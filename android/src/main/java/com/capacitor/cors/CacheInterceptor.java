package com.capacitor.cors;

import android.util.Log;
import com.getcapacitor.JSObject;
import org.json.JSONException;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * Cache Interceptor for OkHttp
 * OkHttp 缓存拦截器
 */
public class CacheInterceptor implements Interceptor {
    private static final String TAG = "CacheInterceptor";
    
    private final CacheManager cacheManager;
    private final CacheStrategy strategy;
    private final long maxAge;
    private final boolean enabled;
    
    /**
     * Cache Strategy
     */
    public enum CacheStrategy {
        NETWORK_FIRST,
        CACHE_FIRST,
        NETWORK_ONLY,
        CACHE_ONLY,
        STALE_WHILE_REVALIDATE
    }
    
    /**
     * Constructor
     */
    public CacheInterceptor(CacheManager cacheManager, CacheStrategy strategy, 
                           long maxAge, boolean enabled) {
        this.cacheManager = cacheManager;
        this.strategy = strategy != null ? strategy : CacheStrategy.NETWORK_FIRST;
        this.maxAge = maxAge;
        this.enabled = enabled;
        
        Log.i(TAG, "CacheInterceptor initialized with strategy: " + this.strategy);
    }
    
    @Override
    public Response intercept(Chain chain) throws IOException {
        if (!enabled) {
            return chain.proceed(chain.request());
        }
        
        Request request = chain.request();
        String cacheKey = generateCacheKey(request);
        
        // Check if should exclude this request
        if (shouldExclude(request)) {
            return chain.proceed(request);
        }
        
        switch (strategy) {
            case CACHE_FIRST:
            case CACHE_ONLY:
                return handleCacheFirst(chain, request, cacheKey);
                
            case NETWORK_ONLY:
                return handleNetworkOnly(chain, request);
                
            case STALE_WHILE_REVALIDATE:
                return handleStaleWhileRevalidate(chain, request, cacheKey);
                
            case NETWORK_FIRST:
            default:
                return handleNetworkFirst(chain, request, cacheKey);
        }
    }
    
    /**
     * Network-First Strategy
     */
    private Response handleNetworkFirst(Chain chain, Request request, String cacheKey) 
            throws IOException {
        try {
            // Try network first
            Response response = chain.proceed(request);
            
            // Cache successful responses
            if (response.isSuccessful()) {
                cacheResponse(cacheKey, request, response);
            }
            
            return response;
        } catch (IOException e) {
            // Network failed, try cache
            Log.w(TAG, "Network failed, trying cache: " + e.getMessage());
            CacheManager.CacheEntry cached = cacheManager.get(cacheKey);
            
            if (cached != null) {
                Log.i(TAG, "Using cached response for: " + cacheKey);
                return createResponseFromCache(request, cached);
            }
            
            throw e;
        }
    }
    
    /**
     * Cache-First Strategy
     */
    private Response handleCacheFirst(Chain chain, Request request, String cacheKey) 
            throws IOException {
        // Check cache first
        CacheManager.CacheEntry cached = cacheManager.get(cacheKey);
        
        if (cached != null) {
            Log.i(TAG, "Cache hit for: " + cacheKey);
            return createResponseFromCache(request, cached);
        }
        
        // Cache miss
        if (strategy == CacheStrategy.CACHE_ONLY) {
            throw new IOException("Cache miss in cache-only mode");
        }
        
        // Fetch from network
        Response response = chain.proceed(request);
        
        if (response.isSuccessful()) {
            cacheResponse(cacheKey, request, response);
        }
        
        return response;
    }
    
    /**
     * Network-Only Strategy
     */
    private Response handleNetworkOnly(Chain chain, Request request) throws IOException {
        return chain.proceed(request);
    }
    
    /**
     * Stale-While-Revalidate Strategy
     */
    private Response handleStaleWhileRevalidate(Chain chain, Request request, String cacheKey) 
            throws IOException {
        CacheManager.CacheEntry cached = cacheManager.get(cacheKey);
        
        if (cached != null) {
            // Return cached response immediately
            Log.i(TAG, "Returning stale cache for: " + cacheKey);
            
            // Revalidate in background (simplified - in production use WorkManager)
            new Thread(() -> {
                try {
                    Response response = chain.proceed(request);
                    if (response.isSuccessful()) {
                        cacheResponse(cacheKey, request, response);
                    }
                    response.close();
                } catch (IOException e) {
                    Log.e(TAG, "Background revalidation failed", e);
                }
            }).start();
            
            return createResponseFromCache(request, cached);
        }
        
        // No cache, fetch from network
        Response response = chain.proceed(request);
        
        if (response.isSuccessful()) {
            cacheResponse(cacheKey, request, response);
        }
        
        return response;
    }
    
    /**
     * Cache response
     */
    private void cacheResponse(String cacheKey, Request request, Response response) {
        try {
            ResponseBody body = response.body();
            if (body == null) {
                return;
            }
            
            // Read response body
            String bodyString = body.string();
            
            // Create cache entry
            Map<String, String> headers = new HashMap<>();
            for (String name : response.headers().names()) {
                headers.put(name, response.header(name));
            }
            
            CacheManager.CacheEntry entry = new CacheManager.CacheEntry(
                cacheKey,
                bodyString,
                headers,
                response.code(),
                maxAge
            );
            
            // Set metadata
            entry.metadata = new CacheManager.CacheMetadata();
            entry.metadata.url = request.url().toString();
            entry.metadata.method = request.method();
            entry.metadata.etag = response.header("ETag");
            entry.metadata.lastModified = response.header("Last-Modified");
            
            // Save to cache
            cacheManager.put(cacheKey, entry);
            
            Log.d(TAG, "Cached response for: " + cacheKey);
            
        } catch (Exception e) {
            Log.e(TAG, "Error caching response", e);
        }
    }
    
    /**
     * Create response from cache
     */
    private Response createResponseFromCache(Request request, CacheManager.CacheEntry cached) {
        ResponseBody body = ResponseBody.create(
            okhttp3.MediaType.parse("application/json; charset=utf-8"),
            cached.data
        );
        
        Response.Builder builder = new Response.Builder()
            .request(request)
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .code(cached.status)
            .message("OK")
            .body(body);
        
        // Add headers
        for (Map.Entry<String, String> header : cached.headers.entrySet()) {
            builder.addHeader(header.getKey(), header.getValue());
        }
        
        // Add cache indicator header
        builder.addHeader("X-Cache", "HIT");
        builder.addHeader("X-Cache-Timestamp", String.valueOf(cached.timestamp));
        
        return builder.build();
    }
    
    /**
     * Generate cache key
     */
    private String generateCacheKey(Request request) {
        String method = request.method();
        String url = request.url().toString();
        
        // Remove query parameters if needed
        // url = url.split("\\?")[0];
        
        return method + ":" + url;
    }
    
    /**
     * Check if should exclude this request
     */
    private boolean shouldExclude(Request request) {
        String method = request.method();
        
        // Don't cache POST, PUT, DELETE by default
        if (method.equals("POST") || method.equals("PUT") || 
            method.equals("DELETE") || method.equals("PATCH")) {
            return true;
        }
        
        // Don't cache auth endpoints
        String url = request.url().toString();
        if (url.contains("/auth/") || url.contains("/login")) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Get cache manager
     */
    public CacheManager getCacheManager() {
        return cacheManager;
    }
}