import Foundation

/**
 * Performance Monitor for HTTP requests
 * Tracks DNS, TCP, TLS, and download metrics
 */
@objc public class PerformanceMonitor: NSObject {
    
    // MARK: - Types
    
    /**
     * Performance Metrics
     */
    public struct Metrics {
        var dnsTime: TimeInterval = 0
        var tcpTime: TimeInterval = 0
        var tlsTime: TimeInterval = 0
        var ttfb: TimeInterval = 0  // Time to first byte
        var downloadTime: TimeInterval = 0
        var totalTime: TimeInterval = 0
        var downloadSpeed: Int64 = 0  // bytes per second
        var httpProtocol: String = "unknown"
        
        func toDictionary() -> [String: Any] {
            return [
                "dnsTime": Int(dnsTime * 1000),  // Convert to milliseconds
                "tcpTime": Int(tcpTime * 1000),
                "tlsTime": Int(tlsTime * 1000),
                "ttfb": Int(ttfb * 1000),
                "downloadTime": Int(downloadTime * 1000),
                "totalTime": Int(totalTime * 1000),
                "downloadSpeed": downloadSpeed,
                "httpProtocol": httpProtocol
            ]
        }
    }
    
    // MARK: - URLSession Delegate for Performance Monitoring
    
    /**
     * Performance monitoring URLSession delegate
     */
    public class PerformanceDelegate: NSObject, URLSessionTaskDelegate, URLSessionDataDelegate {
        
        private var startTime: Date?
        private var responseStartTime: Date?
        private var metrics = Metrics()
        private var receivedData = Data()
        private let completion: (Data?, URLResponse?, Error?, Metrics) -> Void
        
        init(completion: @escaping (Data?, URLResponse?, Error?, Metrics) -> Void) {
            self.completion = completion
            super.init()
        }
        
        public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
            responseStartTime = Date()
            
            if let startTime = startTime {
                metrics.ttfb = Date().timeIntervalSince(startTime)
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                metrics.httpProtocol = ProtocolManager.detectProtocol(from: httpResponse)
            }
            
            completionHandler(.allow)
        }
        
