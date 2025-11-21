import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(CorsBypassPlugin)
public class CorsBypassPlugin: CAPPlugin {
    private var sseConnections: [String: SSEConnection] = [:]
    private var streamTasks: [String: URLSessionDataTask] = [:]
    private var connectionCounter = 0
    private var streamCounter = 0
    private var pluginInterceptor: PluginInterceptor?
    private var cacheManager: CacheManager?
    private var cacheInterceptor: CacheInterceptor?
    
    public override func load() {
        super.load()
        
        // Initialize plugin interceptor
        pluginInterceptor = PluginInterceptor(plugin: self)
        
        // Initialize cache manager
        cacheManager = CacheManager(
            maxSize: 50 * 1024 * 1024, // 50MB
            evictionPolicy: .lru
        )
        
        // Initialize cache interceptor (disabled by default)
        if let cacheManager = cacheManager {
            cacheInterceptor = CacheInterceptor(
                cacheManager: cacheManager,
                strategy: .networkFirst,
                maxAge: 5 * 60, // 5 minutes
                enabled: false
            )
        }
        
        // Register URLProtocol for intercepting requests
        InterceptorURLProtocol.setInterceptor(pluginInterceptor!)
        URLProtocol.registerClass(InterceptorURLProtocol.self)
    }
    
    @objc func request(_ call: CAPPluginCall) {
        guard let url = call.getString("url") else {
            call.reject("URL is required")
            return
        }
        
        let method = call.getString("method") ?? "GET"
        let headers = call.getObject("headers") as? [String: String] ?? [:]
        let data = call.getValue("data")
        let params = call.getObject("params") as? [String: String]
        let timeout = call.getDouble("timeout") ?? 30.0
        let responseType = call.getString("responseType") ?? "json"
        let withCredentials = call.getBool("withCredentials") ?? false
        
        makeHttpRequest(
            url: url,
            method: method,
            headers: headers,
            data: data,
            params: params,
            timeout: timeout,
            responseType: responseType,
            withCredentials: withCredentials,
            call: call
        )
    }
    
    @objc func get(_ call: CAPPluginCall) {
        handleHttpMethod(call: call, method: "GET")
    }
    
    @objc func post(_ call: CAPPluginCall) {
        handleHttpMethod(call: call, method: "POST")
    }
    
    @objc func put(_ call: CAPPluginCall) {
        handleHttpMethod(call: call, method: "PUT")
    }
    
    @objc func patch(_ call: CAPPluginCall) {
        handleHttpMethod(call: call, method: "PATCH")
    }
    
    @objc func delete(_ call: CAPPluginCall) {
        handleHttpMethod(call: call, method: "DELETE")
    }
    
    private func handleHttpMethod(call: CAPPluginCall, method: String) {
        guard let url = call.getString("url") else {
            call.reject("URL is required")
            return
        }
        
        let headers = call.getObject("headers") as? [String: String] ?? [:]
        let data = call.getValue("data")
        let params = call.getObject("params") as? [String: String]
        let timeout = call.getDouble("timeout") ?? 30.0
        let responseType = call.getString("responseType") ?? "json"
        let withCredentials = call.getBool("withCredentials") ?? false
        
        makeHttpRequest(
            url: url,
            method: method,
            headers: headers,
            data: data,
            params: params,
            timeout: timeout,
            responseType: responseType,
            withCredentials: withCredentials,
            call: call
        )
    }
    
