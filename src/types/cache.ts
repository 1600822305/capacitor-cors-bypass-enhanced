/**
 * Cache System Types
 * 缓存系统类型定义
 */

/**
 * 缓存策略
 */
export type CacheStrategy = 
  | 'network-first'           // 网络优先，失败时使用缓存
  | 'cache-first'             // 缓存优先，缓存不存在时请求网络
  | 'network-only'            // 仅网络，不使用缓存
  | 'cache-only'              // 仅缓存，不请求网络
  | 'stale-while-revalidate'; // 返回缓存同时后台更新

/**
 * 缓存配置选项
 */
export interface CacheOptions {
  /**
   * 缓存策略
   * @default 'network-first'
   */
  strategy?: CacheStrategy;

  /**
   * 缓存最大存活时间（毫秒）
   * @default 300000 (5分钟)
   */
  maxAge?: number;

  /**
   * 缓存最大大小（字节）
   * @default 50 * 1024 * 1024 (50MB)
   */
  maxSize?: number;

  /**
   * 是否启用缓存
   * @default true
   */
  enabled?: boolean;

  /**
   * 缓存键生成函数
   */
  keyGenerator?: (url: string, method: string, params?: any) => string;

  /**
   * 排除规则
   */
  exclude?: {
    /**
     * 是否排除查询参数
     */
    query?: boolean;

    /**
     * 排除的URL路径模式
     */
    paths?: string[];

    /**
     * 排除的HTTP方法
     */
    methods?: string[];
  };

  /**
   * 是否压缩缓存数据
   * @default false
   */
  compress?: boolean;

  /**
   * 缓存存储类型
   * @default 'memory'
   */
  storage?: 'memory' | 'localStorage' | 'indexedDB';
}

/**
 * 缓存条目
 */
export interface CacheEntry {
  /**
   * 缓存键
   */
  key: string;

  /**
   * 缓存数据
   */
  data: any;

  /**
   * 响应头
   */
  headers: { [key: string]: string };

  /**
   * HTTP状态码
   */
  status: number;

  /**
   * 创建时间戳
   */
  timestamp: number;

  /**
   * 过期时间戳
   */
  expiresAt: number;

  /**
   * 数据大小（字节）
   */
  size: number;

  /**
   * 是否已压缩
   */
  compressed?: boolean;

  /**
   * 元数据
   */
  metadata?: {
    url: string;
    method: string;
    etag?: string;
    lastModified?: string;
  };
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /**
   * 缓存条目总数
   */
  totalEntries: number;

  /**
   * 缓存总大小（字节）
   */
  totalSize: number;

  /**
   * 命中次数
   */
  hits: number;

  /**
   * 未命中次数
   */
  misses: number;

  /**
   * 命中率
   */
  hitRate: number;

  /**
   * 最老的缓存时间戳
   */
  oldestEntry?: number;

  /**
   * 最新的缓存时间戳
   */
  newestEntry?: number;
}

/**
 * 缓存管理器接口
 */
export interface CacheManager {
  /**
   * 获取缓存
   */
  get(key: string): Promise<CacheEntry | null>;

  /**
   * 设置缓存
   */
  set(key: string, entry: CacheEntry): Promise<void>;

  /**
   * 删除缓存
   */
  delete(key: string): Promise<boolean>;

  /**
   * 清空所有缓存
   */
  clear(): Promise<void>;

  /**
   * 检查缓存是否存在
   */
  has(key: string): Promise<boolean>;

  /**
   * 获取所有缓存键
   */
  keys(): Promise<string[]>;

  /**
   * 获取缓存统计信息
   */
  getStats(): Promise<CacheStats>;

  /**
   * 清理过期缓存
   */
  cleanup(): Promise<number>;

  /**
   * 获取缓存大小
   */
  getSize(): Promise<number>;
}

/**
 * 缓存拦截器配置
 */
export interface CacheInterceptorOptions extends CacheOptions {
  /**
   * 拦截器名称
   */
  name?: string;

  /**
   * 优先级
   */
  priority?: number;

  /**
   * 是否启用
   */
  enabled?: boolean;

  /**
   * 缓存前的钩子
   */
  beforeCache?: (response: any) => any | Promise<any>;

  /**
   * 缓存后的钩子
   */
  afterCache?: (entry: CacheEntry) => void | Promise<void>;

  /**
   * 缓存命中的钩子
   */
  onCacheHit?: (entry: CacheEntry) => void | Promise<void>;

  /**
   * 缓存未命中的钩子
   */
  onCacheMiss?: (key: string) => void | Promise<void>;
}

/**
 * 离线配置
 */
export interface OfflineOptions {
  /**
   * 是否启用离线模式
   * @default false
   */
  enabled?: boolean;

  /**
   * 离线时的缓存策略
   * @default 'cache-only'
   */
  strategy?: CacheStrategy;

  /**
   * 离线检测函数
   */
  isOffline?: () => boolean | Promise<boolean>;

  /**
   * 离线时的回退响应
   */
  fallbackResponse?: any;

  /**
   * 离线队列配置
   */
  queue?: {
    /**
     * 是否启用请求队列
     */
    enabled?: boolean;

    /**
     * 队列最大大小
     */
    maxSize?: number;

    /**
     * 重试次数
     */
    retryCount?: number;

    /**
     * 重试延迟（毫秒）
     */
    retryDelay?: number;
  };
}

/**
 * 缓存清理策略
 */
export type CacheEvictionPolicy = 
  | 'lru'   // 最近最少使用
  | 'lfu'   // 最不经常使用
  | 'fifo'  // 先进先出
  | 'ttl';  // 基于过期时间

/**
 * 缓存清理配置
 */
export interface CacheEvictionOptions {
  /**
   * 清理策略
   * @default 'lru'
   */
  policy?: CacheEvictionPolicy;

  /**
   * 触发清理的阈值（缓存大小百分比）
   * @default 0.9 (90%)
   */
  threshold?: number;

  /**
   * 清理目标（清理后的缓存大小百分比）
   * @default 0.7 (70%)
   */
  target?: number;

  /**
   * 自动清理间隔（毫秒）
   * @default 60000 (1分钟)
   */
  interval?: number;
}