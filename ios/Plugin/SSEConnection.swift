import Foundation

class SSEConnection: NSObject {
    private let url: String
    private let headers: [String: String]
    private let withCredentials: Bool
    private let reconnectTimeout: Double
    private weak var plugin: CorsBypassPlugin?
    private let connectionId: String
    
    private var urlSessionTask: URLSessionDataTask?
    private var urlSession: URLSession?
    private var reconnectTimer: Timer?
    private var isConnected = false
    
    init(url: String, headers: [String: String], withCredentials: Bool, reconnectTimeout: Double, plugin: CorsBypassPlugin, connectionId: String) {
        self.url = url
        self.headers = headers
        self.withCredentials = withCredentials
        self.reconnectTimeout = reconnectTimeout
        self.plugin = plugin
        self.connectionId = connectionId
        super.init()
    }
    
    func connect() {
        guard let requestUrl = URL(string: url) else {
            plugin?.notifySSEError(connectionId: connectionId, error: "Invalid URL")
            return
        }
        
        var request = URLRequest(url: requestUrl)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        
        // Set custom headers
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        
        // Configure session
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 0
        config.timeoutIntervalForResource = 0
        
        if withCredentials {
            config.httpCookieAcceptPolicy = .always
            config.httpShouldSetCookies = true
        }
        
        urlSession = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        urlSessionTask = urlSession?.dataTask(with: request)
        urlSessionTask?.resume()
    }
    
    func disconnect() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        
        urlSessionTask?.cancel()
        urlSessionTask = nil
        
        urlSession?.invalidateAndCancel()
        urlSession = nil
        
        isConnected = false
        plugin?.notifySSEClose(connectionId: connectionId)
    }
    
    private func scheduleReconnect() {
        guard reconnectTimeout > 0 else { return }
        
        reconnectTimer?.invalidate()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: reconnectTimeout, repeats: false) { [weak self] _ in
            self?.connect()
        }
    }
    
    private func parseSSEData(_ data: String) {
        let lines = data.components(separatedBy: .newlines)
        var eventType: String?
        var eventData: String?
        var eventId: String?
        
        for line in lines {
            if line.isEmpty {
                // Empty line indicates end of event
                if let data = eventData {
                    plugin?.notifySSEMessage(connectionId: connectionId, data: data, id: eventId, type: eventType)
                }
                
                // Reset for next event
                eventType = nil
                eventData = nil
                eventId = nil
            } else if line.hasPrefix("data:") {
                let dataValue = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                if eventData == nil {
                    eventData = dataValue
                } else {
                    eventData! += "\n" + dataValue
                }
            } else if line.hasPrefix("event:") {
                eventType = String(line.dropFirst(6)).trimmingCharacters(in: .whitespaces)
            } else if line.hasPrefix("id:") {
                eventId = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
            } else if line.hasPrefix("retry:") {
                // Handle retry directive if needed
            }
        }
        
        // Handle case where data doesn't end with empty line
        if let data = eventData {
            plugin?.notifySSEMessage(connectionId: connectionId, data: data, id: eventId, type: eventType)
        }
    }
}

extension SSEConnection: URLSessionDataDelegate {
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        
        guard let httpResponse = response as? HTTPURLResponse else {
            plugin?.notifySSEError(connectionId: connectionId, error: "Invalid response")
            completionHandler(.cancel)
            return
        }
        
        if httpResponse.statusCode == 200 {
            isConnected = true
            plugin?.notifySSEOpen(connectionId: connectionId)
            completionHandler(.allow)
        } else {
            plugin?.notifySSEError(connectionId: connectionId, error: "HTTP \(httpResponse.statusCode)")
            completionHandler(.cancel)
        }
    }
    
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard let string = String(data: data, encoding: .utf8) else {
            return
        }
        
        parseSSEData(string)
    }
    
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didCompleteWithError error: Error?) {
        isConnected = false
        
        if let error = error {
            plugin?.notifySSEError(connectionId: connectionId, error: error.localizedDescription)
        }
        
        // Schedule reconnection if not manually disconnected
        if reconnectTimeout > 0 && urlSessionTask != nil {
            scheduleReconnect()
        }
    }
}