    private func makeHttpRequest(
        url: String,
        method: String,
        headers: [String: String],
        data: Any?,
        params: [String: String]?,
        timeout: Double,
        responseType: String,
        withCredentials: Bool,
        call: CAPPluginCall
    ) {
        var urlString = url
        
        // Add URL parameters
        if let params = params, !params.isEmpty {
            var urlComponents = URLComponents(string: url)
            var queryItems = urlComponents?.queryItems ?? []
            
            for (key, value) in params {
                queryItems.append(URLQueryItem(name: key, value: value))
            }
            
            urlComponents?.queryItems = queryItems
            urlString = urlComponents?.url?.absoluteString ?? url
        }
        
        guard let requestUrl = URL(string: urlString) else {
            call.reject("Invalid URL")
            return
        }
        
        var request = URLRequest(url: requestUrl)
        request.httpMethod = method
        request.timeoutInterval = timeout
        
        // Set headers
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        
        // Set body for non-GET requests
        if method != "GET", let data = data {
            do {
                if let jsonData = data as? [String: Any] {
                    request.httpBody = try JSONSerialization.data(withJSONObject: jsonData)
                    if request.value(forHTTPHeaderField: "Content-Type") == nil {
                        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    }
                } else if let stringData = data as? String {
                    request.httpBody = stringData.data(using: .utf8)
                }
            } catch {
                call.reject("Failed to serialize request body: \(error.localizedDescription)")
                return
            }
        }
        
        // Configure session with HTTP/2 support
        let config = URLSessionConfiguration.default
        
        // Enable HTTP/2 multiplexing
        config.httpShouldUsePipelining = true
        config.httpMaximumConnectionsPerHost = 6
        
        // Cookie and credential handling
        if withCredentials {
            config.httpCookieAcceptPolicy = .always
            config.httpShouldSetCookies = true
        }
        
        // Network service type for prioritization
        config.networkServiceType = .responsiveData
        
        // TLS configuration for modern protocols
        config.tlsMinimumSupportedProtocolVersion = .TLSv12
        
        let session = URLSession(configuration: config)
        
        let task = session.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject("Request failed: \(error.localizedDescription)")
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    call.reject("Invalid response")
                    return
                }
                
