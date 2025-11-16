import type {
  HttpRequestOptions,
  HttpResponse,
  HttpError,
  InterceptorContext,
} from '../definitions';
import { isCrossOrigin, createInterceptorContext } from './utils';

/**
 * HTTP Request Manager
 * Handles all HTTP requests with CORS bypass and interceptor support
 */
export class HttpManager {
  private proxyServerUrl: string | null;

  constructor(proxyServerUrl: string | null) {
    this.proxyServerUrl = proxyServerUrl;
  }

  /**
   * Set custom proxy server URL
   */
  setProxyServer(url: string): void {
    this.proxyServerUrl = url;
    console.log(`🔧 Proxy server set to: ${url}`);
  }

  /**
   * Make an HTTP request with CORS bypass and interceptor support
   */
  async request(
    options: HttpRequestOptions,
    interceptors: Array<{
      id: string;
      interceptor: any;
      options: any;
      enabled: boolean;
    }>
  ): Promise<HttpResponse> {
    const context = createInterceptorContext();

    try {
      // Execute request interceptors
      let modifiedOptions = await this.executeRequestInterceptors(options, context, interceptors);

      const {
        url,
        method = 'GET',
        headers = {},
        data,
        params,
        timeout = 30000,
        responseType = 'json',
        followRedirects = true,
      } = modifiedOptions;

      // Build URL with query parameters
      let requestUrl = url;
      if (params) {
        const urlParams = new URLSearchParams(params);
        requestUrl += (url.includes('?') ? '&' : '?') + urlParams.toString();
      }

      // Use proxy server if available and URL is cross-origin
      let finalUrl = requestUrl;
      let fetchOptions: RequestInit = {
        method,
        headers,
        redirect: followRedirects ? 'follow' : 'manual',
      };

      if (this.proxyServerUrl && isCrossOrigin(requestUrl)) {
        console.log(`🔧 Using proxy server for: ${requestUrl}`);
        finalUrl = `${this.proxyServerUrl}/proxy/${encodeURIComponent(requestUrl)}`;
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      fetchOptions.signal = controller.signal;

      try {
        // Add body for methods that support it
        if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
          if (typeof data === 'string') {
            fetchOptions.body = data;
          } else {
            fetchOptions.body = JSON.stringify(data);
            if (!headers['Content-Type']) {
              headers['Content-Type'] = 'application/json';
            }
          }
        }

        const response = await fetch(finalUrl, fetchOptions);
        clearTimeout(timeoutId);

        // Parse response based on responseType
        let responseData: any;
        switch (responseType) {
          case 'text':
            responseData = await response.text();
            break;
          case 'blob':
            responseData = await response.blob();
            break;
          case 'arraybuffer':
            responseData = await response.arrayBuffer();
            break;
          case 'json':
          default:
            try {
              responseData = await response.json();
            } catch {
              responseData = await response.text();
            }
            break;
        }

        // Convert Headers to plain object
        const responseHeaders: { [key: string]: string } = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        let httpResponse: HttpResponse = {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          data: responseData,
          url: response.url,
        };

        // Execute response interceptors
        httpResponse = await this.executeResponseInterceptors(httpResponse, context, interceptors);

        return httpResponse;
      } catch (error) {
        clearTimeout(timeoutId);

        // Create HTTP error
        const httpError: HttpError = {
          message: error instanceof Error ? error.message : 'Unknown error',
          config: modifiedOptions,
          originalError: error,
        };

        // Try error interceptors
        const interceptorResult = await this.executeErrorInterceptors(httpError, context, interceptors);
        if (interceptorResult) {
          return interceptorResult;
        }

        // If proxy failed and we have a proxy server, try direct request as fallback
        if (this.proxyServerUrl && finalUrl.includes(this.proxyServerUrl)) {
          console.warn(`⚠️ Proxy request failed, trying direct request: ${error}`);
          return this.request({ ...options, url: requestUrl }, interceptors);
        }

        throw httpError;
      }
    } catch (error) {
      // Handle errors from interceptors or other sources
      if ((error as any).config) {
        // Already an HttpError
        throw error;
      }

      // Create HTTP error
      const httpError: HttpError = {
        message: error instanceof Error ? error.message : 'Unknown error',
        config: options,
        originalError: error,
      };

      throw httpError;
    }
  }

