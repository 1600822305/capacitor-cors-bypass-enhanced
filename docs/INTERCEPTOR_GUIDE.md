# 拦截器系统使用指南

## 概述

拦截器系统是Capacitor CORS Bypass插件的核心功能之一，它允许你在HTTP请求的生命周期中插入自定义逻辑。拦截器可以用于：

- 🔐 **认证管理** - 自动添加认证令牌
- 📝 **日志记录** - 记录所有网络请求和响应
- 🔄 **错误处理** - 统一处理错误和自动重试
- 💾 **缓存控制** - 实现自定义缓存策略
- 🎯 **请求转换** - 修改请求参数和响应数据
- 📊 **性能监控** - 收集网络性能指标

## 快速开始

### 基础用法

```typescript
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

// 添加一个简单的日志拦截器
const handle = await CorsBypass.addInterceptor({
  onRequest: (config) => {
    console.log(`[Request] ${config.method} ${config.url}`);
    return config;
  },
  onResponse: (response) => {
    console.log(`[Response] ${response.status} ${response.url}`);
    return response;
  }
});
```

### 认证拦截器

```typescript
// 自动添加认证令牌
await CorsBypass.addInterceptor({
  onRequest: (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`
      };
    }
    return config;
  }
}, {
  name: 'auth-interceptor',
  priority: 100 // 高优先级，确保最先执行
});
```

### 错误处理和重试

```typescript
await CorsBypass.addInterceptor({
  onError: async (error) => {
    // 401错误：刷新令牌并重试
    if (error.status === 401) {
      console.log('Token expired, refreshing...');
      await refreshAuthToken();
      
      // 重试原始请求
      return CorsBypass.request(error.config);
    }
    
    // 网络错误：自动重试
    if (!error.status && error.config.retryCount < 3) {
      console.log(`Retrying request (${error.config.retryCount + 1}/3)...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return CorsBypass.request({
        ...error.config,
        retryCount: (error.config.retryCount || 0) + 1
      });
    }
    
    // 其他错误：抛出
    throw error;
  }
}, {
  name: 'error-handler',
  priority: 50
});
```

## 拦截器类型

### 1. 请求拦截器 (onRequest)

在请求发送前执行，可以修改请求配置。

```typescript
interface Interceptor {
  onRequest?(config: HttpRequestOptions): HttpRequestOptions | Promise<HttpRequestOptions>;
}
```

**示例：添加自定义请求头**

```typescript
await CorsBypass.addInterceptor({
  onRequest: (config) => {
    return {
      ...config,
      headers: {
        ...config.headers,
        'X-Custom-Header': 'custom-value',
        'X-Request-ID': generateRequestId(),
        'X-Timestamp': Date.now().toString()
      }
    };
  }
});
```

**示例：请求参数加密**

```typescript
await CorsBypass.addInterceptor({
  onRequest: (config) => {
    if (config.data && config.method === 'POST') {
      config.data = {
        encrypted: encrypt(JSON.stringify(config.data))
      };
    }
    return config;
  }
});
```

### 2. 响应拦截器 (onResponse)

在收到响应后执行，可以修改响应数据。

```typescript
interface Interceptor {
  onResponse?(response: HttpResponse): HttpResponse | Promise<HttpResponse>;
}
```

**示例：响应数据转换**

```typescript
await CorsBypass.addInterceptor({
  onResponse: (response) => {
    // 统一处理API响应格式
    if (response.data && typeof response.data === 'object') {
      return {
        ...response,
        data: {
          success: response.status >= 200 && response.status < 300,
          data: response.data,
          timestamp: Date.now()
        }
      };
    }
    return response;
  }
});
```

**示例：响应数据解密**

```typescript
await CorsBypass.addInterceptor({
  onResponse: (response) => {
    if (response.data && response.data.encrypted) {
      response.data = JSON.parse(decrypt(response.data.encrypted));
    }
    return response;
  }
});
```

### 3. 错误拦截器 (onError)

在请求或响应发生错误时执行。

```typescript
interface Interceptor {
  onError?(error: HttpError): void | HttpResponse | Promise<void | HttpResponse>;
}
```

**示例：错误日志记录**

```typescript
await CorsBypass.addInterceptor({
  onError: async (error) => {
    // 记录错误到分析服务
    await logErrorToAnalytics({
      url: error.config.url,
      method: error.config.method,
      status: error.status,
      message: error.message,
      timestamp: Date.now()
    });
    
    // 不处理错误，继续抛出
    throw error;
  }
});
```

**示例：错误提示**

```typescript
await CorsBypass.addInterceptor({
  onError: (error) => {
    // 显示用户友好的错误消息
    if (error.status === 404) {
      showToast('请求的资源不存在');
    } else if (error.status === 500) {
      showToast('服务器错误，请稍后重试');
    } else if (!error.status) {
      showToast('网络连接失败');
    }
    
    throw error;
  }
});
```

## 拦截器配置

### 优先级 (priority)

拦截器按优先级从高到低执行。优先级相同时，按添加顺序执行。

```typescript
// 高优先级拦截器（最先执行）
await CorsBypass.addInterceptor(authInterceptor, {
  name: 'auth',
  priority: 100
});

// 中优先级拦截器
await CorsBypass.addInterceptor(loggingInterceptor, {
  name: 'logging',
  priority: 50
});

// 低优先级拦截器（最后执行）
await CorsBypass.addInterceptor(cacheInterceptor, {
  name: 'cache',
  priority: 10
});
```

### 作用域 (scope)

限制拦截器只对特定的请求生效。

```typescript
// 只拦截API请求
await CorsBypass.addInterceptor(apiInterceptor, {
  name: 'api-interceptor',
  scope: {
    urlPattern: '^https://api\\.example\\.com',
    methods: ['GET', 'POST']
  }
});

// 只拦截POST请求
await CorsBypass.addInterceptor(postInterceptor, {
  name: 'post-interceptor',
  scope: {
    methods: ['POST', 'PUT', 'PATCH']
  }
});
```

### 启用/禁用

```typescript
const handle = await CorsBypass.addInterceptor(myInterceptor, {
  name: 'my-interceptor',
  enabled: true // 默认启用
});

// 临时禁用
handle.disable();

// 重新启用
handle.enable();

// 检查状态
if (handle.isEnabled()) {
  console.log('拦截器已启用');
}
```

## 拦截器管理

### 添加拦截器

```typescript
const handle = await CorsBypass.addInterceptor(interceptor, options);
```

### 移除拦截器

```typescript
// 方式1：使用句柄
handle.remove();

// 方式2：使用ID
await CorsBypass.removeInterceptor(handle.id);

// 方式3：使用句柄对象
await CorsBypass.removeInterceptor(handle);
```

### 移除所有拦截器

```typescript
await CorsBypass.removeAllInterceptors();
```

### 获取所有拦截器

```typescript
const interceptors = await CorsBypass.getInterceptors();
console.log(`当前有 ${interceptors.length} 个拦截器`);

interceptors.forEach(handle => {
  console.log(`- ${handle.name || handle.id}: ${handle.isEnabled() ? '启用' : '禁用'}`);
});
```

## 实战示例

### 完整的认证流程

```typescript
class AuthManager {
  private authInterceptorHandle: InterceptorHandle | null = null;

  async initialize() {
    this.authInterceptorHandle = await CorsBypass.addInterceptor({
      onRequest: (config) => {
        const token = this.getToken();
        if (token) {
          config.headers = {
            ...config.headers,
            'Authorization': `Bearer ${token}`
          };
        }
        return config;
      },
      onError: async (error) => {
        if (error.status === 401) {
          // Token过期，尝试刷新
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // 重试原始请求
            return CorsBypass.request(error.config);
          } else {
            // 刷新失败，跳转到登录页
            this.logout();
          }
        }
        throw error;
      }
    }, {
      name: 'auth-manager',
      priority: 100
    });
  }

  async cleanup() {
    if (this.authInterceptorHandle) {
      this.authInterceptorHandle.remove();
    }
  }

  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      const response = await CorsBypass.post({
        url: 'https://api.example.com/auth/refresh',
        data: { refreshToken }
      });
      
      localStorage.setItem('auth_token', response.data.token);
      return true;
    } catch (error) {
      return false;
    }
  }

  private logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
  }
}
```

### 性能监控

```typescript
class PerformanceMonitor {
  private metrics: Map<string, number> = new Map();

  async initialize() {
    await CorsBypass.addInterceptor({
      onRequest: (config) => {
        // 记录请求开始时间
        const requestId = this.generateRequestId();
        this.metrics.set(requestId, Date.now());
        
        // 将requestId附加到配置中
        return {
          ...config,
          headers: {
            ...config.headers,
            'X-Request-ID': requestId
          }
        };
      },
      onResponse: (response) => {
        // 计算请求耗时
        const requestId = response.headers['x-request-id'];
        if (requestId && this.metrics.has(requestId)) {
          const startTime = this.metrics.get(requestId)!;
          const duration = Date.now() - startTime;
          
          console.log(`[Performance] ${response.url}: ${duration}ms`);
          
          // 发送到分析服务
          this.sendMetrics({
            url: response.url,
            method: response.headers['x-request-method'],
            duration,
            status: response.status
          });
          
          this.metrics.delete(requestId);
        }
        
        return response;
      },
      onError: (error) => {
        // 记录失败的请求
        const requestId = error.config.headers?.['X-Request-ID'];
        if (requestId && this.metrics.has(requestId)) {
          const startTime = this.metrics.get(requestId)!;
          const duration = Date.now() - startTime;
          
          this.sendMetrics({
            url: error.config.url,
            method: error.config.method,
            duration,
            status: error.status || 0,
            error: error.message
          });
          
          this.metrics.delete(requestId);
        }
        
        throw error;
      }
    }, {
      name: 'performance-monitor',
      priority: 90
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sendMetrics(data: any) {
    // 发送到分析服务
    console.log('[Metrics]', data);
  }
}
```

### 智能缓存

```typescript
class CacheInterceptor {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private maxAge = 5 * 60 * 1000; // 5分钟

  async initialize() {
    await CorsBypass.addInterceptor({
      onRequest: (config) => {
        // 只缓存GET请求
        if (config.method === 'GET') {
          const cacheKey = this.getCacheKey(config);
          const cached = this.cache.get(cacheKey);
          
          if (cached && Date.now() - cached.timestamp < this.maxAge) {
            console.log(`[Cache] Hit: ${config.url}`);
            // 返回缓存的响应（需要特殊处理）
            throw {
              __cached: true,
              response: cached.data
            };
          }
        }
        
        return config;
      },
      onResponse: (response) => {
        // 缓存GET请求的响应
        if (response.status === 200) {
          const method = response.headers['x-request-method'];
          if (method === 'GET') {
            const cacheKey = this.getCacheKey({ url: response.url });
            this.cache.set(cacheKey, {
              data: response,
              timestamp: Date.now()
            });
            console.log(`[Cache] Stored: ${response.url}`);
          }
        }
        
        return response;
      },
      onError: (error) => {
        // 检查是否是缓存命中
        if ((error as any).__cached) {
          return (error as any).response;
        }
        throw error;
      }
    }, {
      name: 'cache-interceptor',
      priority: 20
    });
  }

  private getCacheKey(config: { url: string; params?: any }): string {
    let key = config.url;
    if (config.params) {
      const params = new URLSearchParams(config.params).toString();
      key += `?${params}`;
    }
    return key;
  }

  clearCache() {
    this.cache.clear();
    console.log('[Cache] Cleared');
  }
}
```

## 最佳实践

### 1. 拦截器命名

始终为拦截器提供有意义的名称，便于调试和管理。

```typescript
await CorsBypass.addInterceptor(interceptor, {
  name: 'auth-token-injector' // 好的命名
});
```

### 2. 优先级规划

合理规划拦截器优先级，确保执行顺序正确。

```typescript
// 推荐的优先级范围：
// 100-90: 认证相关
// 89-70: 请求转换
// 69-50: 日志记录
// 49-30: 错误处理
// 29-10: 缓存控制
// 9-0: 其他
```

### 3. 错误处理

在错误拦截器中，如果不处理错误，记得重新抛出。

```typescript
await CorsBypass.addInterceptor({
  onError: (error) => {
    logError(error);
    throw error; // 重要：重新抛出错误
  }
});
```

### 4. 异步操作

拦截器支持异步操作，但要注意性能影响。

```typescript
await CorsBypass.addInterceptor({
  onRequest: async (config) => {
    // 异步获取配置
    const settings = await fetchSettings();
    return {
      ...config,
      headers: {
        ...config.headers,
        ...settings.headers
      }
    };
  }
});
```

### 5. 清理资源

在组件卸载或应用退出时，记得移除拦截器。

```typescript
class MyComponent {
  private interceptorHandle: InterceptorHandle | null = null;

  async mounted() {
    this.interceptorHandle = await CorsBypass.addInterceptor(myInterceptor);
  }

  async unmounted() {
    if (this.interceptorHandle) {
      this.interceptorHandle.remove();
    }
  }
}
```

## 调试技巧

### 1. 日志拦截器

```typescript
await CorsBypass.addInterceptor({
  onRequest: (config) => {
    console.group(`🚀 Request: ${config.method} ${config.url}`);
    console.log('Headers:', config.headers);
    console.log('Data:', config.data);
    console.groupEnd();
    return config;
  },
  onResponse: (response) => {
    console.group(`✅ Response: ${response.status} ${response.url}`);
    console.log('Headers:', response.headers);
    console.log('Data:', response.data);
    console.groupEnd();
    return response;
  },
  onError: (error) => {
    console.group(`❌ Error: ${error.config.url}`);
    console.error('Message:', error.message);
    console.error('Status:', error.status);
    console.groupEnd();
    throw error;
  }
}, {
  name: 'debug-logger',
  priority: 0 // 最低优先级，最后执行
});
```

### 2. 性能分析

```typescript
await CorsBypass.addInterceptor({
  onRequest: (config) => {
    (config as any).__startTime = performance.now();
    return config;
  },
  onResponse: (response) => {
    const duration = performance.now() - (response as any).__startTime;
    if (duration > 1000) {
      console.warn(`⚠️ Slow request: ${response.url} (${duration.toFixed(2)}ms)`);
    }
    return response;
  }
});
```

## 常见问题

### Q: 拦截器的执行顺序是什么？

A: 请求拦截器按优先级从高到低执行，响应拦截器按相反顺序执行。

### Q: 可以在拦截器中修改请求URL吗？

A: 可以，在请求拦截器中修改`config.url`即可。

### Q: 错误拦截器可以恢复请求吗？

A: 可以，返回一个`HttpResponse`对象即可，不会继续抛出错误。

### Q: 拦截器会影响性能吗？

A: 会有轻微影响，但通常可以忽略。避免在拦截器中执行耗时操作。

### Q: 可以动态启用/禁用拦截器吗？

A: 可以，使用`handle.enable()`和`handle.disable()`方法。

## 总结

拦截器系统是一个强大的工具，可以帮助你：

- ✅ 简化代码，避免重复逻辑
- ✅ 统一处理认证、日志、错误
- ✅ 提高代码可维护性
- ✅ 增强应用的健壮性

合理使用拦截器，可以让你的网络请求代码更加优雅和强大！