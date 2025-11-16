import Foundation

/**
 * Cache Manager for iOS
 * 缓存管理器 - iOS实现
 */
@objc public class CacheManager: NSObject {
    
    // MARK: - Types
    
    /**
     * Cache Entry
     */
    @objc public class CacheEntry: NSObject {
        @objc public var key: String
        @objc public var data: String
        @objc public var headers: [String: String]
        @objc public var status: Int
        @objc public var timestamp: TimeInterval
        @objc public var expiresAt: TimeInterval
        @objc public var size: Int
        @objc public var compressed: Bool
        @objc public var metadata: CacheMetadata?
        
        init(key: String, data: String, headers: [String: String], status: Int, maxAge: TimeInterval) {
            self.key = key
            self.data = data
            self.headers = headers
            self.status = status
            self.timestamp = Date().timeIntervalSince1970
            self.expiresAt = self.timestamp + maxAge
            self.size = data.utf8.count
            self.compressed = false
            super.init()
        }
        
        @objc public func isExpired() -> Bool {
            return Date().timeIntervalSince1970 > expiresAt
        }
        
        @objc public func toDictionary() -> [String: Any] {
            var dict: [String: Any] = [
                "key": key,
                "data": data,
                "headers": headers,
                "status": status,
                "timestamp": timestamp,
                "expiresAt": expiresAt,
                "size": size,
                "compressed": compressed
            ]
            
            if let metadata = metadata {
                dict["metadata"] = metadata.toDictionary()
            }
            
            return dict
        }
        
        @objc public static func fromDictionary(_ dict: [String: Any]) -> CacheEntry? {
            guard let key = dict["key"] as? String,
                  let data = dict["data"] as? String,
                  let headers = dict["headers"] as? [String: String],
                  let status = dict["status"] as? Int,
                  let timestamp = dict["timestamp"] as? TimeInterval,
                  let expiresAt = dict["expiresAt"] as? TimeInterval else {
                return nil
            }
            
            let entry = CacheEntry(key: key, data: data, headers: headers, status: status, maxAge: 0)
            entry.timestamp = timestamp
            entry.expiresAt = expiresAt
            entry.size = dict["size"] as? Int ?? data.utf8.count
            entry.compressed = dict["compressed"] as? Bool ?? false
            
            if let metadataDict = dict["metadata"] as? [String: Any] {
                entry.metadata = CacheMetadata.fromDictionary(metadataDict)
            }
            
            return entry
        }
    }
    
    /**
     * Cache Metadata
     */
    @objc public class CacheMetadata: NSObject {
        @objc public var url: String
        @objc public var method: String
        @objc public var etag: String?
        @objc public var lastModified: String?
        
        init(url: String, method: String) {
            self.url = url
            self.method = method
            super.init()
        }
        
        func toDictionary() -> [String: Any] {
            var dict: [String: Any] = [
                "url": url,
                "method": method
            ]
            if let etag = etag { dict["etag"] = etag }
            if let lastModified = lastModified { dict["lastModified"] = lastModified }
            return dict
        }
        
        static func fromDictionary(_ dict: [String: Any]) -> CacheMetadata? {
            guard let url = dict["url"] as? String,
                  let method = dict["method"] as? String else {
                return nil
            }
            
            let metadata = CacheMetadata(url: url, method: method)
            metadata.etag = dict["etag"] as? String
            metadata.lastModified = dict["lastModified"] as? String
            return metadata
        }
    }
    
    /**
     * Cache Statistics
     */
    @objc public class CacheStats: NSObject {
        @objc public var totalEntries: Int = 0
        @objc public var totalSize: Int = 0
        @objc public var hits: Int = 0
        @objc public var misses: Int = 0
        @objc public var hitRate: Double = 0.0
        @objc public var oldestEntry: TimeInterval = 0
        @objc public var newestEntry: TimeInterval = 0
        
        func toDictionary() -> [String: Any] {
            return [
                "totalEntries": totalEntries,
                "totalSize": totalSize,
                "hits": hits,
                "misses": misses,
                "hitRate": hitRate,
                "oldestEntry": oldestEntry,
                "newestEntry": newestEntry
            ]
        }
    }
    
