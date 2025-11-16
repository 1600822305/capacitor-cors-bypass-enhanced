import { WebPlugin } from '@capacitor/core';

// MCP SDK imports with type assertions
const { Client } = require('@modelcontextprotocol/sdk/client/index.js') as any;
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js') as any;

import type {
  CorsBypassPlugin,
  HttpRequestOptions,
  HttpResponse,
  StreamRequestOptions,
  SSEOptions,
  SSEConnectionOptions,
  SSEConnection,
  WebSocketConnectionOptions,
  WebSocketConnection,
  MCPClientOptions,
  MCPClient,
  MCPResourceList,
  MCPResource,
  MCPToolList,
  MCPToolResult,
  MCPPromptList,
  MCPPrompt,
  MCPSamplingRequest,
  MCPSamplingResponse,
  Interceptor,
  InterceptorOptions,
  InterceptorHandle,
} from './definitions';
 

// Import modular managers
import { UtilsManager } from './web/utils';
import { HttpManager } from './web/http';
import { StreamManager } from './web/stream';
import { SSEManager } from './web/sse';
import { WebSocketManager } from './web/websocket';
import { InterceptorManager } from './web/interceptor';

export class CorsBypassWeb extends WebPlugin implements CorsBypassPlugin {
  private proxyServerUrl: string | null = null;
  
  // Modular managers
  private utilsManager: UtilsManager;
  private httpManager: HttpManager;
  private streamManager: StreamManager;
  private sseManager: SSEManager;
  private wsManager: WebSocketManager;
  private interceptorManager: InterceptorManager;
  
  // MCP specific
  private mcpClients = new Map<string, any>();
  private mcpTransports = new Map<string, any>();
  private connectionCounter = 0;

  constructor() {
    super();
    
    // Initialize managers
    this.utilsManager = new UtilsManager();
    this.httpManager = new HttpManager(this.proxyServerUrl);
    this.streamManager = new StreamManager(this.proxyServerUrl, this.notifyListeners.bind(this));
    this.sseManager = new SSEManager(this.proxyServerUrl, this.notifyListeners.bind(this));
    this.wsManager = new WebSocketManager(this.notifyListeners.bind(this));
    this.interceptorManager = new InterceptorManager();
    
    // Try to detect if a proxy server is available
    this.detectProxyServer();
  }

