# 快速测试设置指南

本指南帮助你快速设置和测试 CORS 插件的流式输出功能。

## 🚀 快速开始（5分钟）

### 步骤 1: 构建插件

```bash
# 在插件目录下
npm install
npm run build
```

### 步骤 2: 在你的项目中安装

```bash
# 在你的 AetherLink 项目目录下
cd J:\Cherry\Capacitor-CORS4\AetherLink-main

# 安装本地插件
npm install ../

# 同步到原生平台
npx cap sync
```

### 步骤 3: 在项目中使用

在你的 AetherLink 项目中，修改 API 调用以使用流式请求：

```typescript
// 在 src/shared/api/openai/provider.ts 或相关文件中

import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

// 添加流式请求方法
async function streamChatRequest(url: string, headers: any, data: any, onUpdate?: (text: string) => void) {
  let fullResponse = '';
  
  // 监听数据块
  const chunkListener = await CorsBypass.addListener('streamChunk', (event) => {
    if (event.data) {
      // 解析 SSE 数据
      const lines = event.data.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullResponse += content;
                // 触发更新回调
                onUpdate?.(fullResponse);
              }
            } catch (e) {
              console.warn('解析SSE数据失败:', e);
            }
          }
        }
      }
    }
    
    if (event.done) {
      chunkListener.remove();
      if (event.error) {
        console.error('流式请求错误:', event.error);
      }
    }
  });
  
  // 发起流式请求
  const { streamId } = await CorsBypass.streamRequest({
    url,
    method: 'POST',
    headers,
    data: { ...data, stream: true },
    timeout: 60000
  });
  
  return { streamId, cleanup: () => chunkListener.remove() };
}
```

### 步骤 4: 添加 CORS 兼容开关支持

在你的设置中添加一个开关来控制是否使用 CORS 插件：

```typescript
// 在 settingsSlice.ts 或相关文件中

interface Settings {
  // ... 其他设置
  useCorsPlugin: boolean;  // 新增：是否使用 CORS 插件
}

// 在 API 调用时检查
async function sendRequest(url: string, options: any) {
  const settings = getSettings();
  
  if (settings.useCorsPlugin) {
    // 使用 CORS 插件的流式请求
    return await streamChatRequest(url, options.headers, options.data);
  } else {
    // 使用原有的 fetch 请求
    return await fetch(url, options);
  }
}
```

## 🧪 测试流式输出

### 方法 1: 使用测试页面

1. 打开 `test-streaming.html` 文件
2. 填入你的 API 配置
3. 点击"开始流式请求"按钮
4. 观察实时输出

### 方法 2: 在 AetherLink 中测试

1. 启动你的 AetherLink 应用
2. 在设置中启用"CORS 兼容模式"
3. 发起一个对话请求
4. 观察是否能正常接收流式输出

## 📱 平台测试

### Web 平台测试

```bash
# 在 AetherLink 项目目录
npm run dev
# 或
npm run build && npm run preview
```

在浏览器中打开应用，测试流式对话功能。

### Android 平台测试

```bash
# 构建并运行 Android 应用
npx cap open android
```

在 Android Studio 中：
1. 连接设备或启动模拟器
2. 点击 Run 按钮
3. 测试流式对话功能

### iOS 平台测试

```bash
# 构建并运行 iOS 应用
npx cap open ios
```

在 Xcode 中：
1. 选择目标设备
2. 点击 Run 按钮
3. 测试流式对话功能

## 🔍 调试技巧

### 1. 启用详细日志

```typescript
// 在使用插件前添加
CorsBypass.addListener('streamStatus', (event) => {
  console.log('[CORS Plugin] 状态:', event);
});

CorsBypass.addListener('streamChunk', (event) => {
  console.log('[CORS Plugin] 数据块:', {
    streamId: event.streamId,
    dataLength: event.data?.length,
    done: event.done,
    error: event.error
  });
});
```

### 2. 检查网络请求

在浏览器开发者工具的 Network 标签中：
- 查看请求是否成功发送
- 检查响应头
- 查看响应数据

### 3. Android 日志

```bash
# 查看 Android 日志
adb logcat | grep "CorsBypass"
```

### 4. iOS 日志

在 Xcode 的 Console 中查看日志输出。

## ⚠️ 常见问题

### 问题 1: 插件未加载

**症状：** 调用插件方法时报错 "Plugin not found"

**解决：**
```bash
# 重新同步
npx cap sync
# 清理并重建
npx cap clean
npx cap sync
```

### 问题 2: 无法接收流式数据

**症状：** 请求成功但没有数据返回

**检查：**
1. 确认 API 支持流式输出（`stream: true`）
2. 检查监听器是否正确设置
3. 查看控制台是否有错误

**解决：**
```typescript
// 确保监听器在请求前设置
const listener = await CorsBypass.addListener('streamChunk', handler);
const result = await CorsBypass.streamRequest(options);
```

### 问题 3: CORS 错误仍然存在

**症状：** 仍然看到 CORS 相关错误

**原因：** 可能在 Web 平台上，插件需要代理服务器

**解决：**
```typescript
// 在 web.ts 中设置代理服务器
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

// 如果你有本地代理服务器
CorsBypass.setProxyServer('http://localhost:3002');
```

### 问题 4: 数据解析错误

**症状：** 接收到数据但无法正确解析

**检查：** 不同 API 的数据格式可能不同

**解决：**
```typescript
// OpenAI 格式
if (line.startsWith('data: ')) {
  const data = line.slice(6);
  if (data !== '[DONE]') {
    const json = JSON.parse(data);
    // 处理
  }
}

// 其他格式可能需要不同的解析方式
```

## 📊 性能优化建议

### 1. 限制数据累积

```typescript
let accumulated = '';
const MAX_SIZE = 1000000; // 1MB

CorsBypass.addListener('streamChunk', (event) => {
  if (accumulated.length < MAX_SIZE) {
    accumulated += event.data;
  } else {
    console.warn('数据累积达到上限');
  }
});
```

### 2. 及时清理监听器

```typescript
// 使用完后立即清理
const listener = await CorsBypass.addListener('streamChunk', handler);
// ... 使用
listener.remove();
```

### 3. 使用防抖处理 UI 更新

```typescript
import { debounce } from 'lodash';

const updateUI = debounce((text: string) => {
  // 更新 UI
}, 100);

CorsBypass.addListener('streamChunk', (event) => {
  if (event.data) {
    accumulated += event.data;
    updateUI(accumulated);
  }
});
```

## 🎯 下一步

1. ✅ 完成基本测试
2. ✅ 在实际项目中集成
3. ✅ 测试不同 AI 模型
4. ✅ 优化用户体验
5. ✅ 收集反馈并改进

## 📚 更多资源

- [完整使用指南](./STREAMING_GUIDE.md)
- [测试页面](./test-streaming.html)
- [API 文档](./README.md)

## 💬 获取帮助

如果遇到问题：
1. 查看本文档的常见问题部分
2. 检查浏览器控制台的错误信息
3. 查看 [STREAMING_GUIDE.md](./STREAMING_GUIDE.md) 的故障排除部分
4. 在 GitHub 上提交 Issue

---

**祝测试顺利！** 🎉