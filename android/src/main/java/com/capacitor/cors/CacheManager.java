package com.capacitor.cors;

import android.content.Context;
import android.util.Log;
import com.getcapacitor.JSObject;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cache Manager for Android
 * 缓存管理器 - Android实现
 */
public class CacheManager {
    private static final String TAG = "CacheManager";
    private static final String CACHE_DIR = "http_cache";
    
    private final Context context;
    private final ConcurrentHashMap<String, CacheEntry> memoryCache;
    private final File cacheDir;
    private final long maxSize;
    private final CacheEvictionPolicy evictionPolicy;
    
    private long currentSize = 0;
    private int hits = 0;
    private int misses = 0;

    /**
     * Cache Entry
     */
    public static class CacheEntry {
        public String key;
        public String data;
        public Map<String, String> headers;
        public int status;
        public long timestamp;
        public long expiresAt;
        public long size;
        public boolean compressed;
        public CacheMetadata metadata;
        
        public CacheEntry(String key, String data, Map<String, String> headers, 
                         int status, long maxAge) {
            this.key = key;
            this.data = data;
            this.headers = headers;
            this.status = status;
            this.timestamp = System.currentTimeMillis();
            this.expiresAt = this.timestamp + maxAge;
            this.size = data.getBytes().length;
            this.compressed = false;
        }
        
        public boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }
        
        public JSONObject toJSON() throws JSONException {
            JSONObject json = new JSONObject();
            json.put("key", key);
            json.put("data", data);
            json.put("status", status);
            json.put("timestamp", timestamp);
            json.put("expiresAt", expiresAt);
            json.put("size", size);
            json.put("compressed", compressed);
            
            JSONObject headersJson = new JSONObject();
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                headersJson.put(entry.getKey(), entry.getValue());
            }
            json.put("headers", headersJson);
            
            if (metadata != null) {
                json.put("metadata", metadata.toJSON());
            }
            
