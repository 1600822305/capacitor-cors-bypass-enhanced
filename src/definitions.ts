/**
 * Capacitor CORS Bypass Plugin Definitions
 * 
 * This file serves as the main entry point for all plugin types.
 * Individual type definitions are organized in the ./types directory.
 */

// Re-export all types from modular files
export * from './types';

// Import types needed for the main plugin interface
import type {
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
  PluginListenerHandle,
} from './types';

/**
 * Main Plugin Interface
 * Defines all methods available in the CorsBypass plugin
 */
export interface CorsBypassPlugin {
  /**
   * Make an HTTP request bypassing CORS restrictions
   */
  request(options: HttpRequestOptions): Promise<HttpResponse>;

  /**
   * Make a GET request with CORS bypass
   */
  get(options: HttpRequestOptions): Promise<HttpResponse>;

  /**
   * Make a POST request with CORS bypass
   */
  post(options: HttpRequestOptions): Promise<HttpResponse>;

  /**
   * Make a PUT request with CORS bypass
   */
  put(options: HttpRequestOptions): Promise<HttpResponse>;

  /**
   * Make a PATCH request with CORS bypass
   */
  patch(options: HttpRequestOptions): Promise<HttpResponse>;

  /**
   * Make a DELETE request with CORS bypass
   */
  delete(options: HttpRequestOptions): Promise<HttpResponse>;

  /**
   * Make a streaming HTTP request with CORS bypass
   * Returns chunks of data as they arrive
   */
  streamRequest(options: StreamRequestOptions): Promise<{ streamId: string }>;

  /**
   * Cancel a streaming request
   */
  cancelStream(options: { streamId: string }): Promise<void>;

  /**
   * Start listening to Server-Sent Events
   */
  startSSE(options: SSEOptions): Promise<{ connectionId: string }>;

  /**
   * Stop listening to Server-Sent Events
   */
  stopSSE(options: { connectionId: string }): Promise<void>;

  /**
   * Create a Server-Sent Events connection
   */
  createSSEConnection(options: SSEConnectionOptions): Promise<SSEConnection>;

  /**
   * Close an SSE connection
   */
  closeSSEConnection(options: { connectionId: string }): Promise<void>;

  /**
   * Create a WebSocket connection bypassing CORS
   */
  createWebSocketConnection(options: WebSocketConnectionOptions): Promise<WebSocketConnection>;

  /**
   * Close a WebSocket connection
   */
  closeWebSocketConnection(options: { connectionId: string }): Promise<void>;

  /**
   * Send data through WebSocket
   */
  sendWebSocketMessage(options: { connectionId: string; message: string }): Promise<void>;

  /**
   * Create MCP client with full protocol support
   */
  createMCPClient(options: MCPClientOptions): Promise<MCPClient>;

  /**
   * List MCP resources
   */
  listMCPResources(options: { connectionId: string; cursor?: string }): Promise<MCPResourceList>;

  /**
   * Read MCP resource
   */
  readMCPResource(options: { connectionId: string; uri: string }): Promise<MCPResource>;

  /**
   * List MCP tools
   */
  listMCPTools(options: { connectionId: string; cursor?: string }): Promise<MCPToolList>;

  /**
   * Call MCP tool
   */
  callMCPTool(options: { connectionId: string; name: string; arguments?: any }): Promise<MCPToolResult>;

  /**
   * List MCP prompts
   */
  listMCPPrompts(options: { connectionId: string; cursor?: string }): Promise<MCPPromptList>;

  /**
   * Get MCP prompt
   */
  getMCPPrompt(options: { connectionId: string; name: string; arguments?: any }): Promise<MCPPrompt>;

  /**
   * Send MCP sampling request
   */
  sendMCPSampling(options: { connectionId: string; request: MCPSamplingRequest }): Promise<MCPSamplingResponse>;

  /**
   * Add listener for plugin events
   */
  addListener(
    eventName: string,
    listenerFunc: (event: any) => void,
  ): Promise<PluginListenerHandle>;

  /**
   * Remove all listeners for this plugin
   */
  removeAllListeners(): Promise<void>;
}
