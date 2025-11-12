# Capacitor CORS Proxy Plugin - 详细集成指南

一个强大的 Capacitor 插件，专门用于解决移动应用中的 CORS 跨域问题，支持 HTTP 请求、SSE 连接和 MCP 协议。

## 🌟 功能特性

- 🌐 **HTTP 请求代理** - 绕过 CORS 限制，支持所有 HTTP 方法
- 📡 **Server-Sent Events (SSE) 代理** - 实时数据流支持
- 🤖 **Model Context Protocol (MCP) 支持** - AI 应用集成
- 🔒 **SSL/TLS 支持** - 安全连接处理
- 📱 **原生移动应用支持** - iOS 和 Android 原生实现
- 🔧 **会话管理** - 自动处理认证和会话状态
- 📝 **详细日志** - 完整的请求/响应日志

## 📦 安装指南

### 1. 安装插件

```bash
# 安装插件
npm install capacitor-cors-proxy

# 同步到原生平台
npx cap sync
```

### 2. 启动代理服务器（开发环境）

在开发环境中，你需要启动本地代理服务器：

```bash
# 克隆项目（如果还没有）
git clone <repository-url>
cd capacitor-cors-proxy

# 安装依赖
npm install

# 启动代理服务器
npm run proxy
```

代理服务器将在 `http://localhost:3002` 启动。

## 🚀 快速开始

### 基本 HTTP 请求

```typescript
import { CorsProxy } from 'capacitor-cors-proxy';

// 简单的 GET 请求
const result = await CorsProxy.request({
  url: 'https://api.example.com/data',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  }
});

console.log('响应数据:', result.data);
console.log('状态码:', result.status);
```

### POST 请求示例

```typescript
const postResult = await CorsProxy.request({
  url: 'https://api.example.com/users',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token'
  },
  body: JSON.stringify({
    name: '张三',
    email: 'zhangsan@example.com'
  })
});
```

### SSE 连接示例

```typescript
// 监听 SSE 消息
const listener = await CorsProxy.addListener('sseMessage', (data) => {
  console.log('收到实时消息:', data.message);
});

// 建立 SSE 连接
await CorsProxy.connectSSE({
  url: 'https://api.example.com/events'
});

// 断开连接
await CorsProxy.disconnectSSE();

// 移除监听器
listener.remove();
```

## 🤖 MCP 协议集成

### 基本 MCP 客户端

```typescript
class MCPClient {
  private sessionId: string | null = null;
  
  async initialize(serverUrl: string) {
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {
          roots: { listChanged: true },
          sampling: {}
        },
        clientInfo: {
          name: 'my-app',
          version: '1.0.0'
        }
      }
    };

    const result = await CorsProxy.sendMCPMessage({
      url: serverUrl,
      message: initRequest
    });

    // 保存会话ID（如果服务器返回）
    if (result.sessionId) {
      this.sessionId = result.sessionId;
    }

    return result.data;
  }

  async listTools(serverUrl: string) {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/list',
      params: {}
    };

    const result = await CorsProxy.sendMCPMessage({
      url: serverUrl,
      message: request,
      sessionId: this.sessionId // 包含会话ID
    });

    return result.data.result.tools;
  }

  async callTool(serverUrl: string, toolName: string, args: any) {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    const result = await CorsProxy.sendMCPMessage({
      url: serverUrl,
      message: request,
      sessionId: this.sessionId
    });

    return result.data.result;
  }
}

// 使用示例
const mcpClient = new MCPClient();
await mcpClient.initialize('https://your-mcp-server.com/mcp');
const tools = await mcpClient.listTools('https://your-mcp-server.com/mcp');
console.log('可用工具:', tools);
```

## 📱 在不同框架中集成

### React/Ionic React

