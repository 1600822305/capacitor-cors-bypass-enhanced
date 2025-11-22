/**
 * Model Context Protocol (MCP) Types
 */

/**
 * MCP Transport Types
 */
export type MCPTransportType = 'sse' | 'streamablehttp' | 'stdio';

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
   * Transport type to use
   * - 'streamablehttp': New single-endpoint transport (recommended)
   * - 'sse': Legacy HTTP+SSE dual-endpoint transport
   * - 'stdio': Standard input/output transport (not supported in browser)
   */
  transport?: MCPTransportType;

  /**
   * MCP server endpoint URL
   * For StreamableHTTP: Single endpoint (e.g., 'https://example.com/mcp')
   * For SSE: This will be used as sseUrl if sseUrl is not provided
   */
  url?: string;

  /**
   * MCP server SSE endpoint URL (legacy, for backward compatibility)
   * @deprecated Use 'url' with transport='sse' instead
   */
  sseUrl?: string;

  /**
   * MCP server POST endpoint URL for sending messages (legacy)
   * @deprecated Use 'url' with transport='sse' instead
   */
  postUrl?: string;

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

  /**
   * Enable session resumability for StreamableHTTP
   * Allows reconnecting and resuming message streams
   */
  resumable?: boolean;

  /**
   * Session ID for resuming StreamableHTTP connections
   */
  sessionId?: string;

  /**
   * Last received message sequence number for resumability
   */
  lastSequence?: number;
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