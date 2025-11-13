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

export interface SSEConnectionOptions {
  /**
   * The SSE endpoint URL
   */
  url: string;

  /**
   * Request headers
   */
  headers?: { [key: string]: string };

  /**
   * Reconnection options
   */
  reconnect?: {
    /**
     * Whether to automatically reconnect
     * @default true
     */
    enabled?: boolean;

    /**
     * Initial retry delay in milliseconds
     * @default 1000
     */
    initialDelay?: number;

    /**
     * Maximum retry delay in milliseconds
     * @default 30000
     */
    maxDelay?: number;

    /**
     * Maximum number of retry attempts
     * @default 10
     */
    maxAttempts?: number;
  };

  /**
   * MCP protocol specific options
   */
  mcp?: {
    /**
     * Whether this is an MCP (Model Context Protocol) connection
     * @default false
     */
    enabled?: boolean;

    /**
     * MCP client information
     */
    clientInfo?: {
      name: string;
      version: string;
    };

    /**
     * MCP capabilities
     */
    capabilities?: {
      sampling?: boolean;
      roots?: {
        listChanged?: boolean;
      } | boolean;
      [key: string]: any;
    };

    /**
     * HTTP POST endpoint for sending messages to MCP server
     */
    postEndpoint?: string;
  };
}

export interface SSEConnection {
  /**
   * Unique connection identifier
   */
  connectionId: string;

  /**
   * Connection status
   */
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface SSEMessageEvent {
  /**
   * Connection identifier
   */
  connectionId: string;

  /**
   * Event type (e.g., 'message', 'error', 'open')
   */
  type: string;

  /**
   * Event data
   */
  data?: string;

  /**
   * Event ID
   */
  id?: string;

  /**
   * Retry time
   */
  retry?: number;
}

export interface SSEConnectionChangeEvent {
  /**
   * Connection identifier
   */
  connectionId: string;

  /**
   * New connection status
   */
  status: 'connecting' | 'connected' | 'disconnected' | 'error';

  /**
   * Error message if status is 'error'
   */
  error?: string;
}

export interface WebSocketConnectionOptions {
  /**
   * The WebSocket URL
   */
  url: string;

  /**
   * WebSocket protocols
   */
  protocols?: string[];

  /**
   * Request headers
   */
  headers?: { [key: string]: string };

  /**
   * Connection timeout in milliseconds
   * @default 10000
   */
  timeout?: number;
}

export interface WebSocketConnection {
  /**
   * Unique connection identifier
   */
  connectionId: string;

  /**
   * Connection status
   */
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface WebSocketMessageEvent {
  /**
   * Connection identifier
   */
  connectionId: string;

  /**
   * Message data
   */
  data: string;

  /**
   * Message type
   */
  type: 'text' | 'binary';
}

export interface WebSocketConnectionChangeEvent {
  /**
   * Connection identifier
   */
  connectionId: string;

  /**
   * New connection status
   */
  status: 'connecting' | 'connected' | 'disconnected' | 'error';

  /**
   * Error message if status is 'error'
   */
  error?: string;
}

export interface PluginListenerHandle {
  remove(): Promise<void>;
}

// ===== MCP Protocol Types =====

export interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPClientOptions {
  /**
   * MCP server SSE endpoint URL
   */
  sseUrl: string;

  /**
   * MCP server POST endpoint URL for sending messages
   */
  postUrl: string;

  /**
   * Client information
   */
  clientInfo: {
    name: string;
    version: string;
  };

  /**
   * Client capabilities
   */
  capabilities: {
    sampling?: boolean;
    roots?: {
      listChanged?: boolean;
    };
    [key: string]: any;
  };

  /**
   * Protocol version
   */
  protocolVersion?: string;

  /**
   * Request headers
   */
  headers?: { [key: string]: string };

  /**
   * Connection timeout in milliseconds
   */
  timeout?: number;
}

export interface MCPClient {
  /**
   * Connection identifier
   */
  connectionId: string;

  /**
   * Connection status
   */
  status: 'connecting' | 'connected' | 'disconnected' | 'error';

  /**
   * Server capabilities
   */
  serverCapabilities?: any;

  /**
   * Protocol version negotiated
   */
  protocolVersion?: string;
}

export interface MCPResourceList {
  resources: MCPResourceInfo[];
  nextCursor?: string;
}

export interface MCPResourceInfo {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResource {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface MCPToolList {
  tools: MCPToolInfo[];
  nextCursor?: string;
}

export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema: any;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPPromptList {
  prompts: MCPPromptInfo[];
  nextCursor?: string;
}

export interface MCPPromptInfo {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPPrompt {
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text' | 'image' | 'resource';
      text?: string;
      data?: string;
      mimeType?: string;
    };
  }>;
}

export interface MCPSamplingRequest {
  method: 'sampling/createMessage';
  params: {
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: {
        type: 'text' | 'image';
        text?: string;
        data?: string;
        mimeType?: string;
      };
    }>;
    modelPreferences?: {
      hints?: Array<{
        name?: string;
      }>;
      costPriority?: number;
      speedPriority?: number;
      intelligencePriority?: number;
    };
    systemPrompt?: string;
    includeContext?: 'none' | 'thisServer' | 'allServers';
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
    metadata?: any;
  };
}

export interface MCPSamplingResponse {
  role: 'assistant';
  content: {
    type: 'text';
    text: string;
  };
  model: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
}

export interface SSEOptions {
  /**
   * The URL to connect to for SSE
   */
  url: string;

  /**
   * Request headers
   */
  headers?: { [key: string]: string };

  /**
   * Whether to include credentials (cookies)
   */
  withCredentials?: boolean;

  /**
   * Reconnection timeout in milliseconds
   */
  reconnectTimeout?: number;
}
