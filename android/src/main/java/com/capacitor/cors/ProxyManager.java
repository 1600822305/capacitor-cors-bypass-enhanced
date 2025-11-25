package com.capacitor.cors;

import android.util.Log;
import com.getcapacitor.JSObject;
import okhttp3.*;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.PasswordAuthentication;
import java.net.Authenticator;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Proxy Manager for handling network proxy configurations
 * Supports HTTP, HTTPS, SOCKS4, and SOCKS5 proxies
 */
public class ProxyManager {
    private static final String TAG = "ProxyManager";
    
    // Proxy configuration
    private boolean enabled = false;
    private String type = "http";
    private String host = "";
    private int port = 8080;
    private String username = null;
    private String password = null;
    private String[] bypass = new String[0];
    private boolean applyToAll = true;
    
    // Statistics
    private final AtomicInteger requestCount = new AtomicInteger(0);
    private final AtomicLong lastSuccessTime = new AtomicLong(0);
    private String lastError = null;
    
    public ProxyManager() {
    }
    
    /**
     * Configure global proxy settings
     */
    public void setConfig(JSObject config) {
        if (config == null) {
            clearConfig();
            return;
        }
        
        this.enabled = config.getBoolean("enabled", false);
        this.type = config.getString("type", "http");
        this.host = config.getString("host", "");
        this.port = config.getInteger("port", 8080);
        this.username = config.getString("username", null);
        this.password = config.getString("password", null);
        this.applyToAll = config.getBoolean("applyToAll", true);
        
        // Parse bypass list
        try {
            com.getcapacitor.JSArray bypassArray = config.getJSArray("bypass");
            if (bypassArray != null) {
                this.bypass = new String[bypassArray.length()];
                for (int i = 0; i < bypassArray.length(); i++) {
                    this.bypass[i] = bypassArray.getString(i);
                }
            }
        } catch (Exception e) {
            this.bypass = new String[0];
        }
        
        Log.i(TAG, "Proxy configured: " + type + "://" + host + ":" + port + " (enabled: " + enabled + ")");
    }
    
    /**
     * Clear proxy configuration
     */
    public void clearConfig() {
        this.enabled = false;
        this.type = "http";
        this.host = "";
        this.port = 8080;
        this.username = null;
        this.password = null;
        this.bypass = new String[0];
        this.applyToAll = true;
        this.lastError = null;
        
        Log.i(TAG, "Proxy configuration cleared");
    }
    
    /**
     * Get current proxy configuration as JSObject
     */
    public JSObject getConfig() {
        if (!enabled) {
            return null;
        }
        
        JSObject config = new JSObject();
        config.put("enabled", enabled);
        config.put("type", type);
        config.put("host", host);
        config.put("port", port);
        if (username != null) {
            config.put("username", username);
        }
        config.put("applyToAll", applyToAll);
        
        com.getcapacitor.JSArray bypassArray = new com.getcapacitor.JSArray();
        for (String b : bypass) {
            bypassArray.put(b);
        }
        config.put("bypass", bypassArray);
        
        return config;
    }
    
    /**
     * Get proxy status
     */
    public JSObject getStatus() {
        JSObject status = new JSObject();
        status.put("active", enabled && !host.isEmpty());
        status.put("requestCount", requestCount.get());
        
        if (lastError != null) {
            status.put("lastError", lastError);
        }
        
        long successTime = lastSuccessTime.get();
        if (successTime > 0) {
            status.put("lastSuccessTime", successTime);
        }
        
        if (enabled) {
            status.put("config", getConfig());
        }
        
        return status;
    }
    
    /**
     * Check if proxy is enabled and configured
     */
    public boolean isEnabled() {
        return enabled && !host.isEmpty();
    }
    
