/**
 * StreamableHTTP 使用示例
 * 展示如何使用新的 StreamableHTTP 协议连接到 MCP 服务器
 */

import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

// ==================== 基本使用 ====================

async function basicExample() {
  console.log('=== 基本 StreamableHTTP 示例 ===');
  
  // 创建 MCP 客户端
  const client = await CorsBypass.createMCPClient({
    url: 'https://example.com/mcp',  // MCP 服务器端点
    transport: 'streamablehttp',      // 使用 StreamableHTTP 传输
    clientInfo: {
      name: 'MyCapacitorApp',
      version: '1.0.0'
    },
    capabilities: {
      sampling: true,
      roots: { listChanged: true }
    }
  });
  
  console.log('MCP 客户端已连接:', client.connectionId);
  
  // 监听消息
  CorsBypass.addListener('mcpMessage', (data) => {
    console.log('收到消息:', data.message);
  });
  
  // 监听错误
  CorsBypass.addListener('mcpError', (data) => {
    console.error('MCP 错误:', data.error);
  });
  
  // 监听状态变化
  CorsBypass.addListener('mcpStateChange', (data) => {
    console.log('状态变化:', data.state);
  });
  
  // 列出资源
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
  
  // 等待一段时间后关闭
  setTimeout(async () => {
    await CorsBypass.closeMCPClient({ connectionId: client.connectionId });
    console.log('客户端已关闭');
  }, 30000);
}

// ==================== 会话恢复示例 ====================

async function resumableExample() {
  console.log('=== 会话恢复示例 ===');
  
  // 创建可恢复的客户端
  const client = await CorsBypass.createMCPClient({
    url: 'https://example.com/mcp',
    transport: 'streamablehttp',
    resumable: true,  // 启用会话恢复
    clientInfo: {
      name: 'MyCapacitorApp',
      version: '1.0.0'
    },
    capabilities: {}
  });
  
  console.log('客户端已连接（可恢复）');
  
  // 模拟一些操作
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
  
  // 获取会话信息
  const sessionInfo = await CorsBypass.getMCPSessionInfo({
    connectionId: client.connectionId
  });
  
  console.log('会话信息:', {
    sessionId: sessionInfo.sessionId,
    lastSequence: sessionInfo.lastSequence
  });
  
  // 保存会话信息到本地存储
  localStorage.setItem('mcp_session', JSON.stringify({
    sessionId: sessionInfo.sessionId,
    lastSequence: sessionInfo.lastSequence
  }));
  
  // 模拟断线
  await CorsBypass.closeMCPClient({ connectionId: client.connectionId });
  console.log('连接已断开');
  
  // 等待一会儿后重新连接
  setTimeout(async () => {
    console.log('正在恢复连接...');
    
    // 从本地存储恢复会话信息
    const saved = JSON.parse(localStorage.getItem('mcp_session') || '{}');
    
    // 使用会话信息重新连接
    const reconnectedClient = await CorsBypass.createMCPClient({
      url: 'https://example.com/mcp',
      transport: 'streamablehttp',
      resumable: true,
      sessionId: saved.sessionId,      // 恢复会话
      lastSequence: saved.lastSequence, // 从上次位置继续
      clientInfo: {
        name: 'MyCapacitorApp',
        version: '1.0.0'
      },
      capabilities: {}
    });
    
    console.log('连接已恢复:', reconnectedClient.connectionId);
  }, 5000);
}

// ==================== 服务器推送示例 ====================

async function serverPushExample() {
  console.log('=== 服务器推送示例 ===');
  
  const client = await CorsBypass.createMCPClient({
    url: 'https://example.com/mcp',
    transport: 'streamablehttp',
    clientInfo: {
      name: 'MyCapacitorApp',
      version: '1.0.0'
    },
    capabilities: {}
  });
  
  // 打开监听流
  await CorsBypass.openMCPListenStream({
    connectionId: client.connectionId
  });
  
  console.log('监听流已打开，等待服务器推送...');
  
  // 监听服务器推送的消息
  CorsBypass.addListener('mcpMessage', (data) => {
    console.log('服务器推送:', data.message);
    
    // 根据消息类型处理
    if (data.message.method === 'notifications/resources/updated') {
      console.log('资源已更新:', data.message.params);
    } else if (data.message.method === 'notifications/tools/list_changed') {
      console.log('工具列表已变更');
    }
  });
}

// ==================== 完整的 MCP 工作流 ====================

