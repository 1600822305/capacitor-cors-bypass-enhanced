import { WebPlugin } from '@capacitor/core';

// MCP SDK imports with type assertions
const { Client } = require('@modelcontextprotocol/sdk/client/index.js') as any;
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js') as any;

import type {
  CorsBypassPlugin,
  HttpRequestOptions,
  HttpResponse,
  SSEOptions,
  SSEConnectionOptions,
  SSEConnection,
  WebSocketConnectionOptions,
  WebSocketConnection,
  SSEMessageEvent,
  SSEConnectionChangeEvent,
  WebSocketMessageEvent,
  WebSocketConnectionChangeEvent,
  MCPResponse,
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
} from './definitions';

export class CorsBypassWeb extends WebPlugin implements CorsBypassPlugin {
  private sseConnections = new Map<string, EventSource>();
  private wsConnections = new Map<string, WebSocket>();
  private mcpClients = new Map<string, any>();
  private mcpTransports = new Map<string, any>();
  private connectionCounter = 0;
  private proxyServerUrl: string | null = null;

  constructor() {
    super();
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
    console.log(`🔧 Proxy server set to: ${url}`);
  }

  async request(options: HttpRequestOptions): Promise<HttpResponse> {
    const {
      url,
      method = 'GET',
      headers = {},
      data,
      params,
      timeout = 30000,
      responseType = 'json',
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
    let fetchOptions: RequestInit = {
      method,
      headers,
      redirect: followRedirects ? 'follow' : 'manual',
    };

    if (this.proxyServerUrl && this.isCrossOrigin(requestUrl)) {
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

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: responseData,
        url: response.url,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // If proxy failed and we have a proxy server, try direct request as fallback
      if (this.proxyServerUrl && finalUrl.includes(this.proxyServerUrl)) {
        console.warn(`⚠️ Proxy request failed, trying direct request: ${error}`);
        return this.request({ ...options, url: requestUrl });
      }

      throw error;
    }
  }

  async get(options: HttpRequestOptions): Promise<HttpResponse> {
    return this.request({ ...options, method: 'GET' });
  }

  async post(options: HttpRequestOptions): Promise<HttpResponse> {
    return this.request({ ...options, method: 'POST' });
  }

  async put(options: HttpRequestOptions): Promise<HttpResponse> {
    return this.request({ ...options, method: 'PUT' });
  }

  async patch(options: HttpRequestOptions): Promise<HttpResponse> {
    return this.request({ ...options, method: 'PATCH' });
  }

  async delete(options: HttpRequestOptions): Promise<HttpResponse> {
    return this.request({ ...options, method: 'DELETE' });
  }

  async startSSE(options: SSEOptions): Promise<{ connectionId: string }> {
    const connectionId = `sse_${++this.connectionCounter}`;
    const { url, headers = {}, withCredentials = false, reconnectTimeout = 3000 } = options;

    // Use proxy server for SSE if available and cross-origin
    let sseUrl = url;
    if (this.proxyServerUrl && this.isCrossOrigin(url)) {
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
      });
    };

    eventSource.onerror = () => {
      this.notifyListeners('sseError', {
        connectionId,
        error: 'Connection error',
      });
    };

    return { connectionId };
  }

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

  private isCrossOrigin(url: string): boolean {
    try {
      const targetUrl = new URL(url);
      const currentUrl = new URL(window.location.href);

      return targetUrl.origin !== currentUrl.origin;
    } catch {
      return false;
    }
  }

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
      if (this.proxyServerUrl && this.isCrossOrigin(url)) {
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
        });
      };

      eventSource.onmessage = (event) => {
        this.notifyListeners('sseMessage', {
          connectionId,
          type: 'message',
          data: event.data,
          id: event.lastEventId,
        });
      };

      eventSource.onerror = () => {
        this.notifyListeners('sseConnectionChange', {
          connectionId,
          status: 'error',
          error: 'Connection error',
        });

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
        });
      });
    };

    this.notifyListeners('sseConnectionChange', {
      connectionId,
      status: 'connecting',
    });

    createConnection();

    return {
      connectionId,
      status: 'connecting',
    };
  }

  async closeSSEConnection(options: { connectionId: string }): Promise<void> {
    const { connectionId } = options;
    const connection = this.sseConnections.get(connectionId);
    
    if (connection) {
      connection.close();
      this.sseConnections.delete(connectionId);
      this.notifyListeners('sseConnectionChange', {
        connectionId,
        status: 'disconnected',
      });
    }
  }

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
        });
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
        });
      };

      ws.onerror = () => {
        clearTimeout(timeoutId);
        this.notifyListeners('webSocketConnectionChange', {
          connectionId,
          status: 'error',
          error: 'WebSocket connection error',
        });
      };

      ws.onclose = () => {
        this.wsConnections.delete(connectionId);
        this.notifyListeners('webSocketConnectionChange', {
          connectionId,
          status: 'disconnected',
        });
      };

      this.notifyListeners('webSocketConnectionChange', {
        connectionId,
        status: 'connecting',
      });
    });
  }

  async closeWebSocketConnection(options: { connectionId: string }): Promise<void> {
    const { connectionId } = options;
    const connection = this.wsConnections.get(connectionId);
    
    if (connection) {
      connection.close();
      this.wsConnections.delete(connectionId);
    }
  }

  async sendWebSocketMessage(options: { connectionId: string; message: string }): Promise<void> {
    const { connectionId, message } = options;
    const connection = this.wsConnections.get(connectionId);

    if (connection && connection.readyState === WebSocket.OPEN) {
      connection.send(message);
    } else {
      throw new Error('WebSocket connection not found or not open');
    }
  }

  // ===== MCP Protocol Methods =====

  async createMCPClient(options: MCPClientOptions): Promise<MCPClient> {
    const connectionId = `mcp_${++this.connectionCounter}`;

    try {
      // 创建SSE传输层
      let transport: any;

      if (this.proxyServerUrl && this.isCrossOrigin(options.sseUrl)) {
        // 使用代理服务器
        const proxyUrl = `${this.proxyServerUrl}/sse-proxy/${encodeURIComponent(options.sseUrl)}`;
        transport = new SSEClientTransport(new URL(proxyUrl));
      } else {
        // 直接连接
        transport = new SSEClientTransport(new URL(options.sseUrl));
      }

      // 创建MCP客户端
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

      // 连接到服务器
      await client.connect(transport);

      // 存储客户端和传输层
      this.mcpClients.set(connectionId, client);
      this.mcpTransports.set(connectionId, transport);

      console.log(`✅ MCP客户端已连接: ${connectionId}`);

      return {
        connectionId,
        status: 'connected',
        serverCapabilities: client.getServerCapabilities(),
        protocolVersion: '2025-03-26'
      };
    } catch (error) {
      console.error(`❌ MCP客户端连接失败:`, error);
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
        description: result.description || '',
        messages: (result.messages as any) || []
      };
    } catch (error) {
      throw new Error(`Failed to get MCP prompt: ${error}`);
    }
  }

  async sendMCPSampling(options: { connectionId: string; request: MCPSamplingRequest }): Promise<MCPSamplingResponse> {
    // MCP SDK doesn't directly support sampling, this would need to be implemented
    // based on the specific server's sampling capabilities
    throw new Error('MCP sampling not yet implemented with SDK');
  }
}