  private async detectProxyServer() {
    const possibleUrls = [
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];

    for (const url of possibleUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);

        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          this.proxyServerUrl = url;
          this.httpManager.setProxyServer(url);
          this.streamManager = new StreamManager(this.proxyServerUrl, this.notifyListeners.bind(this));
          this.sseManager = new SSEManager(this.proxyServerUrl, this.notifyListeners.bind(this));
          console.log(`🔧 CORS Proxy server detected at: ${url}`);
          break;
        }
      } catch (error) {
        // Ignore errors, continue checking
      }
    }

    if (!this.proxyServerUrl) {
      console.warn('⚠️ No CORS proxy server detected. Some requests may fail due to CORS.');
      console.log('💡 To enable full functionality, run: node web-proxy-server.js');
    }
  }

  /**
   * Set custom proxy server URL
   */
  setProxyServer(url: string) {
    this.proxyServerUrl = url;
    this.httpManager.setProxyServer(url);
    this.streamManager = new StreamManager(this.proxyServerUrl, this.notifyListeners.bind(this));
    this.sseManager = new SSEManager(this.proxyServerUrl, this.notifyListeners.bind(this));
    console.log(`🔧 Proxy server set to: ${url}`);
  }

  async request(options: HttpRequestOptions): Promise<HttpResponse> {
    const interceptors = this.interceptorManager.getInterceptorsInternal();
    return this.httpManager.request(options, interceptors);
  }

  async get(options: HttpRequestOptions): Promise<HttpResponse> {
    const interceptors = this.interceptorManager.getInterceptorsInternal();
    return this.httpManager.get(options, interceptors);
  }

  async post(options: HttpRequestOptions): Promise<HttpResponse> {
    const interceptors = this.interceptorManager.getInterceptorsInternal();
    return this.httpManager.post(options, interceptors);
  }

  async put(options: HttpRequestOptions): Promise<HttpResponse> {
    const interceptors = this.interceptorManager.getInterceptorsInternal();
    return this.httpManager.put(options, interceptors);
  }

  async patch(options: HttpRequestOptions): Promise<HttpResponse> {
    const interceptors = this.interceptorManager.getInterceptorsInternal();
    return this.httpManager.patch(options, interceptors);
  }

  async delete(options: HttpRequestOptions): Promise<HttpResponse> {
    const interceptors = this.interceptorManager.getInterceptorsInternal();
    return this.httpManager.delete(options, interceptors);
  }

  /**
   * Streaming HTTP request - supports AI model streaming output
   */
  async streamRequest(options: StreamRequestOptions): Promise<{ streamId: string }> {
    return this.streamManager.streamRequest(options);
  }

  /**
   * Cancel streaming request
   */
  async cancelStream(options: { streamId: string }): Promise<void> {
    return this.streamManager.cancelStream(options);
  }

  async startSSE(options: SSEOptions): Promise<{ connectionId: string }> {
    return this.sseManager.startSSE(options);
  }

  async stopSSE(options: { connectionId: string }): Promise<void> {
    return this.sseManager.stopSSE(options);
  }

  async createSSEConnection(options: SSEConnectionOptions): Promise<SSEConnection> {
    return this.sseManager.createSSEConnection(options);
  }

  async closeSSEConnection(options: { connectionId: string }): Promise<void> {
    return this.sseManager.closeSSEConnection(options);
  }

  async createWebSocketConnection(options: WebSocketConnectionOptions): Promise<WebSocketConnection> {
    return this.wsManager.createWebSocketConnection(options);
  }

  async closeWebSocketConnection(options: { connectionId: string }): Promise<void> {
    return this.wsManager.closeWebSocketConnection(options);
  }

  async sendWebSocketMessage(options: { connectionId: string; message: string }): Promise<void> {
    return this.wsManager.sendWebSocketMessage(options);
  }

  // ===== MCP Protocol Methods =====

  async createMCPClient(options: MCPClientOptions): Promise<MCPClient> {
    const connectionId = `mcp_${++this.connectionCounter}`;

    try {
      // Create SSE transport layer
      let transport: any;

      if (this.proxyServerUrl && this.utilsManager.isCrossOrigin(options.sseUrl)) {
        // Use proxy server
        const proxyUrl = `${this.proxyServerUrl}/sse-proxy/${encodeURIComponent(options.sseUrl)}`;
        transport = new SSEClientTransport(new URL(proxyUrl));
      } else {
        // Direct connection
        transport = new SSEClientTransport(new URL(options.sseUrl));
      }

      // Create MCP client
      const client = new Client(
        {
          name: options.clientInfo.name,
          version: options.clientInfo.version,
        },
        {
          capabilities: {
            roots: options.capabilities?.roots ? { listChanged: true } : undefined,
            sampling: options.capabilities?.sampling ? {} : undefined,
          }
        }
      );

      // Connect to server
      await client.connect(transport);

      // Store client and transport
      this.mcpClients.set(connectionId, client);
      this.mcpTransports.set(connectionId, transport);

      console.log(`✅ MCP client connected: ${connectionId}`);

      return {
        connectionId,
        status: 'connected',
        serverCapabilities: client.getServerCapabilities(),
        protocolVersion: '2025-03-26'
      };
    } catch (error) {
      console.error(`❌ MCP client connection failed:`, error);
      throw new Error(`Failed to create MCP client: ${error}`);
    }
  }

  async listMCPResources(options: { connectionId: string; cursor?: string }): Promise<MCPResourceList> {
    const client = this.mcpClients.get(options.connectionId);
    if (!client) {
      throw new Error('MCP client not found');
    }

    try {
      const result = await client.listResources(options.cursor ? { cursor: options.cursor } : {});
      return {
        resources: result.resources || [],
        nextCursor: result.nextCursor
      };
    } catch (error) {
      throw new Error(`Failed to list MCP resources: ${error}`);
    }
  }

  async readMCPResource(options: { connectionId: string; uri: string }): Promise<MCPResource> {
    const client = this.mcpClients.get(options.connectionId);
    if (!client) {
      throw new Error('MCP client not found');
    }

    try {
      const result = await client.readResource({ uri: options.uri });
      return {
        uri: options.uri,
        mimeType: result.contents?.[0]?.mimeType || 'text/plain',
        text: (result.contents?.[0] as any)?.text || '',
        blob: (result.contents?.[0] as any)?.data
      };
    } catch (error) {
      throw new Error(`Failed to read MCP resource: ${error}`);
    }
  }

  async listMCPTools(options: { connectionId: string; cursor?: string }): Promise<MCPToolList> {
    const client = this.mcpClients.get(options.connectionId);
    if (!client) {
      throw new Error('MCP client not found');
    }

    try {
      const result = await client.listTools(options.cursor ? { cursor: options.cursor } : {});
      return {
        tools: result.tools || [],
        nextCursor: result.nextCursor
      };
    } catch (error) {
      throw new Error(`Failed to list MCP tools: ${error}`);
    }
  }

  async callMCPTool(options: { connectionId: string; name: string; arguments?: any }): Promise<MCPToolResult> {
    const client = this.mcpClients.get(options.connectionId);
    if (!client) {
      throw new Error('MCP client not found');
    }

    try {
      const result = await client.callTool({
        name: options.name,
        arguments: options.arguments || {}
      });

      return {
        content: (result.content as any) || [],
        isError: (result as any).isError || false
      };
    } catch (error) {
      throw new Error(`Failed to call MCP tool: ${error}`);
    }
  }

  async listMCPPrompts(options: { connectionId: string; cursor?: string }): Promise<MCPPromptList> {
    const client = this.mcpClients.get(options.connectionId);
    if (!client) {
      throw new Error('MCP client not found');
    }

    try {
      const result = await client.listPrompts(options.cursor ? { cursor: options.cursor } : {});
      return {
        prompts: result.prompts || [],
        nextCursor: result.nextCursor
      };
    } catch (error) {
      throw new Error(`Failed to list MCP prompts: ${error}`);
    }
  }

  async getMCPPrompt(options: { connectionId: string; name: string; arguments?: any }): Promise<MCPPrompt> {
    const client = this.mcpClients.get(options.connectionId);
    if (!client) {
      throw new Error('MCP client not found');
    }

    try {
      const result = await client.getPrompt({
        name: options.name,
        arguments: options.arguments || {}
      });

      return {
        description: result.description,
        messages: result.messages || []
      };
    } catch (error) {
      throw new Error(`Failed to get MCP prompt: ${error}`);
    }
  }

  async sendMCPSampling(options: { connectionId: string; request: MCPSamplingRequest }): Promise<MCPSamplingResponse> {
    const client = this.mcpClients.get(options.connectionId);
    if (!client) {
      throw new Error('MCP client not found');
    }

    try {
      const result = await client.request({
        method: options.request.method,
        params: options.request.params
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to send MCP sampling request: ${error}`);
    }
  }

  // ==================== Interceptor Management ====================

  async addInterceptor(interceptor: Interceptor, options?: InterceptorOptions): Promise<InterceptorHandle> {
    return this.interceptorManager.addInterceptor(interceptor, options);
  }

  async removeInterceptor(handle: InterceptorHandle | string): Promise<void> {
    return this.interceptorManager.removeInterceptor(handle);
  }

  async removeAllInterceptors(): Promise<void> {
    return this.interceptorManager.removeAllInterceptors();
  }

  async getInterceptors(): Promise<InterceptorHandle[]> {
    return this.interceptorManager.getInterceptors();
  }
}