            return json;
        }
        
        public static CacheEntry fromJSON(JSONObject json) throws JSONException {
            String key = json.getString("key");
            String data = json.getString("data");
            int status = json.getInt("status");
            long timestamp = json.getLong("timestamp");
            long expiresAt = json.getLong("expiresAt");
            
            Map<String, String> headers = new HashMap<>();
            JSONObject headersJson = json.getJSONObject("headers");
            Iterator<String> keys = headersJson.keys();
            while (keys.hasNext()) {
                String headerKey = keys.next();
                headers.put(headerKey, headersJson.getString(headerKey));
            }
            
            CacheEntry entry = new CacheEntry(key, data, headers, status, 0);
            entry.timestamp = timestamp;
            entry.expiresAt = expiresAt;
            entry.size = json.optLong("size", data.getBytes().length);
            entry.compressed = json.optBoolean("compressed", false);
            
            if (json.has("metadata")) {
                entry.metadata = CacheMetadata.fromJSON(json.getJSONObject("metadata"));
            }
            
            return entry;
        }
    }
    
    /**
     * Cache Metadata
     */
    public static class CacheMetadata {
        public String url;
        public String method;
        public String etag;
        public String lastModified;
        
        public JSONObject toJSON() throws JSONException {
            JSONObject json = new JSONObject();
            json.put("url", url);
            json.put("method", method);
            if (etag != null) json.put("etag", etag);
            if (lastModified != null) json.put("lastModified", lastModified);
            return json;
        }
        
        public static CacheMetadata fromJSON(JSONObject json) throws JSONException {
            CacheMetadata metadata = new CacheMetadata();
            metadata.url = json.getString("url");
            metadata.method = json.getString("method");
            metadata.etag = json.optString("etag", null);
            metadata.lastModified = json.optString("lastModified", null);
            return metadata;
        }
    }
    
    /**
     * Cache Statistics
     */
    public static class CacheStats {
        public int totalEntries;
        public long totalSize;
        public int hits;
        public int misses;
        public double hitRate;
        public long oldestEntry;
        public long newestEntry;
        
        public JSObject toJSObject() {
            JSObject obj = new JSObject();
            obj.put("totalEntries", totalEntries);
            obj.put("totalSize", totalSize);
            obj.put("hits", hits);
            obj.put("misses", misses);
            obj.put("hitRate", hitRate);
            obj.put("oldestEntry", oldestEntry);
            obj.put("newestEntry", newestEntry);
            return obj;
        }
    }
    
    /**
     * Cache Eviction Policy
     */
    public enum CacheEvictionPolicy {
        LRU,  // Least Recently Used
        LFU,  // Least Frequently Used
        FIFO, // First In First Out
        TTL   // Time To Live
    }
    
    /**
     * Constructor
     */
    public CacheManager(Context context, long maxSize, CacheEvictionPolicy policy) {
        this.context = context;
        this.maxSize = maxSize;
        this.evictionPolicy = policy != null ? policy : CacheEvictionPolicy.LRU;
        this.memoryCache = new ConcurrentHashMap<>();
        this.cacheDir = new File(context.getCacheDir(), CACHE_DIR);
        
        if (!cacheDir.exists()) {
            cacheDir.mkdirs();
        }
        
        // Load cache size
        calculateCacheSize();
        
        Log.i(TAG, "CacheManager initialized with maxSize: " + maxSize + 
                   ", policy: " + this.evictionPolicy);
    }
    
    /**
     * Get cache entry
     */
    public CacheEntry get(String key) {
        // Check memory cache first
        CacheEntry entry = memoryCache.get(key);
        
        if (entry == null) {
            // Try to load from disk
            entry = loadFromDisk(key);
            if (entry != null) {
                memoryCache.put(key, entry);
            }
        }
        
        if (entry == null) {
            misses++;
            return null;
        }
        
        // Check if expired
        if (entry.isExpired()) {
            delete(key);
            misses++;
            return null;
        }
        
        hits++;
        return entry;
    }
    
    /**
     * Put cache entry
     */
    public void put(String key, CacheEntry entry) {
        // Check if we need to evict
        if (currentSize + entry.size > maxSize) {
            evict(entry.size);
        }
        
        // Add to memory cache
        memoryCache.put(key, entry);
        
        // Save to disk
        saveToDisk(key, entry);
        
        currentSize += entry.size;
        
        Log.d(TAG, "Cached: " + key + " (size: " + entry.size + ")");
    }
    
    /**
     * Delete cache entry
     */
    public boolean delete(String key) {
        CacheEntry entry = memoryCache.remove(key);
        
        if (entry != null) {
            currentSize -= entry.size;
        }
        
        // Delete from disk
        File file = new File(cacheDir, getCacheFileName(key));
        if (file.exists()) {
            return file.delete();
        }
        
        return entry != null;
    }
    
    /**
     * Clear all cache
     */
    public void clear() {
        memoryCache.clear();
        
        // Delete all files
        File[] files = cacheDir.listFiles();
        if (files != null) {
            for (File file : files) {
                file.delete();
            }
        }
        
        currentSize = 0;
        hits = 0;
        misses = 0;
        
        Log.i(TAG, "Cache cleared");
    }
    
    /**
     * Check if key exists
     */
    public boolean has(String key) {
        CacheEntry entry = get(key);
        return entry != null;
    }
    
    /**
     * Get all cache keys
     */
    public List<String> keys() {
        return new ArrayList<>(memoryCache.keySet());
    }
    
    /**
     * Get cache statistics
     */
    public CacheStats getStats() {
        CacheStats stats = new CacheStats();
        stats.totalEntries = memoryCache.size();
        stats.totalSize = currentSize;
        stats.hits = hits;
        stats.misses = misses;
        stats.hitRate = (hits + misses) > 0 ? (double) hits / (hits + misses) : 0;
        
        long oldest = Long.MAX_VALUE;
        long newest = 0;
        
        for (CacheEntry entry : memoryCache.values()) {
            if (entry.timestamp < oldest) oldest = entry.timestamp;
            if (entry.timestamp > newest) newest = entry.timestamp;
        }
        
        stats.oldestEntry = oldest != Long.MAX_VALUE ? oldest : 0;
        stats.newestEntry = newest;
        
        return stats;
    }
    
    /**
     * Cleanup expired entries
     */
    public int cleanup() {
        int cleaned = 0;
        List<String> toRemove = new ArrayList<>();
        
        for (Map.Entry<String, CacheEntry> entry : memoryCache.entrySet()) {
            if (entry.getValue().isExpired()) {
                toRemove.add(entry.getKey());
            }
        }
        
        for (String key : toRemove) {
            delete(key);
            cleaned++;
        }
        
        Log.i(TAG, "Cleaned up " + cleaned + " expired entries");
        return cleaned;
    }
    
    /**
     * Get current cache size
     */
    public long getSize() {
        return currentSize;
    }
    
    /**
     * Evict entries to free space
     */
    private void evict(long requiredSpace) {
        long targetSize = (long) (maxSize * 0.7); // Evict to 70%
        long freedSpace = 0;
        
        List<Map.Entry<String, CacheEntry>> entries = new ArrayList<>(memoryCache.entrySet());
        
        // Sort based on eviction policy
        switch (evictionPolicy) {
            case LRU:
                entries.sort((a, b) -> Long.compare(a.getValue().timestamp, b.getValue().timestamp));
                break;
            case FIFO:
                entries.sort((a, b) -> Long.compare(a.getValue().timestamp, b.getValue().timestamp));
                break;
            case TTL:
                entries.sort((a, b) -> Long.compare(a.getValue().expiresAt, b.getValue().expiresAt));
                break;
        }
        
        for (Map.Entry<String, CacheEntry> entry : entries) {
            if (currentSize - freedSpace <= targetSize && freedSpace >= requiredSpace) {
                break;
            }
            
            freedSpace += entry.getValue().size;
            delete(entry.getKey());
        }
        
        Log.i(TAG, "Evicted entries, freed: " + freedSpace + " bytes");
    }
    
    /**
     * Save entry to disk
     */
    private void saveToDisk(String key, CacheEntry entry) {
        try {
            File file = new File(cacheDir, getCacheFileName(key));
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(entry.toJSON().toString().getBytes());
            fos.close();
        } catch (Exception e) {
            Log.e(TAG, "Error saving to disk: " + key, e);
        }
    }
    
    /**
     * Load entry from disk
     */
    private CacheEntry loadFromDisk(String key) {
        try {
            File file = new File(cacheDir, getCacheFileName(key));
            if (!file.exists()) {
                return null;
            }
            
            FileInputStream fis = new FileInputStream(file);
            byte[] data = new byte[(int) file.length()];
            fis.read(data);
            fis.close();
            
            String json = new String(data);
            return CacheEntry.fromJSON(new JSONObject(json));
        } catch (Exception e) {
            Log.e(TAG, "Error loading from disk: " + key, e);
            return null;
        }
    }
    
    /**
     * Get cache file name
     */
    private String getCacheFileName(String key) {
        return String.valueOf(key.hashCode()) + ".cache";
    }
    
    /**
     * Calculate total cache size
     */
    private void calculateCacheSize() {
        currentSize = 0;
        File[] files = cacheDir.listFiles();
        if (files != null) {
            for (File file : files) {
                currentSize += file.length();
            }
        }
    }
}