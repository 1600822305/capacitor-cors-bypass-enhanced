/**
 * HTTP Request and Response Types
 */

export interface HttpRequestOptions {
  /**
   * The URL to request
   */
  url: string;

  /**
   * The HTTP method to use
   * @default 'GET'
   */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

  /**
   * Request headers
   */
  headers?: { [key: string]: string };

  /**
   * Request body (for POST, PUT, PATCH)
   */
  data?: any;

  /**
   * Query parameters
   */
  params?: { [key: string]: string };

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Response type
   * @default 'json'
   */
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';

  /**
   * Whether to follow redirects
   * @default true
   */
  followRedirects?: boolean;

  /**
   * Maximum number of redirects to follow
   * @default 5
   */
  maxRedirects?: number;

  /**
   * Enable streaming mode for the request
   * @default false
   */
  stream?: boolean;
  
  /**
   * Protocol configuration for HTTP/2 and HTTP/3 support
   */
  protocolConfig?: ProtocolConfig;
}

/**
 * Protocol configuration for HTTP/2 and HTTP/3 support
 */
export interface ProtocolConfig {
  /**
   * HTTP/2 configuration
   */
  http2?: {
    /**
     * Enable HTTP/2 support
     * @default true
     */
    enabled?: boolean;
    
    /**
     * Enable server push support
     * @default false
     */
    pushEnabled?: boolean;
    
    /**
     * Ping interval in milliseconds for connection health check
     * @default 10000
     */
    pingInterval?: number;
  };
  
  /**
   * HTTP/3 configuration (experimental)
   */
  http3?: {
    /**
     * Enable HTTP/3 support
     * @default false
     */
    enabled?: boolean;
    
    /**
     * QUIC protocol version
     * @default 'Q046'
     */
    quicVersion?: string;
    
    /**
     * Enable 0-RTT for faster connection establishment
     * @default false
     */
    zeroRtt?: boolean;
  };
  
  /**
   * Protocol negotiation and fallback configuration
   */
  fallback?: {
    /**
     * Enable automatic protocol fallback
     * @default true
     */
    enabled?: boolean;
    
    /**
     * Maximum number of retry attempts with different protocols
     * @default 2
     */
    retryCount?: number;
    
    /**
     * Preferred protocol order (e.g., ['h3', 'h2', 'http/1.1'])
     */
    preferredProtocols?: string[];
  };
}

export interface HttpResponse {
  /**
   * Response status code
   */
  status: number;

  /**
   * Response status text
   */
  statusText: string;

  /**
   * Response headers
   */
  headers: { [key: string]: string };

  /**
   * Response data
   */
  data: any;

  /**
   * Final URL after redirects
   */
  url: string;
  
  /**
   * Protocol version used for the request
   * @example 'http/1.1', 'h2', 'h3'
   */
  protocolVersion?: string;
  
  /**
   * Connection metrics for performance monitoring
   */
  metrics?: ConnectionMetrics;
}

/**
 * Connection metrics for performance monitoring
 */
export interface ConnectionMetrics {
  /**
   * DNS resolution time in milliseconds
   */
  dnsTime?: number;
  
  /**
   * TCP handshake time in milliseconds
   */
  tcpTime?: number;
  
  /**
   * TLS handshake time in milliseconds
   */
  tlsTime?: number;
  
  /**
   * Time to first byte (TTFB) in milliseconds
   */
  ttfb?: number;
  
  /**
   * Total download time in milliseconds
   */
  downloadTime?: number;
  
  /**
   * Average download speed in bytes per second
   */
  downloadSpeed?: number;
  
  /**
   * Protocol version used
   */
  protocol?: string;
}