# Capacitor CORS Bypass Enhanced

🚀 **The ultimate Capacitor plugin for advanced networking and CORS bypass**

A comprehensive Capacitor plugin that provides powerful networking capabilities including CORS bypass, modern protocol support (HTTP/2, HTTP/3, gRPC, GraphQL), file operations, and advanced network management features.

## ✨ Features

### 🌐 Core Networking
- **CORS Bypass** - Complete bypass of browser CORS restrictions
- **Network Proxy** ✅ NEW - HTTP, HTTPS, SOCKS4, SOCKS5 proxy support with authentication
- **HTTP/2 Support** ✅ - Multiplexing, server push, stream prioritization (Android & iOS)
- **HTTP/3 (QUIC)** ⏭️ - Planned (requires OkHttp 5.0 stable or Cronet integration)
- **Protocol Auto-Detection** ✅ - Automatic protocol negotiation and fallback
- **Performance Monitoring** ✅ - DNS, TCP, TLS, TTFB metrics tracking
- **Server-Sent Events (SSE)** - Real-time event streaming
- **WebSocket Enhanced** - Auto-reconnect, heartbeat, connection pooling

### 🔧 Advanced Protocols
- **gRPC** - High-performance RPC with streaming support
- **GraphQL** - Queries, mutations, subscriptions with caching
- **MCP (Model Context Protocol)** - AI model communication with StreamableHTTP support ✨NEW
  - **StreamableHTTP Transport** ✅ - Single-endpoint, bidirectional communication
  - **Session Resumability** ✅ - Reconnect and resume message streams
  - **Backward Compatible** ✅ - Legacy SSE transport still supported

### 📁 File Operations
- **File Download** - Progress tracking, resume, speed control
- **File Upload** - Multi-part uploads with progress
- **Batch Operations** - Concurrent file processing

### 🚀 Performance Features
- **Connection Pooling** - Efficient connection reuse
- **Batch Requests** - Parallel request processing with retry logic
- **Smart Caching** - Compressed storage with TTL
- **Network Monitoring** - Real-time performance metrics

### 🛠 Data Processing
- **Multi-format Parsing** - JSON, XML, CSV, YAML, HTML, Markdown, Base64
- **Data Transformation** - Format conversion and extraction
- **Compression** - Built-in gzip/deflate support

## 📦 Installation

```bash
npm install capacitor-cors-bypass-enhanced
npx cap sync
```

## 🚀 Quick Start

### Basic HTTP Request with CORS Bypass

```typescript
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

// Simple request
const response = await CorsBypass.makeRequest({
  url: 'https://api.example.com/data',
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' }
});

console.log('Success:', response.success);
console.log('Data:', response.data);
console.log('Duration:', response.duration + 'ms');
```

### HTTP/2 and HTTP/3 Support

```typescript
// Automatic protocol selection (HTTP/3 -> HTTP/2 -> HTTP/1.1)
const response = await CorsBypass.get({
  url: 'https://api.example.com/data'
});

console.log('Protocol:', response.protocolVersion); // 'h2' or 'h3'
console.log('Performance:', response.metrics);

// Configure protocol options
const response = await CorsBypass.get({
  url: 'https://api.example.com/data',
  protocolConfig: {
    http2: {
      enabled: true,
      pushEnabled: true,
      pingInterval: 10000
    },
    http3: {
      enabled: true,  // Android only
      zeroRtt: true
    },
    fallback: {
      enabled: true,
      retryCount: 2,
      preferredProtocols: ['h3', 'h2', 'http/1.1']
    }
  }
});

// Performance metrics
if (response.metrics) {
  console.log('DNS Time:', response.metrics.dnsTime, 'ms');
  console.log('TCP Time:', response.metrics.tcpTime, 'ms');
  console.log('TLS Time:', response.metrics.tlsTime, 'ms');
  console.log('TTFB:', response.metrics.ttfb, 'ms');
  console.log('Download Speed:', response.metrics.downloadSpeed, 'bytes/sec');
}
```

### Network Proxy Support ✨NEW

```typescript
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

// Set global proxy (applies to all requests)
await CorsBypass.setGlobalProxy({
  enabled: true,
  type: 'http',  // 'http' | 'https' | 'socks4' | 'socks5'
  host: '127.0.0.1',
  port: 8080,
  username: 'user',      // Optional
  password: 'pass',      // Optional
  bypass: ['localhost', '*.local'],  // Optional bypass list
  applyToAll: true
});

// Test proxy connection
const testResult = await CorsBypass.testProxy({
  enabled: true,
  type: 'socks5',
  host: '127.0.0.1',
  port: 1080
}, 'https://www.google.com');

console.log('Proxy test:', testResult.success ? 'OK' : testResult.error);
console.log('Response time:', testResult.responseTime, 'ms');

// Per-request proxy (overrides global proxy)
const response = await CorsBypass.get({
  url: 'https://api.example.com/data',
  proxy: {
    enabled: true,
    type: 'http',
    host: 'proxy.company.com',
    port: 3128
  }
});

// Get proxy status
const status = await CorsBypass.getProxyStatus();
console.log('Active:', status.active);
console.log('Request count:', status.requestCount);

// Clear global proxy
await CorsBypass.clearGlobalProxy();
```

