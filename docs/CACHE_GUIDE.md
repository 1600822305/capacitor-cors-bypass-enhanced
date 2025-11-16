# 缓存系统使用指南

## 概述

缓存系统是 Capacitor CORS Bypass 插件的核心功能之一，提供智能缓存策略、离线支持和完整的缓存管理 API。

## 特性

- 🚀 **多种缓存策略** - Network-First, Cache-First, Stale-While-Revalidate 等
- 💾 **多种存储方式** - Memory, LocalStorage, IndexedDB
- 📊 **缓存统计** - 命中率、大小、条目数等
- 🔄 **自动清理** - LRU, LFU, FIFO, TTL 策略
- 📴 **离线支持** - 离线模式和请求队列
- 🎯 **灵活配置** - 排除规则、自定义键生成等

## 快速开始

### 基础用法

```typescript
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import { createCacheInterceptor, CacheStrategies } from 'capacitor-cors-bypass-enhanced/cache';

// 创建缓存拦截器
const cacheInterceptor = createCacheInterceptor({
  strategy: 'network-first',
  maxAge: 5 * 60 * 1000, // 5分钟
  storage: 'memory',
  enabled: true
});

// 添加到插件
await CorsBypass.addInterceptor(cacheInterceptor, {
  name: 'cache-interceptor',
  priority: 80
});

// 发起请求（自动缓存）
const response = await CorsBypass.get({
  url: 'https://api.example.com/data'
});
```

### 使用预设策略

```typescript
import { CacheStrategies } from 'capacitor-cors-bypass-enhanced/cache';

// 网络优先（推荐用于动态数据）
const networkFirst = createCacheInterceptor(
  CacheStrategies.networkFirst(5 * 60 * 1000)
);

// 缓存优先（推荐用于静态资源）
const cacheFirst = createCacheInterceptor(
  CacheStrategies.cacheFirst(60 * 60 * 1000) // 1小时
);

// 陈旧重新验证（推荐用于可接受旧数据的场景）
const staleWhileRevalidate = createCacheInterceptor(
  CacheStrategies.staleWhileRevalidate(10 * 60 * 1000)
);
```

## 缓存策略

### 1. Network-First（网络优先）

优先从网络获取数据，失败时使用缓存。

```typescript
const interceptor = createCacheInterceptor({
  strategy: 'network-first',
  maxAge: 5 * 60 * 1000
});
```

**适用场景：**
- 需要最新数据的API
- 实时性要求高的场景
- 默认推荐策略

**工作流程：**
1. 发起网络请求
2. 成功：返回数据并更新缓存
3. 失败：返回缓存数据（如果有）

### 2. Cache-First（缓存优先）

优先使用缓存，缓存不存在或过期时从网络获取。

```typescript
const interceptor = createCacheInterceptor({
  strategy: 'cache-first',
  maxAge: 60 * 60 * 1000 // 1小时
});
```

**适用场景：**
- 静态资源（图片、CSS、JS）
- 不常变化的配置数据
- 需要快速响应的场景

**工作流程：**
1. 检查缓存
2. 缓存存在且未过期：直接返回
3. 缓存不存在或过期：发起网络请求

### 3. Stale-While-Revalidate（陈旧重新验证）

立即返回缓存数据，同时在后台更新。

```typescript
const interceptor = createCacheInterceptor({
  strategy: 'stale-while-revalidate',
  maxAge: 10 * 60 * 1000
});
```

**适用场景：**
- 可以接受稍旧数据的场景
- 需要极快响应速度
- 用户体验优先

**工作流程：**
1. 立即返回缓存数据
2. 后台发起网络请求更新缓存
3. 下次请求使用更新后的数据

### 4. Network-Only（仅网络）

总是从网络获取，不使用缓存。

```typescript
const interceptor = createCacheInterceptor({
  strategy: 'network-only',
  enabled: false // 或者不添加缓存拦截器
});
```

**适用场景：**
- 敏感数据
- 实时性要求极高
- 不希望缓存的数据

### 5. Cache-Only（仅缓存）

只使用缓存，不发起网络请求。

```typescript
const interceptor = createCacheInterceptor({
  strategy: 'cache-only',
  maxAge: 24 * 60 * 60 * 1000 // 24小时
});
```

**适用场景：**
- 离线模式
- 已预加载的数据
- 测试场景

## 存储方式

