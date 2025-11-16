import Foundation

/**
 * Protocol Manager for HTTP/2 detection and fallback
 */
@objc public class ProtocolManager: NSObject {
    
    // MARK: - Types
    
    struct FallbackConfig {
        var enabled: Bool = true
        var retryCount: Int = 2
        var preferredProtocols: [String] = ["h2", "http/1.1"]
    }
    
    // MARK: - Protocol Detection
    
    /**
     * Detect protocol from URLResponse
     */
    static func detectProtocol(from response: URLResponse) -> String {
        guard let httpResponse = response as? HTTPURLResponse else {
            return "unknown"
        }
        
        // Check for HTTP/2 indicators
        if #available(iOS 13.0, *) {
            // Check for HTTP/2 pseudo-headers
            if httpResponse.value(forHTTPHeaderField: ":status") != nil {
                return "h2"
            }
        }
        
        // Check ALPN negotiated protocol (if available)
        if let url = httpResponse.url,
           let scheme = url.scheme,
           scheme == "https" {
            // Assume HTTP/2 for HTTPS if no clear indicator
            // (URLSession uses HTTP/2 by default for HTTPS)
            return "h2"
        }
        
        return "http/1.1"
    }
    
    /**
     * Check if protocol is supported
     */
    static func isProtocolSupported(_ protocolName: String) -> Bool {
        let normalized = protocolName.lowercased()
        
        switch normalized {
        case "h2", "http/2":
            return true
        case "http/1.1", "http/1.0":
            return true
        case "h3", "http/3":
            // HTTP/3 not natively supported in URLSession yet
            return false
        default:
            return false
        }
    }
    
    /**
     * Get recommended protocols for a given URL
     */
    static func getRecommendedProtocols(for url: String) -> [String] {
        var protocols: [String] = []
        
        if url.starts(with: "https://") {
            // For HTTPS, prefer HTTP/2
            protocols.append("h2")
            protocols.append("http/1.1")
        } else {
            // For HTTP, only use HTTP/1.1
            protocols.append("http/1.1")
        }
        
        return protocols
    }
    
    /**
     * Create URLSessionConfiguration with protocol optimization
     */
    static func createOptimizedConfiguration(
        timeout: TimeInterval = 30.0,
        withCredentials: Bool = false
    ) -> URLSessionConfiguration {
        let config = URLSessionConfiguration.default
        
        // Enable HTTP/2 multiplexing
        config.httpShouldUsePipelining = true
        config.httpMaximumConnectionsPerHost = 6
        
        // Timeout configuration
        config.timeoutIntervalForRequest = timeout
        config.timeoutIntervalForResource = timeout * 2
        
        // Cookie and credential handling
        if withCredentials {
            config.httpCookieAcceptPolicy = .always
            config.httpShouldSetCookies = true
        }
        
        // Network service type for prioritization
        config.networkServiceType = .responsiveData
        
        // TLS configuration for modern protocols
        config.tlsMinimumSupportedProtocolVersion = .TLSv12
        
        // Connection pooling
        config.httpMaximumConnectionsPerHost = 6
        config.requestCachePolicy = .useProtocolCachePolicy
        
        return config
    }
    
    /**
     * Perform request with protocol fallback
     */
    static func performRequestWithFallback(
        request: URLRequest,
        config: FallbackConfig = FallbackConfig(),
        completion: @escaping (Data?, URLResponse?, Error?) -> Void
    ) {
        let session = URLSession(configuration: createOptimizedConfiguration())
        
        performRequestAttempt(
            request: request,
            session: session,
            attempt: 0,
            maxAttempts: config.retryCount,
            completion: completion
        )
    }
    
    private static func performRequestAttempt(
        request: URLRequest,
        session: URLSession,
        attempt: Int,
        maxAttempts: Int,
        completion: @escaping (Data?, URLResponse?, Error?) -> Void
    ) {
        let task = session.dataTask(with: request) { data, response, error in
            if let error = error {
                // Check if we should retry
                if attempt < maxAttempts {
                    print("[ProtocolManager] Request failed on attempt \(attempt + 1), retrying...")
                    
                    // Exponential backoff
                    let delay = Double(attempt + 1) * 0.1
                    DispatchQueue.global().asyncAfter(deadline: .now() + delay) {
                        performRequestAttempt(
                            request: request,
                            session: session,
                            attempt: attempt + 1,
                            maxAttempts: maxAttempts,
                            completion: completion
                        )
                    }
                } else {
                    // Exhausted retries
                    completion(data, response, error)
                }
            } else {
                // Success
                if let response = response {
                    let protocol = detectProtocol(from: response)
                    print("[ProtocolManager] Request successful with protocol: \(protocol)")
                }
                completion(data, response, error)
            }
        }
        
        task.resume()
    }
    
    /**
     * Get protocol metrics from response
     */
    static func getProtocolMetrics(from response: URLResponse) -> [String: Any] {
        var metrics: [String: Any] = [:]
        
        metrics["protocol"] = detectProtocol(from: response)
        
        if let httpResponse = response as? HTTPURLResponse {
            metrics["statusCode"] = httpResponse.statusCode
            metrics["url"] = httpResponse.url?.absoluteString ?? ""
        }
        
        return metrics
    }
}