/**
 * Streaming Request Types
 */

export interface StreamRequestOptions {
  /**
   * The URL to request
   */
  url: string;

  /**
   * The HTTP method to use
   * @default 'POST'
   */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

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
   * @default 60000
   */
  timeout?: number;

  /**
   * Whether to follow redirects
   * @default true
   */
  followRedirects?: boolean;
}

export interface StreamChunkEvent {
  /**
   * Stream identifier
   */
  streamId: string;

  /**
   * Chunk data (text)
   */
  data: string;

  /**
   * Whether this is the final chunk
   */
  done: boolean;

  /**
   * Error message if any
   */
  error?: string;
}

export interface StreamStatusEvent {
  /**
   * Stream identifier
   */
  streamId: string;

  /**
   * Stream status
   */
  status: 'started' | 'completed' | 'error' | 'cancelled';

  /**
   * Error message if status is 'error'
   */
  error?: string;

  /**
   * HTTP status code
   */
  statusCode?: number;

  /**
   * Response headers
   */
  headers?: { [key: string]: string };
}