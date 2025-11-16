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
}