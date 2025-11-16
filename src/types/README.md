# Types Directory

This directory contains modularized TypeScript type definitions for the Capacitor CORS Bypass plugin.

## Structure

```
types/
├── index.ts          # Central export point for all types
├── common.ts         # Common shared types
├── http.ts           # HTTP request/response types
├── stream.ts         # Streaming request types
├── sse.ts            # Server-Sent Events types
├── websocket.ts      # WebSocket types
└── mcp.ts            # Model Context Protocol types
```

## Usage

### Import all types (recommended)
```typescript
import { HttpRequestOptions, HttpResponse, SSEConnection } from 'capacitor-cors-bypass-enhanced';
```

### Import from specific modules (for tree-shaking)
```typescript
import { HttpRequestOptions } from 'capacitor-cors-bypass-enhanced/dist/esm/types/http';
import { SSEConnection } from 'capacitor-cors-bypass-enhanced/dist/esm/types/sse';
```

## Module Descriptions

### `common.ts`
Contains shared types used across multiple modules:
- `PluginListenerHandle` - Handle for event listeners

### `http.ts`
HTTP request and response types:
- `HttpRequestOptions` - Configuration for HTTP requests
- `HttpResponse` - HTTP response structure

### `stream.ts`
Streaming request types:
- `StreamRequestOptions` - Configuration for streaming requests
- `StreamChunkEvent` - Event for received data chunks
- `StreamStatusEvent` - Event for stream status changes

### `sse.ts`
Server-Sent Events types:
- `SSEOptions` - Basic SSE connection options
- `SSEConnectionOptions` - Advanced SSE connection options with reconnection
- `SSEConnection` - SSE connection object
- `SSEMessageEvent` - SSE message event
- `SSEConnectionChangeEvent` - SSE connection status change event

### `websocket.ts`
WebSocket types:
- `WebSocketConnectionOptions` - WebSocket connection configuration
- `WebSocketConnection` - WebSocket connection object
- `WebSocketMessageEvent` - WebSocket message event
- `WebSocketConnectionChangeEvent` - WebSocket connection status change event

### `mcp.ts`
Model Context Protocol types:
- `MCPClientOptions` - MCP client configuration
- `MCPClient` - MCP client object
- `MCPResourceList`, `MCPResourceInfo`, `MCPResource` - Resource types
- `MCPToolList`, `MCPToolInfo`, `MCPToolResult` - Tool types
- `MCPPromptList`, `MCPPromptInfo`, `MCPPrompt` - Prompt types
- `MCPSamplingRequest`, `MCPSamplingResponse` - Sampling types
- `MCPResponse` - Generic MCP response

## Benefits of Modularization

1. **Better Organization**: Related types are grouped together
2. **Easier Maintenance**: Changes to one feature don't affect others
3. **Improved Documentation**: Each module can be documented separately
4. **Tree-Shaking**: Bundlers can eliminate unused types
5. **Team Collaboration**: Multiple developers can work on different modules
6. **Type Discovery**: Easier to find relevant types for specific features