    /**
     * Cache Eviction Policy
     */
    @objc public enum CacheEvictionPolicy: Int {
        case lru  // Least Recently Used
        case lfu  // Least Frequently Used
        case fifo // First In First Out
        case ttl  // Time To Live
    }
    
    // MARK: - Properties
    
    private var memoryCache: [String: CacheEntry] = [:]
    private var accessCount: [String: Int] = [:]
    private var accessTime: [String: TimeInterval] = [:]
    private let lock = NSLock()
    private let maxSize: Int
    private let evictionPolicy: CacheEvictionPolicy
    private let cacheDirectory: URL
    
    private var currentSize: Int = 0
    private var hits: Int = 0
    private var misses: Int = 0
    
    // MARK: - Initialization
    
    @objc public init(maxSize: Int, evictionPolicy: CacheEvictionPolicy) {
        self.maxSize = maxSize
        self.evictionPolicy = evictionPolicy
        
        // Setup cache directory
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        self.cacheDirectory = cacheDir.appendingPathComponent("http_cache")
        
        super.init()
        
        // Create cache directory if needed
        try? FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        
        // Calculate initial cache size
        calculateCacheSize()
        
        print("[CacheManager] Initialized with maxSize: \(maxSize), policy: \(evictionPolicy)")
    }
    
    // MARK: - Public Methods
    
    /**
     * Get cache entry
     */
    @objc public func get(_ key: String) -> CacheEntry? {
        lock.lock()
        defer { lock.unlock() }
        
        // Check memory cache first
        var entry = memoryCache[key]
        
        if entry == nil {
            // Try to load from disk
            entry = loadFromDisk(key)
            if let entry = entry {
                memoryCache[key] = entry
            }
        }
        
        guard let entry = entry else {
            misses += 1
            return nil
        }
        
        // Check if expired
        if entry.isExpired() {
            delete(key)
            misses += 1
            return nil
        }
        
        // Update access statistics
        accessCount[key] = (accessCount[key] ?? 0) + 1
        accessTime[key] = Date().timeIntervalSince1970
        hits += 1
        
        return entry
    }
    
    /**
     * Put cache entry
     */
    @objc public func put(_ key: String, entry: CacheEntry) {
        lock.lock()
        defer { lock.unlock() }
        
        // Check if we need to evict
        if currentSize + entry.size > maxSize {
            evict(requiredSpace: entry.size)
        }
        
        // Add to memory cache
        memoryCache[key] = entry
        accessCount[key] = 1
        accessTime[key] = Date().timeIntervalSince1970
        
        // Save to disk
        saveToDisk(key, entry: entry)
        
        currentSize += entry.size
        
        print("[CacheManager] Cached: \(key) (size: \(entry.size))")
    }
    
    /**
     * Delete cache entry
     */
    @objc public func delete(_ key: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        
        if let entry = memoryCache.removeValue(forKey: key) {
            currentSize -= entry.size
        }
        
        accessCount.removeValue(forKey: key)
        accessTime.removeValue(forKey: key)
        
        // Delete from disk
        let fileURL = cacheDirectory.appendingPathComponent(getCacheFileName(key))
        try? FileManager.default.removeItem(at: fileURL)
        
        return true
    }
    
    /**
     * Clear all cache
     */
    @objc public func clear() {
        lock.lock()
        defer { lock.unlock() }
        
        memoryCache.removeAll()
        accessCount.removeAll()
        accessTime.removeAll()
        
        // Delete all files
        if let files = try? FileManager.default.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil) {
            for file in files {
                try? FileManager.default.removeItem(at: file)
            }
        }
        
        currentSize = 0
        hits = 0
        misses = 0
        
