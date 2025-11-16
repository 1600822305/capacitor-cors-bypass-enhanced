/**
 * WebSocket Types
 */

export interface WebSocketConnectionOptions {
  /**
   * The WebSocket URL
   */
  url: string;

  /**
   * WebSocket protocols
   */
  protocols?: string[];

  /**
   * Request headers
   */
  headers?: { [key: string]: string };

  /**
   * Connection timeout in milliseconds
   * @default 10000
   */
  timeout?: number;
}

export interface WebSocketConnection {
  /**
   * Unique connection identifier
   */
  connectionId: string;

  /**
   * Connection status
   */
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface WebSocketMessageEvent {
  /**
   * Connection identifier
   */
  connectionId: string;

  /**
   * Message data
   */
  data: string;

  /**
   * Message type
   */
  type: 'text' | 'binary';
}

export interface WebSocketConnectionChangeEvent {
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