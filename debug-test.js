// 调试测试脚本
// 用于测试网页抓取功能

import { CorsBypass } from 'capacitor-cors-bypass-enhanced';

// 测试配置
const testConfigs = [
  {
    name: "简单HTTP测试",
    url: "http://httpbin.org/get",
    timeout: 10000
  },
  {
    name: "HTTPS测试",
    url: "https://httpbin.org/get", 
    timeout: 15000
  },
  {
    name: "百度搜索测试",
    url: "https://www.baidu.com/s?wd=test",
    timeout: 30000
  },
  {
    name: "Bing搜索测试",
    url: "https://www.bing.com/search?q=test",
    timeout: 30000
  }
];

// 测试函数
async function testWebScraping(config) {
  console.log(`\n🧪 开始测试: ${config.name}`);
  console.log(`📍 URL: ${config.url}`);
  
  const startTime = Date.now();
  
  try {
    const response = await CorsBypass.request({
      url: config.url,
      method: 'GET',
      responseType: 'text',
      timeout: config.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      }
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ 测试成功!`);
    console.log(`⏱️ 耗时: ${duration}ms`);
    console.log(`📊 状态码: ${response.status}`);
    console.log(`📝 状态文本: ${response.statusText}`);
    console.log(`🔗 最终URL: ${response.url}`);
    console.log(`📄 内容长度: ${response.data ? response.data.length : 0} 字符`);
    
    // 显示部分内容
    if (response.data && typeof response.data === 'string') {
      const preview = response.data.substring(0, 200);
      console.log(`👀 内容预览: ${preview}...`);
    }
    
    // 显示响应头
    console.log(`📋 响应头:`, Object.keys(response.headers || {}).length, '个');
    
    return {
      success: true,
      duration,
      status: response.status,
      contentLength: response.data ? response.data.length : 0
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.log(`❌ 测试失败!`);
    console.log(`⏱️ 耗时: ${duration}ms`);
    console.log(`🚨 错误: ${error.message}`);
    console.log(`📋 错误详情:`, error);
    
    return {
      success: false,
      duration,
      error: error.message
    };
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 开始网页抓取测试...\n');
  
  const results = [];
  
  for (const config of testConfigs) {
    const result = await testWebScraping(config);
    results.push({
      name: config.name,
      ...result
    });
    
    // 测试间隔
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 显示总结
  console.log('\n📊 测试总结:');
  console.log('=' * 50);
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}: ${result.duration}ms`);
    if (!result.success) {
      console.log(`   错误: ${result.error}`);
    } else {
      console.log(`   状态: ${result.status}, 内容: ${result.contentLength} 字符`);
    }
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎯 成功率: ${successCount}/${results.length} (${(successCount/results.length*100).toFixed(1)}%)`);
}

// 单独测试Bing搜索
async function testBingSearch() {
  console.log('🔍 专门测试Bing搜索...\n');
  
  const result = await testWebScraping({
    name: "Bing搜索详细测试",
    url: "https://www.bing.com/search?q=123123&ensearch=1&count=17&setlang=zh-CN&cc=CN&safesearch=moderate",
    timeout: 60000 // 增加到60秒
  });
  
  return result;
}

// 导出测试函数
window.debugTest = {
  runAllTests,
  testBingSearch,
  testWebScraping
};

console.log('🛠️ 调试工具已加载!');
console.log('使用方法:');
console.log('- debugTest.runAllTests() - 运行所有测试');
console.log('- debugTest.testBingSearch() - 测试Bing搜索');
console.log('- debugTest.testWebScraping(config) - 自定义测试');