        public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
            receivedData.append(data)
        }
        
        public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
            if let startTime = startTime {
                metrics.totalTime = Date().timeIntervalSince(startTime)
            }
            
            if let responseStartTime = responseStartTime {
                metrics.downloadTime = Date().timeIntervalSince(responseStartTime)
            }
            
            // Calculate download speed
            let dataSize = Int64(receivedData.count)
            if dataSize > 0 && metrics.downloadTime > 0 {
                metrics.downloadSpeed = Int64(Double(dataSize) / metrics.downloadTime)
            }
            
            completion(receivedData, task.response, error, metrics)
        }
        
        public func urlSession(_ session: URLSession, task: URLSessionTask, didFinishCollecting metrics: URLSessionTaskMetrics) {
            // Extract detailed metrics from URLSessionTaskMetrics
            guard let transactionMetrics = metrics.transactionMetrics.first else {
                return
            }
            
            // DNS time
            if let domainLookupStart = transactionMetrics.domainLookupStartDate,
               let domainLookupEnd = transactionMetrics.domainLookupEndDate {
                self.metrics.dnsTime = domainLookupEnd.timeIntervalSince(domainLookupStart)
            }
            
            // TCP connection time
            if let connectStart = transactionMetrics.connectStartDate,
               let connectEnd = transactionMetrics.connectEndDate {
                self.metrics.tcpTime = connectEnd.timeIntervalSince(connectStart)
            }
            
            // TLS handshake time
            if let secureConnectionStart = transactionMetrics.secureConnectionStartDate,
               let secureConnectionEnd = transactionMetrics.secureConnectionEndDate {
                self.metrics.tlsTime = secureConnectionEnd.timeIntervalSince(secureConnectionStart)
            }
            
            // Request/Response timing
            if let requestStart = transactionMetrics.requestStartDate,
               let responseStart = transactionMetrics.responseStartDate {
                self.metrics.ttfb = responseStart.timeIntervalSince(requestStart)
            }
            
            // Protocol
            if let negotiatedProtocol = transactionMetrics.networkProtocolName {
                self.metrics.httpProtocol = negotiatedProtocol
            }
            
            print("[PerformanceMonitor] Metrics collected:")
            print("  DNS: \(Int(self.metrics.dnsTime * 1000))ms")
            print("  TCP: \(Int(self.metrics.tcpTime * 1000))ms")
            print("  TLS: \(Int(self.metrics.tlsTime * 1000))ms")
            print("  TTFB: \(Int(self.metrics.ttfb * 1000))ms")
            print("  Download: \(Int(self.metrics.downloadTime * 1000))ms")
            print("  Total: \(Int(self.metrics.totalTime * 1000))ms")
            print("  Speed: \(self.metrics.downloadSpeed) bytes/sec")
            print("  Protocol: \(self.metrics.httpProtocol)")
        }
        
        func setStartTime(_ time: Date) {
            startTime = time
        }
    }
    
    // MARK: - Public Methods
    
    /**
     * Perform request with performance monitoring
     */
    static func performRequestWithMonitoring(
        request: URLRequest,
        completion: @escaping (Data?, URLResponse?, Error?, Metrics) -> Void
    ) {
        let config = URLSessionConfiguration.default
        config.httpShouldUsePipelining = true
        config.httpMaximumConnectionsPerHost = 6
        config.networkServiceType = .responsiveData
        config.tlsMinimumSupportedProtocolVersion = .TLSv12
        
        let delegate = PerformanceDelegate(completion: completion)
        let session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
        
        delegate.setStartTime(Date())
        let task = session.dataTask(with: request)
        task.resume()
    }
    
    /**
     * Create URLSession with performance monitoring
     */
    static func createMonitoredSession(
        configuration: URLSessionConfiguration = .default,
        delegate: PerformanceDelegate
    ) -> URLSession {
        return URLSession(configuration: configuration, delegate: delegate, delegateQueue: nil)
    }
    
    /**
     * Calculate metrics from URLSessionTaskMetrics
     */
    static func calculateMetrics(from taskMetrics: URLSessionTaskMetrics) -> Metrics {
        var metrics = Metrics()
        
        guard let transactionMetrics = taskMetrics.transactionMetrics.first else {
            return metrics
        }
        
        // DNS time
        if let domainLookupStart = transactionMetrics.domainLookupStartDate,
           let domainLookupEnd = transactionMetrics.domainLookupEndDate {
            metrics.dnsTime = domainLookupEnd.timeIntervalSince(domainLookupStart)
        }
        
        // TCP connection time
        if let connectStart = transactionMetrics.connectStartDate,
           let connectEnd = transactionMetrics.connectEndDate {
            metrics.tcpTime = connectEnd.timeIntervalSince(connectStart)
        }
        
        // TLS handshake time
        if let secureConnectionStart = transactionMetrics.secureConnectionStartDate,
           let secureConnectionEnd = transactionMetrics.secureConnectionEndDate {
            metrics.tlsTime = secureConnectionEnd.timeIntervalSince(secureConnectionStart)
        }
        
        // Request/Response timing
        if let requestStart = transactionMetrics.requestStartDate,
           let responseStart = transactionMetrics.responseStartDate {
            metrics.ttfb = responseStart.timeIntervalSince(requestStart)
        }
        
        if let requestStart = transactionMetrics.requestStartDate,
           let responseEnd = transactionMetrics.responseEndDate {
            metrics.totalTime = responseEnd.timeIntervalSince(requestStart)
        }
        
        // Protocol
        if let negotiatedProtocol = transactionMetrics.networkProtocolName {
            metrics.httpProtocol = negotiatedProtocol
        }
        
        return metrics
    }
    
    /**
     * Log metrics
     */
    static func logMetrics(_ metrics: Metrics) {
        print("[PerformanceMonitor] Performance Metrics:")
        print("  DNS Time: \(Int(metrics.dnsTime * 1000))ms")
        print("  TCP Time: \(Int(metrics.tcpTime * 1000))ms")
        print("  TLS Time: \(Int(metrics.tlsTime * 1000))ms")
        print("  TTFB: \(Int(metrics.ttfb * 1000))ms")
        print("  Download Time: \(Int(metrics.downloadTime * 1000))ms")
        print("  Total Time: \(Int(metrics.totalTime * 1000))ms")
        print("  Download Speed: \(metrics.downloadSpeed) bytes/sec")
        print("  Protocol: \(metrics.httpProtocol)")
    }
}