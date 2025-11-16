import type {
  StreamRequestOptions,
  StreamChunkEvent,
  StreamStatusEvent,
} from '../definitions';
import { isCrossOrigin } from './utils';

/**
 * Stream Manager
 * Handles streaming HTTP requests with CORS bypass
 */
export class StreamManager {
  private proxyServerUrl: string | null;
  private streamControllers = new Map<string, AbortController>();
  private streamCounter = 0;
  private notifyListeners: (eventName: string, data: any) => void;

  constructor(
    proxyServerUrl: string | null,
    notifyListeners: (eventName: string, data: any) => void
  ) {
    this.proxyServerUrl = proxyServerUrl;
    this.notifyListeners = notifyListeners;
  }

  /**
   * Make a streaming HTTP request - supports AI model streaming output
   */
  async streamRequest(options: StreamRequestOptions): Promise<{ streamId: string }> {
    const streamId = `stream_${++this.streamCounter}`;
    const {
      url,
      method = 'POST',
      headers = {},
      data,
      params,
      timeout = 60000,
      followRedirects = true,
    } = options;

    // Build URL with query parameters
    let requestUrl = url;
    if (params) {
      const urlParams = new URLSearchParams(params);
      requestUrl += (url.includes('?') ? '&' : '?') + urlParams.toString();
    }

    // Use proxy server if available and URL is cross-origin
    let finalUrl = requestUrl;
    if (this.proxyServerUrl && isCrossOrigin(requestUrl)) {
      console.log(`🔧 Using proxy server for streaming: ${requestUrl}`);
      finalUrl = `${this.proxyServerUrl}/proxy/${encodeURIComponent(requestUrl)}`;
    }

    // Create AbortController for this stream
    const controller = new AbortController();
    this.streamControllers.set(streamId, controller);

    // Set timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
      this.notifyListeners('streamStatus', {
        streamId,
        status: 'error',
        error: 'Request timeout',
      } as StreamStatusEvent);
    }, timeout);

    try {
      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method,
        headers: {
          ...headers,
          'Accept': 'text/event-stream, application/json, text/plain, */*',
        },
        signal: controller.signal,
        redirect: followRedirects ? 'follow' : 'manual',
      };

      // Add body for methods that support it
      if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
        if (typeof data === 'string') {
          fetchOptions.body = data;
        } else {
          fetchOptions.body = JSON.stringify(data);
          if (!headers['Content-Type']) {
            fetchOptions.headers = {
              ...fetchOptions.headers,
              'Content-Type': 'application/json',
            };
          }
        }
      }

      console.log(`🌊 Starting stream request: ${streamId} to ${finalUrl}`);

      // Start the fetch request
      fetch(finalUrl, fetchOptions)
        .then(async (response) => {
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          // Convert headers to plain object
          const responseHeaders: { [key: string]: string } = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });

          // Notify stream started
          this.notifyListeners('streamStatus', {
            streamId,
            status: 'started',
            statusCode: response.status,
            headers: responseHeaders,
          } as StreamStatusEvent);

          // Read the stream
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('Response body is not readable');
          }

          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                // Stream completed
                this.notifyListeners('streamChunk', {
                  streamId,
                  data: '',
                  done: true,
                } as StreamChunkEvent);

                this.notifyListeners('streamStatus', {
                  streamId,
                  status: 'completed',
                } as StreamStatusEvent);

                this.streamControllers.delete(streamId);
                break;
              }

              // Decode and send chunk
              const chunk = decoder.decode(value, { stream: true });
              
              this.notifyListeners('streamChunk', {
                streamId,
                data: chunk,
                done: false,
              } as StreamChunkEvent);
            }
          } catch (error: any) {
            if (error.name === 'AbortError') {
              this.notifyListeners('streamStatus', {
                streamId,
                status: 'cancelled',
              } as StreamStatusEvent);
            } else {
              throw error;
            }
          }
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          this.notifyListeners('streamChunk', {
            streamId,
            data: '',
            done: true,
            error: errorMessage,
          } as StreamChunkEvent);

          this.notifyListeners('streamStatus', {
            streamId,
            status: 'error',
            error: errorMessage,
          } as StreamStatusEvent);

          this.streamControllers.delete(streamId);
        });

      return { streamId };
    } catch (error) {
      clearTimeout(timeoutId);
      this.streamControllers.delete(streamId);
      throw error;
    }
  }

  /**
   * Cancel a streaming request
   */
  async cancelStream(options: { streamId: string }): Promise<void> {
    const { streamId } = options;
    const controller = this.streamControllers.get(streamId);

    if (controller) {
      controller.abort();
      this.streamControllers.delete(streamId);
      
      this.notifyListeners('streamStatus', {
        streamId,
        status: 'cancelled',
      } as StreamStatusEvent);
    }
  }

  /**
   * Get all active stream controllers
   */
  getStreamControllers(): Map<string, AbortController> {
    return this.streamControllers;
  }
}