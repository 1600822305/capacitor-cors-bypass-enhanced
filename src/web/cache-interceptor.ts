/**
 * Cache Interceptor
 * 缓存拦截器实现
 */

import type {
  Interceptor,
  HttpRequestOptions,
  HttpResponse,
  HttpError,
} from '../definitions';
import type {
  CacheOptions,
  CacheStrategy,
  CacheEntry,
  CacheInterceptorOptions,
  OfflineOptions,
} from '../types/cache';
import { createCacheManager, type CacheManager } from './cache';

/**
 * 缓存拦截器类
 */
export class CacheInterceptor implements Interceptor {
  private cacheManager: CacheManager;
  private options: CacheInterceptorOptions;
  private offlineOptions?: OfflineOptions;

  constructor(options?: CacheInterceptorOptions, offlineOptions?: OfflineOptions) {
    this.options = {
      strategy: 'network-first',
      maxAge: 5 * 60 * 1000, // 5分钟
      enabled: true,
      compress: false,
      storage: 'memory',
      ...options,
    };

    this.offlineOptions = offlineOptions;
    this.cacheManager = createCacheManager(this.options);
  }

  /**
   * 请求拦截器
   */
  async onRequest(config: HttpRequestOptions): Promise<HttpRequestOptions> {
    // 如果缓存未启用，直接返回
    if (!this.options.enabled) {
      return config;
    }

    // 检查是否应该排除此请求
    if (this.shouldExclude(config)) {
      return config;
    }

    // 检查是否离线
    const isOffline = await this.checkOffline();
    if (isOffline && this.offlineOptions?.enabled) {
      return this.handleOfflineRequest(config);
    }

    // 根据策略处理缓存
    const strategy = this.options.strategy || 'network-first';
    const cacheKey = this.generateCacheKey(config);

    switch (strategy) {
      case 'cache-first':
      case 'cache-only':
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
          // 缓存命中，调用钩子
          if (this.options.onCacheHit) {
            await this.options.onCacheHit(cached);
          }
          
          // 返回缓存的响应（通过抛出特殊错误来中断请求）
          throw {
            __cacheHit: true,
            response: this.entryToResponse(cached),
          };
        }

        // cache-only 策略下，如果没有缓存则失败
        if (strategy === 'cache-only') {
          throw new Error('Cache miss in cache-only mode');
        }
        break;

      case 'stale-while-revalidate':
        const staleCache = await this.cacheManager.get(cacheKey);
        if (staleCache) {
          // 返回缓存，但在后台更新
          setTimeout(() => {
            this.backgroundRevalidate(config, cacheKey);
          }, 0);

          throw {
            __cacheHit: true,
            response: this.entryToResponse(staleCache),
          };
        }
        break;
    }

    // 缓存未命中，调用钩子
    if (this.options.onCacheMiss) {
      await this.options.onCacheMiss(cacheKey);
    }

