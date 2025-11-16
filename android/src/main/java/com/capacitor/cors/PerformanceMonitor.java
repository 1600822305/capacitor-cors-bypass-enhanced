package com.capacitor.cors;

import android.util.Log;
import com.getcapacitor.JSObject;
import java.io.IOException;
import java.net.Proxy;
import okhttp3.*;

/**
 * Performance Monitor for HTTP requests
 * Tracks DNS, TCP, TLS, and download metrics
 */
public class PerformanceMonitor {
    private static final String TAG = "PerformanceMonitor";
    
    /**
     * Performance Metrics
     */
    public static class Metrics {
        public long dnsTime = 0;
        public long tcpTime = 0;
        public long tlsTime = 0;
        public long ttfb = 0;  // Time to first byte
        public long downloadTime = 0;
        public long totalTime = 0;
        public long downloadSpeed = 0;  // bytes per second
        public String protocol = "unknown";
        
        public JSObject toJSObject() {
            JSObject obj = new JSObject();
            obj.put("dnsTime", dnsTime);
            obj.put("tcpTime", tcpTime);
            obj.put("tlsTime", tlsTime);
            obj.put("ttfb", ttfb);
            obj.put("downloadTime", downloadTime);
            obj.put("totalTime", totalTime);
            obj.put("downloadSpeed", downloadSpeed);
            obj.put("protocol", protocol);
            return obj;
        }
    }
    
    /**
     * Performance Monitoring Interceptor
     */
    public static class PerformanceInterceptor implements Interceptor {
        private final MetricsCallback callback;
        
        public interface MetricsCallback {
            void onMetricsCollected(Metrics metrics);
        }
        
        public PerformanceInterceptor(MetricsCallback callback) {
            this.callback = callback;
        }
        
        @Override
        public Response intercept(Chain chain) throws IOException {
            Request request = chain.request();
            Metrics metrics = new Metrics();
            
            long startTime = System.currentTimeMillis();
            
            Response response = null;
            try {
                response = chain.proceed(request);
                
                long endTime = System.currentTimeMillis();
                metrics.totalTime = endTime - startTime;
                
                // Get protocol
                metrics.protocol = ProtocolManager.detectProtocol(response);
                
                // Calculate download metrics
                if (response.body() != null) {
                    long bodySize = response.body().contentLength();
                    if (bodySize > 0 && metrics.downloadTime > 0) {
                        metrics.downloadSpeed = (bodySize * 1000) / metrics.downloadTime;
                    }
                }
                
                // Estimate TTFB (simplified - actual TTFB would need EventListener)
                metrics.ttfb = metrics.totalTime / 2;
                
                Log.d(TAG, "Performance metrics: " + 
                    "Total=" + metrics.totalTime + "ms, " +
                    "Protocol=" + metrics.protocol);
                
                if (callback != null) {
                    callback.onMetricsCollected(metrics);
                }
                
                return response;
                
            } catch (IOException e) {
                long endTime = System.currentTimeMillis();
                metrics.totalTime = endTime - startTime;
                
                if (callback != null) {
                    callback.onMetricsCollected(metrics);
                }
                
                throw e;
            }
        }
    }
    
    /**
     * Detailed Event Listener for fine-grained metrics
     */
    public static class DetailedEventListener extends EventListener {
        private final MetricsCallback callback;
        private final Metrics metrics = new Metrics();
        
        private long dnsStartTime = 0;
        private long connectStartTime = 0;
        private long secureConnectStartTime = 0;
        private long requestStartTime = 0;
        private long responseStartTime = 0;
        
        public interface MetricsCallback {
            void onMetricsCollected(Metrics metrics);
        }
        
        public DetailedEventListener(MetricsCallback callback) {
            this.callback = callback;
        }
        
        @Override
        public void dnsStart(Call call, String domainName) {
            dnsStartTime = System.currentTimeMillis();
            Log.d(TAG, "DNS lookup started for: " + domainName);
        }
        
        @Override
        public void dnsEnd(Call call, String domainName, java.util.List<java.net.InetAddress> inetAddressList) {
            if (dnsStartTime > 0) {
                metrics.dnsTime = System.currentTimeMillis() - dnsStartTime;
                Log.d(TAG, "DNS lookup completed in " + metrics.dnsTime + "ms");
            }
        }
        
        @Override
        public void connectStart(Call call, java.net.InetSocketAddress inetSocketAddress, Proxy proxy) {
            connectStartTime = System.currentTimeMillis();
            Log.d(TAG, "TCP connection started");
        }
        
        @Override
        public void connectEnd(Call call, java.net.InetSocketAddress inetSocketAddress, Proxy proxy, Protocol protocol) {
            if (connectStartTime > 0) {
                metrics.tcpTime = System.currentTimeMillis() - connectStartTime;
                Log.d(TAG, "TCP connection completed in " + metrics.tcpTime + "ms");
            }
        }
        
        @Override
        public void secureConnectStart(Call call) {
            secureConnectStartTime = System.currentTimeMillis();
            Log.d(TAG, "TLS handshake started");
        }
        
        @Override
        public void secureConnectEnd(Call call, Handshake handshake) {
            if (secureConnectStartTime > 0) {
                metrics.tlsTime = System.currentTimeMillis() - secureConnectStartTime;
                Log.d(TAG, "TLS handshake completed in " + metrics.tlsTime + "ms");
            }
        }
        
        @Override
        public void requestHeadersStart(Call call) {
            requestStartTime = System.currentTimeMillis();
        }
        
        @Override
        public void responseHeadersStart(Call call) {
            responseStartTime = System.currentTimeMillis();
        }
        
        @Override
        public void responseHeadersEnd(Call call, Response response) {
            if (requestStartTime > 0 && responseStartTime > 0) {
                metrics.ttfb = responseStartTime - requestStartTime;
                metrics.protocol = ProtocolManager.detectProtocol(response);
                Log.d(TAG, "TTFB: " + metrics.ttfb + "ms, Protocol: " + metrics.protocol);
            }
        }
        
        @Override
        public void responseBodyEnd(Call call, long byteCount) {
            if (responseStartTime > 0) {
                long endTime = System.currentTimeMillis();
                metrics.downloadTime = endTime - responseStartTime;
                metrics.totalTime = endTime - requestStartTime;
                
                if (byteCount > 0 && metrics.downloadTime > 0) {
                    metrics.downloadSpeed = (byteCount * 1000) / metrics.downloadTime;
                }
                
                Log.d(TAG, "Download completed: " + byteCount + " bytes in " + 
                    metrics.downloadTime + "ms (" + metrics.downloadSpeed + " bytes/sec)");
                
                if (callback != null) {
                    callback.onMetricsCollected(metrics);
                }
            }
        }
        
        @Override
        public void callFailed(Call call, IOException ioe) {
            Log.e(TAG, "Call failed: " + ioe.getMessage());
            if (callback != null) {
                callback.onMetricsCollected(metrics);
            }
        }
    }
    
    /**
     * Create OkHttpClient with performance monitoring
     */
    public static OkHttpClient addPerformanceMonitoring(
        OkHttpClient client,
        DetailedEventListener.MetricsCallback callback
    ) {
        return client.newBuilder()
            .eventListener(new DetailedEventListener(callback))
            .build();
    }
}