### Memory（内存存储）

```typescript
const interceptor = createCacheInterceptor({
  storage: 'memory',
  maxSize: 50 * 1024 * 1024 // 50MB
});
```

**特点：**
- ✅ 最快的读写速度
- ✅ 不占用磁盘空间
- ❌ 页面刷新后丢失
- ❌ 受内存限制

**适用场景：**
- 临时数据
- 会话期间的缓存
- 性能要求高的场景

### LocalStorage（本地存储）

```typescript
const interceptor = createCacheInterceptor({
  storage: 'localStorage',
  maxSize: 5 * 1024 * 1024 // 5MB（浏览器限制）
});
```

**特点：**
- ✅ 持久化存储
- ✅ 简单易用
- ❌ 大小限制（通常5-10MB）
- ❌ 同步API，可能阻塞

**适用场景：**
- 小量数据持久化
- 配置信息
- 用户偏好设置

### IndexedDB（索引数据库）

```typescript
const interceptor = createCacheInterceptor({
  storage: 'indexedDB',
  maxSize: 100 * 1024 * 1024 // 100MB
});
```

**特点：**
- ✅ 大容量存储
- ✅ 异步API
- ✅ 支持索引和查询
- ❌ API相对复杂

**适用场景：**
- 大量数据缓存
- 离线应用
- 需要持久化的场景

## 高级配置

### 排除规则

```typescript
const interceptor = createCacheInterceptor({
  strategy: 'cache-first',
  exclude: {
    // 排除查询参数
    query: true,
    
    // 排除特定路径
    paths: [
      '/api/realtime',
      '/api/auth/.*',
      '^https://analytics\\..*'
    ],
    
    // 排除特定HTTP方法
    methods: ['POST', 'PUT', 'DELETE']
  }
});
```

### 自定义缓存键

```typescript
const interceptor = createCacheInterceptor({
  keyGenerator: (url, method, params) => {
    // 自定义键生成逻辑
    const userId = getCurrentUserId();
    return `${userId}:${method}:${url}`;
  }
});
```

### 缓存钩子

```typescript
const interceptor = createCacheInterceptor({
  // 缓存前处理
  beforeCache: async (response) => {
    // 可以修改要缓存的数据
    return {
      ...response.data,
      cachedAt: Date.now()
    };
  },
  
  // 缓存后回调
  afterCache: async (entry) => {
    console.log('Cached:', entry.key, entry.size);
  },
  
  // 缓存命中回调
  onCacheHit: async (entry) => {
    console.log('Cache hit:', entry.key);
  },
  
  // 缓存未命中回调
  onCacheMiss: async (key) => {
    console.log('Cache miss:', key);
  }
});
```

### 数据压缩

```typescript
const interceptor = createCacheInterceptor({
  compress: true, // 启用压缩
  storage: 'localStorage' // 推荐用于localStorage
});
```

## 离线支持

### 基础离线模式

```typescript
const interceptor = createCacheInterceptor(
  {
    strategy: 'network-first',
    maxAge: 10 * 60 * 1000
  },
  {
    // 离线配置
    enabled: true,
    strategy: 'cache-only',
    
    // 自定义离线检测
    isOffline: () => !navigator.onLine,
    
    // 离线时的回退响应
    fallbackResponse: {
      data: { message: '当前离线，显示缓存数据' },
      status: 200,
      headers: {},
      url: ''
    }
  }
);
```

### 离线请求队列

```typescript
const interceptor = createCacheInterceptor(
  { strategy: 'network-first' },
  {
    enabled: true,
    queue: {
      enabled: true,
      maxSize: 100,
      retryCount: 3,
      retryDelay: 1000
    }
  }
);
```

## 缓存管理

### 获取缓存统计

```typescript
const stats = await cacheInterceptor.getStats();

console.log('缓存条目数:', stats.totalEntries);
console.log('缓存总大小:', stats.totalSize);
console.log('命中次数:', stats.hits);
console.log('未命中次数:', stats.misses);
console.log('命中率:', (stats.hitRate * 100).toFixed(2) + '%');
```

### 清空缓存

```typescript
// 清空所有缓存
await cacheInterceptor.clearCache();

// 或者直接使用缓存管理器
const cacheManager = cacheInterceptor.getCacheManager();
await cacheManager.clear();
```

### 清理过期缓存

