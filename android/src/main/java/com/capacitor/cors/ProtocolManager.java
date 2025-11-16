package com.capacitor.cors;

import android.util.Log;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import okhttp3.*;

/**
 * Protocol Manager for HTTP/2 and HTTP/3 detection and fallback
 */
public class ProtocolManager {
    private static final String TAG = "ProtocolManager";
    
    /**
     * Protocol fallback configuration
     */
    public static class FallbackConfig {
        public boolean enabled = true;
        public int retryCount = 2;
        public List<Protocol> preferredProtocols = Arrays.asList(
            Protocol.HTTP_2,
            Protocol.HTTP_1_1
        );
        
        public FallbackConfig() {}
        
        public FallbackConfig(boolean enabled, int retryCount, List<Protocol> preferredProtocols) {
            this.enabled = enabled;
            this.retryCount = retryCount;
            this.preferredProtocols = preferredProtocols;
        }
    }
    
    /**
     * Create OkHttpClient with protocol fallback support
     */
    public static OkHttpClient createClientWithFallback(
        OkHttpClient baseClient,
        FallbackConfig config
    ) {
        if (!config.enabled) {
            return baseClient;
        }
        
        return baseClient.newBuilder()
            .addInterceptor(new ProtocolFallbackInterceptor(config))
            .build();
    }
    
    /**
     * Protocol Fallback Interceptor
     */
    private static class ProtocolFallbackInterceptor implements Interceptor {
        private final FallbackConfig config;
        
        public ProtocolFallbackInterceptor(FallbackConfig config) {
            this.config = config;
        }
        
        @Override
        public Response intercept(Chain chain) throws IOException {
            Request request = chain.request();
            Response response = null;
            IOException lastException = null;
            
            // Try each protocol in order
            for (int attempt = 0; attempt <= config.retryCount; attempt++) {
                try {
                    response = chain.proceed(request);
                    
                    // Log successful protocol
                    Protocol protocol = response.protocol();
                    Log.d(TAG, "Request successful with protocol: " + protocol);
                    
                    return response;
                    
                } catch (IOException e) {
                    lastException = e;
                    Log.w(TAG, "Request failed on attempt " + (attempt + 1) + ": " + e.getMessage());
                    
                    // If we've exhausted retries, throw the exception
                    if (attempt >= config.retryCount) {
                        throw e;
                    }
                    
                    // Wait before retry
                    try {
                        Thread.sleep(100 * (attempt + 1)); // Exponential backoff
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw e;
                    }
                }
            }
            
            // Should not reach here, but throw last exception if we do
            if (lastException != null) {
                throw lastException;
            }
            
            throw new IOException("Request failed after all retry attempts");
        }
    }
    
    /**
     * Detect protocol from response
     */
    public static String detectProtocol(Response response) {
        Protocol protocol = response.protocol();
        
        switch (protocol) {
            case HTTP_2:
                return "h2";
            case HTTP_1_1:
                return "http/1.1";
            case HTTP_1_0:
                return "http/1.0";
            default:
                return protocol.toString();
        }
    }
    
    /**
     * Check if protocol is supported
     */
    public static boolean isProtocolSupported(String protocolName) {
        try {
            switch (protocolName.toLowerCase()) {
                case "h2":
                case "http/2":
                    return true;
                case "http/1.1":
                case "http/1.0":
                    return true;
                case "h3":
                case "http/3":
                    return false; // HTTP/3 requires OkHttp 5.0+ (alpha)
                default:
                    return false;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking protocol support", e);
            return false;
        }
    }
    
    /**
     * Get recommended protocols for a given URL
     */
    public static List<Protocol> getRecommendedProtocols(String url) {
        List<Protocol> protocols = new ArrayList<>();
        
        // For HTTPS, try HTTP/2
        if (url.startsWith("https://")) {
            protocols.add(Protocol.HTTP_2);
            protocols.add(Protocol.HTTP_1_1);
        } else {
            // For HTTP, only use HTTP/1.1
            protocols.add(Protocol.HTTP_1_1);
        }
        
        return protocols;
    }
}