package com.capacitor.cors;

import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import okhttp3.*;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "CorsBypass")
public class CorsBypassPlugin extends Plugin {
    private static final String TAG = "CorsBypassPlugin";
    private final Map<String, SSEConnection> sseConnections = new HashMap<>();
    private final Map<String, Call> streamRequests = new HashMap<>();
    private final Map<String, StreamableHTTPTransport> mcpConnections = new HashMap<>();
    private int connectionCounter = 0;
    private int streamCounter = 0;
    private int mcpConnectionCounter = 0;
    private OkHttpClient httpClient;
    private PluginInterceptor pluginInterceptor;
    private CacheManager cacheManager;
    private CacheInterceptor cacheInterceptor;
    private ProxyManager proxyManager;

    @Override
    public void load() {
        super.load();

        // Initialize plugin interceptor
        pluginInterceptor = new PluginInterceptor(this);

        // Initialize cache manager
        cacheManager = new CacheManager(
            getContext(),
            50 * 1024 * 1024, // 50MB
            CacheManager.CacheEvictionPolicy.LRU
        );

        // Initialize cache interceptor
        cacheInterceptor = new CacheInterceptor(
            cacheManager,
            CacheInterceptor.CacheStrategy.NETWORK_FIRST,
            5 * 60 * 1000, // 5 minutes
            false // Disabled by default, enable via plugin method
        );

        // Initialize proxy manager
        proxyManager = new ProxyManager();

        // Initialize HTTP client with HTTP/2 support
        httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .retryOnConnectionFailure(true)
            
            // Connection pool for connection reuse
            .connectionPool(new ConnectionPool(5, 5, TimeUnit.MINUTES))
            
            // Protocol configuration - HTTP/2 support
            .protocols(Arrays.asList(
                Protocol.HTTP_2,      // HTTP/2
                Protocol.HTTP_1_1     // HTTP/1.1 fallback
            ))
            
            // Connection specs for TLS configuration
            .connectionSpecs(Arrays.asList(
                ConnectionSpec.MODERN_TLS,
                ConnectionSpec.COMPATIBLE_TLS,
                ConnectionSpec.CLEARTEXT
            ))
            
            // HTTP/2 ping interval for connection health check
            .pingInterval(10, TimeUnit.SECONDS)
            
            // Add cache interceptor
            .addInterceptor(cacheInterceptor)
            
            // Add plugin interceptor
            .addInterceptor(pluginInterceptor)
            
            // Add logging interceptor for debugging
            .addInterceptor(new okhttp3.logging.HttpLoggingInterceptor(new okhttp3.logging.HttpLoggingInterceptor.Logger() {
                @Override
                public void log(String message) {
                    Log.d(TAG, "HTTP: " + message);
                }
            }).setLevel(okhttp3.logging.HttpLoggingInterceptor.Level.BASIC))
            
            .build();
            
        Log.i(TAG, "HTTP client initialized with HTTP/2 support");
    }

    @PluginMethod
    public void request(PluginCall call) {
        makeHttpRequest(call, call.getString("method", "GET"));
    }

    @PluginMethod
    public void get(PluginCall call) {
        makeHttpRequest(call, "GET");
    }

    @PluginMethod
    public void post(PluginCall call) {
        makeHttpRequest(call, "POST");
    }

    @PluginMethod
    public void put(PluginCall call) {
        makeHttpRequest(call, "PUT");
    }

    @PluginMethod
    public void patch(PluginCall call) {
        makeHttpRequest(call, "PATCH");
    }

    @PluginMethod
    public void delete(PluginCall call) {
        makeHttpRequest(call, "DELETE");
    }

