import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(CorsBypassPlugin)
public class CorsBypassPlugin: CAPPlugin {
    private var sseConnections: [String: SSEConnection] = [:]
    private var connectionCounter = 0
    
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
        
        // Configure session
        let config = URLSessionConfiguration.default
        if withCredentials {
            config.httpCookieAcceptPolicy = .always
            config.httpShouldSetCookies = true
        }
        
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
                    "url": httpResponse.url?.absoluteString ?? url
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
}
