package com.capacitor.cors;

import android.util.Log;
import com.getcapacitor.JSObject;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.concurrent.TimeUnit;
import okhttp3.*;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * StreamableHTTP Transport for MCP
 * Implements the new single-endpoint transport protocol
 * 
 * @see <a href="https://modelcontextprotocol.io/specification/2025-03-26/basic/transports">MCP Transports</a>
 */
public class StreamableHTTPTransport {
    private static final String TAG = "StreamableHTTPTransport";
    private static final String PROTOCOL_VERSION_HEADER = "Mcp-Protocol-Version";
    private static final String SESSION_ID_HEADER = "Mcp-Session-Id";
    private static final String SEQUENCE_HEADER = "Mcp-Sequence";
    
    private final String endpointUrl;
    private final OkHttpClient httpClient;
    private final StreamableHTTPCallback callback;
    private String sessionId;
    private long lastSequence = 0;
    private boolean resumable;
    private Call currentStreamCall;
    
    public interface StreamableHTTPCallback {
        void onMessage(JSONObject message);
        void onError(String error);
        void onConnectionStateChange(String state);
    }
    
    public StreamableHTTPTransport(String endpointUrl, OkHttpClient httpClient, 
                                   StreamableHTTPCallback callback, boolean resumable) {
        this.endpointUrl = endpointUrl;
        this.httpClient = httpClient;
        this.callback = callback;
        this.resumable = resumable;
    }
    
