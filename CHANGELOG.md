# Changelog

## [1.1.2] - 2025-11-23

### Fixed - 彻底修复 OkHttp 自动添加 charset 问题
- **修改 OkHttp RequestBody 创建逻辑**
  - 使用 `RequestBody.create(null, bytes)` 替代 `RequestBody.create(mediaType, string)`
  - 手动设置 `Content-Type: application/json` header（无 charset）
  - 避免 OkHttp 底层自动添加 `charset=utf-8` 参数
  - 修改了两处 `makeHttpRequest()` 方法（常规请求和流式请求）

### 影响
- **彻底解决** MCP 服务器拒绝带 charset 的 Content-Type 问题
- 不再需要代理服务器清理 charset
- 移动端可以直接连接 MCP 服务器

---

## [1.1.1] - 2025-11-23

### Fixed - 修复 MCP 服务器 Content-Type 兼容性问题
- **移除 Android 端 `Content-Type` 中的 `charset=utf-8` 参数**
  - 修改 `CorsBypassPlugin.java` 中的 `MediaType.parse()` 调用
  - 从 `"application/json; charset=utf-8"` 改为 `"application/json"`
  - 解决某些 MCP 服务器（如 ModelScope）拒绝带 charset 的请求问题

### 影响
- 修复移动端 MCP 客户端初始化失败问题（HTTP 400 错误）
- 提高与严格 JSON API 服务器的兼容性
- 不影响现有功能，只是移除可选参数

---

## [1.0.11] - 2025-11-21

### Fixed - 修复重复声明和 @objc 错误
- **修复 `CorsBypassPlugin.swift` 重复声明错误**
  - 删除第625行重复的 `cancelStream` 函数（已在第499行存在）
  
- **修复 `CacheInterceptor.swift` @objc 兼容性错误**
  - 移除 `interceptRequest` 方法的 `@objc` 标记
  - Swift 的 `Result` 类型无法在 Objective-C 中表示

### 影响
- 解决 iOS 构建中的函数重复声明错误
- 解决 @objc 方法类型不兼容错误
- 现在应该可以成功构建 iOS 应用

---

## [1.0.10] - 2025-11-21

### Fixed - iOS构建修复
- **修复 `CorsBypassPlugin.swift` 严重结构错误**
  - 移除第610行错误的类结束括号
  - 修复 `cancelStream` 函数被孤立在类外部的问题
  - 移除 `AssociatedKeys` 和 `StreamContext` 的重复定义
  - 移除 `URLSessionDataDelegate` extension 的重复定义
  - 重新组织类结构，确保所有函数都在正确的作用域内

- **修复 `PerformanceMonitor.swift` Swift 保留关键字错误**
  - 将变量名从 `protocol` 重命名为 `httpProtocol`
  - 更新所有相关引用（7处）

- **修复 `ProtocolManager.swift` Swift 保留关键字错误**
  - 将局部变量从 `protocol` 重命名为 `detectedProtocol`

### 影响
- 解决了 iOS 构建失败问题（退出代码 65）
- 解决了 40+ 个 Swift 编译错误
- 现在可以成功构建 iOS 应用

---

## [1.0.9] - 2025-11-19
- Previous version with iOS build issues