async function fullWorkflowExample() {
  console.log('=== 完整 MCP 工作流示例 ===');
  
  // 1. 创建客户端并初始化
  const client = await CorsBypass.createMCPClient({
    url: 'https://example.com/mcp',
    transport: 'streamablehttp',
    resumable: true,
    clientInfo: {
      name: 'MyCapacitorApp',
      version: '1.0.0'
    },
    capabilities: {
      sampling: true,
      roots: { listChanged: true }
    }
  });
  
  console.log('1. 客户端已初始化');
  
  // 2. 列出可用的工具
  const listToolsRequest = {
    jsonrpc: '2.0' as const,
    id: 2,
    method: 'tools/list',
    params: {}
  };
  
  await CorsBypass.sendMCPMessage({
    connectionId: client.connectionId,
    message: listToolsRequest,
    expectStream: true
  });
  
  console.log('2. 已请求工具列表');
  
  // 3. 等待工具列表响应
  const toolsListPromise = new Promise((resolve) => {
    const handler = (data: any) => {
      if (data.message.id === 2 && data.message.result) {
        console.log('3. 收到工具列表:', data.message.result.tools);
        CorsBypass.removeAllListeners();
        resolve(data.message.result);
      }
    };
    CorsBypass.addListener('mcpMessage', handler);
  });
  
  const toolsList = await toolsListPromise;
  
  // 4. 调用一个工具
  const callToolRequest = {
    jsonrpc: '2.0' as const,
    id: 3,
    method: 'tools/call',
    params: {
      name: 'example_tool',
      arguments: { param1: 'value1' }
    }
  };
  
  await CorsBypass.sendMCPMessage({
    connectionId: client.connectionId,
    message: callToolRequest,
    expectStream: true
  });
  
  console.log('4. 已调用工具');
  
  // 5. 列出资源
  const listResourcesRequest = {
    jsonrpc: '2.0' as const,
    id: 4,
    method: 'resources/list',
    params: {}
  };
  
  await CorsBypass.sendMCPMessage({
    connectionId: client.connectionId,
    message: listResourcesRequest,
    expectStream: true
  });
  
  console.log('5. 已请求资源列表');
  
  // 6. 打开监听流以接收服务器通知
  await CorsBypass.openMCPListenStream({
    connectionId: client.connectionId
  });
  
  console.log('6. 监听流已打开');
  
  // 7. 处理所有消息
  CorsBypass.addListener('mcpMessage', (data) => {
    console.log('收到消息:', {
      id: data.message.id,
      method: data.message.method,
      hasResult: !!data.message.result,
      hasError: !!data.message.error
    });
  });
}

// ==================== 错误处理示例 ====================

async function errorHandlingExample() {
  console.log('=== 错误处理示例 ===');
  
  try {
    const client = await CorsBypass.createMCPClient({
      url: 'https://example.com/mcp',
      transport: 'streamablehttp',
      clientInfo: {
        name: 'MyCapacitorApp',
        version: '1.0.0'
      },
      capabilities: {}
    });
    
    // 监听错误
    CorsBypass.addListener('mcpError', (data) => {
      console.error('MCP 错误:', {
        connectionId: data.connectionId,
        error: data.error
      });
      
      // 根据错误类型处理
      if (data.error.includes('timeout')) {
        console.log('超时错误，尝试重新连接...');
      } else if (data.error.includes('404')) {
        console.log('端点不存在');
      } else if (data.error.includes('401')) {
        console.log('认证失败');
      }
    });
    
    // 监听状态变化
    CorsBypass.addListener('mcpStateChange', (data) => {
      console.log('连接状态:', data.state);
      
      if (data.state === 'stream_closed') {
        console.log('流已关闭，可能需要重新连接');
      } else if (data.state === 'get_not_supported') {
        console.log('服务器不支持 GET 流，将只使用 POST');
      }
    });
    
    // 发送请求
    await CorsBypass.sendMCPMessage({
      connectionId: client.connectionId,
      message: {
        jsonrpc: '2.0',
        id: 5,
        method: 'invalid/method',  // 故意使用无效方法测试错误
        params: {}
      },
      expectStream: true
    });
    
  } catch (error) {
    console.error('创建客户端失败:', error);
  }
}

// ==================== 向后兼容示例（旧 SSE 方式） ====================

async function legacySSEExample() {
  console.log('=== 旧 SSE 传输示例（向后兼容）===');
  
  // 注意：这是旧方式，不推荐新项目使用
  try {
    const client = await CorsBypass.createMCPClient({
      sseUrl: 'https://example.com/sse',
      postUrl: 'https://example.com/sse/messages',
      transport: 'sse',  // 明确指定使用旧传输
      clientInfo: {
        name: 'MyCapacitorApp',
        version: '1.0.0'
      },
      capabilities: {}
    });
    
    console.log('使用旧 SSE 传输连接成功');
  } catch (error) {
    console.error('旧 SSE 传输暂未实现，请使用 StreamableHTTP');
  }
}

// ==================== 运行示例 ====================

// 取消注释以运行不同的示例：

// basicExample();
// resumableExample();
// serverPushExample();
// fullWorkflowExample();
// errorHandlingExample();
// legacySSEExample();

export {
  basicExample,
  resumableExample,
  serverPushExample,
  fullWorkflowExample,
  errorHandlingExample,
  legacySSEExample,
};
