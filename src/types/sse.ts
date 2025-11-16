/**
 * Server-Sent Events (SSE) Types
 */

export interface SSEOptions {
  /**
   * The URL to connect to for SSE
   */
  url: string;

  /**
   * Request headers
   */
  headers?: { [key: string]: string };

  /**
   * Whether to include credentials (cookies)
   */
  withCredentials?: boolean;

  /**
   * Reconnection timeout in milliseconds
   */
  reconnectTimeout?: number;
}

export interface SSEConnectionOptions {
  /**
   * The SSE endpoint URL
   */
  url: string;

  /**
   * Request headers
   */
  headers?: { [key: string]: string };

  /**
   * Reconnection options
   */
  reconnect?: {
    /**
     * Whether to automatically reconnect
     * @default true
     */
    enabled?: boolean;

    /**
     * Initial retry delay in milliseconds
     * @default 1000
     */
    initialDelay?: number;

    /**
     * Maximum retry delay in milliseconds
     * @default 30000
     */
    maxDelay?: number;

    /**
     * Maximum number of retry attempts
     * @default 10
     */
    maxAttempts?: number;
  };

  /**
   * MCP protocol specific options
   */
  mcp?: {
    /**
     * Whether this is an MCP (Model Context Protocol) connection
     * @default false
     */
    enabled?: boolean;

    /**
     * MCP client information
     */
    clientInfo?: {
      name: string;
      version: string;
    };

    /**
     * MCP capabilities
     */
    capabilities?: {
      sampling?: boolean;
      roots?: {
        listChanged?: boolean;
      } | boolean;
      [key: string]: any;
    };

    /**
     * HTTP POST endpoint for sending messages to MCP server
     */
    postEndpoint?: string;
  };
}

export interface SSEConnection {
  /**
   * Unique connection identifier
   */
  connectionId: string;

  /**
   * Connection status
   */
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface SSEMessageEvent {
  /**
   * Connection identifier
   */
  connectionId: string;

  /**
   * Event type (e.g., 'message', 'error', 'open')
   */
  type: string;

  /**
   * Event data
   */
  data?: string;

  /**
   * Event ID
   */
  id?: string;

  /**
   * Retry time
   */
  retry?: number;
}

export interface SSEConnectionChangeEvent {
  /**
   * Connection identifier
   */
  connectionId: string;

  /**
   * New connection status
   */
  status: 'connecting' | 'connected' | 'disconnected' | 'error';

  /**
   * Error message if status is 'error'
   */
  error?: string;
}