import type {
  WebSocketConnectionOptions,
  WebSocketConnection,
  WebSocketMessageEvent,
  WebSocketConnectionChangeEvent,
} from '../definitions';

/**
 * WebSocket Manager
 * Handles WebSocket connections with CORS bypass
 */
export class WebSocketManager {
  private wsConnections = new Map<string, WebSocket>();
  private connectionCounter = 0;
  private notifyListeners: (eventName: string, data: any) => void;

  constructor(notifyListeners: (eventName: string, data: any) => void) {
    this.notifyListeners = notifyListeners;
  }

  /**
   * Create a WebSocket connection
   */
  async createWebSocketConnection(options: WebSocketConnectionOptions): Promise<WebSocketConnection> {
    const connectionId = `ws_${++this.connectionCounter}`;
    const { url, protocols, headers, timeout = 10000 } = options;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, protocols);
      this.wsConnections.set(connectionId, ws);

      const timeoutId = setTimeout(() => {
        ws.close();
        this.wsConnections.delete(connectionId);
        reject(new Error('WebSocket connection timeout'));
      }, timeout);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        this.notifyListeners('webSocketConnectionChange', {
          connectionId,
          status: 'connected',
        } as WebSocketConnectionChangeEvent);
        resolve({
          connectionId,
          status: 'connected',
        });
      };

      ws.onmessage = (event) => {
        this.notifyListeners('webSocketMessage', {
          connectionId,
          data: event.data,
          type: typeof event.data === 'string' ? 'text' : 'binary',
        } as WebSocketMessageEvent);
      };

      ws.onerror = () => {
        clearTimeout(timeoutId);
        this.notifyListeners('webSocketConnectionChange', {
          connectionId,
          status: 'error',
          error: 'WebSocket connection error',
        } as WebSocketConnectionChangeEvent);
      };

      ws.onclose = () => {
        this.wsConnections.delete(connectionId);
        this.notifyListeners('webSocketConnectionChange', {
          connectionId,
          status: 'disconnected',
        } as WebSocketConnectionChangeEvent);
      };

      this.notifyListeners('webSocketConnectionChange', {
        connectionId,
        status: 'connecting',
      } as WebSocketConnectionChangeEvent);
    });
  }

  /**
   * Close a WebSocket connection
   */
  async closeWebSocketConnection(options: { connectionId: string }): Promise<void> {
    const { connectionId } = options;
    const connection = this.wsConnections.get(connectionId);
    
    if (connection) {
      connection.close();
      this.wsConnections.delete(connectionId);
    }
  }

  /**
   * Send data through WebSocket
   */
  async sendWebSocketMessage(options: { connectionId: string; message: string }): Promise<void> {
    const { connectionId, message } = options;
    const connection = this.wsConnections.get(connectionId);

    if (connection && connection.readyState === WebSocket.OPEN) {
      connection.send(message);
    } else {
      throw new Error('WebSocket connection not found or not open');
    }
  }

  /**
   * Get all active WebSocket connections
   */
  getWebSocketConnections(): Map<string, WebSocket> {
    return this.wsConnections;
  }
}