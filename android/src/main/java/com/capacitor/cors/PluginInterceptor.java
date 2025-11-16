package com.capacitor.cors;

import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;

/**
 * Plugin Interceptor Manager
 * Manages custom interceptors for HTTP requests
 */
public class PluginInterceptor implements Interceptor {
    private static final String TAG = "PluginInterceptor";
    
    private final List<InterceptorEntry> interceptors = Collections.synchronizedList(new ArrayList<>());
    private final AtomicInteger interceptorCounter = new AtomicInteger(0);
    private final CorsBypassPlugin plugin;

    public PluginInterceptor(CorsBypassPlugin plugin) {
        this.plugin = plugin;
    }

    /**
     * Interceptor Entry
     */
    public static class InterceptorEntry {
        public String id;
        public String name;
        public int priority;
        public boolean enabled;
        public InterceptorScope scope;
        
        public InterceptorEntry(String id, String name, int priority, boolean enabled, InterceptorScope scope) {
            this.id = id;
            this.name = name;
            this.priority = priority;
            this.enabled = enabled;
            this.scope = scope;
        }
    }

    /**
     * Interceptor Scope
     */
    public static class InterceptorScope {
        public String urlPattern;
        public List<String> methods;
        
        public InterceptorScope(String urlPattern, List<String> methods) {
            this.urlPattern = urlPattern;
            this.methods = methods;
        }
        
        public boolean matches(String url, String method) {
            // Check URL pattern
            if (urlPattern != null && !url.matches(urlPattern)) {
                return false;
            }
            
            // Check method
            if (methods != null && !methods.isEmpty() && !methods.contains(method)) {
                return false;
            }
            
            return true;
        }
    }

