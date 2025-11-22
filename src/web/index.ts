/**
 * Web Module Exports
 * Web端模块导出
 */

// HTTP Manager
export { HttpManager } from './http';

// Stream Manager
export { StreamManager } from './stream';

// SSE Manager
export { SSEManager } from './sse';

// WebSocket Manager
export { WebSocketManager } from './websocket';

// StreamableHTTP Transport (for MCP)
export { StreamableHTTPTransport } from './streamable-http';

// MCP Client Manager
export { MCPClientManager, mcpClientManager } from './mcp-client';

// Interceptor Manager
export { InterceptorManager } from './interceptor';

// Cache System
export {
  MemoryCacheManager,
  LocalStorageCacheManager,
  IndexedDBCacheManager,
  createCacheManager,
  type CacheManager,
} from './cache';

export {
  CacheInterceptor,
  createCacheInterceptor,
  CacheStrategies,
} from './cache-interceptor';

// Utils
export { UtilsManager } from './utils';