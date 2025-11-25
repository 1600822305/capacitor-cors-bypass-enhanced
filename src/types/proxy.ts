/**
 * Network Proxy Configuration Types
 * 
 * Provides comprehensive proxy support including HTTP, HTTPS, and SOCKS5 protocols.
 */

/**
 * Proxy type enumeration
 */
export type ProxyType = 'http' | 'https' | 'socks4' | 'socks5';

/**
 * Proxy configuration for network requests
 */
export interface ProxyConfig {
  /**
   * Whether proxy is enabled
   * @default false
   */
  enabled: boolean;

  /**
   * Proxy type
   * @default 'http'
   */
  type?: ProxyType;

  /**
   * Proxy server hostname or IP address
   * @example '127.0.0.1', 'proxy.example.com'
   */
  host: string;

  /**
   * Proxy server port
   * @example 8080, 1080
   */
  port: number;

  /**
   * Proxy authentication username (optional)
   */
  username?: string;

  /**
   * Proxy authentication password (optional)
   */
  password?: string;

  /**
   * List of hosts that should bypass the proxy
   * Supports wildcards: *.example.com, 192.168.*
   * @example ['localhost', '127.0.0.1', '*.local']
   */
  bypass?: string[];
}

/**
 * Global proxy settings for the plugin
 */
export interface GlobalProxyConfig extends ProxyConfig {
  /**
   * Apply proxy to all requests by default
   * Individual requests can override this setting
   * @default true
   */
  applyToAll?: boolean;
}

/**
 * Proxy test result
 */
export interface ProxyTestResult {
  /**
   * Whether the proxy connection was successful
   */
  success: boolean;

  /**
   * Response time in milliseconds
   */
  responseTime?: number;

  /**
   * Error message if connection failed
   */
  error?: string;

  /**
   * HTTP status code from test request
   */
  statusCode?: number;

  /**
   * External IP address as seen through the proxy
   */
  externalIp?: string;
}

/**
 * Proxy connection status
 */
export interface ProxyStatus {
  /**
   * Whether proxy is currently active
   */
  active: boolean;

  /**
   * Current proxy configuration
   */
  config?: ProxyConfig;

  /**
   * Number of requests routed through proxy
   */
  requestCount?: number;

  /**
   * Last connection error if any
   */
  lastError?: string;

  /**
   * Timestamp of last successful request
   */
  lastSuccessTime?: number;
}