```typescript
// hooks/useCorsProxy.ts
import { useEffect, useState } from 'react';
import { CorsProxy } from 'capacitor-cors-proxy';

export const useCorsProxy = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = async (url: string, options: any = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await CorsProxy.request({
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body
      });
      
      setIsLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  };

  return { makeRequest, isLoading, error };
};

// 组件中使用
import React from 'react';
import { useCorsProxy } from '../hooks/useCorsProxy';

const ApiComponent: React.FC = () => {
  const { makeRequest, isLoading, error } = useCorsProxy();

  const fetchData = async () => {
    try {
      const result = await makeRequest('https://api.example.com/data');
      console.log('数据:', result.data);
    } catch (err) {
      console.error('请求失败:', err);
    }
  };

  return (
    <div>
      <button onClick={fetchData} disabled={isLoading}>
        {isLoading ? '加载中...' : '获取数据'}
      </button>
      {error && <p>错误: {error}</p>}
    </div>
  );
};
```

### Vue/Ionic Vue

```typescript
// composables/useCorsProxy.ts
import { ref } from 'vue';
import { CorsProxy } from 'capacitor-cors-proxy';

export const useCorsProxy = () => {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const makeRequest = async (url: string, options: any = {}) => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const result = await CorsProxy.request({
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body
      });
      
      isLoading.value = false;
      return result;
    } catch (err) {
      error.value = err.message;
      isLoading.value = false;
      throw err;
    }
  };

  return { makeRequest, isLoading, error };
};

// 组件中使用
<template>
  <div>
    <button @click="fetchData" :disabled="isLoading">
      {{ isLoading ? '加载中...' : '获取数据' }}
    </button>
    <p v-if="error">错误: {{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { useCorsProxy } from '../composables/useCorsProxy';

const { makeRequest, isLoading, error } = useCorsProxy();

const fetchData = async () => {
  try {
    const result = await makeRequest('https://api.example.com/data');
    console.log('数据:', result.data);
  } catch (err) {
    console.error('请求失败:', err);
  }
};
</script>
```

### Angular/Ionic Angular

```typescript
// services/cors-proxy.service.ts
import { Injectable } from '@angular/core';
import { CorsProxy } from 'capacitor-cors-proxy';
import { Observable, from } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CorsProxyService {

  makeRequest(url: string, options: any = {}): Observable<any> {
    return from(CorsProxy.request({
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body
    }));
  }

  connectSSE(url: string): Observable<any> {
    return from(CorsProxy.connectSSE({ url }));
  }

  sendMCPMessage(url: string, message: any, sessionId?: string): Observable<any> {
    return from(CorsProxy.sendMCPMessage({
      url,
      message,
      sessionId
    }));
  }
}

// 组件中使用
import { Component } from '@angular/core';
import { CorsProxyService } from '../services/cors-proxy.service';

@Component({
  selector: 'app-api',
  template: `
    <button (click)="fetchData()" [disabled]="isLoading">
      {{ isLoading ? '加载中...' : '获取数据' }}
    </button>
    <p *ngIf="error">错误: {{ error }}</p>
  `
})
export class ApiComponent {
  isLoading = false;
  error: string | null = null;

  constructor(private corsProxy: CorsProxyService) {}

  fetchData() {
    this.isLoading = true;
    this.error = null;

    this.corsProxy.makeRequest('https://api.example.com/data')
      .subscribe({
        next: (result) => {
          console.log('数据:', result.data);
          this.isLoading = false;
        },
        error: (err) => {
          this.error = err.message;
          this.isLoading = false;
        }
      });
  }
}
```

## 🔧 高级配置

### 错误处理和重试机制

```typescript
class RobustCorsProxy {
  private maxRetries = 3;
  private retryDelay = 1000;

  async requestWithRetry(url: string, options: any = {}, retries = 0): Promise<any> {
    try {
      return await CorsProxy.request({
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body
      });
    } catch (error) {
      if (retries < this.maxRetries) {
        console.log(`请求失败，${this.retryDelay}ms 后重试... (${retries + 1}/${this.maxRetries})`);
        await this.delay(this.retryDelay);
        return this.requestWithRetry(url, options, retries + 1);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 使用示例
const robustProxy = new RobustCorsProxy();
const result = await robustProxy.requestWithRetry('https://api.example.com/data');
```

### 请求拦截器

