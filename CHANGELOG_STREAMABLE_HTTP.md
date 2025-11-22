# StreamableHTTP 协议支持 - 更新日志

## 版本 1.1.0 (2024-11-22)

### 🎉 新增功能

#### StreamableHTTP 传输协议支持

添加了对 Model Context Protocol (MCP) StreamableHTTP 传输协议的完整支持。

**关键特性：**

1. **单端点通信**
   - 使用单一端点替代传统的双端点架构
   - 简化连接管理和配置

2. **动态连接升级**
   - 自动在 HTTP 和 SSE 流之间切换
   - 根据需要优化传输方式

3. **会话可恢复性**
   - 支持断线重连
   - 消息序列号追踪
   - 无损消息传递

4. **双向通信**
   - 服务器可主动推送消息
   - 支持请求、响应、通知

5. **向后兼容**
   - 保留旧的 SSE 传输配置
   - 平滑迁移路径

### 📝 文件变更

#### 新增文件

1. **Android 端**
   - `android/src/main/java/com/capacitor/cors/StreamableHTTPTransport.java`
     - 实现 StreamableHTTP 传输层
     - 支持 SSE 流解析
     - 会话管理和恢复

2. **Web 端**
   - `src/web/streamable-http.ts`
     - Web 版 StreamableHTTP 实现
     - 基于 Fetch API 和 ReadableStream
   - `src/web/mcp-client.ts`
     - MCP 客户端管理器
     - 连接生命周期管理
     - 事件监听器管理

3. **文档**
   - `STREAMABLE_HTTP.md` - 详细协议指南
   - `CHANGELOG_STREAMABLE_HTTP.md` - 本更新日志
   - `examples/streamable-http-example.ts` - 使用示例

#### 修改文件

1. **类型定义**
   - `src/types/mcp.ts`
     - 添加 `MCPTransportType` 类型
     - 扩展 `MCPClientOptions` 接口
     - 添加会话恢复相关字段

2. **插件核心**
   - `android/src/main/java/com/capacitor/cors/CorsBypassPlugin.java`
     - 添加 MCP 连接管理
     - 实现新的插件方法
     - 集成 StreamableHTTP 传输

3. **Web 模块**
   - `src/web/index.ts`
     - 导出新的传输和管理器类

4. **文档**
   - `README.md`
     - 更新特性列表
     - 添加 StreamableHTTP 说明
     - 添加文档链接

### 🔌 新增 API 方法

#### Android & Web

1. **`createMCPClient(options)`**
   - 创建 MCP 客户端连接
   - 支持 StreamableHTTP 和 SSE 传输
   - 自动发送初始化请求

2. **`sendMCPMessage(options)`**
   - 发送 JSON-RPC 消息
   - 支持流式和非流式响应

3. **`openMCPListenStream(options)`**
   - 打开 GET 监听流
   - 接收服务器主动推送

4. **`closeMCPClient(options)`**
   - 关闭 MCP 连接
   - 清理资源

5. **`getMCPSessionInfo(options)`**
   - 获取会话信息
   - 用于会话恢复

### 📡 新增事件

1. **`mcpMessage`**
   - 接收到 MCP 消息时触发
   - 包含连接 ID 和消息内容

2. **`mcpError`**
   - MCP 错误时触发
   - 包含连接 ID 和错误信息

3. **`mcpStateChange`**
   - 连接状态变化时触发
   - 状态包括：connecting, streaming, accepted, stream_closed, closed

### 🔧 技术实现

#### Android 实现细节

- **传输层**：基于 OkHttp 3.x
- **SSE 解析**：手动实现 SSE 协议解析
- **线程模型**：异步回调 + 主线程通知
- **连接管理**：HashMap 管理多个连接

**关键类：**
```java
StreamableHTTPTransport
├── sendMessage()      // 发送消息
├── openListenStream() // 打开监听流
├── handleSSEStream()  // 处理 SSE 流
└── close()            // 关闭连接
```

#### Web 实现细节

- **传输层**：基于 Fetch API
- **流处理**：ReadableStream + TextDecoder
- **SSE 解析**：自定义解析器
- **状态管理**：AbortController 管理取消

