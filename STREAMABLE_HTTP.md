# StreamableHTTP 协议支持

## 概述

本插件现已完全支持 **Model Context Protocol (MCP)** 的 **StreamableHTTP** 传输协议。StreamableHTTP 是 MCP 规范 2025-03-26 版本引入的新一代传输协议，用于替代旧的 HTTP+SSE 双端点架构。

## 什么是 StreamableHTTP？

StreamableHTTP 是一种单端点、双向通信的 HTTP 传输协议，具有以下特性：

### 主要优势

1. **单端点通信** - 使用一个端点（如 `/mcp`）替代传统的两个端点（`/sse` 和 `/sse/messages`）
2. **动态连接升级** - 根据需要自动在简单 HTTP 和 SSE 流之间切换
3. **双向通信** - 服务器可以在同一连接上发送通知和请求
4. **会话可恢复** - 支持断线重连和消息重传
5. **更好的错误处理** - 统一的错误通道，简化调试

### 与旧协议的区别

| 特性 | 旧 HTTP+SSE | 新 StreamableHTTP |
|-----|------------|------------------|
| 端点数量 | 2 个（SSE + POST） | 1 个 |
| 连接管理 | 复杂 | 简单 |
| 可扩展性 | 有限 | 优秀 |
| 断线恢复 | 不支持 | 支持 |
| 双向通信 | 受限 | 完全支持 |

## 使用方法

### 基本示例

```typescript
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

// 创建 MCP 客户端（使用 StreamableHTTP）
const client = await CorsBypass.createMCPClient({
  url: 'https://example.com/mcp',  // 单一端点
  transport: 'streamablehttp',      // 使用新协议
  clientInfo: {
    name: 'MyApp',
    version: '1.0.0'
  },
  capabilities: {
    sampling: true,
    roots: { listChanged: true }
  }
});

console.log('MCP Client connected:', client.connectionId);

// 监听服务器消息
CorsBypass.addListener('mcpMessage', (data) => {
  console.log('Received message:', data.message);
});

// 发送 JSON-RPC 请求
await CorsBypass.sendMCPMessage({
  connectionId: client.connectionId,
  message: {
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/list',
    params: {}
  },
  expectStream: true  // 期望流式响应
});
```

### 会话恢复

StreamableHTTP 支持断线重连和消息重传：

```typescript
// 启用会话恢复
const client = await CorsBypass.createMCPClient({
  url: 'https://example.com/mcp',
  transport: 'streamablehttp',
  resumable: true,  // 启用可恢复性
  clientInfo: {
    name: 'MyApp',
    version: '1.0.0'
  },
  capabilities: {}
});

// 断线后，获取会话信息
const sessionInfo = await CorsBypass.getMCPSessionInfo({
  connectionId: client.connectionId
});

console.log('Session ID:', sessionInfo.sessionId);
console.log('Last Sequence:', sessionInfo.lastSequence);

// 使用会话信息重新连接
const reconnectedClient = await CorsBypass.createMCPClient({
  url: 'https://example.com/mcp',
  transport: 'streamablehttp',
  resumable: true,
  sessionId: sessionInfo.sessionId,      // 恢复会话
  lastSequence: sessionInfo.lastSequence, // 从上次位置继续
  clientInfo: {
    name: 'MyApp',
    version: '1.0.0'
  },
  capabilities: {}
});
```

### 服务器推送

打开监听流以接收服务器主动推送的消息：

```typescript
// 打开监听流
await CorsBypass.openMCPListenStream({
  connectionId: client.connectionId
});

// 监听服务器推送的消息
CorsBypass.addListener('mcpMessage', (data) => {
  console.log('Server push:', data.message);
});

// 监听连接状态变化
CorsBypass.addListener('mcpStateChange', (data) => {
  console.log('Connection state:', data.state);
});
```

### 发送不同类型的消息

```typescript
// 发送请求（期望响应）
await CorsBypass.sendMCPMessage({
  connectionId: client.connectionId,
  message: {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/list',
    params: {}
  },
  expectStream: true
});

// 发送通知（不期望响应）
await CorsBypass.sendMCPMessage({
  connectionId: client.connectionId,
  message: {
    jsonrpc: '2.0',
    method: 'notifications/cancelled',
    params: { requestId: 3 }
  },
  expectStream: false
});

// 发送响应（回复服务器的请求）
await CorsBypass.sendMCPMessage({
  connectionId: client.connectionId,
  message: {
    jsonrpc: '2.0',
    id: 10,  // 服务器请求的 ID
    result: { /* 响应数据 */ }
  },
  expectStream: false
});
```

### 关闭连接

```typescript
// 关闭 MCP 客户端
await CorsBypass.closeMCPClient({
  connectionId: client.connectionId
});
```

## 兼容性

### 向后兼容

插件仍然支持旧的 HTTP+SSE 传输方式：

```typescript
// 旧方式（仍然支持，但不推荐）
const client = await CorsBypass.createMCPClient({
  sseUrl: 'https://example.com/sse',
  postUrl: 'https://example.com/sse/messages',
  transport: 'sse',  // 使用旧协议
  clientInfo: { name: 'MyApp', version: '1.0.0' },
  capabilities: {}
});
```