    /**
     * Check if URL should bypass proxy
     */
    public boolean shouldBypass(String url) {
        if (bypass == null || bypass.length == 0) {
            return false;
        }
        
        try {
            java.net.URL parsedUrl = new java.net.URL(url);
            String urlHost = parsedUrl.getHost();
            
            for (String pattern : bypass) {
                if (matchesPattern(urlHost, pattern)) {
                    return true;
                }
            }
        } catch (Exception e) {
            // Ignore parsing errors
        }
        
        return false;
    }
    
    /**
     * Simple wildcard pattern matching for bypass list
     */
    private boolean matchesPattern(String host, String pattern) {
        if (pattern.startsWith("*.")) {
            // Wildcard domain match
            String suffix = pattern.substring(1);
            return host.endsWith(suffix) || host.equals(pattern.substring(2));
        } else if (pattern.endsWith(".*")) {
            // Wildcard IP match
            String prefix = pattern.substring(0, pattern.length() - 1);
            return host.startsWith(prefix);
        } else {
            return host.equalsIgnoreCase(pattern);
        }
    }
    
    /**
     * Create OkHttp Proxy object
     */
    public Proxy createProxy() {
        if (!isEnabled()) {
            return Proxy.NO_PROXY;
        }
        
        Proxy.Type proxyType;
        switch (type.toLowerCase()) {
            case "socks4":
            case "socks5":
            case "socks":
                proxyType = Proxy.Type.SOCKS;
                break;
            case "http":
            case "https":
            default:
                proxyType = Proxy.Type.HTTP;
                break;
        }
        
        return new Proxy(proxyType, new InetSocketAddress(host, port));
    }
    
    /**
     * Create proxy authenticator for OkHttp
     */
    public Authenticator createAuthenticator() {
        if (!isEnabled() || username == null || username.isEmpty()) {
            return null;
        }
        
        return new Authenticator() {
            @Override
            public Request authenticate(Route route, Response response) throws IOException {
                if (response.request().header("Proxy-Authorization") != null) {
                    // Already attempted authentication
                    return null;
                }
                
                String credential = Credentials.basic(username, password != null ? password : "");
                return response.request().newBuilder()
                    .header("Proxy-Authorization", credential)
                    .build();
            }
        };
    }
    
    /**
     * Apply proxy configuration to OkHttpClient.Builder
     */
    public void applyToClientBuilder(OkHttpClient.Builder builder) {
        if (!isEnabled()) {
            return;
        }
        
        builder.proxy(createProxy());
        
        Authenticator authenticator = createAuthenticator();
        if (authenticator != null) {
            builder.proxyAuthenticator(authenticator);
        }
        
        Log.d(TAG, "Proxy applied to HTTP client: " + type + "://" + host + ":" + port);
    }
    
    /**
     * Apply proxy configuration to OkHttpClient.Builder for a specific request
     * Takes into account per-request proxy config and bypass list
     */
    public void applyToClientBuilder(OkHttpClient.Builder builder, String url, JSObject requestProxy) {
        // Check if request has its own proxy config
        if (requestProxy != null && requestProxy.getBoolean("enabled", false)) {
            applyRequestProxy(builder, requestProxy);
            return;
        }
        
        // Check if global proxy should apply
        if (!isEnabled() || !applyToAll) {
            return;
        }
        
        // Check bypass list
        if (shouldBypass(url)) {
            Log.d(TAG, "Bypassing proxy for URL: " + url);
            return;
        }
        
        applyToClientBuilder(builder);
    }
    