```typescript
// 手动清理
const cleaned = await cacheInterceptor.cleanup();
console.log(`清理了 ${cleaned} 个过期条目`);

// 自动清理（在创建时配置）
const cacheManager = new MemoryCacheManager(
  50 * 1024 * 1024,
  {
    policy: 'lru',
    interval: 60000 // 每分钟清理一次
  }
);
```

### 删除特定缓存

```typescript
const cacheManager = cacheInterceptor.getCacheManager();

// 删除单个缓存
await cacheManager.delete('GET:https://api.example.com/data:');

// 获取所有缓存键
const keys = await cacheManager.keys();
console.log('所有缓存键:', keys);

// 批量删除
for (const key of keys) {
  if (key.includes('/api/old/')) {
    await cacheManager.delete(key);
  }
}
```

## 实战示例

### 示例1：API数据缓存

```typescript
// 为不同类型的API配置不同的缓存策略
class ApiCacheManager {
  async initialize() {
    // 用户数据：网络优先，5分钟缓存
    await CorsBypass.addInterceptor(
      createCacheInterceptor({
        strategy: 'network-first',
        maxAge: 5 * 60 * 1000,
        storage: 'memory',
        exclude: {
          paths: ['/api/user/profile'] // 个人资料总是最新
        }
      }),
      { name: 'user-cache', priority: 80 }
    );

    // 静态配置：缓存优先，1小时缓存
    await CorsBypass.addInterceptor(
      createCacheInterceptor({
        strategy: 'cache-first',
        maxAge: 60 * 60 * 1000,
        storage: 'localStorage',
        scope: {
          urlPattern: '/api/config/.*'
        }
      }),
      { name: 'config-cache', priority: 70 }
    );

    // 列表数据：陈旧重新验证，10分钟缓存
    await CorsBypass.addInterceptor(
      createCacheInterceptor({
        strategy: 'stale-while-revalidate',
        maxAge: 10 * 60 * 1000,
        storage: 'indexedDB',
        scope: {
          urlPattern: '/api/list/.*'
        }
      }),
      { name: 'list-cache', priority: 60 }
    );
  }
}
```

### 示例2：离线优先应用

```typescript
class OfflineFirstApp {
  private cacheInterceptor: CacheInterceptor;

  async initialize() {
    this.cacheInterceptor = createCacheInterceptor(
      {
        strategy: 'cache-first',
        maxAge: 24 * 60 * 60 * 1000, // 24小时
        storage: 'indexedDB',
        maxSize: 100 * 1024 * 1024 // 100MB
      },
      {
        enabled: true,
        strategy: 'cache-only',
        isOffline: () => !navigator.onLine,
        queue: {
          enabled: true,
          maxSize: 50,
          retryCount: 3,
          retryDelay: 2000
        }
      }
    );

    await CorsBypass.addInterceptor(this.cacheInterceptor, {
      name: 'offline-cache',
      priority: 100
    });

    // 监听在线/离线状态
    window.addEventListener('online', () => {
      console.log('网络已连接，处理队列中的请求');
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      console.log('网络已断开，切换到离线模式');
    });
  }

  private async processQueue() {
    // 处理离线队列中的请求
    console.log('处理离线队列...');
  }

  async preloadData() {
    // 预加载关键数据
    const urls = [
      '/api/user/profile',
      '/api/config/app',
      '/api/content/home'
    ];

    for (const url of urls) {
      try {
        await CorsBypass.get({ url });
        console.log('预加载成功:', url);
      } catch (error) {
        console.error('预加载失败:', url, error);
      }
    }
  }
}
```

### 示例3：智能缓存管理