                // Detect protocol version
                var protocolVersion = "http/1.1"
                if #available(iOS 13.0, *) {
                    // iOS 13+ supports HTTP/2 detection
                    if let urlResponse = response as? HTTPURLResponse {
                        // Check for HTTP/2 indicators in response
                        if urlResponse.value(forHTTPHeaderField: ":status") != nil {
                            protocolVersion = "h2"
                        }
                    }
                }
                
                // Convert headers to dictionary
                var responseHeaders: [String: String] = [:]
                for (key, value) in httpResponse.allHeaderFields {
                    if let keyString = key as? String, let valueString = value as? String {
                        responseHeaders[keyString] = valueString
                    }
                }
                
                // Parse response data
                var responseData: Any = ""
                if let data = data {
                    switch responseType {
                    case "text":
                        responseData = String(data: data, encoding: .utf8) ?? ""
                    case "json":
                        do {
                            responseData = try JSONSerialization.jsonObject(with: data, options: [])
                        } catch {
                            responseData = String(data: data, encoding: .utf8) ?? ""
                        }
                    case "blob", "arraybuffer":
                        responseData = data.base64EncodedString()
                    default:
                        do {
                            responseData = try JSONSerialization.jsonObject(with: data, options: [])
                        } catch {
                            responseData = String(data: data, encoding: .utf8) ?? ""
                        }
                    }
                }
                
                call.resolve([
                    "data": responseData,
                    "status": httpResponse.statusCode,
                    "statusText": HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode),
                    "headers": responseHeaders,
                    "url": httpResponse.url?.absoluteString ?? url,
                    "protocolVersion": protocolVersion
                ])
            }
        }
        
        task.resume()
    }
    
    @objc func startSSE(_ call: CAPPluginCall) {
        guard let url = call.getString("url") else {
            call.reject("URL is required")
            return
        }
        
        connectionCounter += 1
        let connectionId = "sse_\(connectionCounter)"
        
        let headers = call.getObject("headers") as? [String: String] ?? [:]
        let withCredentials = call.getBool("withCredentials") ?? false
        let reconnectTimeout = call.getDouble("reconnectTimeout") ?? 3.0
        
        let sseConnection = SSEConnection(
            url: url,
            headers: headers,
            withCredentials: withCredentials,
            reconnectTimeout: reconnectTimeout,
            plugin: self,
            connectionId: connectionId
        )
        
        sseConnections[connectionId] = sseConnection
        sseConnection.connect()
        
        call.resolve(["connectionId": connectionId])
    }
    
    @objc func stopSSE(_ call: CAPPluginCall) {
        guard let connectionId = call.getString("connectionId") else {
            call.reject("Connection ID is required")
            return
        }
        
        if let connection = sseConnections[connectionId] {
            connection.disconnect()
            sseConnections.removeValue(forKey: connectionId)
        }
        
        call.resolve()
    }
    
    // MARK: - Cache Management Methods
    
    @objc func enableCache(_ call: CAPPluginCall) {
        guard let cacheManager = cacheManager else {
            call.reject("Cache manager not initialized")
            return
        }
        
        let strategyString = call.getString("strategy") ?? "networkFirst"
        let maxAge = call.getDouble("maxAge") ?? 5 * 60 // 5 minutes
        
        var strategy: CacheInterceptor.CacheStrategy = .networkFirst
        switch strategyString.lowercased() {
        case "cachefirst":
            strategy = .cacheFirst
        case "networkonly":
            strategy = .networkOnly
        case "cacheonly":
            strategy = .cacheOnly
        case "stalewhilerevalidate":
            strategy = .staleWhileRevalidate
        default:
            strategy = .networkFirst
        }
        
        // Recreate cache interceptor with new settings
        cacheInterceptor = CacheInterceptor(
            cacheManager: cacheManager,
            strategy: strategy,
            maxAge: maxAge,
            enabled: true
        )
        
        call.resolve([
            "enabled": true,
            "strategy": strategyString,
            "maxAge": maxAge
        ])
    }
    
    @objc func disableCache(_ call: CAPPluginCall) {
        guard let cacheManager = cacheManager else {
            call.reject("Cache manager not initialized")
            return
        }
        
        cacheInterceptor = CacheInterceptor(
            cacheManager: cacheManager,
            strategy: .networkOnly,
            maxAge: 0,
            enabled: false
        )
        
        call.resolve(["enabled": false])
    }
    
    @objc func getCacheStats(_ call: CAPPluginCall) {
        guard let cacheManager = cacheManager else {
            call.reject("Cache manager not initialized")
            return
        }
        
        let stats = cacheManager.getStats()
        call.resolve(stats.toDictionary())
    }
    
    @objc func clearCache(_ call: CAPPluginCall) {
        guard let cacheManager = cacheManager else {
            call.reject("Cache manager not initialized")
            return
        }
        
        cacheManager.clear()
        call.resolve(["cleared": true])
    }
    
    @objc func cleanupCache(_ call: CAPPluginCall) {
        guard let cacheManager = cacheManager else {
            call.reject("Cache manager not initialized")
            return
        }
        
        let cleaned = cacheManager.cleanup()
        call.resolve(["cleaned": cleaned])
    }
    
    @objc func getCacheKeys(_ call: CAPPluginCall) {
        guard let cacheManager = cacheManager else {
            call.reject("Cache manager not initialized")
            return
        }
        
        let keys = cacheManager.keys()
        call.resolve(["keys": keys])
    }
    
    @objc func deleteCacheEntry(_ call: CAPPluginCall) {
        guard let cacheManager = cacheManager else {
            call.reject("Cache manager not initialized")
            return
        }
        
        guard let key = call.getString("key") else {
            call.reject("Key is required")
            return
        }
        
        let deleted = cacheManager.delete(key)
        call.resolve(["deleted": deleted])
    }
    
    @objc func streamRequest(_ call: CAPPluginCall) {
        guard let url = call.getString("url") else {
            call.reject("URL is required")
            return
        }
        
        streamCounter += 1
        let streamId = "stream_\(streamCounter)"
        
        let method = call.getString("method") ?? "POST"
        let headers = call.getObject("headers") as? [String: String] ?? [:]
        let data = call.getValue("data")
        let params = call.getObject("params") as? [String: String]
        let timeout = call.getDouble("timeout") ?? 60.0
        
        var urlString = url
        
        // Add URL parameters
        if let params = params, !params.isEmpty {
            var urlComponents = URLComponents(string: url)
            var queryItems = urlComponents?.queryItems ?? []
            
            for (key, value) in params {
                queryItems.append(URLQueryItem(name: key, value: value))
            }
            
            urlComponents?.queryItems = queryItems
            urlString = urlComponents?.url?.absoluteString ?? url
        }
        
        guard let requestUrl = URL(string: urlString) else {
            call.reject("Invalid URL")
            return
        }
        
        var request = URLRequest(url: requestUrl)
        request.httpMethod = method
        request.timeoutInterval = timeout
        
        // Set headers
        request.setValue("text/event-stream, application/json, text/plain, */*", forHTTPHeaderField: "Accept")
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        
        // Set body for non-GET requests
        if method != "GET", let data = data {
            do {
                if let jsonData = data as? [String: Any] {
                    request.httpBody = try JSONSerialization.data(withJSONObject: jsonData)
                    if request.value(forHTTPHeaderField: "Content-Type") == nil {
                        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    }
                } else if let stringData = data as? String {
                    request.httpBody = stringData.data(using: .utf8)
                }
            } catch {
                call.reject("Failed to serialize request body: \(error.localizedDescription)")
                return
            }
        }
        
        // Configure session for streaming
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = timeout
        config.timeoutIntervalForResource = 0  // No timeout for streaming
        
        let session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        
        let task = session.dataTask(with: request)
        streamTasks[streamId] = task
        
        // Store stream context
        let context = StreamContext(streamId: streamId, plugin: self)
        objc_setAssociatedObject(task, &AssociatedKeys.streamContext, context, .OBJC_ASSOCIATION_RETAIN)
        
        task.resume()
        
        call.resolve(["streamId": streamId])
    }
    
    @objc func cancelStream(_ call: CAPPluginCall) {
        guard let streamId = call.getString("streamId") else {
            call.reject("Stream ID is required")
            return
        }
        
        if let task = streamTasks[streamId] {
            task.cancel()
            streamTasks.removeValue(forKey: streamId)
            
            notifyListeners("streamStatus", data: [
                "streamId": streamId,
                "status": "cancelled"
            ])
        }
        
        call.resolve()
    }
    
    // SSE event handlers
    func notifySSEOpen(connectionId: String) {
        notifyListeners("sseOpen", data: [
            "connectionId": connectionId,
            "status": "connected"
        ])
    }
    
    func notifySSEMessage(connectionId: String, data: String, id: String?, type: String?) {
        var eventData: [String: Any] = [
            "connectionId": connectionId,
            "data": data
        ]
        
        if let id = id {
            eventData["id"] = id
        }
        
        if let type = type {
            eventData["type"] = type
        }
        
        notifyListeners("sseMessage", data: eventData)
    }
    
    
    // MARK: - Interceptor Management
    
    @objc func addInterceptor(_ call: CAPPluginCall) {
        guard let pluginInterceptor = pluginInterceptor else {
            call.reject("Interceptor system not initialized")
            return
        }
        
        let options = call.getObject("options") ?? [:]
        let id = pluginInterceptor.addInterceptor(options: options)
        
        var result: [String: Any] = ["id": id]
        if let name = options["name"] as? String {
            result["name"] = name
        }
        
        call.resolve(result)
    }
    
    @objc func removeInterceptor(_ call: CAPPluginCall) {
        guard let pluginInterceptor = pluginInterceptor else {
            call.reject("Interceptor system not initialized")
            return
        }
        
        var id: String?
        
        // Try to get id directly
        if let handleString = call.getString("handle") {
            id = handleString
        } else if let handle = call.getObject("handle") {
            id = handle["id"] as? String
        }
        
        guard let interceptorId = id else {
            call.reject("Interceptor ID is required")
            return
        }
        
        let removed = pluginInterceptor.removeInterceptor(id: interceptorId)
        if removed {
            call.resolve()
        } else {
            call.reject("Interceptor not found")
        }
    }
    
    @objc func removeAllInterceptors(_ call: CAPPluginCall) {
        guard let pluginInterceptor = pluginInterceptor else {
            call.reject("Interceptor system not initialized")
            return
        }
        
        pluginInterceptor.removeAllInterceptors()
        call.resolve()
    }
    
    @objc func getInterceptors(_ call: CAPPluginCall) {
        guard let pluginInterceptor = pluginInterceptor else {
            call.reject("Interceptor system not initialized")
            return
        }
        
        let interceptors = pluginInterceptor.getAllInterceptors()
        call.resolve(["interceptors": interceptors])
    }
    
    func notifySSEError(connectionId: String, error: String) {
        notifyListeners("sseError", data: [
            "connectionId": connectionId,
            "error": error
        ])
    }
    
    func notifySSEClose(connectionId: String) {
        notifyListeners("sseClose", data: [
            "connectionId": connectionId,
            "status": "disconnected"
        ])
    }
    
    @objc func cancelStream(_ call: CAPPluginCall) {
        guard let streamId = call.getString("streamId") else {
            call.reject("Stream ID is required")
            return
        }
        
        if let task = streamTasks[streamId] {
            task.cancel()
            streamTasks.removeValue(forKey: streamId)
        }
        
        call.resolve()
    }
}

