import Foundation
import Capacitor

/**
 * Plugin Interceptor Manager
 * Manages custom interceptors for HTTP requests
 */
@objc public class PluginInterceptor: NSObject {
    
    // MARK: - Types
    
    struct InterceptorEntry {
        let id: String
        var name: String?
        var priority: Int
        var enabled: Bool
        var scope: InterceptorScope?
    }
    
    struct InterceptorScope {
        let urlPattern: String?
        let methods: [String]?
        
        func matches(url: String, method: String) -> Bool {
            // Check URL pattern
            if let pattern = urlPattern {
                let regex = try? NSRegularExpression(pattern: pattern, options: [])
                let range = NSRange(url.startIndex..., in: url)
                if regex?.firstMatch(in: url, options: [], range: range) == nil {
                    return false
                }
            }
            
            // Check method
            if let methods = methods, !methods.isEmpty, !methods.contains(method) {
                return false
            }
            
            return true
        }
    }
    
    // MARK: - Properties
    
    private var interceptors: [InterceptorEntry] = []
    private var interceptorCounter = 0
    private let lock = NSLock()
    private weak var plugin: CorsBypassPlugin?
    
    // MARK: - Initialization
    
    init(plugin: CorsBypassPlugin) {
        self.plugin = plugin
        super.init()
    }
    
    // MARK: - Public Methods
    
    /**
     * Add interceptor
     */
    func addInterceptor(options: [String: Any]) -> String {
        lock.lock()
        defer { lock.unlock() }
        
        interceptorCounter += 1
        let id = "interceptor_\(interceptorCounter)"
        let name = options["name"] as? String
        let priority = options["priority"] as? Int ?? 0
        let enabled = options["enabled"] as? Bool ?? true
        
        // Parse scope
        var scope: InterceptorScope?
        if let scopeDict = options["scope"] as? [String: Any] {
            let urlPattern = scopeDict["urlPattern"] as? String
            let methods = scopeDict["methods"] as? [String]
            scope = InterceptorScope(urlPattern: urlPattern, methods: methods)
        }
        
        let entry = InterceptorEntry(
            id: id,
            name: name,
            priority: priority,
            enabled: enabled,
            scope: scope
        )
        
        interceptors.append(entry)
        
        // Sort by priority (higher first)
        interceptors.sort { $0.priority > $1.priority }
        
        print("[PluginInterceptor] Added interceptor: \(id) (priority: \(priority))")
        return id
    }
    
    /**
     * Remove interceptor
     */
    func removeInterceptor(id: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        
        if let index = interceptors.firstIndex(where: { $0.id == id }) {
            interceptors.remove(at: index)
            print("[PluginInterceptor] Removed interceptor: \(id)")
            return true
        }
        return false
    }
    
    /**
     * Remove all interceptors
     */
    func removeAllInterceptors() {
        lock.lock()
        defer { lock.unlock() }
        
        interceptors.removeAll()
        print("[PluginInterceptor] Removed all interceptors")
    }
    
    /**
     * Get all interceptors
     */
    func getAllInterceptors() -> [[String: Any]] {
        lock.lock()
        defer { lock.unlock() }
        
        return interceptors.map { entry in
            var dict: [String: Any] = [
                "id": entry.id,
                "enabled": entry.enabled
            ]
            if let name = entry.name {
                dict["name"] = name
            }
            return dict
        }
    }
    