```typescript
class SmartCacheManager {
  private cacheInterceptor: CacheInterceptor;

  async initialize() {
    this.cacheInterceptor = createCacheInterceptor({
      strategy: 'network-first',
      maxAge: 10 * 60 * 1000,
      storage: 'indexedDB',
      beforeCache: async (response) => {
        // 只缓存成功的响应
        if (response.status >= 200 && response.status < 300) {
          return response.data;
        }
        return null;
      },
      onCacheHit: async (entry) => {
        // 记录缓存命中
        this.trackCacheHit(entry.key);
      },
      onCacheMiss: async (key) => {
        // 记录缓存未命中
        this.trackCacheMiss(key);
      }
    });

    await CorsBypass.addInterceptor(this.cacheInterceptor, {
      name: 'smart-cache',
      priority: 80
    });

    // 定期清理和优化
    setInterval(() => this.optimize(), 5 * 60 * 1000);
  }

  private async optimize() {
    const stats = await this.cacheInterceptor.getStats();
    
    console.log('缓存统计:', {
      entries: stats.totalEntries,
      size: (stats.totalSize / 1024 / 1024).toFixed(2) + 'MB',
      hitRate: (stats.hitRate * 100).toFixed(2) + '%'
    });

    // 如果命中率低于50%，清理缓存
    if (stats.hitRate < 0.5) {
      console.log('命中率过低，清理缓存...');
      await this.cacheInterceptor.cleanup();
    }

    // 如果缓存过大，清理
    if (stats.totalSize > 80 * 1024 * 1024) {
      console.log('缓存过大，清理...');
      await this.cacheInterceptor.cleanup();
    }
  }

  private trackCacheHit(key: string) {
    // 发送到分析服务
    console.log('Cache hit:', key);
  }

  private trackCacheMiss(key: string) {
    // 发送到分析服务
    console.log('Cache miss:', key);
  }

  async getCacheReport() {
    const stats = await this.cacheInterceptor.getStats();
    const cacheManager = this.cacheInterceptor.getCacheManager();
    const keys = await cacheManager.keys();

    return {
      summary: stats,
      keys: keys,
      recommendations: this.getRecommendations(stats)
    };
  }

  private getRecommendations(stats: any) {
    const recommendations = [];

    if (stats.hitRate < 0.3) {
      recommendations.push('命中率过低，考虑调整缓存策略');
    }

    if (stats.totalSize > 90 * 1024 * 1024) {
      recommendations.push('缓存接近上限，建议清理');
    }

    if (stats.totalEntries > 1000) {
      recommendations.push('缓存条目过多，考虑增加清理频率');
    }

    return recommendations;
  }
}
```

## 最佳实践

### 1. 选择合适的缓存策略

- **动态数据**：使用 `network-first`
- **静态资源**：使用 `cache-first`
- **可接受旧数据**：使用 `stale-while-revalidate`
- **离线应用**：使用 `cache-only` + 离线队列

### 2. 选择合适的存储方式

- **临时数据**：使用 `memory`
- **小量持久化**：使用 `localStorage`
- **大量数据**：使用 `indexedDB`

### 3. 设置合理的过期时间

```typescript
// 根据数据更新频率设置
const cacheConfig = {
  // 实时数据：1-5分钟
  realtime: 1 * 60 * 1000,
  
  // 动态数据：5-30分钟
  dynamic: 10 * 60 * 1000,
  
  // 半静态数据：1-6小时
  semiStatic: 60 * 60 * 1000,
  
  // 静态数据：24小时+
  static: 24 * 60 * 60 * 1000
};
```

### 4. 监控缓存性能

```typescript
// 定期检查缓存统计
setInterval(async () => {
  const stats = await cacheInterceptor.getStats();
  
  if (stats.hitRate < 0.5) {
    console.warn('缓存命中率低:', stats.hitRate);
  }
  
  if (stats.totalSize > 80 * 1024 * 1024) {
    console.warn('缓存占用过大:', stats.totalSize);
  }
}, 60000);
```

### 5. 合理使用排除规则

```typescript
const interceptor = createCacheInterceptor({
  exclude: {
    // 不缓存POST/PUT/DELETE请求
    methods: ['POST', 'PUT', 'DELETE'],
    
    // 不缓存认证相关接口
    paths: ['/api/auth/.*', '/api/login'],
    
    // 不缓存实时数据
    paths: ['/api/realtime/.*']
  }
});
```

## 故障排查

### 缓存未生效

1. 检查拦截器是否已添加
2. 检查缓存策略配置
3. 检查排除规则
4. 查看浏览器控制台日志

### 缓存占用过大

1. 减小 `maxSize` 配置
2. 缩短 `maxAge` 时间
3. 启用自动清理
4. 使用压缩

### 离线模式不工作

1. 检查离线配置是否启用
2. 检查 `isOffline` 函数
3. 确保有缓存数据
4. 查看离线队列配置

## 总结

缓存系统提供了强大而灵活的缓存能力，通过合理配置可以显著提升应用性能和用户体验。建议根据实际需求选择合适的策略和存储方式，并定期监控缓存性能。