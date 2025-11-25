import Foundation
import Capacitor

/**
 * Proxy Manager for handling network proxy configurations on iOS
 * Supports HTTP, HTTPS, SOCKS4, and SOCKS5 proxies
 */
public class ProxyManager {
    
    // MARK: - Properties
    
    private var enabled: Bool = false
    private var type: String = "http"
    private var host: String = ""
    private var port: Int = 8080
    private var username: String?
    private var password: String?
    private var bypass: [String] = []
    private var applyToAll: Bool = true
    
    // Statistics
    private var requestCount: Int = 0
    private var lastSuccessTime: Date?
    private var lastError: String?
    
    // MARK: - Initialization
    
    public init() {}
    
    // MARK: - Configuration
    
    /**
     * Configure global proxy settings
     */
    public func setConfig(_ config: JSObject?) {
        guard let config = config else {
            clearConfig()
            return
        }
        
        enabled = config["enabled"] as? Bool ?? false
        type = config["type"] as? String ?? "http"
        host = config["host"] as? String ?? ""
        port = config["port"] as? Int ?? 8080
        username = config["username"] as? String
        password = config["password"] as? String
        applyToAll = config["applyToAll"] as? Bool ?? true
        
        if let bypassArray = config["bypass"] as? [String] {
            bypass = bypassArray
        } else {
            bypass = []
        }
        
        print("[ProxyManager] Proxy configured: \(type)://\(host):\(port) (enabled: \(enabled))")
    }
    
    /**
     * Clear proxy configuration
     */
    public func clearConfig() {
        enabled = false
        type = "http"
        host = ""
        port = 8080
        username = nil
        password = nil
        bypass = []
        applyToAll = true
        lastError = nil
        
        print("[ProxyManager] Proxy configuration cleared")
    }
    
    /**
     * Get current proxy configuration as JSObject
     */
    public func getConfig() -> JSObject? {
        guard enabled else { return nil }
        
        var config: JSObject = [
            "enabled": enabled,
            "type": type,
            "host": host,
            "port": port,
            "applyToAll": applyToAll,
            "bypass": bypass
        ]
        
        if let username = username {
            config["username"] = username
        }
        
        return config
    }
    
    /**
     * Get proxy status
     */
    public func getStatus() -> JSObject {
        var status: JSObject = [
            "active": enabled && !host.isEmpty,
            "requestCount": requestCount
        ]
        
        if let lastError = lastError {
            status["lastError"] = lastError
        }
        
        if let lastSuccessTime = lastSuccessTime {
            status["lastSuccessTime"] = lastSuccessTime.timeIntervalSince1970 * 1000
        }
        
        if enabled, let config = getConfig() {
            status["config"] = config
        }
        
        return status
    }
    
    /**
     * Check if proxy is enabled and configured
     */
    public var isEnabled: Bool {
        return enabled && !host.isEmpty
    }
    
    // MARK: - Bypass Logic
    
    /**
     * Check if URL should bypass proxy
     */
    public func shouldBypass(url: String) -> Bool {
        guard !bypass.isEmpty else { return false }
        
        guard let parsedUrl = URL(string: url), let urlHost = parsedUrl.host else {
            return false
        }
        
        for pattern in bypass {
            if matchesPattern(host: urlHost, pattern: pattern) {
                return true
            }
        }
        
        return false
    }
    
    /**
     * Simple wildcard pattern matching for bypass list
     */
    private func matchesPattern(host: String, pattern: String) -> Bool {
        if pattern.hasPrefix("*.") {
            // Wildcard domain match
            let suffix = String(pattern.dropFirst(1))
            return host.hasSuffix(suffix) || host == String(pattern.dropFirst(2))
        } else if pattern.hasSuffix(".*") {
            // Wildcard IP match
            let prefix = String(pattern.dropLast(1))
            return host.hasPrefix(prefix)
        } else {
            return host.lowercased() == pattern.lowercased()
        }
    }
    
    // MARK: - URLSession Configuration
    
    /**
     * Apply proxy configuration to URLSessionConfiguration
     */
    public func applyToSessionConfig(_ config: URLSessionConfiguration) {
        guard isEnabled else { return }
        
        var proxyDict: [AnyHashable: Any] = [:]
        
        switch type.lowercased() {
        case "socks4", "socks5", "socks":
            proxyDict[kCFStreamPropertySOCKSProxyHost as String] = host
            proxyDict[kCFStreamPropertySOCKSProxyPort as String] = port
            
            if let username = username, !username.isEmpty {
                proxyDict[kCFStreamPropertySOCKSUser as String] = username
                proxyDict[kCFStreamPropertySOCKSPassword as String] = password ?? ""
            }
            
        case "https":
            proxyDict[kCFNetworkProxiesHTTPSEnable as String] = true
            proxyDict[kCFNetworkProxiesHTTPSProxy as String] = host
            proxyDict[kCFNetworkProxiesHTTPSPort as String] = port
            
        case "http":
            fallthrough
        default:
            proxyDict[kCFNetworkProxiesHTTPEnable as String] = true
            proxyDict[kCFNetworkProxiesHTTPProxy as String] = host
            proxyDict[kCFNetworkProxiesHTTPPort as String] = port
        }
        
        config.connectionProxyDictionary = proxyDict
        
        print("[ProxyManager] Proxy applied to session config: \(type)://\(host):\(port)")
    }
    