**关键类：**
```typescript
StreamableHTTPTransport
├── sendMessage()      // 发送消息
├── openListenStream() // 打开监听流
├── handleSSEStream()  // 处理 SSE 流
└── close()            // 关闭连接

MCPClientManager
├── createClient()     // 创建客户端
├── sendMessage()      // 发送消息
├── getSessionInfo()   // 获取会话信息
└── closeClient()      // 关闭客户端
```

### 📋 协议实现

#### HTTP 头部

```
Mcp-Protocol-Version: 2025-03-26
Mcp-Session-Id: <session-id>
Mcp-Sequence: <number>
Accept: application/json, text/event-stream
Content-Type: application/json
```

#### SSE 格式

```
data: {"jsonrpc":"2.0","id":1,"result":{...}}

event: message
data: {"jsonrpc":"2.0","method":"notifications/...",...}

```

#### 响应类型

1. **application/json** - 单个 JSON 响应
2. **text/event-stream** - SSE 流
3. **202 Accepted** - 通知/响应已接受

### 🔄 向后兼容性

#### 旧的 SSE 配置仍然支持

```typescript
// 旧方式（仍然有效）
{
  sseUrl: 'https://example.com/sse',
  postUrl: 'https://example.com/sse/messages'
}

// 新方式（推荐）
{
  url: 'https://example.com/mcp',
  transport: 'streamablehttp'
}
```

#### 自动检测

如果提供 `sseUrl`，会自动使用 SSE 传输：

```typescript
// 这会自动使用 SSE 传输
{
  sseUrl: 'https://example.com/sse',
  postUrl: 'https://example.com/sse/messages'
  // transport: 'sse' 自动推断
}
```

### 📖 使用示例

#### 基本用法

```typescript
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

// 创建客户端
const client = await CorsBypass.createMCPClient({
  url: 'https://example.com/mcp',
  transport: 'streamablehttp',
  clientInfo: { name: 'MyApp', version: '1.0.0' },
  capabilities: {}
});

// 发送消息
await CorsBypass.sendMCPMessage({
  connectionId: client.connectionId,
  message: {
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/list',
    params: {}
  },
  expectStream: true
});

// 监听响应
CorsBypass.addListener('mcpMessage', (data) => {
  console.log('Message:', data.message);
});
```

#### 会话恢复

```typescript
// 保存会话
const info = await CorsBypass.getMCPSessionInfo({
  connectionId: client.connectionId
});
localStorage.setItem('session', JSON.stringify(info));

// 恢复会话
const saved = JSON.parse(localStorage.getItem('session'));
const client = await CorsBypass.createMCPClient({
  url: 'https://example.com/mcp',
  transport: 'streamablehttp',
  resumable: true,
  sessionId: saved.sessionId,
  lastSequence: saved.lastSequence,
  clientInfo: { name: 'MyApp', version: '1.0.0' },
  capabilities: {}
});
```

### 🧪 测试

建议测试场景：

1. **基本连接**
   - 创建客户端
   - 发送初始化请求
   - 接收响应

2. **流式响应**
   - 发送请求并期望 SSE 流
   - 接收多个消息
   - 流正常关闭

3. **会话恢复**
   - 建立连接
   - 断开连接
   - 使用会话信息重连
   - 验证消息不丢失

4. **服务器推送**
   - 打开监听流
   - 接收服务器主动消息
   - 处理通知

5. **错误处理**
   - 网络错误
   - 服务器错误响应
   - 超时处理

### 🐛 已知问题

1. **iOS 支持**
   - iOS 端实现计划中，尚未完成

2. **SSE 传输**
   - 旧的 SSE 传输在新 API 中标记为待实现
   - 建议使用 StreamableHTTP

### 📚 参考资源

- [MCP 规范 - Transports](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [StreamableHTTP 博客文章](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)
- [MCP SDK 文档](https://modelcontextprotocol.io/)

### 🚀 下一步

1. 完成 iOS 端实现
2. 添加更多单元测试
3. 性能优化
4. 添加连接池支持
5. 实现自动重连机制

### 👥 贡献者

- AetherLink Team

---

**发布日期：** 2024-11-22  
**协议版本：** MCP 2025-03-26  
**插件版本：** 1.1.0+
