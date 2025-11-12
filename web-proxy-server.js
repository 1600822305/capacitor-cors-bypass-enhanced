// Simple CORS proxy server for web development
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const EventSource = require('eventsource');
const fetch = require('node-fetch');
const https = require('https');

// Create HTTPS agent that ignores SSL certificate errors (for development only)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  secureProtocol: 'TLSv1_2_method',
  ciphers: 'ALL:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA',
  honorCipherOrder: true,
  secureOptions: require('constants').SSL_OP_NO_SSLv2 | require('constants').SSL_OP_NO_SSLv3
});

const app = express();
const PORT = process.env.PORT || 3002;

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control']
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CORS Proxy Server is running' });
});

// Generic HTTP proxy
app.all('/proxy/*', async (req, res) => {
  let targetUrl = req.url.replace('/proxy/', '');

  // Decode URL if it's encoded (handle double encoding)
  try {
    // First decode
    targetUrl = decodeURIComponent(targetUrl);
    // Check if still encoded and decode again
    if (targetUrl.includes('%')) {
      targetUrl = decodeURIComponent(targetUrl);
    }
  } catch (e) {
    // If decoding fails, use original
  }

  console.log(`[${req.method}] Proxying to: ${targetUrl}`);
  
  try {
    const options = {
      method: req.method,
      headers: {
        ...req.headers,
        host: undefined, // Remove host header
        origin: undefined, // Remove origin header
      },
      agent: targetUrl.startsWith('https:') ? httpsAgent : undefined, // Use HTTPS agent for HTTPS URLs
    };

    if (req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
      options.headers['content-type'] = 'application/json';
    }

    const response = await fetch(targetUrl, options);
    
    // Copy response headers
    Object.entries(response.headers.raw()).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control');

    res.status(response.status);
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }

  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error.message,
      target: targetUrl 
    });
  }
});

// SSE proxy endpoint
app.get('/sse-proxy/*', (req, res) => {
  let targetUrl = req.url.replace('/sse-proxy/', '');

  // Decode URL if it's encoded (handle double encoding)
  try {
    // First decode
    targetUrl = decodeURIComponent(targetUrl);
    // Check if still encoded and decode again
    if (targetUrl.includes('%')) {
      targetUrl = decodeURIComponent(targetUrl);
    }
  } catch (e) {
    // If decoding fails, use original
  }

  console.log(`[SSE] Proxying to: ${targetUrl}`);

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Create EventSource connection to target
  const eventSource = new EventSource(targetUrl);

  eventSource.onopen = () => {
    console.log(`[SSE] Connected to ${targetUrl}`);
    res.write('event: open\ndata: Connected to SSE stream\n\n');
  };

  eventSource.onmessage = (event) => {
    console.log(`[SSE] Message: ${event.data}`);
    res.write(`data: ${event.data}\n\n`);
  };

  eventSource.onerror = (error) => {
    console.error(`[SSE] Error:`, error);
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'SSE connection error' })}\n\n`);
  };

  // Handle client disconnect
  req.on('close', () => {
    console.log(`[SSE] Client disconnected from ${targetUrl}`);
    eventSource.close();
  });

  req.on('error', () => {
    console.log(`[SSE] Client error for ${targetUrl}`);
    eventSource.close();
  });
});

// MCP specific proxy with session management
const mcpSessions = new Map(); // Store session info

app.post('/mcp-proxy', async (req, res) => {
  const { sseUrl, postUrl, message, sessionId } = req.body;

  if (!postUrl || !message) {
    return res.status(400).json({ error: 'Missing postUrl or message' });
  }

  console.log(`[MCP] Sending message to: ${postUrl}`);
  console.log(`[MCP] Message:`, message);
  console.log(`[MCP] Session ID:`, sessionId);

  try {
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Add session ID header if provided (for non-initialize requests)
    if (sessionId && message.method !== 'initialize') {
      headers['mcp-session-id'] = sessionId;
      console.log(`[MCP] Using session ID: ${sessionId}`);
    }

    const response = await fetch(postUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(message),
      agent: postUrl.startsWith('https:') ? httpsAgent : undefined
    });

    const data = await response.json();

    // Extract session ID from response headers if this is an initialize request
    let responseSessionId = null;
    if (message.method === 'initialize' && response.headers.get('mcp-session-id')) {
      responseSessionId = response.headers.get('mcp-session-id');
      console.log(`[MCP] Got session ID from server: ${responseSessionId}`);
    }

    res.json({
      status: response.status,
      statusText: response.statusText,
      data: data,
      sessionId: responseSessionId
    });

  } catch (error) {
    console.error('[MCP] Error:', error.message);
    res.status(500).json({
      error: 'MCP proxy error',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 CORS Proxy Server running on http://localhost:${PORT}`);
  console.log(`📋 Usage:`);
  console.log(`   HTTP Proxy: http://localhost:${PORT}/proxy/https://example.com/api`);
  console.log(`   SSE Proxy:  http://localhost:${PORT}/sse-proxy/https://example.com/events`);
  console.log(`   MCP Proxy:  POST to http://localhost:${PORT}/mcp-proxy`);
  console.log(`   Health:     http://localhost:${PORT}/health`);
});

module.exports = app;
