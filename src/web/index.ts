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