    /**
     * Apply proxy configuration considering per-request config and bypass list
     */
    public func applyToSessionConfig(_ config: URLSessionConfiguration, url: String, requestProxy: JSObject?) {
        // Check if request has its own proxy config
        if let requestProxy = requestProxy, requestProxy["enabled"] as? Bool == true {
            applyRequestProxy(config, proxyConfig: requestProxy)
            return
        }
        
        // Check if global proxy should apply
        guard isEnabled && applyToAll else { return }
        
        // Check bypass list
        if shouldBypass(url: url) {
            print("[ProxyManager] Bypassing proxy for URL: \(url)")
            return
        }
        
        applyToSessionConfig(config)
    }
    
    /**
     * Apply per-request proxy configuration
     */
    private func applyRequestProxy(_ config: URLSessionConfiguration, proxyConfig: JSObject) {
        let proxyType = proxyConfig["type"] as? String ?? "http"
        let proxyHost = proxyConfig["host"] as? String ?? ""
        let proxyPort = proxyConfig["port"] as? Int ?? 8080
        
        guard !proxyHost.isEmpty else { return }
        
        var proxyDict: [AnyHashable: Any] = [:]
        
        switch proxyType.lowercased() {
        case "socks4", "socks5", "socks":
            proxyDict[kCFStreamPropertySOCKSProxyHost as String] = proxyHost
            proxyDict[kCFStreamPropertySOCKSProxyPort as String] = proxyPort
            
            if let username = proxyConfig["username"] as? String, !username.isEmpty {
                proxyDict[kCFStreamPropertySOCKSUser as String] = username
                proxyDict[kCFStreamPropertySOCKSPassword as String] = proxyConfig["password"] as? String ?? ""
            }
            
        case "https":
            proxyDict[kCFNetworkProxiesHTTPSEnable as String] = true
            proxyDict[kCFNetworkProxiesHTTPSProxy as String] = proxyHost
            proxyDict[kCFNetworkProxiesHTTPSPort as String] = proxyPort
            
        default:
            proxyDict[kCFNetworkProxiesHTTPEnable as String] = true
            proxyDict[kCFNetworkProxiesHTTPProxy as String] = proxyHost
            proxyDict[kCFNetworkProxiesHTTPPort as String] = proxyPort
        }
        
        config.connectionProxyDictionary = proxyDict
        
        print("[ProxyManager] Per-request proxy applied: \(proxyType)://\(proxyHost):\(proxyPort)")
    }
    
    // MARK: - Proxy Testing
    
    /**
     * Test proxy connection
     */
    public func testProxy(_ proxyConfig: JSObject, testUrl: String?, completion: @escaping (JSObject) -> Void) {
        let startTime = Date()
        
        let proxyType = proxyConfig["type"] as? String ?? "http"
        let proxyHost = proxyConfig["host"] as? String ?? ""
        let proxyPort = proxyConfig["port"] as? Int ?? 8080
        
        guard !proxyHost.isEmpty else {
            completion([
                "success": false,
                "error": "Proxy host is required"
            ])
            return
        }
        
        let urlString = testUrl ?? "https://www.google.com"
        guard let url = URL(string: urlString) else {
            completion([
                "success": false,
                "error": "Invalid test URL"
            ])
            return
        }
        
        // Configure session with proxy
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 10
        
        var proxyDict: [AnyHashable: Any] = [:]
        
        switch proxyType.lowercased() {
        case "socks4", "socks5", "socks":
            proxyDict[kCFStreamPropertySOCKSProxyHost as String] = proxyHost
            proxyDict[kCFStreamPropertySOCKSProxyPort as String] = proxyPort
            
            if let username = proxyConfig["username"] as? String, !username.isEmpty {
                proxyDict[kCFStreamPropertySOCKSUser as String] = username
                proxyDict[kCFStreamPropertySOCKSPassword as String] = proxyConfig["password"] as? String ?? ""
            }
            
        case "https":
            proxyDict[kCFNetworkProxiesHTTPSEnable as String] = true
            proxyDict[kCFNetworkProxiesHTTPSProxy as String] = proxyHost
            proxyDict[kCFNetworkProxiesHTTPSPort as String] = proxyPort
            
        default:
            proxyDict[kCFNetworkProxiesHTTPEnable as String] = true
            proxyDict[kCFNetworkProxiesHTTPProxy as String] = proxyHost
            proxyDict[kCFNetworkProxiesHTTPPort as String] = proxyPort
        }
        
        config.connectionProxyDictionary = proxyDict
        
        let session = URLSession(configuration: config)
        
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        
        let task = session.dataTask(with: request) { _, response, error in
            let responseTime = Date().timeIntervalSince(startTime) * 1000
            
            if let error = error {
                completion([
                    "success": false,
                    "responseTime": Int(responseTime),
                    "error": error.localizedDescription
                ])
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                completion([
                    "success": false,
                    "responseTime": Int(responseTime),
                    "error": "Invalid response"
                ])
                return
            }
            
            let success = (200..<400).contains(httpResponse.statusCode)
            
            completion([
                "success": success,
                "responseTime": Int(responseTime),
                "statusCode": httpResponse.statusCode
            ])
            
            print("[ProxyManager] Proxy test completed: \(success ? "success" : "failed") in \(Int(responseTime))ms")
        }
        
        task.resume()
    }
    
    // MARK: - Statistics
    
    /**
     * Record successful request
     */
    public func recordSuccess() {
        requestCount += 1
        lastSuccessTime = Date()
        lastError = nil
    }
    
    /**
     * Record failed request
     */
    public func recordError(_ error: String) {
        requestCount += 1
        lastError = error
    }
}