        print("[CacheManager] Cache cleared")
    }
    
    /**
     * Check if key exists
     */
    @objc public func has(_ key: String) -> Bool {
        return get(key) != nil
    }
    
    /**
     * Get all cache keys
     */
    @objc public func keys() -> [String] {
        lock.lock()
        defer { lock.unlock() }
        
        return Array(memoryCache.keys)
    }
    
    /**
     * Get cache statistics
     */
    @objc public func getStats() -> CacheStats {
        lock.lock()
        defer { lock.unlock() }
        
        let stats = CacheStats()
        stats.totalEntries = memoryCache.count
        stats.totalSize = currentSize
        stats.hits = hits
        stats.misses = misses
        stats.hitRate = (hits + misses) > 0 ? Double(hits) / Double(hits + misses) : 0
        
        var oldest = TimeInterval.greatestFiniteMagnitude
        var newest: TimeInterval = 0
        
        for entry in memoryCache.values {
            if entry.timestamp < oldest { oldest = entry.timestamp }
            if entry.timestamp > newest { newest = entry.timestamp }
        }
        
        stats.oldestEntry = oldest != TimeInterval.greatestFiniteMagnitude ? oldest : 0
        stats.newestEntry = newest
        
        return stats
    }
    
    /**
     * Cleanup expired entries
     */
    @objc public func cleanup() -> Int {
        lock.lock()
        defer { lock.unlock() }
        
        var cleaned = 0
        var toRemove: [String] = []
        
        for (key, entry) in memoryCache {
            if entry.isExpired() {
                toRemove.append(key)
            }
        }
        
        for key in toRemove {
            _ = delete(key)
            cleaned += 1
        }
        
        print("[CacheManager] Cleaned up \(cleaned) expired entries")
        return cleaned
    }
    
    /**
     * Get current cache size
     */
    @objc public func getSize() -> Int {
        lock.lock()
        defer { lock.unlock() }
        
        return currentSize
    }
    
    // MARK: - Private Methods
    
    /**
     * Evict entries to free space
     */
    private func evict(requiredSpace: Int) {
        let targetSize = Int(Double(maxSize) * 0.7) // Evict to 70%
        var freedSpace = 0
        
        var entries = Array(memoryCache)
        
        // Sort based on eviction policy
        switch evictionPolicy {
        case .lru:
            entries.sort { (a, b) in
                let timeA = accessTime[a.key] ?? 0
                let timeB = accessTime[b.key] ?? 0
                return timeA < timeB
            }
        case .lfu:
            entries.sort { (a, b) in
                let countA = accessCount[a.key] ?? 0
                let countB = accessCount[b.key] ?? 0
                return countA < countB
            }
        case .fifo:
            entries.sort { $0.value.timestamp < $1.value.timestamp }
        case .ttl:
            entries.sort { $0.value.expiresAt < $1.value.expiresAt }
        }
        
        for (key, entry) in entries {
            if currentSize - freedSpace <= targetSize && freedSpace >= requiredSpace {
                break
            }
            
            freedSpace += entry.size
            _ = delete(key)
        }
        
        print("[CacheManager] Evicted entries, freed: \(freedSpace) bytes")
    }
    
    /**
     * Save entry to disk
     */
    private func saveToDisk(_ key: String, entry: CacheEntry) {
        let fileURL = cacheDirectory.appendingPathComponent(getCacheFileName(key))
        
        do {
            let data = try JSONSerialization.data(withJSONObject: entry.toDictionary())
            try data.write(to: fileURL)
        } catch {
            print("[CacheManager] Error saving to disk: \(key), error: \(error)")
        }
    }
    
    /**
     * Load entry from disk
     */
    private func loadFromDisk(_ key: String) -> CacheEntry? {
        let fileURL = cacheDirectory.appendingPathComponent(getCacheFileName(key))
        
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return nil
        }
        
        do {
            let data = try Data(contentsOf: fileURL)
            let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            return dict.flatMap { CacheEntry.fromDictionary($0) }
        } catch {
            print("[CacheManager] Error loading from disk: \(key), error: \(error)")
            return nil
        }
    }
    
    /**
     * Get cache file name
     */
    private func getCacheFileName(_ key: String) -> String {
        return "\(key.hashValue).cache"
    }
    
    /**
     * Calculate total cache size
     */
    private func calculateCacheSize() {
        currentSize = 0
        
        if let files = try? FileManager.default.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: [.fileSizeKey]) {
            for file in files {
                if let size = try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize {
                    currentSize += size
                }
            }
        }
    }
}