/**
 * MCP Client Manager (Web Implementation)
 * Manages MCP connections with StreamableHTTP transport
 */

import { StreamableHTTPTransport } from './streamable-http';
import type { MCPClientOptions, MCPClient } from '../types/mcp';

export class MCPClientManager {
  private connections: Map<string, {
    transport: StreamableHTTPTransport;
    info: MCPClient;
    listeners: Map<string, Set<Function>>;
  }> = new Map();
  private connectionCounter = 0;

  /**
   * Create a new MCP client connection
   */
  async createClient(options: MCPClientOptions): Promise<MCPClient> {
    this.connectionCounter++;
    const connectionId = `mcp_web_${this.connectionCounter}`;

    // Determine transport type
    const transport = options.transport || 'streamablehttp';
    
    // Get endpoint URL
    let url = options.url;
    if (!url && options.sseUrl) {
      // Backward compatibility
      url = options.sseUrl;
    }
    
    if (!url) {
      throw new Error('URL is required for MCP client');
    }

    if (transport === 'streamablehttp') {
      return this.createStreamableHTTPClient(connectionId, url, options);
    } else if (transport === 'sse') {
      throw new Error('Legacy SSE transport not yet implemented. Use StreamableHTTP instead.');
    } else {
      throw new Error(`Unsupported transport: ${transport}`);
    }
  }

  /**
   * Create a StreamableHTTP MCP client
   */
  private async createStreamableHTTPClient(
    connectionId: string,
    url: string,
    options: MCPClientOptions
  ): Promise<MCPClient> {
    const listeners = new Map<string, Set<Function>>();
    
    const streamableTransport = new StreamableHTTPTransport(
      url,
      {
        onMessage: (message: any) => {
          this.notifyListeners(connectionId, 'message', { connectionId, message });
        },
        onError: (error: string) => {
          this.notifyListeners(connectionId, 'error', { connectionId, error });
        },
        onConnectionStateChange: (state: string) => {
          this.notifyListeners(connectionId, 'stateChange', { connectionId, state });
        },
      },
      options.resumable || false,
      options.sessionId,
      options.lastSequence
    );

    const clientInfo: MCPClient = {
      connectionId,
      status: 'connecting',
    };

    this.connections.set(connectionId, {
      transport: streamableTransport,
      info: clientInfo,
      listeners,
    });

    // Send initialize request
    try {
      const initRequest = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: options.protocolVersion || '2025-03-26',
          clientInfo: options.clientInfo,
          capabilities: options.capabilities,
        },
      };

      await streamableTransport.sendMessage(initRequest, true);
      clientInfo.status = 'connected';
    } catch (error: any) {
      clientInfo.status = 'error';
      throw error;
    }

    return clientInfo;
  }

  /**
   * Send a message to an MCP server
   */
  async sendMessage(connectionId: string, message: any, expectStream: boolean = false): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`MCP connection not found: ${connectionId}`);
    }

    await connection.transport.sendMessage(message, expectStream);
  }

  /**
   * Open a listen stream for server-initiated messages
   */
  async openListenStream(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`MCP connection not found: ${connectionId}`);
    }

    await connection.transport.openListenStream();
  }

  /**
   * Close an MCP client connection
   */
  closeClient(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.transport.close();
      connection.info.status = 'disconnected';
      this.connections.delete(connectionId);
    }
  }

  /**
   * Get session information for a connection
   */
  getSessionInfo(connectionId: string): {
    sessionId: string | null;
    lastSequence: number;
    resumable: boolean;
  } | null {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return null;
    }

    return {
      sessionId: connection.transport.getSessionId(),
      lastSequence: connection.transport.getLastSequence(),
      resumable: connection.transport.isResumable(),
    };
  }

  /**
   * Get client info
   */
  getClientInfo(connectionId: string): MCPClient | null {
    const connection = this.connections.get(connectionId);
    return connection ? connection.info : null;
  }

  /**
   * Add event listener
   */
  addEventListener(
    connectionId: string,
    event: string,
    callback: Function
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`MCP connection not found: ${connectionId}`);
    }

    if (!connection.listeners.has(event)) {
      connection.listeners.set(event, new Set());
    }

    connection.listeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(
    connectionId: string,
    event: string,
    callback: Function
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const listeners = connection.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Notify listeners
   */
  private notifyListeners(connectionId: string, event: string, data: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const listeners = connection.listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in MCP event listener:', error);
        }
      });
    }
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    this.connections.forEach((connection, connectionId) => {
      this.closeClient(connectionId);
    });
  }
}

// Export singleton instance
export const mcpClientManager = new MCPClientManager();
