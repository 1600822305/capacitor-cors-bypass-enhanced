# 流式输出使用指南

本指南介绍如何使用 Capacitor CORS Bypass 插件的流式请求功能，特别适用于 AI 模型的流式输出场景。

## 📋 目录

- [功能概述](#功能概述)
- [快速开始](#快速开始)
- [API 参考](#api-参考)
- [使用示例](#使用示例)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)

## 功能概述

流式请求功能允许你：

- ✅ 实时接收 HTTP 响应数据块
- ✅ 支持 AI 模型的流式输出（如 OpenAI、Claude 等）
- ✅ 完全绕过浏览器 CORS 限制
- ✅ 支持请求取消和超时控制
- ✅ 跨平台支持（Web、Android、iOS）

## 快速开始

### 1. 安装插件

```bash
npm install capacitor-cors-bypass-enhanced
npx cap sync
```

### 2. 基本使用

```typescript
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

// 监听数据块
CorsBypass.addListener('streamChunk', (event) => {
  console.log('收到数据:', event.data);
  if (event.done) {
    console.log('流式请求完成');
  }
});

// 监听状态变化
CorsBypass.addListener('streamStatus', (event) => {
  console.log('状态:', event.status);
});

// 发起流式请求
const { streamId } = await CorsBypass.streamRequest({
  url: 'https://api.openai.com/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  data: {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: '你好' }],
    stream: true
  }
});

// 如需取消
await CorsBypass.cancelStream({ streamId });
```

## API 参考

### streamRequest()

发起流式 HTTP 请求。

```typescript
streamRequest(options: StreamRequestOptions): Promise<{ streamId: string }>
```

#### StreamRequestOptions

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| url | string | ✅ | - | 请求 URL |
| method | string | ❌ | 'POST' | HTTP 方法 |
| headers | object | ❌ | {} | 请求头 |
| data | any | ❌ | - | 请求体 |
| params | object | ❌ | {} | URL 查询参数 |
| timeout | number | ❌ | 60000 | 超时时间（毫秒） |
| followRedirects | boolean | ❌ | true | 是否跟随重定向 |

#### 返回值

返回一个包含 `streamId` 的对象，用于后续操作（如取消请求）。

### cancelStream()

取消正在进行的流式请求。

```typescript
cancelStream(options: { streamId: string }): Promise<void>
```

### 事件监听

#### streamChunk

接收数据块事件。

```typescript
interface StreamChunkEvent {
  streamId: string;  // 流 ID
  data: string;      // 数据块内容
  done: boolean;     // 是否完成
  error?: string;    // 错误信息（如有）
}
```

#### streamStatus

流状态变化事件。

```typescript
interface StreamStatusEvent {
  streamId: string;           // 流 ID
  status: string;             // 状态：'started' | 'completed' | 'error' | 'cancelled'
  error?: string;             // 错误信息（如有）
  statusCode?: number;        // HTTP 状态码
  headers?: Record<string, string>;  // 响应头
}
```

## 使用示例

### 示例 1: OpenAI 流式对话

```typescript
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

async function chatWithOpenAI(message: string, apiKey: string) {
  let fullResponse = '';
  
  // 监听数据块
  const chunkListener = await CorsBypass.addListener('streamChunk', (event) => {
    if (event.data) {
      // 解析 SSE 格式数据
      const lines = event.data.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content || '';
            fullResponse += content;
            console.log('收到内容:', content);
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
    
    if (event.done) {
      console.log('完整响应:', fullResponse);
      chunkListener.remove();
    }
  });
  
  // 发起请求
  const { streamId } = await CorsBypass.streamRequest({
    url: 'https://api.openai.com/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    data: {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: message }],
      stream: true
    }
  });
  
  return streamId;
}
```

### 示例 2: React 组件中使用

```typescript
import React, { useState, useEffect } from 'react';
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

function StreamingChat() {
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  
  useEffect(() => {
    // 设置监听器
    const chunkListener = CorsBypass.addListener('streamChunk', (event) => {
      if (event.data) {
        setResponse(prev => prev + event.data);
      }
      if (event.done) {
        setIsStreaming(false);
        setStreamId(null);
      }
    });
    
    return () => {
      chunkListener.then(l => l.remove());
    };
  }, []);
  
  const startStream = async () => {
    setResponse('');
    setIsStreaming(true);
    
    const result = await CorsBypass.streamRequest({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: '你好' }],
        stream: true
      }
    });
    
    setStreamId(result.streamId);
  };
  
  const cancelStream = async () => {
    if (streamId) {
      await CorsBypass.cancelStream({ streamId });
      setIsStreaming(false);
      setStreamId(null);
    }
  };
  
  return (
    <div>
      <button onClick={startStream} disabled={isStreaming}>
        开始对话
      </button>
      <button onClick={cancelStream} disabled={!isStreaming}>
        取消
      </button>
      <div>{response}</div>
    </div>
  );
}
```

### 示例 3: 可取消的流式请求管理器

```typescript
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

class StreamManager {
  private currentStreamId: string | null = null;
  private listeners: any[] = [];
  
  async start(url: string, data: any, onData: (text: string) => void) {
    // 如果有正在进行的请求，先取消
    if (this.currentStreamId) {
      await this.cancel();
    }
    
    const chunkListener = await CorsBypass.addListener('streamChunk', (event) => {
      if (event.data) {
        onData(event.data);
      }
      
      if (event.done) {
        this.currentStreamId = null;
        this.cleanup();
      }
    });
    
    this.listeners.push(chunkListener);
    
    const { streamId } = await CorsBypass.streamRequest({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data
    });
    
    this.currentStreamId = streamId;
    return streamId;
  }
  
  async cancel() {
    if (this.currentStreamId) {
      await CorsBypass.cancelStream({ streamId: this.currentStreamId });
      this.currentStreamId = null;
      this.cleanup();
    }
  }
  
  private cleanup() {
    this.listeners.forEach(l => l.remove());
    this.listeners = [];
  }
  
  isStreaming(): boolean {
    return this.currentStreamId !== null;
  }
}

// 使用
const manager = new StreamManager();
await manager.start(
  'https://api.example.com/stream',
  { /* data */ },
  (text) => console.log('收到:', text)
);
```

## 最佳实践

### 1. 错误处理

始终处理可能的错误：

```typescript
try {
  const { streamId } = await CorsBypass.streamRequest(options);
} catch (error) {
  console.error('启动流式请求失败:', error);
}

CorsBypass.addListener('streamChunk', (event) => {
  if (event.error) {
    console.error('流式错误:', event.error);
  }
});
```

### 2. 清理监听器

组件卸载时移除监听器：

```typescript
const listener = await CorsBypass.addListener('streamChunk', handler);
// 使用完后清理
listener.remove();
```

### 3. 超时控制

设置合理的超时时间：

```typescript
await CorsBypass.streamRequest({
  url: 'https://api.example.com/stream',
  timeout: 30000,  // 30秒超时
  // ...
});
```

### 4. 数据解析

根据 API 格式正确解析数据：

```typescript
CorsBypass.addListener('streamChunk', (event) => {
  if (event.data) {
    // OpenAI SSE 格式
    const lines = event.data.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6);
        if (jsonStr !== '[DONE]') {
          try {
            const data = JSON.parse(jsonStr);
            // 处理数据
          } catch (e) {
            console.warn('解析失败:', e);
          }
        }
      }
    }
  }
});
```

## 故障排除

### 问题 1: 无法接收数据

**解决方案：**
```typescript
// 确保在发起请求前设置监听器
const listener = await CorsBypass.addListener('streamChunk', handler);
const { streamId } = await CorsBypass.streamRequest(options);
```

### 问题 2: 请求超时

**解决方案：**
```typescript
await CorsBypass.streamRequest({
  url: 'https://api.example.com/stream',
  timeout: 120000,  // 增加到 120 秒
  // ...
});
```

### 问题 3: 内存泄漏

**解决方案：**
```typescript
// 使用完后清理监听器
const listener = await CorsBypass.addListener('streamChunk', handler);
// ... 使用
listener.remove();
```

## 平台特定说明

### Web 平台
- 使用 Fetch API 的 ReadableStream
- 支持所有现代浏览器

### Android 平台
- 使用 OkHttp 实现
- 支持 Android 5.0+

### iOS 平台
- 使用 URLSession 实现
- 支持 iOS 11.0+

## 相关资源

- [测试页面](./test-streaming.html)
- [API 文档](./README.md)
- [GitHub 仓库](https://github.com/1600822305/capacitor-cors-bypass-enhanced)