### gRPC Service Calls

```typescript
const grpcResponse = await CorsBypass.callGRPC({
  url: 'https://grpc.api.example.com',
  service: 'UserService',
  method: 'GetUser',
  data: { userId: 123 },
  metadata: { 'authorization': 'Bearer token' },
  compression: 'gzip'
});

console.log('gRPC Status:', grpcResponse.status);
console.log('Response:', grpcResponse.data);
```

### GraphQL with Caching

```typescript
const graphqlResponse = await CorsBypass.queryGraphQL({
  url: 'https://api.example.com/graphql',
  query: `
    query GetUser($id: ID!) {
      user(id: $id) {
        name
        email
        posts { title }
      }
    }
  `,
  variables: { id: '123' },
  cache: { enabled: true, ttl: 300000 } // 5 min cache
});

console.log('Data:', graphqlResponse.data);
console.log('Cache hit:', graphqlResponse.cache?.hit);
```

### Batch Requests with Retry

```typescript
const results = await CorsBypass.batchRequests([
  {
    url: 'https://api1.example.com/data',
    id: 'req1',
    priority: 1,
    retry: { maxAttempts: 3, delay: 1000 }
  },
  {
    url: 'https://api2.example.com/data',
    id: 'req2',
    priority: 2
  }
]);

results.forEach(result => {
  console.log(`${result.id}: ${result.success ? 'Success' : 'Failed'}`);
  console.log(`Duration: ${result.duration}ms, Attempts: ${result.attempts}`);
});
```

### File Download with Progress

```typescript
const download = await CorsBypass.downloadFile({
  url: 'https://example.com/large-file.zip',
  filePath: '/storage/downloads/file.zip',
  resume: true,
  maxSpeed: 1024 * 1024 // 1MB/s
});

// Listen for progress
CorsBypass.addListener('downloadProgress', (progress) => {
  const percent = (progress.bytesDownloaded / progress.totalSize) * 100;
  console.log(`Download: ${percent.toFixed(2)}%`);
});
```

### Smart Caching

```typescript
// Set cache with compression
await CorsBypass.manageCache({
  operation: 'set',
  key: 'user_data',
  value: userData,
  expiration: 3600000, // 1 hour
  compression: { enabled: true, algorithm: 'gzip' }
});

// Get cached data
const cached = await CorsBypass.manageCache({
  operation: 'get',
  key: 'user_data'
});

if (cached.hit) {
  console.log('Cache hit:', cached.value);
}
```

### Data Parsing

```typescript
// Parse CSV data
const csvResult = await CorsBypass.parseData({
  data: 'name,age\nJohn,25\nJane,30',
  format: 'csv',
  options: { delimiter: ',' }
});

// Parse JSON with JSONPath
const jsonResult = await CorsBypass.parseData({
  data: '{"users": [{"name": "John"}, {"name": "Jane"}]}',
  format: 'json',
  options: { jsonPath: '$.users[*].name' }
});
```

## 🔧 Configuration

### Android Setup

Add to your `MainActivity.java`:

```java
import com.capacitor.cors.CorsBypassPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    
    this.init(savedInstanceState, new ArrayList<Class<? extends Plugin>>() {{
      add(CorsBypassPlugin.class);
    }});
  }
}
```

### iOS Setup

The plugin will be automatically registered on iOS.

## 📚 API Documentation

For complete API documentation with all interfaces and options, see:
- [PLUGIN_ENHANCED_FEATURES.md](./PLUGIN_ENHANCED_FEATURES.md) - Complete API reference
- [STREAMABLE_HTTP.md](./STREAMABLE_HTTP.md) - StreamableHTTP protocol guide (MCP) ✨NEW

## 🎯 Use Cases

- **Enterprise API Integration** - Connect to internal APIs without CORS issues
- **AI/LLM Integration** - Connect to MCP servers using StreamableHTTP ✨NEW
- **Real-time Applications** - SSE, WebSocket, GraphQL subscriptions
- **File Management** - Upload/download with progress tracking
- **Performance Optimization** - HTTP/2, connection pooling, caching
- **Microservices** - gRPC communication between services
- **Data Processing** - Parse and transform various data formats
- **Network Monitoring** - Track performance and debug issues

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/1600822305/capacitor-cors-bypass-enhanced)
- [npm Package](https://www.npmjs.com/package/capacitor-cors-bypass-enhanced)
- [Issue Tracker](https://github.com/1600822305/capacitor-cors-bypass-enhanced/issues)
- [Documentation](./PLUGIN_ENHANCED_FEATURES.md)

## 🏷️ Version History

- **1.0.0** - Initial release with full feature set
  - CORS bypass for all HTTP methods
  - HTTP/2 and HTTP/3 support
  - gRPC and GraphQL protocols
  - File operations with progress tracking
  - Advanced caching and data parsing
  - Network monitoring and connection pooling

---

**Made with ❤️ by the AetherLink Team**