    private void makeHttpRequest(PluginCall call, String method) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("URL is required");
            return;
        }

        JSObject headers = call.getObject("headers", new JSObject());
        JSObject params = call.getObject("params", new JSObject());
        Object data = call.getData().opt("data");
        double timeout = call.getDouble("timeout", 30.0);
        String responseType = call.getString("responseType", "json");
        boolean withCredentials = call.getBoolean("withCredentials", false);
        JSObject proxyConfig = call.getObject("proxy", null);

        try {
            // Build URL with parameters
            HttpUrl.Builder urlBuilder = HttpUrl.parse(url).newBuilder();
            Iterator<String> paramKeys = params.keys();
            while (paramKeys.hasNext()) {
                String key = paramKeys.next();
                urlBuilder.addQueryParameter(key, params.getString(key));
            }
            HttpUrl requestUrl = urlBuilder.build();

            // Build request
            Request.Builder requestBuilder = new Request.Builder().url(requestUrl);

            // Add headers
            Iterator<String> headerKeys = headers.keys();
            while (headerKeys.hasNext()) {
                String key = headerKeys.next();
                requestBuilder.addHeader(key, headers.getString(key));
            }

            // Add body for non-GET requests
            RequestBody body = null;
            if (!method.equals("GET") && data != null) {
                // 强制手动设置 Content-Type（避免 OkHttp 自动添加 charset=utf-8）
                if (!headers.has("Content-Type")) {
                    requestBuilder.header("Content-Type", "application/json");
                }
                
                // 使用 null MediaType 创建 RequestBody，避免 OkHttp 自动添加 charset
                String bodyString = (data instanceof JSONObject) ? data.toString() : (String) data;
                body = RequestBody.create(null, bodyString.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            }

            requestBuilder.method(method, body);
            Request request = requestBuilder.build();

            // Configure client with timeout and proxy
            OkHttpClient.Builder clientBuilder = httpClient.newBuilder()
                .connectTimeout((long) timeout, TimeUnit.SECONDS)
                .readTimeout((long) timeout, TimeUnit.SECONDS)
                .writeTimeout((long) timeout, TimeUnit.SECONDS);
            
            // Apply proxy configuration
            proxyManager.applyToClientBuilder(clientBuilder, url, proxyConfig);
            
            OkHttpClient client = clientBuilder.build();

            // Execute request
            Log.d(TAG, "Making request to: " + requestUrl.toString());
            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call httpCall, IOException e) {
                    Log.e(TAG, "Request failed: " + e.getMessage(), e);
                    call.reject("Request failed: " + e.getMessage());
                }

                @Override
                public void onResponse(Call httpCall, Response response) throws IOException {
                    // Get protocol version
                    String protocolVersion = response.protocol().toString();
                    Log.d(TAG, "Response received: " + response.code() + " " + response.message() + " (Protocol: " + protocolVersion + ")");
                    
                    try {
                        // Parse response headers
                        JSObject responseHeaders = new JSObject();
                        for (String name : response.headers().names()) {
                            responseHeaders.put(name, response.header(name));
                        }

                        // Parse response body
                        Object responseData = "";
                        if (response.body() != null) {
                            String bodyString = response.body().string();
                            Log.d(TAG, "Response body length: " + bodyString.length());

                            switch (responseType) {
                                case "text":
                                    responseData = bodyString;
                                    break;
                                case "json":
                                    try {
                                        responseData = new JSONObject(bodyString);
                                    } catch (JSONException e) {
                                        Log.w(TAG, "Failed to parse JSON, returning as text", e);
                                        responseData = bodyString;
                                    }
                                    break;
                                case "blob":
                                case "arraybuffer":
                                    // Convert to base64 for transfer
                                    responseData = android.util.Base64.encodeToString(
                                        bodyString.getBytes(), android.util.Base64.DEFAULT);
                                    break;
                                default:
                                    try {
                                        responseData = new JSONObject(bodyString);
                                    } catch (JSONException e) {
                                        responseData = bodyString;
                                    }
                                    break;
                            }
                        }

                        JSObject result = new JSObject();
                        result.put("data", responseData);
                        result.put("status", response.code());
                        result.put("statusText", response.message());
                        result.put("headers", responseHeaders);
                        result.put("url", response.request().url().toString());
                        result.put("protocolVersion", protocolVersion);

                        Log.d(TAG, "Request completed successfully with " + protocolVersion);
                        call.resolve(result);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to parse response", e);
                        call.reject("Failed to parse response: " + e.getMessage());
                    } finally {
                        if (response.body() != null) {
                            response.body().close();
                        }
                    }
                }
            });

        } catch (Exception e) {
            call.reject("Failed to create request: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startSSE(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("URL is required");
            return;
        }

        connectionCounter++;
        String connectionId = "sse_" + connectionCounter;

        JSObject headers = call.getObject("headers", new JSObject());
        boolean withCredentials = call.getBoolean("withCredentials", false);
        double reconnectTimeout = call.getDouble("reconnectTimeout", 3.0);

        try {
            SSEConnection sseConnection = new SSEConnection(
                url, headers, withCredentials, reconnectTimeout, this, connectionId, httpClient
            );
            
            sseConnections.put(connectionId, sseConnection);
            sseConnection.connect();

            JSObject result = new JSObject();
            result.put("connectionId", connectionId);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to start SSE connection: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopSSE(PluginCall call) {
        String connectionId = call.getString("connectionId");
        if (connectionId == null) {
            call.reject("Connection ID is required");
            return;
        }

        SSEConnection connection = sseConnections.get(connectionId);
        if (connection != null) {
            connection.disconnect();
            sseConnections.remove(connectionId);
        }

        call.resolve();
    }

    // ==================== Cache Management Methods ====================

    @PluginMethod
    public void enableCache(PluginCall call) {
        String strategy = call.getString("strategy", "NETWORK_FIRST");
        long maxAge = call.getLong("maxAge", 5 * 60 * 1000L);
        
        CacheInterceptor.CacheStrategy cacheStrategy;
        try {
            cacheStrategy = CacheInterceptor.CacheStrategy.valueOf(strategy);
        } catch (IllegalArgumentException e) {
            cacheStrategy = CacheInterceptor.CacheStrategy.NETWORK_FIRST;
        }
        
        // Recreate cache interceptor with new settings
        cacheInterceptor = new CacheInterceptor(
            cacheManager,
            cacheStrategy,
            maxAge,
            true
        );
        
        // Rebuild HTTP client with new cache interceptor
        rebuildHttpClient();
        
        JSObject result = new JSObject();
        result.put("enabled", true);
        result.put("strategy", cacheStrategy.toString());
        result.put("maxAge", maxAge);
        call.resolve(result);
    }

    @PluginMethod
    public void disableCache(PluginCall call) {
        cacheInterceptor = new CacheInterceptor(
            cacheManager,
            CacheInterceptor.CacheStrategy.NETWORK_ONLY,
            0,
            false
        );
        
        rebuildHttpClient();
        
        JSObject result = new JSObject();
        result.put("enabled", false);
        call.resolve(result);
    }

    @PluginMethod
    public void getCacheStats(PluginCall call) {
        CacheManager.CacheStats stats = cacheManager.getStats();
        call.resolve(stats.toJSObject());
    }

    @PluginMethod
    public void clearCache(PluginCall call) {
        cacheManager.clear();
        
        JSObject result = new JSObject();
        result.put("cleared", true);
        call.resolve(result);
    }

    @PluginMethod
    public void cleanupCache(PluginCall call) {
        int cleaned = cacheManager.cleanup();
        
        JSObject result = new JSObject();
        result.put("cleaned", cleaned);
        call.resolve(result);
    }

    @PluginMethod
    public void getCacheKeys(PluginCall call) {
        List<String> keys = cacheManager.keys();
        
        JSArray keysArray = new JSArray();
        for (String key : keys) {
            keysArray.put(key);
        }
        
        JSObject result = new JSObject();
        result.put("keys", keysArray);
        call.resolve(result);
    }

    @PluginMethod
    public void deleteCacheEntry(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("Key is required");
            return;
        }
        
        boolean deleted = cacheManager.delete(key);
        
        JSObject result = new JSObject();
        result.put("deleted", deleted);
        call.resolve(result);
    }

    private void rebuildHttpClient() {
        OkHttpClient.Builder builder = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .retryOnConnectionFailure(true)
            .connectionPool(new ConnectionPool(5, 5, TimeUnit.MINUTES))
            .protocols(Arrays.asList(Protocol.HTTP_2, Protocol.HTTP_1_1))
            .connectionSpecs(Arrays.asList(
                ConnectionSpec.MODERN_TLS,
                ConnectionSpec.COMPATIBLE_TLS,
                ConnectionSpec.CLEARTEXT
            ))
            .pingInterval(10, TimeUnit.SECONDS)
            .addInterceptor(cacheInterceptor)
            .addInterceptor(pluginInterceptor)
            .addInterceptor(new okhttp3.logging.HttpLoggingInterceptor(new okhttp3.logging.HttpLoggingInterceptor.Logger() {
                @Override
                public void log(String message) {
                    Log.d(TAG, "HTTP: " + message);
                }
            }).setLevel(okhttp3.logging.HttpLoggingInterceptor.Level.BASIC));
        
        // Apply global proxy if configured
        if (proxyManager != null) {
            proxyManager.applyToClientBuilder(builder);
        }
        
        httpClient = builder.build();
    }

    @PluginMethod
    public void streamRequest(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("URL is required");
            return;
        }

        streamCounter++;
        String streamId = "stream_" + streamCounter;

        String method = call.getString("method", "POST");
        JSObject headers = call.getObject("headers", new JSObject());
        JSObject params = call.getObject("params", new JSObject());
        Object data = call.getData().opt("data");
        double timeout = call.getDouble("timeout", 60.0);

        try {
            // Build URL with parameters
            HttpUrl.Builder urlBuilder = HttpUrl.parse(url).newBuilder();
            Iterator<String> paramKeys = params.keys();
            while (paramKeys.hasNext()) {
                String key = paramKeys.next();
                urlBuilder.addQueryParameter(key, params.getString(key));
            }
            HttpUrl requestUrl = urlBuilder.build();

            // Build request
            Request.Builder requestBuilder = new Request.Builder().url(requestUrl);

            // Add headers
            requestBuilder.addHeader("Accept", "text/event-stream, application/json, text/plain, */*");
            Iterator<String> headerKeys = headers.keys();
            while (headerKeys.hasNext()) {
                String key = headerKeys.next();
                requestBuilder.addHeader(key, headers.getString(key));
            }

            // Add body for non-GET requests
            RequestBody body = null;
            if (!method.equals("GET") && data != null) {
                // 强制手动设置 Content-Type（避免 OkHttp 自动添加 charset=utf-8）
                if (!headers.has("Content-Type")) {
                    requestBuilder.header("Content-Type", "application/json");
                }
                
                // 使用 null MediaType 创建 RequestBody，避免 OkHttp 自动添加 charset
                String bodyString = (data instanceof JSONObject) ? data.toString() : (String) data;
                body = RequestBody.create(null, bodyString.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            }

            requestBuilder.method(method, body);
            Request request = requestBuilder.build();

            // Configure client with timeout
            OkHttpClient client = httpClient.newBuilder()
                .connectTimeout((long) timeout, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.SECONDS)  // No timeout for streaming
                .writeTimeout((long) timeout, TimeUnit.SECONDS)
                .build();

            // Execute streaming request
            Log.d(TAG, "Starting stream request: " + streamId + " to " + requestUrl.toString());
            
            Call streamCall = client.newCall(request);
            streamRequests.put(streamId, streamCall);

            streamCall.enqueue(new Callback() {
                @Override
                public void onFailure(Call httpCall, IOException e) {
                    Log.e(TAG, "Stream request failed: " + e.getMessage(), e);
                    streamRequests.remove(streamId);
                    
                    JSObject errorData = new JSObject();
                    errorData.put("streamId", streamId);
                    errorData.put("data", "");
                    errorData.put("done", true);
                    errorData.put("error", e.getMessage());
                    notifyListeners("streamChunk", errorData);
                    
                    JSObject statusData = new JSObject();
                    statusData.put("streamId", streamId);
                    statusData.put("status", "error");
                    statusData.put("error", e.getMessage());
                    notifyListeners("streamStatus", statusData);
                }

                @Override
                public void onResponse(Call httpCall, Response response) throws IOException {
                    try {
                        // Parse response headers
                        JSObject responseHeaders = new JSObject();
                        for (String name : response.headers().names()) {
                            responseHeaders.put(name, response.header(name));
                        }

                        // Notify stream started
                        JSObject statusData = new JSObject();
                        statusData.put("streamId", streamId);
                        statusData.put("status", "started");
                        statusData.put("statusCode", response.code());
                        statusData.put("headers", responseHeaders);
                        notifyListeners("streamStatus", statusData);

                        if (!response.isSuccessful()) {
                            throw new IOException("HTTP " + response.code() + ": " + response.message());
                        }

                        // Read stream in chunks
                        if (response.body() != null) {
                            InputStream inputStream = response.body().byteStream();
                            byte[] buffer = new byte[8192];
                            int bytesRead;

                            while ((bytesRead = inputStream.read(buffer)) != -1) {
                                String chunk = new String(buffer, 0, bytesRead, "UTF-8");
                                
                                JSObject chunkData = new JSObject();
                                chunkData.put("streamId", streamId);
                                chunkData.put("data", chunk);
                                chunkData.put("done", false);
                                notifyListeners("streamChunk", chunkData);
                            }

                            // Stream completed
                            JSObject finalChunk = new JSObject();
                            finalChunk.put("streamId", streamId);
                            finalChunk.put("data", "");
                            finalChunk.put("done", true);
                            notifyListeners("streamChunk", finalChunk);

                            JSObject completedStatus = new JSObject();
                            completedStatus.put("streamId", streamId);
                            completedStatus.put("status", "completed");
                            notifyListeners("streamStatus", completedStatus);
                        }

                        streamRequests.remove(streamId);
                        Log.d(TAG, "Stream completed: " + streamId);

                    } catch (Exception e) {
                        Log.e(TAG, "Error processing stream", e);
                        streamRequests.remove(streamId);
                        
                        JSObject errorData = new JSObject();
                        errorData.put("streamId", streamId);
                        errorData.put("data", "");
                        errorData.put("done", true);
                        errorData.put("error", e.getMessage());
                        notifyListeners("streamChunk", errorData);
                        
                        JSObject statusData = new JSObject();
                        statusData.put("streamId", streamId);
                        statusData.put("status", "error");
                        statusData.put("error", e.getMessage());
                        notifyListeners("streamStatus", statusData);
                    } finally {
                        if (response.body() != null) {
                            response.body().close();
                        }
                    }
                }
            });

            JSObject result = new JSObject();
            result.put("streamId", streamId);
            call.resolve(result);

        } catch (Exception e) {
            streamRequests.remove(streamId);
            call.reject("Failed to start stream request: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelStream(PluginCall call) {
        String streamId = call.getString("streamId");
        if (streamId == null) {
            call.reject("Stream ID is required");
            return;
        }

        Call streamCall = streamRequests.get(streamId);
        if (streamCall != null) {
            streamCall.cancel();
            streamRequests.remove(streamId);
            
            JSObject statusData = new JSObject();
            statusData.put("streamId", streamId);
            statusData.put("status", "cancelled");
            notifyListeners("streamStatus", statusData);
        }

        call.resolve();
    }

    // SSE event handlers
    public void notifySSEOpen(String connectionId) {
        JSObject data = new JSObject();
        data.put("connectionId", connectionId);
        data.put("status", "connected");
        notifyListeners("sseOpen", data);
    }

    public void notifySSEMessage(String connectionId, String messageData, String id, String type) {
        JSObject data = new JSObject();
        data.put("connectionId", connectionId);
        data.put("data", messageData);
        
        if (id != null) {
            data.put("id", id);
        }
        
        if (type != null) {
            data.put("type", type);
        }
        
        notifyListeners("sseMessage", data);
    }

    public void notifySSEError(String connectionId, String error) {
        JSObject data = new JSObject();
        data.put("connectionId", connectionId);
        data.put("error", error);
        notifyListeners("sseError", data);
    }
    // ==================== Interceptor Management ====================

    @PluginMethod
    public void addInterceptor(PluginCall call) {
        JSObject options = call.getObject("options", new JSObject());
        
        try {
            String id = pluginInterceptor.addInterceptor(options);
            
            JSObject result = new JSObject();
            result.put("id", id);
            result.put("name", options.optString("name", null));
            
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to add interceptor: " + e.getMessage());
        }
    }

    @PluginMethod
    public void removeInterceptor(PluginCall call) {
        String id = call.getString("handle");
        if (id == null) {
            // Try to get id from handle object
            JSObject handle = call.getObject("handle");
            if (handle != null) {
                id = handle.getString("id");
            }
        }
        
        if (id == null) {
            call.reject("Interceptor ID is required");
            return;
        }
        
        boolean removed = pluginInterceptor.removeInterceptor(id);
        if (removed) {
            call.resolve();
        } else {
            call.reject("Interceptor not found");
        }
    }

    @PluginMethod
    public void removeAllInterceptors(PluginCall call) {
        pluginInterceptor.removeAllInterceptors();
        call.resolve();
    }

    @PluginMethod
    public void getInterceptors(PluginCall call) {
        JSArray interceptors = pluginInterceptor.getAllInterceptors();
        JSObject result = new JSObject();
        result.put("interceptors", interceptors);
        call.resolve(result);
    }
    
    public void notifySSEClose(String connectionId) {
        JSObject data = new JSObject();
        data.put("connectionId", connectionId);
        data.put("status", "disconnected");
        notifyListeners("sseClose", data);
    }

    // ==================== MCP Client Methods ====================
    
    @PluginMethod
    public void createMCPClient(PluginCall call) {
        String url = call.getString("url");
        String transport = call.getString("transport", "streamablehttp");
        
        // Backward compatibility: check for legacy sseUrl/postUrl
        if (url == null) {
            url = call.getString("sseUrl");
            if (url != null) {
                transport = "sse";
            }
        }
        
        if (url == null) {
            call.reject("URL is required");
            return;
        }
        
        mcpConnectionCounter++;
        String connectionId = "mcp_" + mcpConnectionCounter;
        
        try {
            if ("streamablehttp".equals(transport)) {
                // Use StreamableHTTP transport
                boolean resumable = call.getBoolean("resumable", false);
                String sessionId = call.getString("sessionId");
                Long lastSequence = call.getLong("lastSequence", 0L);
                
                StreamableHTTPTransport mcpTransport = new StreamableHTTPTransport(
                    url,
                    httpClient,
                    new StreamableHTTPTransport.StreamableHTTPCallback() {
                        @Override
                        public void onMessage(JSONObject message) {
                            JSObject data = new JSObject();
                            data.put("connectionId", connectionId);
                            try {
                                data.put("message", new JSObject(message.toString()));
                            } catch (JSONException e) {
                                Log.e(TAG, "Error converting message", e);
                            }
                            notifyListeners("mcpMessage", data);
                        }
                        
                        @Override
                        public void onError(String error) {
                            JSObject data = new JSObject();
                            data.put("connectionId", connectionId);
                            data.put("error", error);
                            notifyListeners("mcpError", data);
                        }
                        
                        @Override
                        public void onConnectionStateChange(String state) {
                            JSObject data = new JSObject();
                            data.put("connectionId", connectionId);
                            data.put("state", state);
                            notifyListeners("mcpStateChange", data);
                        }
                    },
                    resumable
                );
                
                mcpConnections.put(connectionId, mcpTransport);
                
                // Send initialize request
                JSONObject initRequest = new JSONObject();
                initRequest.put("jsonrpc", "2.0");
                initRequest.put("id", 1);
                initRequest.put("method", "initialize");
                
                JSONObject params = new JSONObject();
                params.put("protocolVersion", call.getString("protocolVersion", "2025-03-26"));
                
                JSObject clientInfo = call.getObject("clientInfo");
                if (clientInfo != null) {
                    JSONObject clientInfoJson = new JSONObject();
                    clientInfoJson.put("name", clientInfo.getString("name", "CapacitorMCPClient"));
                    clientInfoJson.put("version", clientInfo.getString("version", "1.0.0"));
                    params.put("clientInfo", clientInfoJson);
                }
                
                JSObject capabilities = call.getObject("capabilities");
                if (capabilities != null) {
                    params.put("capabilities", new JSONObject(capabilities.toString()));
                }
                
                initRequest.put("params", params);
                
                // Send initialize request and expect stream response
                mcpTransport.sendMessage(initRequest, true);
                
                JSObject result = new JSObject();
                result.put("connectionId", connectionId);
                result.put("transport", "streamablehttp");
                result.put("status", "connecting");
                call.resolve(result);
                
            } else if ("sse".equals(transport)) {
                // Legacy SSE transport
                call.reject("Legacy SSE transport not yet implemented. Use StreamableHTTP instead.");
            } else {
                call.reject("Unsupported transport: " + transport);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to create MCP client", e);
            call.reject("Failed to create MCP client: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void sendMCPMessage(PluginCall call) {
        String connectionId = call.getString("connectionId");
        if (connectionId == null) {
            call.reject("Connection ID is required");
            return;
        }
        
        StreamableHTTPTransport transport = mcpConnections.get(connectionId);
        if (transport == null) {
            call.reject("MCP connection not found");
            return;
        }
        
        try {
            JSObject messageObj = call.getObject("message");
            if (messageObj == null) {
                call.reject("Message is required");
                return;
            }
            
            JSONObject message = new JSONObject(messageObj.toString());
            boolean expectStream = call.getBoolean("expectStream", false);
            
            transport.sendMessage(message, expectStream);
            call.resolve();
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to send MCP message", e);
            call.reject("Failed to send MCP message: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void openMCPListenStream(PluginCall call) {
        String connectionId = call.getString("connectionId");
        if (connectionId == null) {
            call.reject("Connection ID is required");
            return;
        }
        
        StreamableHTTPTransport transport = mcpConnections.get(connectionId);
        if (transport == null) {
            call.reject("MCP connection not found");
            return;
        }
        
        transport.openListenStream();
        call.resolve();
    }
    
    @PluginMethod
    public void closeMCPClient(PluginCall call) {
        String connectionId = call.getString("connectionId");
        if (connectionId == null) {
            call.reject("Connection ID is required");
            return;
        }
        
        StreamableHTTPTransport transport = mcpConnections.get(connectionId);
        if (transport != null) {
            transport.close();
            mcpConnections.remove(connectionId);
        }
        
        call.resolve();
    }
    
    @PluginMethod
    public void getMCPSessionInfo(PluginCall call) {
        String connectionId = call.getString("connectionId");
        if (connectionId == null) {
            call.reject("Connection ID is required");
            return;
        }
        
        StreamableHTTPTransport transport = mcpConnections.get(connectionId);
        if (transport == null) {
            call.reject("MCP connection not found");
            return;
        }
        
        JSObject result = new JSObject();
        result.put("connectionId", connectionId);
        result.put("sessionId", transport.getSessionId());
        result.put("lastSequence", transport.getLastSequence());
        result.put("resumable", transport.isResumable());
        call.resolve(result);
    }

    // ==================== Proxy Management Methods ====================

    @PluginMethod
    public void setGlobalProxy(PluginCall call) {
        try {
            JSObject config = call.getObject("config", call.getData());
            if (config == null) {
                call.reject("Proxy configuration is required");
                return;
            }
            
            proxyManager.setConfig(config);
            
            // Rebuild HTTP client with new proxy settings
            rebuildHttpClient();
            
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to set proxy: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getGlobalProxy(PluginCall call) {
        try {
            JSObject config = proxyManager.getConfig();
            if (config != null) {
                call.resolve(config);
            } else {
                // Return empty result when no proxy is configured
                call.resolve(new JSObject());
            }
        } catch (Exception e) {
            call.reject("Failed to get proxy: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearGlobalProxy(PluginCall call) {
        try {
            proxyManager.clearConfig();
            
            // Rebuild HTTP client without proxy
            rebuildHttpClient();
            
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear proxy: " + e.getMessage());
        }
    }

    @PluginMethod
    public void testProxy(PluginCall call) {
        try {
            JSObject config = call.getObject("config", call.getData());
            if (config == null) {
                call.reject("Proxy configuration is required");
                return;
            }
            
            String testUrl = call.getString("testUrl", "https://www.google.com");
            
            // Run test in background thread
            new Thread(() -> {
                JSObject result = proxyManager.testProxy(config, testUrl);
                
                getActivity().runOnUiThread(() -> {
                    call.resolve(result);
                });
            }).start();
            
        } catch (Exception e) {
            call.reject("Failed to test proxy: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getProxyStatus(PluginCall call) {
        try {
            JSObject status = proxyManager.getStatus();
            call.resolve(status);
        } catch (Exception e) {
            call.reject("Failed to get proxy status: " + e.getMessage());
        }
    }
}
