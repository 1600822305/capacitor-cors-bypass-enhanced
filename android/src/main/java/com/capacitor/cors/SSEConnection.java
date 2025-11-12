package com.capacitor.cors;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.getcapacitor.JSObject;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.Iterator;
import java.util.concurrent.TimeUnit;
import okhttp3.*;

public class SSEConnection {
    private static final String TAG = "SSEConnection";
    
    private final String url;
    private final JSObject headers;
    private final boolean withCredentials;
    private final double reconnectTimeout;
    private final CorsBypassPlugin plugin;
    private final String connectionId;
    private final OkHttpClient httpClient;
    
    private Call currentCall;
    private Handler mainHandler;
    private Handler reconnectHandler;
    private boolean isConnected = false;
    private boolean shouldReconnect = true;

    public SSEConnection(String url, JSObject headers, boolean withCredentials, 
                        double reconnectTimeout, CorsBypassPlugin plugin, 
                        String connectionId, OkHttpClient httpClient) {
        this.url = url;
        this.headers = headers;
        this.withCredentials = withCredentials;
        this.reconnectTimeout = reconnectTimeout;
        this.plugin = plugin;
        this.connectionId = connectionId;
        this.httpClient = httpClient;
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.reconnectHandler = new Handler(Looper.getMainLooper());
    }

    public void connect() {
        try {
            Request.Builder requestBuilder = new Request.Builder()
                .url(url)
                .addHeader("Accept", "text/event-stream")
                .addHeader("Cache-Control", "no-cache");

            // Add custom headers
            Iterator<String> headerKeys = headers.keys();
            while (headerKeys.hasNext()) {
                String key = headerKeys.next();
                requestBuilder.addHeader(key, headers.getString(key));
            }

            Request request = requestBuilder.build();

            // Configure client for SSE
            OkHttpClient client = httpClient.newBuilder()
                .connectTimeout(0, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.SECONDS)
                .writeTimeout(0, TimeUnit.SECONDS)
                .build();

            currentCall = client.newCall(request);
            currentCall.enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    if (!call.isCanceled()) {
                        mainHandler.post(() -> {
                            plugin.notifySSEError(connectionId, e.getMessage());
                            scheduleReconnect();
                        });
                    }
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    if (response.code() == 200) {
                        isConnected = true;
                        mainHandler.post(() -> plugin.notifySSEOpen(connectionId));
                        
                        // Start reading the stream
                        readEventStream(response);
                    } else {
                        mainHandler.post(() -> {
                            plugin.notifySSEError(connectionId, "HTTP " + response.code());
                            scheduleReconnect();
                        });
                    }
                }
            });

        } catch (Exception e) {
            plugin.notifySSEError(connectionId, "Failed to connect: " + e.getMessage());
        }
    }

    private void readEventStream(Response response) {
        try (InputStream inputStream = response.body().byteStream();
             BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream))) {
            
            String line;
            StringBuilder eventData = new StringBuilder();
            String eventType = null;
            String eventId = null;
            
            while ((line = reader.readLine()) != null && !Thread.currentThread().isInterrupted()) {
                if (line.isEmpty()) {
                    // Empty line indicates end of event
                    if (eventData.length() > 0) {
                        final String data = eventData.toString();
                        final String type = eventType;
                        final String id = eventId;
                        
                        mainHandler.post(() -> 
                            plugin.notifySSEMessage(connectionId, data, id, type)
                        );
                    }
                    
                    // Reset for next event
                    eventData.setLength(0);
                    eventType = null;
                    eventId = null;
                    
                } else if (line.startsWith("data:")) {
                    String dataValue = line.substring(5).trim();
                    if (eventData.length() > 0) {
                        eventData.append("\n");
                    }
                    eventData.append(dataValue);
                    
                } else if (line.startsWith("event:")) {
                    eventType = line.substring(6).trim();
                    
                } else if (line.startsWith("id:")) {
                    eventId = line.substring(3).trim();
                    
                } else if (line.startsWith("retry:")) {
                    // Handle retry directive if needed
                }
            }
            
        } catch (IOException e) {
            if (!Thread.currentThread().isInterrupted()) {
                mainHandler.post(() -> {
                    plugin.notifySSEError(connectionId, "Stream reading error: " + e.getMessage());
                    scheduleReconnect();
                });
            }
        } finally {
            isConnected = false;
        }
    }

    public void disconnect() {
        shouldReconnect = false;
        reconnectHandler.removeCallbacksAndMessages(null);
        
        if (currentCall != null) {
            currentCall.cancel();
            currentCall = null;
        }
        
        isConnected = false;
        mainHandler.post(() -> plugin.notifySSEClose(connectionId));
    }

    private void scheduleReconnect() {
        if (shouldReconnect && reconnectTimeout > 0) {
            reconnectHandler.postDelayed(() -> {
                if (shouldReconnect) {
                    connect();
                }
            }, (long) (reconnectTimeout * 1000));
        }
    }
}