### 推荐使用

对于新项目，**强烈推荐使用 StreamableHTTP**，它提供了更好的性能和可靠性。

## API 参考

### `createMCPClient(options)`

创建 MCP 客户端连接。

**参数：**

- `options.url` - MCP 服务器端点 URL（StreamableHTTP）
- `options.transport` - 传输类型：`'streamablehttp'`（推荐）或 `'sse'`（旧协议）
- `options.clientInfo` - 客户端信息
  - `name` - 客户端名称
  - `version` - 客户端版本
- `options.capabilities` - 客户端能力
- `options.protocolVersion` - 协议版本（默认：`'2025-03-26'`）
- `options.resumable` - 是否启用会话恢复（默认：`false`）
- `options.sessionId` - 恢复时使用的会话 ID（可选）
- `options.lastSequence` - 恢复时的最后序列号（可选）
- `options.headers` - 自定义 HTTP 头（可选）

**返回：** `Promise<MCPClient>`

### `sendMCPMessage(options)`

发送 JSON-RPC 消息。

**参数：**

- `options.connectionId` - 连接 ID
- `options.message` - JSON-RPC 消息对象
- `options.expectStream` - 是否期望流式响应（默认：`false`）

**返回：** `Promise<void>`

### `openMCPListenStream(options)`

打开监听流以接收服务器推送。

**参数：**

- `options.connectionId` - 连接 ID

**返回：** `Promise<void>`

### `getMCPSessionInfo(options)`

获取会话信息。

**参数：**

- `options.connectionId` - 连接 ID

**返回：** `Promise<{ sessionId, lastSequence, resumable }>`

### `closeMCPClient(options)`

关闭 MCP 客户端。

**参数：**

- `options.connectionId` - 连接 ID

**返回：** `Promise<void>`

## 事件监听

### `mcpMessage`

接收到 MCP 消息时触发。

```typescript
CorsBypass.addListener('mcpMessage', (data) => {
  console.log('Connection:', data.connectionId);
  console.log('Message:', data.message);
});
```

### `mcpError`

发生错误时触发。

```typescript
CorsBypass.addListener('mcpError', (data) => {
  console.log('Connection:', data.connectionId);
  console.log('Error:', data.error);
});
```

### `mcpStateChange`

连接状态变化时触发。

```typescript
CorsBypass.addListener('mcpStateChange', (data) => {
  console.log('Connection:', data.connectionId);
  console.log('State:', data.state);
  // 状态值: 'connecting', 'streaming', 'accepted', 
  //        'get_not_supported', 'stream_closed', 'closed'
});
```

## 技术细节

### 协议头

StreamableHTTP 使用以下 HTTP 头：

- `Mcp-Protocol-Version: 2025-03-26` - 协议版本
- `Mcp-Session-Id: <session-id>` - 会话 ID（可恢复连接）
- `Mcp-Sequence: <number>` - 消息序列号（可恢复连接）
- `Accept: application/json, text/event-stream` - 接受的内容类型

### 消息流程

1. **POST 请求** - 客户端发送 JSON-RPC 消息
2. **响应类型**：
   - `application/json` - 单个 JSON 响应
   - `text/event-stream` - SSE 流（用于流式响应）
   - `202 Accepted` - 通知/响应已接受
3. **GET 请求** - 打开监听流（可选）
4. **SSE 流** - 服务器通过 SSE 发送多个消息

### 平台支持

- ✅ **Android** - 完全支持（基于 OkHttp）
- ✅ **Web** - 完全支持（基于 Fetch API）
- 🚧 **iOS** - 计划支持

## 参考资源

- [MCP 规范 - Transports](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [为什么 MCP 弃用 SSE 并采用 StreamableHTTP](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)
- [MCP SDK 文档](https://modelcontextprotocol.io/)

## 迁移指南

如果你正在使用旧的 SSE 传输，迁移到 StreamableHTTP 非常简单：

```typescript
// 旧方式
const client = await CorsBypass.createMCPClient({
  sseUrl: 'https://example.com/sse',
  postUrl: 'https://example.com/sse/messages',
  // ...其他选项
});

// 新方式
const client = await CorsBypass.createMCPClient({
  url: 'https://example.com/mcp',  // 单一端点
  transport: 'streamablehttp',      // 指定新传输
  // ...其他选项
});
```

只需更改 URL 配置和指定 `transport: 'streamablehttp'`，其他代码无需修改！

## 故障排除

### 服务器不支持 GET 流

如果服务器返回 `405 Method Not Allowed`，说明服务器不支持 GET 流。这是正常的，你仍然可以使用 POST 请求进行所有通信。

### 会话恢复失败

确保：
1. 服务器支持会话恢复
2. 正确保存并传递 `sessionId` 和 `lastSequence`
3. 会话未过期

### 消息丢失

启用 `resumable: true` 可以避免断线时的消息丢失。

---

**最后更新：** 2024-11-22
