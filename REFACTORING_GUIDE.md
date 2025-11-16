# 类型定义重构指南

## 概述

我们已经将 `src/definitions.ts` 文件（原 721 行）重构为模块化结构，提高了代码的可维护性和可读性。

## 重构内容

### 之前的结构
```
src/
├── definitions.ts (721 lines - 所有类型定义)
├── index.ts
└── web.ts
```

### 重构后的结构
```
src/
├── definitions.ts (165 lines - 主接口 + 重新导出)
├── index.ts
├── web.ts
└── types/
    ├── index.ts          # 类型统一导出
    ├── common.ts         # 通用类型
    ├── http.ts           # HTTP 类型
    ├── stream.ts         # 流式请求类型
    ├── sse.ts            # SSE 类型
    ├── websocket.ts      # WebSocket 类型
    ├── mcp.ts            # MCP 协议类型
    └── README.md         # 类型文档
```

## 向后兼容性

✅ **完全向后兼容** - 所有现有代码无需修改即可继续工作。

### 导入方式保持不变
```typescript
// 这些导入方式仍然有效
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import type { 
  HttpRequestOptions, 
  HttpResponse,
  SSEConnection,
  WebSocketConnection,
  MCPClient
} from 'capacitor-cors-bypass-enhanced';
```

## 新的导入选项

### 选项 1: 从主入口导入（推荐）
```typescript
import { 
  HttpRequestOptions, 
  SSEConnection,
  MCPClient 
} from 'capacitor-cors-bypass-enhanced';
```

### 选项 2: 从特定模块导入（高级用法）
```typescript
// 仅导入 HTTP 相关类型
import type { HttpRequestOptions, HttpResponse } from 'capacitor-cors-bypass-enhanced/dist/esm/types/http';

// 仅导入 SSE 相关类型
import type { SSEConnection, SSEOptions } from 'capacitor-cors-bypass-enhanced/dist/esm/types/sse';

// 仅导入 MCP 相关类型
import type { MCPClient, MCPToolList } from 'capacitor-cors-bypass-enhanced/dist/esm/types/mcp';
```

## 模块说明

### 📦 common.ts
通用类型，被其他模块共享：
- `PluginListenerHandle` - 事件监听器句柄

### 🌐 http.ts
HTTP 请求和响应类型：
- `HttpRequestOptions` - HTTP 请求配置
- `HttpResponse` - HTTP 响应结构

### 🌊 stream.ts
流式请求类型：
- `StreamRequestOptions` - 流式请求配置
- `StreamChunkEvent` - 数据块事件
- `StreamStatusEvent` - 流状态事件

### 📡 sse.ts
Server-Sent Events 类型：
- `SSEOptions` - 基础 SSE 配置
- `SSEConnectionOptions` - 高级 SSE 配置（含重连）
- `SSEConnection` - SSE 连接对象
- `SSEMessageEvent` - SSE 消息事件
- `SSEConnectionChangeEvent` - SSE 连接状态变化事件

### 🔌 websocket.ts
WebSocket 类型：
- `WebSocketConnectionOptions` - WebSocket 连接配置
- `WebSocketConnection` - WebSocket 连接对象
- `WebSocketMessageEvent` - WebSocket 消息事件
- `WebSocketConnectionChangeEvent` - WebSocket 状态变化事件

### 🤖 mcp.ts
Model Context Protocol 类型：
- `MCPClientOptions` - MCP 客户端配置
- `MCPClient` - MCP 客户端对象
- `MCPResourceList`, `MCPResource` - 资源类型
- `MCPToolList`, `MCPToolResult` - 工具类型
- `MCPPromptList`, `MCPPrompt` - 提示类型
- `MCPSamplingRequest`, `MCPSamplingResponse` - 采样类型

## 重构的好处

### 1. 更好的组织结构
- 相关类型分组在一起
- 每个模块职责单一明确

### 2. 更容易维护
- 修改某个功能的类型不会影响其他功能
- 减少合并冲突

### 3. 改进的文档
- 每个模块可以独立文档化
- 更容易理解各个功能

### 4. Tree-Shaking 支持
- 打包工具可以更好地优化未使用的类型
- 减小最终包体积

### 5. 团队协作
- 多人可以同时编辑不同模块
- 减少代码冲突

### 6. 类型发现
- 更容易找到特定功能的类型
- IDE 自动完成更精确

## 构建配置更新

### rollup.config.js
添加了 `@rollup/plugin-node-resolve` 插件以正确解析模块化的类型文件：

```javascript
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
  {
    input: 'dist/esm/index.js',
    plugins: [
      nodeResolve({
        extensions: ['.js']
      })
    ],
    // ...
  }
];
```

## 迁移检查清单

- [x] 类型定义已模块化
- [x] 向后兼容性已验证
- [x] 构建配置已更新
- [x] 构建测试通过
- [x] 文档已创建
- [ ] 单元测试验证（如有）
- [ ] 集成测试验证（如有）

## 常见问题

### Q: 我需要更新现有代码吗？
**A:** 不需要。所有现有的导入语句都会继续工作。

### Q: 如何查看某个类型的定义？
**A:** 
1. 查看 `src/types/README.md` 了解模块结构
2. 在对应的模块文件中查找类型定义
3. 使用 IDE 的"跳转到定义"功能

### Q: 新的模块化结构会影响性能吗？
**A:** 不会。TypeScript 类型在编译后会被移除，不影响运行时性能。

### Q: 可以只导入需要的类型吗？
**A:** 可以，但通常不需要。TypeScript 的类型系统已经很高效，从主入口导入即可。

## 下一步

1. ✅ 类型定义模块化完成
2. 📝 考虑添加更多类型文档和示例
3. 🧪 添加类型测试（如使用 `tsd`）
4. 📚 更新 API 文档以反映新结构

## 反馈

如有任何问题或建议，请提交 Issue 或 Pull Request。