// MARK: - Stream Support

private struct AssociatedKeys {
    static var streamContext = "streamContext"
}

private class StreamContext {
    let streamId: String
    weak var plugin: CorsBypassPlugin?
    var receivedData = Data()
    
    init(streamId: String, plugin: CorsBypassPlugin) {
        self.streamId = streamId
        self.plugin = plugin
    }
}

extension CorsBypassPlugin: URLSessionDataDelegate {
    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        
        guard let context = objc_getAssociatedObject(dataTask, &AssociatedKeys.streamContext) as? StreamContext else {
            completionHandler(.cancel)
            return
        }
        
        guard let httpResponse = response as? HTTPURLResponse else {
            context.plugin?.notifyListeners("streamStatus", data: [
                "streamId": context.streamId,
                "status": "error",
                "error": "Invalid response"
            ])
            completionHandler(.cancel)
            return
        }
        
        // Convert headers to dictionary
        var responseHeaders: [String: String] = [:]
        for (key, value) in httpResponse.allHeaderFields {
            if let keyString = key as? String, let valueString = value as? String {
                responseHeaders[keyString] = valueString
            }
        }
        
        // Notify stream started
        context.plugin?.notifyListeners("streamStatus", data: [
            "streamId": context.streamId,
            "status": "started",
            "statusCode": httpResponse.statusCode,
            "headers": responseHeaders
        ])
        
