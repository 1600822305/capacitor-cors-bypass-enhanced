import type {
  SSEOptions,
  SSEConnectionOptions,
  SSEConnection,
  SSEMessageEvent,
  SSEConnectionChangeEvent,
} from '../definitions';
import { isCrossOrigin } from './utils';

/**
 * SSE Manager
 * Handles Server-Sent Events connections with CORS bypass
 */
export class SSEManager {
  private proxyServerUrl: string | null;
  private sseConnections = new Map<string, EventSource>();
  private connectionCounter = 0;
  private notifyListeners: (eventName: string, data: any) => void;

  constructor(
    proxyServerUrl: string | null,
    notifyListeners: (eventName: string, data: any) => void
  ) {
    this.proxyServerUrl = proxyServerUrl;
    this.notifyListeners = notifyListeners;
  }

  /**
   * Start listening to Server-Sent Events (legacy method)
   */
  async startSSE(options: SSEOptions): Promise<{ connectionId: string }> {
    const connectionId = `sse_${++this.connectionCounter}`;
    const { url, headers = {}, withCredentials = false, reconnectTimeout = 3000 } = options;

    // Use proxy server for SSE if available and cross-origin
    let sseUrl = url;
    if (this.proxyServerUrl && isCrossOrigin(url)) {
      console.log(`🔧 Using SSE proxy for: ${url}`);
      sseUrl = `${this.proxyServerUrl}/sse-proxy/${encodeURIComponent(url)}`;
    }

    const eventSource = new EventSource(sseUrl);
    this.sseConnections.set(connectionId, eventSource);

    eventSource.onopen = () => {
      this.notifyListeners('sseOpen', {
        connectionId,
        status: 'connected',
      });
    };

    eventSource.onmessage = (event) => {
      this.notifyListeners('sseMessage', {
        connectionId,
        type: 'message',
        data: event.data,
        id: event.lastEventId,
      } as SSEMessageEvent);
    };

    eventSource.onerror = () => {
      this.notifyListeners('sseError', {
        connectionId,
        error: 'Connection error',
      });
    };

    return { connectionId };
  }

  /**
   * Stop listening to Server-Sent Events
   */
  async stopSSE(options: { connectionId: string }): Promise<void> {
    const { connectionId } = options;
    const connection = this.sseConnections.get(connectionId);

    if (connection) {
      connection.close();
      this.sseConnections.delete(connectionId);
      this.notifyListeners('sseClose', {
        connectionId,
        status: 'disconnected',
      });
    }
  }

  /**
   * Create a Server-Sent Events connection with reconnection support
   */
  async createSSEConnection(options: SSEConnectionOptions): Promise<SSEConnection> {
    const connectionId = `sse_${++this.connectionCounter}`;
    const { url, headers = {}, reconnect = {} } = options;

    const {
      enabled: reconnectEnabled = true,
      initialDelay = 1000,
      maxDelay = 30000,
      maxAttempts = 10,
    } = reconnect;

    let retryCount = 0;
    let retryDelay = initialDelay;

    const createConnection = () => {
      // Use proxy server for SSE if available and cross-origin
      let sseUrl = url;
      if (this.proxyServerUrl && isCrossOrigin(url)) {
        console.log(`🔧 Using SSE proxy for: ${url}`);
        sseUrl = `${this.proxyServerUrl}/sse-proxy/${encodeURIComponent(url)}`;
      }

      const eventSource = new EventSource(sseUrl);
      this.sseConnections.set(connectionId, eventSource);

      eventSource.onopen = () => {
        retryCount = 0;
        retryDelay = initialDelay;
        this.notifyListeners('sseConnectionChange', {
          connectionId,
          status: 'connected',
        } as SSEConnectionChangeEvent);
      };

      eventSource.onmessage = (event) => {
        this.notifyListeners('sseMessage', {
          connectionId,
          type: 'message',
          data: event.data,
          id: event.lastEventId,
        } as SSEMessageEvent);
      };

      eventSource.onerror = () => {
        this.notifyListeners('sseConnectionChange', {
          connectionId,
          status: 'error',
          error: 'Connection error',
        } as SSEConnectionChangeEvent);

        if (reconnectEnabled && retryCount < maxAttempts) {
          setTimeout(() => {
            retryCount++;
            retryDelay = Math.min(retryDelay * 2, maxDelay);
            eventSource.close();
            createConnection();
          }, retryDelay);
        } else {
          this.sseConnections.delete(connectionId);
        }
      };

      // Add custom event listeners
      eventSource.addEventListener('error', (event) => {
        this.notifyListeners('sseMessage', {
          connectionId,
          type: 'error',
          data: 'Connection error',
        } as SSEMessageEvent);
      });
    };

    this.notifyListeners('sseConnectionChange', {
      connectionId,
      status: 'connecting',
    } as SSEConnectionChangeEvent);

    createConnection();

    return {
      connectionId,
      status: 'connecting',
    };
  }

  /**
   * Close an SSE connection
   */
  async closeSSEConnection(options: { connectionId: string }): Promise<void> {
    const { connectionId } = options;
    const connection = this.sseConnections.get(connectionId);
    
    if (connection) {
      connection.close();
      this.sseConnections.delete(connectionId);
      this.notifyListeners('sseConnectionChange', {
        connectionId,
        status: 'disconnected',
      } as SSEConnectionChangeEvent);
    }
  }

  /**
   * Get all active SSE connections
   */
  getSSEConnections(): Map<string, EventSource> {
    return this.sseConnections;
  }
}