```typescript
class InterceptedCorsProxy {
  private requestInterceptors: Array<(config: any) => any> = [];
  private responseInterceptors: Array<(response: any) => any> = [];

  addRequestInterceptor(interceptor: (config: any) => any) {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: (response: any) => any) {
    this.responseInterceptors.push(interceptor);
  }

  async request(config: any) {
    // 应用请求拦截器
    let processedConfig = config;
    for (const interceptor of this.requestInterceptors) {
      processedConfig = interceptor(processedConfig);
    }

    // 发送请求
    let response = await CorsProxy.request(processedConfig);

    // 应用响应拦截器
    for (const interceptor of this.responseInterceptors) {
      response = interceptor(response);
    }

    return response;
  }
}

// 使用示例
const interceptedProxy = new InterceptedCorsProxy();

// 添加认证头
interceptedProxy.addRequestInterceptor((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  return config;
});

// 添加响应日志
interceptedProxy.addResponseInterceptor((response) => {
  console.log('API 响应:', response);
  return response;
});
```

## 🧪 测试指南

### 单元测试

```typescript
// __tests__/cors-proxy.test.ts
import { CorsProxy } from 'capacitor-cors-proxy';

// Mock CorsProxy
jest.mock('capacitor-cors-proxy', () => ({
  CorsProxy: {
    request: jest.fn(),
    connectSSE: jest.fn(),
    sendMCPMessage: jest.fn()
  }
}));

describe('CorsProxy Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should make HTTP request', async () => {
    const mockResponse = { status: 200, data: { message: 'success' } };
    (CorsProxy.request as jest.Mock).mockResolvedValue(mockResponse);

    const result = await CorsProxy.request({
      url: 'https://api.example.com/test',
      method: 'GET'
    });

    expect(result).toEqual(mockResponse);
    expect(CorsProxy.request).toHaveBeenCalledWith({
      url: 'https://api.example.com/test',
      method: 'GET'
    });
  });

  test('should handle MCP messages', async () => {
    const mockMCPResponse = {
      status: 200,
      data: {
        jsonrpc: '2.0',
        id: 1,
        result: { tools: [] }
      }
    };
    (CorsProxy.sendMCPMessage as jest.Mock).mockResolvedValue(mockMCPResponse);

    const result = await CorsProxy.sendMCPMessage({
      url: 'https://mcp.example.com',
      message: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      }
    });

    expect(result).toEqual(mockMCPResponse);
  });
});
```

### 集成测试

```typescript
// __tests__/integration.test.ts
import { CorsProxy } from 'capacitor-cors-proxy';

describe('CorsProxy Integration Tests', () => {
  test('should connect to real API', async () => {
    // 注意：这需要真实的 API 端点
    const result = await CorsProxy.request({
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET'
    });

    expect(result.status).toBe(200);
    expect(result.data).toHaveProperty('id');
    expect(result.data).toHaveProperty('title');
  });
});
```

## 🚀 部署指南

### 生产环境配置

在生产环境中，你需要部署自己的代理服务器：

```typescript
// production-proxy-server.js
const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');

const app = express();

// 启用 CORS
app.use(cors({
  origin: ['https://your-app.com', 'capacitor://localhost'],
  credentials: true
}));

app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// MCP 代理端点
app.post('/mcp-proxy', async (req, res) => {
  // ... 你的 MCP 代理逻辑
});

// HTTPS 配置（生产环境必需）
const httpsOptions = {
  key: fs.readFileSync('/path/to/private-key.pem'),
  cert: fs.readFileSync('/path/to/certificate.pem')
};

const PORT = process.env.PORT || 443;
https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`🚀 Production CORS Proxy Server running on port ${PORT}`);
});
```

### Docker 部署

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3002