        if httpResponse.statusCode == 200 {
            completionHandler(.allow)
        } else {
            context.plugin?.notifyListeners("streamStatus", data: [
                "streamId": context.streamId,
                "status": "error",
                "error": "HTTP \(httpResponse.statusCode)"
            ])
            completionHandler(.cancel)
        }
    }
    
    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard let context = objc_getAssociatedObject(dataTask, &AssociatedKeys.streamContext) as? StreamContext else {
            return
        }
        
        guard let chunk = String(data: data, encoding: .utf8) else {
            return
        }
        
        // Send chunk to listeners
        context.plugin?.notifyListeners("streamChunk", data: [
            "streamId": context.streamId,
            "data": chunk,
            "done": false
        ])
    }
    
    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let dataTask = task as? URLSessionDataTask,
              let context = objc_getAssociatedObject(dataTask, &AssociatedKeys.streamContext) as? StreamContext else {
            return
        }
        
        streamTasks.removeValue(forKey: context.streamId)
        
        if let error = error {
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled {
                // Already notified in cancelStream
                return
            }
            
            context.plugin?.notifyListeners("streamChunk", data: [
                "streamId": context.streamId,
                "data": "",
                "done": true,
                "error": error.localizedDescription
            ])
            
            context.plugin?.notifyListeners("streamStatus", data: [
                "streamId": context.streamId,
                "status": "error",
                "error": error.localizedDescription
            ])
        } else {
            // Stream completed successfully
            context.plugin?.notifyListeners("streamChunk", data: [
                "streamId": context.streamId,
                "data": "",
                "done": true
            ])
            
            context.plugin?.notifyListeners("streamStatus", data: [
                "streamId": context.streamId,
                "status": "completed"
            ])
        }
    }
}