    /**
     * Enable/disable interceptor
     */
    func setInterceptorEnabled(id: String, enabled: Bool) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        
        if let index = interceptors.firstIndex(where: { $0.id == id }) {
            interceptors[index].enabled = enabled
            print("[PluginInterceptor] \(enabled ? "Enabled" : "Disabled") interceptor: \(id)")
            return true
        }
        return false
    }
    
    // MARK: - Interceptor Execution
    
    /**
     * Execute request interceptors
     */
    func executeRequestInterceptors(config: [String: Any]) -> [String: Any] {
        lock.lock()
        let activeInterceptors = interceptors.filter { $0.enabled }
        lock.unlock()
        
        var modifiedConfig = config
        
        for entry in activeInterceptors {
            // Check scope
            if let scope = entry.scope {
                let url = config["url"] as? String ?? ""
                let method = config["method"] as? String ?? ""
                if !scope.matches(url: url, method: method) {
                    continue
                }
            }
            
            // Notify plugin to execute JS interceptor
            let event: [String: Any] = [
                "type": "onRequest",
                "interceptorId": entry.id,
                "config": modifiedConfig
            ]
            
            print("[PluginInterceptor] Request interceptor: \(entry.id)")
            
            // Note: In a real implementation, we would need to wait for JS response
            // For now, we just log the execution
        }
        
        return modifiedConfig
    }
    
    /**
     * Execute response interceptors
     */
    func executeResponseInterceptors(response: [String: Any]) -> [String: Any] {
        lock.lock()
        let activeInterceptors = interceptors.filter { $0.enabled }
        lock.unlock()
        
        var modifiedResponse = response
        
        for entry in activeInterceptors {
            // Notify plugin to execute JS interceptor
            let event: [String: Any] = [
                "type": "onResponse",
                "interceptorId": entry.id,
                "response": modifiedResponse
            ]
            
            print("[PluginInterceptor] Response interceptor: \(entry.id)")
        }
        
        return modifiedResponse
    }
    
    /**
     * Execute error interceptors
     */
    func executeErrorInterceptors(error: [String: Any]) -> [String: Any]? {
        lock.lock()
        let activeInterceptors = interceptors.filter { $0.enabled }
        lock.unlock()
        
        for entry in activeInterceptors {
            // Notify plugin to execute JS interceptor
            let event: [String: Any] = [
                "type": "onError",
                "interceptorId": entry.id,
                "error": error
            ]
            
            print("[PluginInterceptor] Error interceptor: \(entry.id)")
        }
        
        return nil
    }
}

/**
 * URLProtocol-based interceptor for URLSession
 */
class InterceptorURLProtocol: URLProtocol {
    
    private static var interceptor: PluginInterceptor?
    
    static func setInterceptor(_ interceptor: PluginInterceptor) {
        self.interceptor = interceptor
    }
    
    override class func canInit(with request: URLRequest) -> Bool {
        // Check if we've already handled this request
        if URLProtocol.property(forKey: "HandledByInterceptor", in: request) != nil {
            return false
        }
        
        // Only intercept if we have an interceptor configured
        return interceptor != nil
    }
    
    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        return request
    }
    
    override func startLoading() {
        guard let interceptor = InterceptorURLProtocol.interceptor else {
            client?.urlProtocolDidFinishLoading(self)
            return
        }
        
        // Execute request interceptors
        var config: [String: Any] = [
            "url": request.url?.absoluteString ?? "",
            "method": request.httpMethod ?? "GET"
        ]
        
        if let headers = request.allHTTPHeaderFields {
            config["headers"] = headers
        }
        
        let modifiedConfig = interceptor.executeRequestInterceptors(config: config)
        
        // Create modified request if needed
        let modifiedRequest = (request as NSURLRequest).mutableCopy() as! NSMutableURLRequest
        if let modifiedHeaders = modifiedConfig["headers"] as? [String: String] {
            for (key, value) in modifiedHeaders {
                modifiedRequest.setValue(value, forHTTPHeaderField: key)
            }
        }
        
        // Mark the request as handled to prevent infinite loops
        URLProtocol.setProperty(true, forKey: "HandledByInterceptor", in: modifiedRequest)
        
        // Execute the actual request
        let task = URLSession.shared.dataTask(with: modifiedRequest as URLRequest) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                // Execute error interceptors
                let errorDict: [String: Any] = [
                    "message": error.localizedDescription,
                    "config": config
                ]
                _ = interceptor.executeErrorInterceptors(error: errorDict)
                
                self.client?.urlProtocol(self, didFailWithError: error)
                return
            }
            
            if let response = response as? HTTPURLResponse {
                // Execute response interceptors
                var responseDict: [String: Any] = [
                    "status": response.statusCode,
                    "statusText": HTTPURLResponse.localizedString(forStatusCode: response.statusCode),
                    "url": response.url?.absoluteString ?? ""
                ]
                
                var headers: [String: String] = [:]
                for (key, value) in response.allHeaderFields {
                    if let keyString = key as? String, let valueString = value as? String {
                        headers[keyString] = valueString
                    }
                }
                responseDict["headers"] = headers
                
                _ = interceptor.executeResponseInterceptors(response: responseDict)
                
                self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            }
            
            if let data = data {
                self.client?.urlProtocol(self, didLoad: data)
            }
            
            self.client?.urlProtocolDidFinishLoading(self)
        }
        
        task.resume()
    }
    
    override func stopLoading() {
        // Cancel any ongoing requests
    }
}