CMD ["node", "web-proxy-server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  cors-proxy:
    build: .
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    volumes:
      - ./ssl:/app/ssl:ro
```

### 环境变量配置

```typescript
// config.ts
export const config = {
  proxyUrl: process.env.NODE_ENV === 'production'
    ? 'https://your-proxy-server.com'
    : 'http://localhost:3002',

  timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),

  retries: parseInt(process.env.MAX_RETRIES || '3'),

  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
};
```

## 🔍 故障排除

### 常见问题

#### 1. CORS 错误仍然出现

**问题**: 即使使用了插件，仍然收到 CORS 错误

**解决方案**:
```typescript
// 确保在原生环境中运行
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // 使用插件
  const result = await CorsProxy.request({ url: 'https://api.example.com' });
} else {
  // Web 环境，使用代理服务器
  const result = await fetch('http://localhost:3002/proxy/https://api.example.com');
}
```

#### 2. 代理服务器连接失败

**问题**: 无法连接到代理服务器

**解决方案**:
```typescript
// 添加连接检查
async function checkProxyHealth() {
  try {
    const response = await fetch('http://localhost:3002/health');
    if (!response.ok) {
      throw new Error('代理服务器不健康');
    }
    console.log('✅ 代理服务器运行正常');
  } catch (error) {
    console.error('❌ 代理服务器连接失败:', error);
    // 可以切换到备用服务器或显示错误消息
  }
}
```

#### 3. MCP 会话管理问题

**问题**: MCP 请求返回 "Invalid session ID" 错误

**解决方案**:
```typescript
class MCPSessionManager {
  private sessions = new Map<string, string>();

  async getSessionId(serverUrl: string): Promise<string | null> {
    if (this.sessions.has(serverUrl)) {
      return this.sessions.get(serverUrl)!;
    }

    // 重新初始化
    const initResult = await this.initialize(serverUrl);
    if (initResult.sessionId) {
      this.sessions.set(serverUrl, initResult.sessionId);
      return initResult.sessionId;
    }

    return null;
  }

  clearSession(serverUrl: string) {
    this.sessions.delete(serverUrl);
  }
}
```

#### 4. SSL/TLS 证书问题

**问题**: 自签名证书或证书验证失败

**解决方案**:
```typescript
// 在代理服务器中配置
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.NODE_ENV === 'production',
  // 开发环境中允许自签名证书
  checkServerIdentity: process.env.NODE_ENV === 'production'
    ? undefined
    : () => undefined
});
```

### 调试技巧

#### 启用详细日志

```typescript
// 在插件中启用调试模式
const CorsProxyDebug = {
  enabled: true,

  log(message: string, data?: any) {
    if (this.enabled) {
      console.log(`[CorsProxy Debug] ${message}`, data || '');
    }
  },

  async request(options: any) {
    this.log('发送请求', options);

    try {
      const result = await CorsProxy.request(options);
      this.log('请求成功', { status: result.status, dataLength: JSON.stringify(result.data).length });
      return result;
    } catch (error) {
      this.log('请求失败', error);
      throw error;
    }
  }
};
```

#### 网络监控

```typescript
// 监控网络状态
import { Network } from '@capacitor/network';

class NetworkAwareCorsProxy {
  private isOnline = true;

  async initialize() {
    // 监听网络状态变化
    Network.addListener('networkStatusChange', (status) => {
      this.isOnline = status.connected;
      console.log('网络状态:', status.connected ? '在线' : '离线');
    });

    // 获取当前网络状态
    const status = await Network.getStatus();
    this.isOnline = status.connected;
  }

  async request(options: any) {
    if (!this.isOnline) {
      throw new Error('网络连接不可用');
    }

    return CorsProxy.request(options);
  }
}
```

## 📚 API 参考

### CorsProxy.request()

```typescript
interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

interface RequestResult {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
}
```

### CorsProxy.sendMCPMessage()

```typescript
interface MCPOptions {
  url: string;
  message: {
    jsonrpc: '2.0';
    id: number | string;
    method: string;
    params?: any;
  };
  sessionId?: string;
}

interface MCPResult {
  status: number;
  statusText: string;
  data: {
    jsonrpc: '2.0';
    id: number | string;
    result?: any;
    error?: {
      code: number;
      message: string;
    };
  };
  sessionId?: string;
}
```

### CorsProxy.connectSSE()

```typescript
interface SSEOptions {
  url: string;
  headers?: Record<string, string>;
  reconnect?: {
    enabled: boolean;
    maxAttempts: number;
    delay: number;
  };
}
```

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送到分支: `git push origin feature/amazing-feature`
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。

## 🆘 获取帮助

- 📖 [官方文档](https://github.com/your-repo/capacitor-cors-proxy)
- 🐛 [问题反馈](https://github.com/your-repo/capacitor-cors-proxy/issues)
- 💬 [讨论区](https://github.com/your-repo/capacitor-cors-proxy/discussions)
- 📧 [邮件支持](mailto:support@example.com)