    /**
     * Add interceptor
     */
    public String addInterceptor(JSObject options) {
        String id = "interceptor_" + interceptorCounter.incrementAndGet();
        String name = options.optString("name", null);
        int priority = options.optInt("priority", 0);
        boolean enabled = options.optBoolean("enabled", true);
        
        // Parse scope
        InterceptorScope scope = null;
        if (options.has("scope")) {
            try {
                Object scopeValue = options.get("scope");
                if (scopeValue instanceof org.json.JSONObject) {
                    org.json.JSONObject scopeJson = (org.json.JSONObject) scopeValue;
                    String urlPattern = scopeJson.has("urlPattern") ? scopeJson.getString("urlPattern") : null;
                    List<String> methods = null;
                    
                    if (scopeJson.has("methods")) {
                        org.json.JSONArray methodsArray = scopeJson.getJSONArray("methods");
                        if (methodsArray != null) {
                            methods = new ArrayList<>();
                            for (int i = 0; i < methodsArray.length(); i++) {
                                methods.add(methodsArray.getString(i));
                            }
                        }
                    }
                    
                    scope = new InterceptorScope(urlPattern, methods);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error parsing scope", e);
            }
        }
        
        InterceptorEntry entry = new InterceptorEntry(id, name, priority, enabled, scope);
        interceptors.add(entry);
        
        // Sort by priority (higher first)
        Collections.sort(interceptors, new Comparator<InterceptorEntry>() {
            @Override
            public int compare(InterceptorEntry a, InterceptorEntry b) {
                return Integer.compare(b.priority, a.priority);
            }
        });
        
        Log.d(TAG, "Added interceptor: " + id + " (priority: " + priority + ")");
        return id;
    }

    /**
     * Remove interceptor
     */
    public boolean removeInterceptor(String id) {
        synchronized (interceptors) {
            for (int i = 0; i < interceptors.size(); i++) {
                if (interceptors.get(i).id.equals(id)) {
                    interceptors.remove(i);
                    Log.d(TAG, "Removed interceptor: " + id);
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Remove all interceptors
     */
    public void removeAllInterceptors() {
        synchronized (interceptors) {
            interceptors.clear();
            Log.d(TAG, "Removed all interceptors");
        }
    }

    /**
     * Get all interceptors
     */
    public JSArray getAllInterceptors() {
        JSArray result = new JSArray();
        synchronized (interceptors) {
            for (InterceptorEntry entry : interceptors) {
                JSObject obj = new JSObject();
                obj.put("id", entry.id);
                if (entry.name != null) {
                    obj.put("name", entry.name);
                }
                obj.put("enabled", entry.enabled);
                result.put(obj);
            }
        }
        return result;
    }

    /**
     * Enable/disable interceptor
     */
    public boolean setInterceptorEnabled(String id, boolean enabled) {
        synchronized (interceptors) {
            for (InterceptorEntry entry : interceptors) {
                if (entry.id.equals(id)) {
                    entry.enabled = enabled;
                    Log.d(TAG, (enabled ? "Enabled" : "Disabled") + " interceptor: " + id);
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * OkHttp Interceptor implementation
     */
    @Override
    public Response intercept(Chain chain) throws IOException {
        Request originalRequest = chain.request();
        
        // Create request context
        JSObject requestConfig = new JSObject();
        requestConfig.put("url", originalRequest.url().toString());
        requestConfig.put("method", originalRequest.method());
        
        // Convert headers
        JSObject headers = new JSObject();
        for (String name : originalRequest.headers().names()) {
            headers.put(name, originalRequest.header(name));
        }
        requestConfig.put("headers", headers);
        
        // Execute request interceptors
        JSObject modifiedConfig = executeRequestInterceptors(requestConfig);
        
        // Build modified request if needed
        Request request = originalRequest;
        if (modifiedConfig != null && !modifiedConfig.toString().equals(requestConfig.toString())) {
            Request.Builder builder = originalRequest.newBuilder();
            
            // Update headers
            if (modifiedConfig.has("headers")) {
                try {
                    Object headersValue = modifiedConfig.get("headers");
                    if (headersValue instanceof org.json.JSONObject) {
                        org.json.JSONObject modifiedHeaders = (org.json.JSONObject) headersValue;
                        // Clear existing headers and add modified ones
                        Iterator<String> keys = modifiedHeaders.keys();
                        while (keys.hasNext()) {
                            String key = keys.next();
                            builder.header(key, modifiedHeaders.getString(key));
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error updating headers", e);
                }
            }
            
            request = builder.build();
        }
        
        // Execute request
        Response response;
        try {
            response = chain.proceed(request);
            
            // Execute response interceptors
            JSObject responseData = new JSObject();
            responseData.put("status", response.code());
            responseData.put("statusText", response.message());
            responseData.put("url", response.request().url().toString());
            
            // Convert response headers
            JSObject responseHeaders = new JSObject();
            for (String name : response.headers().names()) {
                responseHeaders.put(name, response.header(name));
            }
            responseData.put("headers", responseHeaders);
            
            JSObject modifiedResponse = executeResponseInterceptors(responseData);
            
            // Note: We can't easily modify the response body in OkHttp interceptor
            // So we just log the interceptor execution
            if (modifiedResponse != null) {
                Log.d(TAG, "Response interceptors executed");
            }
            
            return response;
            
        } catch (IOException e) {
            // Execute error interceptors
            JSObject error = new JSObject();
            error.put("message", e.getMessage());
            error.put("config", requestConfig);
            
            JSObject handledResponse = executeErrorInterceptors(error);
            
            if (handledResponse != null) {
                Log.d(TAG, "Error handled by interceptor");
                // Note: Can't easily create a Response from JSObject in interceptor
                // This would need to be handled at a higher level
            }
            
            throw e;
        }
    }

    /**
     * Execute request interceptors
     */
    private JSObject executeRequestInterceptors(JSObject config) {
        JSObject modifiedConfig = config;
        
        synchronized (interceptors) {
            for (InterceptorEntry entry : interceptors) {
                if (!entry.enabled) {
                    continue;
                }
                
                // Check scope
                if (entry.scope != null) {
                    String url = config.optString("url", "");
                    String method = config.optString("method", "");
                    if (!entry.scope.matches(url, method)) {
                        continue;
                    }
                }
                
                // Notify plugin to execute JS interceptor
                JSObject event = new JSObject();
                event.put("type", "onRequest");
                event.put("interceptorId", entry.id);
                event.put("config", modifiedConfig);
                
                // Note: This is a simplified version
                // In a real implementation, we would need to wait for JS response
                Log.d(TAG, "Request interceptor: " + entry.id);
            }
        }
        
        return modifiedConfig;
    }

    /**
     * Execute response interceptors
     */
    private JSObject executeResponseInterceptors(JSObject response) {
        JSObject modifiedResponse = response;
        
        synchronized (interceptors) {
            for (InterceptorEntry entry : interceptors) {
                if (!entry.enabled) {
                    continue;
                }
                
                // Notify plugin to execute JS interceptor
                JSObject event = new JSObject();
                event.put("type", "onResponse");
                event.put("interceptorId", entry.id);
                event.put("response", modifiedResponse);
                
                Log.d(TAG, "Response interceptor: " + entry.id);
            }
        }
        
        return modifiedResponse;
    }

    /**
     * Execute error interceptors
     */
    private JSObject executeErrorInterceptors(JSObject error) {
        synchronized (interceptors) {
            for (InterceptorEntry entry : interceptors) {
                if (!entry.enabled) {
                    continue;
                }
                
                // Notify plugin to execute JS interceptor
                JSObject event = new JSObject();
                event.put("type", "onError");
                event.put("interceptorId", entry.id);
                event.put("error", error);
                
                Log.d(TAG, "Error interceptor: " + entry.id);
            }
        }
        
        return null;
    }
}