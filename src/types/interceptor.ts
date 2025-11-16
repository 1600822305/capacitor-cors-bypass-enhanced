/**
 * Interceptor Types
 * 拦截器系统类型定义
 */

import type { HttpRequestOptions, HttpResponse } from './http';

/**
 * HTTP错误类型
 */
export interface HttpError {
  /**
   * 错误消息
   */
  message: string;

  /**
   * HTTP状态码（如果有）
   */
  status?: number;

  /**
   * 状态文本
   */
  statusText?: string;

  /**
   * 原始请求配置
   */
  config: HttpRequestOptions;

  /**
   * 响应数据（如果有）
   */
  response?: HttpResponse;

  /**
   * 原始错误对象
   */
  originalError?: any;
}

/**
 * 拦截器接口
 * 定义请求、响应和错误拦截的钩子函数
 */
export interface Interceptor {
  /**
   * 请求拦截器
   * 在请求发送前调用，可以修改请求配置
   * 
   * @param config - 请求配置
   * @returns 修改后的请求配置或Promise
   */
  onRequest?(config: HttpRequestOptions): HttpRequestOptions | Promise<HttpRequestOptions>;

  /**
   * 响应拦截器
   * 在收到响应后调用，可以修改响应数据
   * 
   * @param response - HTTP响应
   * @returns 修改后的响应或Promise
   */
  onResponse?(response: HttpResponse): HttpResponse | Promise<HttpResponse>;

  /**
   * 错误拦截器
   * 在请求或响应发生错误时调用
   * 可以处理错误、重试请求或抛出新错误
   * 
   * @param error - HTTP错误
   * @returns void、修改后的响应或Promise
   */
  onError?(error: HttpError): void | HttpResponse | Promise<void | HttpResponse>;
}

/**
 * 拦截器配置选项
 */
export interface InterceptorOptions {
  /**
   * 拦截器名称（用于调试和管理）
   */
  name?: string;

  /**
   * 拦截器优先级（数字越大优先级越高）
   * @default 0
   */
  priority?: number;

  /**
   * 是否启用拦截器
   * @default true
   */
  enabled?: boolean;

  /**
   * 拦截器作用域（可选，用于条件拦截）
   */
  scope?: {
    /**
     * 匹配的URL模式（正则表达式字符串）
     */
    urlPattern?: string;

    /**
     * 匹配的HTTP方法
     */
    methods?: Array<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'>;
  };
}

/**
 * 拦截器句柄
 * 用于管理已添加的拦截器
 */
export interface InterceptorHandle {
  /**
   * 拦截器ID
   */
  id: string;

  /**
   * 拦截器名称
   */
  name?: string;

  /**
   * 移除此拦截器
   */
  remove(): void;

  /**
   * 启用此拦截器
   */
  enable(): void;

  /**
   * 禁用此拦截器
   */
  disable(): void;

  /**
   * 检查拦截器是否启用
   */
  isEnabled(): boolean;
}

/**
 * 拦截器管理器接口
 */
export interface InterceptorManager {
  /**
   * 添加拦截器
   * 
   * @param interceptor - 拦截器实例
   * @param options - 拦截器配置选项
   * @returns 拦截器句柄
   */
  add(interceptor: Interceptor, options?: InterceptorOptions): InterceptorHandle;

  /**
   * 移除拦截器
   * 
   * @param handle - 拦截器句柄或ID
   */
  remove(handle: InterceptorHandle | string): void;

  /**
   * 移除所有拦截器
   */
  removeAll(): void;

  /**
   * 获取所有拦截器
   */
  getAll(): InterceptorHandle[];

  /**
   * 根据名称查找拦截器
   * 
   * @param name - 拦截器名称
   */
  findByName(name: string): InterceptorHandle | undefined;
}

/**
 * 拦截器执行上下文
 * 提供给拦截器的额外信息
 */
export interface InterceptorContext {
  /**
   * 请求开始时间戳
   */
  startTime: number;

  /**
   * 请求ID（用于追踪）
   */
  requestId: string;

  /**
   * 重试次数
   */
  retryCount: number;

  /**
   * 自定义数据（可在拦截器间传递）
   */
  data?: Record<string, any>;
}