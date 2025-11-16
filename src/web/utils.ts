import type { InterceptorContext } from '../definitions';

/**
 * Check if a URL is cross-origin
 */
export function isCrossOrigin(url: string): boolean {
  try {
    const targetUrl = new URL(url);
    const currentUrl = new URL(window.location.href);

    return targetUrl.origin !== currentUrl.origin;
  } catch {
    return false;
  }
}

/**
 * Create interceptor context
 */
export function createInterceptorContext(): InterceptorContext {
  return {
    startTime: Date.now(),
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    retryCount: 0,
    data: {},
  };
}

/**
 * Utils Manager
 * Provides utility functions for the web plugin
 */
export class UtilsManager {
  /**
   * Check if a URL is cross-origin
   */
  isCrossOrigin(url: string): boolean {
    return isCrossOrigin(url);
  }

  /**
   * Create interceptor context
   */
  createInterceptorContext(): InterceptorContext {
    return createInterceptorContext();
  }
}