    /**
     * Apply per-request proxy configuration
     */
    private void applyRequestProxy(OkHttpClient.Builder builder, JSObject proxyConfig) {
        String proxyType = proxyConfig.getString("type", "http");
        String proxyHost = proxyConfig.getString("host", "");
        int proxyPort = proxyConfig.getInteger("port", 8080);
        String proxyUser = proxyConfig.getString("username", null);
        String proxyPass = proxyConfig.getString("password", null);
        
        if (proxyHost.isEmpty()) {
            return;
        }
        
        Proxy.Type type;
        switch (proxyType.toLowerCase()) {
            case "socks4":
            case "socks5":
            case "socks":
                type = Proxy.Type.SOCKS;
                break;
            default:
                type = Proxy.Type.HTTP;
                break;
        }
        
        builder.proxy(new Proxy(type, new InetSocketAddress(proxyHost, proxyPort)));
        
        if (proxyUser != null && !proxyUser.isEmpty()) {
            builder.proxyAuthenticator((route, response) -> {
                if (response.request().header("Proxy-Authorization") != null) {
                    return null;
                }
                String credential = Credentials.basic(proxyUser, proxyPass != null ? proxyPass : "");
                return response.request().newBuilder()
                    .header("Proxy-Authorization", credential)
                    .build();
            });
        }
        
        Log.d(TAG, "Per-request proxy applied: " + proxyType + "://" + proxyHost + ":" + proxyPort);
    }
    
    /**
     * Test proxy connection
     */
    public JSObject testProxy(JSObject proxyConfig, String testUrl) {
        JSObject result = new JSObject();
        long startTime = System.currentTimeMillis();
        
        try {
            String proxyType = proxyConfig.getString("type", "http");
            String proxyHost = proxyConfig.getString("host", "");
            int proxyPort = proxyConfig.getInteger("port", 8080);
            String proxyUser = proxyConfig.getString("username", null);
            String proxyPass = proxyConfig.getString("password", null);
            
            if (proxyHost.isEmpty()) {
                result.put("success", false);
                result.put("error", "Proxy host is required");
                return result;
            }
            
            // Default test URL
            if (testUrl == null || testUrl.isEmpty()) {
                testUrl = "https://www.google.com";
            }
            
            // Create proxy
            Proxy.Type type;
            switch (proxyType.toLowerCase()) {
                case "socks4":
                case "socks5":
                case "socks":
                    type = Proxy.Type.SOCKS;
                    break;
                default:
                    type = Proxy.Type.HTTP;
                    break;
            }
            
            Proxy proxy = new Proxy(type, new InetSocketAddress(proxyHost, proxyPort));
            
            // Build client
            OkHttpClient.Builder builder = new OkHttpClient.Builder()
                .proxy(proxy)
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS);
            
            if (proxyUser != null && !proxyUser.isEmpty()) {
                final String user = proxyUser;
                final String pass = proxyPass;
                builder.proxyAuthenticator((route, response) -> {
                    if (response.request().header("Proxy-Authorization") != null) {
                        return null;
                    }
                    String credential = Credentials.basic(user, pass != null ? pass : "");
                    return response.request().newBuilder()
                        .header("Proxy-Authorization", credential)
                        .build();
                });
            }
            
            OkHttpClient client = builder.build();
            
            // Make test request
            Request request = new Request.Builder()
                .url(testUrl)
                .head()
                .build();
            
            Response response = client.newCall(request).execute();
            long responseTime = System.currentTimeMillis() - startTime;
            
            result.put("success", response.isSuccessful() || response.isRedirect());
            result.put("responseTime", responseTime);
            result.put("statusCode", response.code());
            
            response.close();
            
            Log.i(TAG, "Proxy test successful: " + responseTime + "ms");
            
        } catch (Exception e) {
            long responseTime = System.currentTimeMillis() - startTime;
            result.put("success", false);
            result.put("responseTime", responseTime);
            result.put("error", e.getMessage());
            
            Log.e(TAG, "Proxy test failed: " + e.getMessage());
        }
        
        return result;
    }
    
    /**
     * Record successful request
     */
    public void recordSuccess() {
        requestCount.incrementAndGet();
        lastSuccessTime.set(System.currentTimeMillis());
        lastError = null;
    }
    
    /**
     * Record failed request
     */
    public void recordError(String error) {
        requestCount.incrementAndGet();
        lastError = error;
    }
}
