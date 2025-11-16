# 缓存系统快速开始

## 安装

缓存系统已内置在 `capacitor-cors-bypass-enhanced` 插件中，无需额外安装。

## 快速使用

### 1. 基础缓存

```typescript
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import { createCacheInterceptor } from 'capacitor-cors-bypass-enhanced/web';

// 创建缓存拦截器
const cacheInterceptor = createCacheInterceptor({
  strategy: 'network-first',  // 网络优先策略
  maxAge: 5 * 60 * 1000,      // 5分钟过期
  storage: 'memory',           // 内存存储
  enabled: true
});

// 添加到插件
await CorsBypass.addInterceptor(cacheInterceptor, {
  name: 'cache',
  priority: 80
});

// 发起请求（自动缓存）
const response = await CorsBypass.get({
  url: 'https://api.example.com/data'
});
```

### 2. 使用预设策略

```typescript
import { CacheStrategies } from 'capacitor-cors-bypass-enhanced/web';

// 网络优先（推荐）
const networkFirst = createCacheInterceptor(
  CacheStrategies.networkFirst(5 * 60 * 1000)
);

// 缓存优先（静态资源）
const cacheFirst = createCacheInterceptor(
  CacheStrategies.cacheFirst(60 * 60 * 1000)
);

// 陈旧重新验证（快速响应）
const staleWhileRevalidate = createCacheInterceptor(
  CacheStrategies.staleWhileRevalidate(10 * 60 * 1000)
);
```

### 3. 离线支持

```typescript
const cacheInterceptor = createCacheInterceptor(
  {
    strategy: 'network-first',
    maxAge: 10 * 60 * 1000,
    storage: 'indexedDB'
  },
  {
    // 离线配置
    enabled: true,
    strategy: 'cache-only',
    fallbackResponse: {
      data: { message: '离线模式' },
      status: 200,
      headers: {},
      url: ''
    }
  }
);
```

## 缓存策略对比

| 策略 | 优先级 | 适用场景 | 响应速度 |
|------|--------|----------|----------|
| network-first | 网络 > 缓存 | 动态数据 | 中 |
| cache-first | 缓存 > 网络 | 静态资源 | 快 |
| stale-while-revalidate | 缓存立即返回 | 可接受旧数据 | 最快 |
| network-only | 仅网络 | 敏感数据 | 慢 |
| cache-only | 仅缓存 | 离线模式 | 快 |

## 存储方式对比

| 存储 | 容量 | 持久化 | 速度 | 适用场景 |
|------|------|--------|------|----------|
| memory | 受内存限制 | ❌ | 最快 | 临时数据 |
| localStorage | 5-10MB | ✅ | 快 | 小量持久化 |
| indexedDB | 100MB+ | ✅ | 中 | 大量数据 |

## 缓存管理

```typescript
// 获取统计信息
const stats = await cacheInterceptor.getStats();
console.log('命中率:', (stats.hitRate * 100).toFixed(2) + '%');

// 清空缓存
await cacheInterceptor.clearCache();

// 清理过期缓存
const cleaned = await cacheInterceptor.cleanup();
console.log('清理了', cleaned, '个过期条目');
```

## 完整示例

```typescript
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import { createCacheInterceptor, CacheStrategies } from 'capacitor-cors-bypass-enhanced/web';

class AppCache {
  private cacheInterceptor: any;

  async initialize() {
    // 创建缓存拦截器
    this.cacheInterceptor = createCacheInterceptor({
      strategy: 'network-first',
      maxAge: 5 * 60 * 1000,
      storage: 'indexedDB',
      maxSize: 50 * 1024 * 1024,
      
      // 排除规则
      exclude: {
        methods: ['POST', 'PUT', 'DELETE'],
        paths: ['/api/auth/.*']
      },
      
      // 钩子函数
      onCacheHit: (entry) => {
        console.log('缓存命中:', entry.key);
      },
      onCacheMiss: (key) => {
        console.log('缓存未命中:', key);
      }
    });

    // 添加拦截器
    await CorsBypass.addInterceptor(this.cacheInterceptor, {
      name: 'app-cache',
      priority: 80
    });

    // 定期清理
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  async cleanup() {
    const cleaned = await this.cacheInterceptor.cleanup();
    console.log('清理了', cleaned, '个过期条目');
  }

  async getReport() {
    const stats = await this.cacheInterceptor.getStats();
    return {
      entries: stats.totalEntries,
      size: (stats.totalSize / 1024 / 1024).toFixed(2) + 'MB',
      hitRate: (stats.hitRate * 100).toFixed(2) + '%',
      hits: stats.hits,
      misses: stats.misses
    };
  }
}

// 使用
const appCache = new AppCache();
await appCache.initialize();

// 发起请求（自动缓存）
const response = await CorsBypass.get({
  url: 'https://api.example.com/data'
});

// 查看报告
const report = await appCache.getReport();
console.log('缓存报告:', report);
```

## 更多信息

详细文档请参考：[docs/CACHE_GUIDE.md](docs/CACHE_GUIDE.md)

## 特性

- ✅ 5种缓存策略
- ✅ 3种存储方式
- ✅ 离线支持
- ✅ 自动清理
- ✅ 缓存统计
- ✅ 灵活配置
- ✅ TypeScript 支持