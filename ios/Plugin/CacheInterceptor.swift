import Foundation

/**
 * Cache Interceptor for URLSession
 * URLSession 缓存拦截器
 */
@objc public class CacheInterceptor: NSObject {
    
    // MARK: - Types
    
    /**
     * Cache Strategy
     */
    @objc public enum CacheStrategy: Int {
        case networkFirst
        case cacheFirst
        case networkOnly
        case cacheOnly
        case staleWhileRevalidate
    }
    
    // MARK: - Properties
    
    private let cacheManager: CacheManager
    private let strategy: CacheStrategy
    private let maxAge: TimeInterval
    private let enabled: Bool
    
    // MARK: - Initialization
    
    @objc public init(cacheManager: CacheManager, strategy: CacheStrategy, maxAge: TimeInterval, enabled: Bool) {
        self.cacheManager = cacheManager
        self.strategy = strategy
        self.maxAge = maxAge
        self.enabled = enabled
        
        super.init()
        
        print("[CacheInterceptor] Initialized with strategy: \(strategy)")
    }
    
    // MARK: - Public Methods
    
    /**
     * Intercept request
     */
    public func interceptRequest(
        url: String,
        method: String,
        headers: [String: String],
        data: Any?,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        guard enabled else {
            completion(.failure(NSError(domain: "CacheInterceptor", code: -1, userInfo: [NSLocalizedDescriptionKey: "Cache not enabled"])))
            return
        }
        
        let cacheKey = generateCacheKey(url: url, method: method)
        
        // Check if should exclude
        if shouldExclude(url: url, method: method) {
            completion(.failure(NSError(domain: "CacheInterceptor", code: -2, userInfo: [NSLocalizedDescriptionKey: "Request excluded from cache"])))
            return
        }
        
        switch strategy {
        case .cacheFirst, .cacheOnly:
            handleCacheFirst(cacheKey: cacheKey, url: url, method: method, headers: headers, data: data, completion: completion)
            
        case .networkOnly:
            completion(.failure(NSError(domain: "CacheInterceptor", code: -3, userInfo: [NSLocalizedDescriptionKey: "Network only mode"])))
            
        case .staleWhileRevalidate:
            handleStaleWhileRevalidate(cacheKey: cacheKey, url: url, method: method, headers: headers, data: data, completion: completion)
            
        case .networkFirst:
            completion(.failure(NSError(domain: "CacheInterceptor", code: -4, userInfo: [NSLocalizedDescriptionKey: "Network first - proceed with request"])))
        }
    }
    
    /**
     * Cache response
     */
    @objc public func cacheResponse(
        url: String,
        method: String,
        status: Int,
        headers: [String: String],
        data: String
    ) {
        guard enabled else { return }
        
        let cacheKey = generateCacheKey(url: url, method: method)
        
        // Create cache entry
        let entry = CacheManager.CacheEntry(
            key: cacheKey,
            data: data,
            headers: headers,
            status: status,
            maxAge: maxAge
        )
        
        // Set metadata
        let metadata = CacheManager.CacheMetadata(url: url, method: method)
        metadata.etag = headers["ETag"] ?? headers["etag"]
        metadata.lastModified = headers["Last-Modified"] ?? headers["last-modified"]
        entry.metadata = metadata
        
        // Save to cache
        cacheManager.put(cacheKey, entry: entry)
        
        print("[CacheInterceptor] Cached response for: \(cacheKey)")
    }
    
    /**
     * Handle error with cache fallback
     */
    @objc public func handleError(
        url: String,
        method: String,
        error: Error
    ) -> [String: Any]? {
        guard enabled else { return nil }
        
        let cacheKey = generateCacheKey(url: url, method: method)
        
        // Try to use cache on error
        if let cached = cacheManager.get(cacheKey) {
            print("[CacheInterceptor] Using cached response due to error")
            return createResponseFromCache(cached)
        }
        
        return nil
    }
    
    /**
     * Get cache manager
     */
    @objc public func getCacheManager() -> CacheManager {
        return cacheManager
    }
    
    // MARK: - Private Methods
    
    /**
     * Handle Cache-First Strategy
     */
    private func handleCacheFirst(
        cacheKey: String,
        url: String,
        method: String,
        headers: [String: String],
        data: Any?,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        // Check cache first
        if let cached = cacheManager.get(cacheKey) {
            print("[CacheInterceptor] Cache hit for: \(cacheKey)")
            completion(.success(createResponseFromCache(cached)))
            return
        }
        
        // Cache miss
        if strategy == .cacheOnly {
            completion(.failure(NSError(domain: "CacheInterceptor", code: -5, userInfo: [NSLocalizedDescriptionKey: "Cache miss in cache-only mode"])))
            return
        }
        
        // Proceed with network request
        completion(.failure(NSError(domain: "CacheInterceptor", code: -6, userInfo: [NSLocalizedDescriptionKey: "Cache miss - proceed with network"])))
    }
    
    /**
     * Handle Stale-While-Revalidate Strategy
     */
    private func handleStaleWhileRevalidate(
        cacheKey: String,
        url: String,
        method: String,
        headers: [String: String],
        data: Any?,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        if let cached = cacheManager.get(cacheKey) {
            print("[CacheInterceptor] Returning stale cache for: \(cacheKey)")
            
            // Return cached response immediately
            completion(.success(createResponseFromCache(cached)))
            
            // Revalidate in background (simplified)
            DispatchQueue.global(qos: .background).async {
                print("[CacheInterceptor] Background revalidation for: \(cacheKey)")
                // In production, this would trigger an actual network request
            }
            return
        }
        
        // No cache, proceed with network
        completion(.failure(NSError(domain: "CacheInterceptor", code: -7, userInfo: [NSLocalizedDescriptionKey: "No cache - proceed with network"])))
    }
    
    /**
     * Create response from cache
     */
    private func createResponseFromCache(_ cached: CacheManager.CacheEntry) -> [String: Any] {
        var response: [String: Any] = [
            "data": cached.data,
            "status": cached.status,
            "statusText": "OK",
            "headers": cached.headers,
            "url": cached.metadata?.url ?? ""
        ]
        
        // Add cache indicators
        var headers = cached.headers
        headers["X-Cache"] = "HIT"
        headers["X-Cache-Timestamp"] = String(cached.timestamp)
        response["headers"] = headers
        
        return response
    }
    
    /**
     * Generate cache key
     */
    private func generateCacheKey(url: String, method: String) -> String {
        // Remove query parameters if needed
        // let cleanUrl = url.components(separatedBy: "?")[0]
        
        return "\(method):\(url)"
    }
    
    /**
     * Check if should exclude this request
     */
    private func shouldExclude(url: String, method: String) -> Bool {
        // Don't cache POST, PUT, DELETE by default
        if method == "POST" || method == "PUT" || method == "DELETE" || method == "PATCH" {
            return true
        }
        
        // Don't cache auth endpoints
        if url.contains("/auth/") || url.contains("/login") {
            return true
        }
        
        return false
    }
}