  /**
   * Make a GET request
   */
  async get(
    options: HttpRequestOptions,
    interceptors: Array<{
      id: string;
      interceptor: any;
      options: any;
      enabled: boolean;
    }>
  ): Promise<HttpResponse> {
    return this.request({ ...options, method: 'GET' }, interceptors);
  }

  /**
   * Make a POST request
   */
  async post(
    options: HttpRequestOptions,
    interceptors: Array<{
      id: string;
      interceptor: any;
      options: any;
      enabled: boolean;
    }>
  ): Promise<HttpResponse> {
    return this.request({ ...options, method: 'POST' }, interceptors);
  }

  /**
   * Make a PUT request
   */
  async put(
    options: HttpRequestOptions,
    interceptors: Array<{
      id: string;
      interceptor: any;
      options: any;
      enabled: boolean;
    }>
  ): Promise<HttpResponse> {
    return this.request({ ...options, method: 'PUT' }, interceptors);
  }

  /**
   * Make a PATCH request
   */
  async patch(
    options: HttpRequestOptions,
    interceptors: Array<{
      id: string;
      interceptor: any;
      options: any;
      enabled: boolean;
    }>
  ): Promise<HttpResponse> {
    return this.request({ ...options, method: 'PATCH' }, interceptors);
  }

  /**
   * Make a DELETE request
   */
  async delete(
    options: HttpRequestOptions,
    interceptors: Array<{
      id: string;
      interceptor: any;
      options: any;
      enabled: boolean;
    }>
  ): Promise<HttpResponse> {
    return this.request({ ...options, method: 'DELETE' }, interceptors);
  }

  /**
   * Execute request interceptors
   */
  private async executeRequestInterceptors(
    config: HttpRequestOptions,
    context: InterceptorContext,
    interceptors: Array<{
      id: string;
      interceptor: any;
      options: any;
      enabled: boolean;
    }>
  ): Promise<HttpRequestOptions> {
    let modifiedConfig = { ...config };

    for (const entry of interceptors) {
      if (!entry.enabled || !entry.interceptor.onRequest) {
        continue;
      }

      // Check scope if defined
      if (entry.options.scope) {
        const { urlPattern, methods } = entry.options.scope;
        
        if (urlPattern && !new RegExp(urlPattern).test(modifiedConfig.url)) {
          continue;
        }
        
        if (methods && modifiedConfig.method && !methods.includes(modifiedConfig.method)) {
          continue;
        }
      }

      try {
        modifiedConfig = await Promise.resolve(entry.interceptor.onRequest(modifiedConfig));
      } catch (error) {
        console.error(`[Interceptor ${entry.id}] Request interceptor error:`, error);
        throw error;
      }
    }

    return modifiedConfig;
  }

  /**
   * Execute response interceptors
   */
  private async executeResponseInterceptors(
    response: HttpResponse,
    context: InterceptorContext,
    interceptors: Array<{
      id: string;
      interceptor: any;
      options: any;
      enabled: boolean;
    }>
  ): Promise<HttpResponse> {
    let modifiedResponse = { ...response };

    for (const entry of interceptors) {
      if (!entry.enabled || !entry.interceptor.onResponse) {
        continue;
      }

      try {
        modifiedResponse = await Promise.resolve(entry.interceptor.onResponse(modifiedResponse));
      } catch (error) {
        console.error(`[Interceptor ${entry.id}] Response interceptor error:`, error);
        throw error;
      }
    }

    return modifiedResponse;
  }

  /**
   * Execute error interceptors
   */
  private async executeErrorInterceptors(
    error: HttpError,
    context: InterceptorContext,
    interceptors: Array<{
      id: string;
      interceptor: any;
      options: any;
      enabled: boolean;
    }>
  ): Promise<HttpResponse | void> {
    for (const entry of interceptors) {
      if (!entry.enabled || !entry.interceptor.onError) {
        continue;
      }

      try {
        const result = await Promise.resolve(entry.interceptor.onError(error));
        if (result) {
          // Interceptor returned a response, use it
          return result;
        }
      } catch (interceptorError) {
        console.error(`[Interceptor ${entry.id}] Error interceptor error:`, interceptorError);
        // Continue to next interceptor
      }
    }

    // No interceptor handled the error, return void
    return;
  }
}