    /**
     * Send a JSON-RPC message to the server
     * 
     * @param message JSON-RPC request, notification, or response
     * @param expectStream Whether to expect an SSE stream response
     */
    public void sendMessage(JSONObject message, boolean expectStream) {
        try {
            RequestBody body = RequestBody.create(
                MediaType.parse("application/json; charset=utf-8"),
                message.toString()
            );
            
            Request.Builder requestBuilder = new Request.Builder()
                .url(endpointUrl)
                .post(body)
                .addHeader("Content-Type", "application/json")
                .addHeader("Accept", "application/json, text/event-stream")
                .addHeader(PROTOCOL_VERSION_HEADER, "2025-03-26");
            
            // Add session headers for resumability
            if (resumable && sessionId != null) {
                requestBuilder.addHeader(SESSION_ID_HEADER, sessionId);
                requestBuilder.addHeader(SEQUENCE_HEADER, String.valueOf(lastSequence));
            }
            
            Request request = requestBuilder.build();
            
            Log.d(TAG, "Sending message: " + message.toString());
            
            currentStreamCall = httpClient.newCall(request);
            currentStreamCall.enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    Log.e(TAG, "Request failed: " + e.getMessage(), e);
                    callback.onError("Request failed: " + e.getMessage());
                }
                
                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    try {
                        // Extract session ID for resumability
                        String newSessionId = response.header(SESSION_ID_HEADER);
                        if (newSessionId != null) {
                            sessionId = newSessionId;
                        }
                        
                        String contentType = response.header("Content-Type");
                        
                        if (contentType != null && contentType.contains("text/event-stream")) {
                            // Handle SSE stream
                            handleSSEStream(response);
                        } else if (contentType != null && contentType.contains("application/json")) {
                            // Handle single JSON response
                            handleJSONResponse(response);
                        } else if (response.code() == 202) {
                            // Accepted (for notifications/responses)
                            Log.d(TAG, "Message accepted by server");
                            callback.onConnectionStateChange("accepted");
                        } else {
                            // Error response
                            String errorBody = response.body() != null ? response.body().string() : "Unknown error";
                            callback.onError("HTTP " + response.code() + ": " + errorBody);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error processing response", e);
                        callback.onError("Error processing response: " + e.getMessage());
                    } finally {
                        if (response.body() != null) {
                            response.body().close();
                        }
                    }
                }
            });
            
        } catch (Exception e) {
            Log.e(TAG, "Error sending message", e);
            callback.onError("Error sending message: " + e.getMessage());
        }
    }
    
    /**
     * Open a GET stream to listen for server-initiated messages
     */
    public void openListenStream() {
        try {
            Request.Builder requestBuilder = new Request.Builder()
                .url(endpointUrl)
                .get()
                .addHeader("Accept", "text/event-stream")
                .addHeader(PROTOCOL_VERSION_HEADER, "2025-03-26");
            
            // Add session headers for resumability
            if (resumable && sessionId != null) {
                requestBuilder.addHeader(SESSION_ID_HEADER, sessionId);
                requestBuilder.addHeader(SEQUENCE_HEADER, String.valueOf(lastSequence));
            }
            
            Request request = requestBuilder.build();
            
            Log.d(TAG, "Opening listen stream");
            
            currentStreamCall = httpClient.newBuilder()
                .readTimeout(0, TimeUnit.SECONDS) // No timeout for streaming
                .build()
                .newCall(request);
                
            currentStreamCall.enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    Log.e(TAG, "Listen stream failed: " + e.getMessage(), e);
                    callback.onError("Listen stream failed: " + e.getMessage());
                }
                
                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    try {
                        if (response.code() == 405) {
                            // Method Not Allowed - server doesn't support GET streams
                            Log.d(TAG, "Server doesn't support GET streams");
                            callback.onConnectionStateChange("get_not_supported");
                            return;
                        }
                        
                        String contentType = response.header("Content-Type");
                        if (contentType != null && contentType.contains("text/event-stream")) {
                            handleSSEStream(response);
                        } else {
                            callback.onError("Unexpected content type: " + contentType);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error processing listen stream", e);
                        callback.onError("Error processing listen stream: " + e.getMessage());
                    } finally {
                        if (response.body() != null) {
                            response.body().close();
                        }
                    }
                }
            });
            
        } catch (Exception e) {
            Log.e(TAG, "Error opening listen stream", e);
            callback.onError("Error opening listen stream: " + e.getMessage());
        }
    }
    
    /**
     * Handle SSE stream response
     */
    private void handleSSEStream(Response response) throws IOException {
        callback.onConnectionStateChange("streaming");
        
        InputStream inputStream = response.body().byteStream();
        BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, "UTF-8"));
        
        StringBuilder eventData = new StringBuilder();
        String line;
        
        try {
            while ((line = reader.readLine()) != null) {
                if (line.isEmpty()) {
                    // Empty line signals end of event
                    if (eventData.length() > 0) {
                        processSSEEvent(eventData.toString());
                        eventData.setLength(0);
                    }
                    continue;
                }
                
                if (line.startsWith("data: ")) {
                    eventData.append(line.substring(6)).append("\n");
                } else if (line.startsWith("event: ")) {
                    // Event type (optional)
                    Log.d(TAG, "SSE event type: " + line.substring(7));
                } else if (line.startsWith("id: ")) {
                    // Event ID (optional)
                    Log.d(TAG, "SSE event ID: " + line.substring(4));
                } else if (line.startsWith(":")) {
                    // Comment line, ignore
                    continue;
                }
            }
        } catch (IOException e) {
            if (!currentStreamCall.isCanceled()) {
                Log.e(TAG, "Error reading SSE stream", e);
                callback.onError("Error reading SSE stream: " + e.getMessage());
            }
        } finally {
            reader.close();
            callback.onConnectionStateChange("stream_closed");
        }
    }
    
    /**
     * Process an SSE event data
     */
    private void processSSEEvent(String eventData) {
        try {
            // Trim trailing newline
            eventData = eventData.trim();
            
            if (eventData.isEmpty()) {
                return;
            }
            
            // Parse as JSON-RPC message
            JSONObject message = new JSONObject(eventData);
            
            // Update sequence number if present
            if (message.has("_meta") && message.getJSONObject("_meta").has("sequence")) {
                lastSequence = message.getJSONObject("_meta").getLong("sequence");
            }
            
            Log.d(TAG, "Received SSE message: " + message.toString());
            callback.onMessage(message);
            
        } catch (JSONException e) {
            Log.e(TAG, "Failed to parse SSE event data: " + eventData, e);
            callback.onError("Failed to parse SSE event: " + e.getMessage());
        }
    }
    
    /**
     * Handle single JSON response
     */
    private void handleJSONResponse(Response response) throws IOException {
        String bodyString = response.body().string();
        
        try {
            JSONObject message = new JSONObject(bodyString);
            
            // Update sequence number if present
            if (message.has("_meta") && message.getJSONObject("_meta").has("sequence")) {
                lastSequence = message.getJSONObject("_meta").getLong("sequence");
            }
            
            Log.d(TAG, "Received JSON message: " + message.toString());
            callback.onMessage(message);
            
        } catch (JSONException e) {
            Log.e(TAG, "Failed to parse JSON response: " + bodyString, e);
            callback.onError("Failed to parse JSON response: " + e.getMessage());
        }
    }
    
    /**
     * Close the transport and cancel any active streams
     */
    public void close() {
        if (currentStreamCall != null && !currentStreamCall.isCanceled()) {
            currentStreamCall.cancel();
        }
        callback.onConnectionStateChange("closed");
    }
    
    /**
     * Get the current session ID
     */
    public String getSessionId() {
        return sessionId;
    }
    
    /**
     * Get the last sequence number
     */
    public long getLastSequence() {
        return lastSequence;
    }
    
    /**
     * Check if transport is resumable
     */
    public boolean isResumable() {
        return resumable;
    }
}