    return config;
  }

  /**
   * 响应拦截器
   */
  async onResponse(response: HttpResponse): Promise<HttpResponse> {
    // 如果缓存未启用，直接返回
    if (!this.options.enabled) {
      return response;
    }

    // 检查是否应该排除此请求
    const config = (response as any).config || {};
    if (this.shouldExclude(config)) {
      return response;
    }

    // 只缓存成功的响应
    if (response.status >= 200 && response.status < 300) {
      const cacheKey = this.generateCacheKey(config);
      
      // 调用缓存前钩子
      let dataToCache = response.data;
      if (this.options.beforeCache) {
        dataToCache = await this.options.beforeCache(response);
      }

      // 创建缓存条目
      const entry: CacheEntry = {
        key: cacheKey,
        data: dataToCache,
        headers: response.headers,
        status: response.status,
        timestamp: Date.now(),
        expiresAt: Date.now() + (this.options.maxAge || 300000),
        size: this.calculateSize(dataToCache),
        compressed: this.options.compress,
        metadata: {
          url: config.url,
          method: config.method || 'GET',
          etag: response.headers['etag'],
          lastModified: response.headers['last-modified'],
        },
      };

      // 如果启用压缩，压缩数据
      if (this.options.compress) {
        entry.data = await this.compressData(entry.data);
      }

      // 保存到缓存
      await this.cacheManager.set(cacheKey, entry);

      // 调用缓存后钩子
      if (this.options.afterCache) {
        await this.options.afterCache(entry);
      }
    }

    return response;
  }

  /**
   * 错误拦截器
   */
  async onError(error: HttpError): Promise<void | HttpResponse> {
    // 检查是否是缓存命中的特殊错误
    if ((error as any).__cacheHit) {
      return (error as any).response;
    }

    // 如果缓存未启用，直接抛出错误
    if (!this.options.enabled) {
      throw error;
    }

    // 网络错误时，尝试使用缓存
    if (!error.status || error.status >= 500) {
      const cacheKey = this.generateCacheKey(error.config);
      const cached = await this.cacheManager.get(cacheKey);

      if (cached) {
        console.log('[Cache] Using cached response due to network error');
        return this.entryToResponse(cached);
      }
    }

    // 离线模式处理
    const isOffline = await this.checkOffline();
    if (isOffline && this.offlineOptions?.enabled) {
      return this.handleOfflineError(error);
    }

    throw error;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(config: HttpRequestOptions): string {
    if (this.options.keyGenerator) {
      return this.options.keyGenerator(config.url, config.method || 'GET', config.params);
    }

    const method = config.method || 'GET';
    let url = config.url;

    // 如果排除查询参数
    if (this.options.exclude?.query) {
      url = url.split('?')[0];
    }

    // 包含参数
    const params = config.params ? JSON.stringify(config.params) : '';
    
    return `${method}:${url}:${params}`;
  }

  /**
   * 检查是否应该排除此请求
   */
  private shouldExclude(config: HttpRequestOptions): boolean {
    const exclude = this.options.exclude;
    if (!exclude) return false;

    // 检查HTTP方法
    if (exclude.methods && config.method) {
      if (exclude.methods.includes(config.method)) {
        return true;
      }
    }

    // 检查URL路径
    if (exclude.paths) {
      for (const pattern of exclude.paths) {
        if (new RegExp(pattern).test(config.url)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 将缓存条目转换为响应
   */
  private entryToResponse(entry: CacheEntry): HttpResponse {
    let data = entry.data;

    // 如果数据被压缩，解压
    if (entry.compressed) {
      data = this.decompressData(data);
    }

    return {
      data,
      status: entry.status,
      statusText: 'OK',
      headers: entry.headers,
      url: entry.metadata?.url || '',
    };
  }

  /**
   * 计算数据大小
   */
  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return JSON.stringify(data).length;
    }
  }

  /**
   * 压缩数据
   */
  private async compressData(data: any): Promise<any> {
    // 简单的压缩实现（实际项目中可以使用 pako 等库）
    try {
      const jsonString = JSON.stringify(data);
      // 这里可以集成 CompressionStream API 或其他压缩库
      return jsonString;
    } catch (error) {
      console.error('[Cache] Compression error:', error);
      return data;
    }
  }

  /**
   * 解压数据
   */
  private decompressData(data: any): any {
    // 简单的解压实现
    try {
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      return data;
    } catch (error) {
      console.error('[Cache] Decompression error:', error);
      return data;
    }
  }

  /**
   * 后台重新验证
   */
  private async backgroundRevalidate(config: HttpRequestOptions, cacheKey: string): Promise<void> {
    try {
      // 这里需要实际的HTTP请求实现
      // 在实际使用中，这会调用原始的请求方法
      console.log('[Cache] Background revalidation for:', cacheKey);
    } catch (error) {
      console.error('[Cache] Background revalidation failed:', error);
    }
  }

  /**
   * 检查是否离线
   */
  private async checkOffline(): Promise<boolean> {
    if (this.offlineOptions?.isOffline) {
      return this.offlineOptions.isOffline();
    }

    // 默认使用 navigator.onLine
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  }

  /**
   * 处理离线请求
   */
  private async handleOfflineRequest(config: HttpRequestOptions): Promise<HttpRequestOptions> {
    const strategy = this.offlineOptions?.strategy || 'cache-only';
    const cacheKey = this.generateCacheKey(config);

    if (strategy === 'cache-only') {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        throw {
          __cacheHit: true,
          response: this.entryToResponse(cached),
        };
      }

      // 如果有回退响应
      if (this.offlineOptions?.fallbackResponse) {
        throw {
          __cacheHit: true,
          response: this.offlineOptions.fallbackResponse,
        };
      }

      throw new Error('Offline and no cache available');
    }

    return config;
  }

  /**
   * 处理离线错误
   */
  private async handleOfflineError(error: HttpError): Promise<HttpResponse> {
    const cacheKey = this.generateCacheKey(error.config);
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return this.entryToResponse(cached);
    }

    if (this.offlineOptions?.fallbackResponse) {
      return this.offlineOptions.fallbackResponse;
    }

    throw error;
  }

  /**
   * 获取缓存管理器
   */
  getCacheManager(): CacheManager {
    return this.cacheManager;
  }

  /**
   * 清空缓存
   */
  async clearCache(): Promise<void> {
    await this.cacheManager.clear();
  }

  /**
   * 获取缓存统计
   */
  async getStats() {
    return this.cacheManager.getStats();
  }

  /**
   * 清理过期缓存
   */
  async cleanup(): Promise<number> {
    return this.cacheManager.cleanup();
  }
}

/**
 * 创建缓存拦截器的便捷函数
 */
export function createCacheInterceptor(
  options?: CacheInterceptorOptions,
  offlineOptions?: OfflineOptions
): CacheInterceptor {
  return new CacheInterceptor(options, offlineOptions);
}

/**
 * 预设的缓存策略
 */
export const CacheStrategies = {
  /**
   * 网络优先策略
   * 优先从网络获取，失败时使用缓存
   */
  networkFirst: (maxAge: number = 300000): CacheInterceptorOptions => ({
    strategy: 'network-first',
    maxAge,
    enabled: true,
  }),

  /**
   * 缓存优先策略
   * 优先使用缓存，缓存不存在时从网络获取
   */
  cacheFirst: (maxAge: number = 300000): CacheInterceptorOptions => ({
    strategy: 'cache-first',
    maxAge,
    enabled: true,
  }),

  /**
   * 仅网络策略
   * 总是从网络获取，不使用缓存
   */
  networkOnly: (): CacheInterceptorOptions => ({
    strategy: 'network-only',
    enabled: false,
  }),

  /**
   * 仅缓存策略
   * 只使用缓存，不发起网络请求
   */
  cacheOnly: (maxAge: number = 300000): CacheInterceptorOptions => ({
    strategy: 'cache-only',
    maxAge,
    enabled: true,
  }),

  /**
   * 陈旧重新验证策略
   * 立即返回缓存，同时在后台更新
   */
  staleWhileRevalidate: (maxAge: number = 300000): CacheInterceptorOptions => ({
    strategy: 'stale-while-revalidate',
    maxAge,
    enabled: true,
  }),
};