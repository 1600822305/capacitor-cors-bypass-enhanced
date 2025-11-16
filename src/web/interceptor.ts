import type {
  Interceptor,
  InterceptorOptions,
  InterceptorHandle,
  HttpRequestOptions,
  HttpResponse,
  HttpError,
  InterceptorContext,
} from '../definitions';
import { createInterceptorContext } from './utils';

/**
 * Interceptor Manager
 * Handles request/response interceptors with priority and scope support
 */
export class InterceptorManager {
  private interceptors: Array<{
    id: string;
    interceptor: Interceptor;
    options: InterceptorOptions;
    enabled: boolean;
  }> = [];
  private interceptorCounter = 0;

  /**
   * Add an interceptor to the request/response chain
   */
  async addInterceptor(interceptor: Interceptor, options?: InterceptorOptions): Promise<InterceptorHandle> {
    const id = `interceptor_${++this.interceptorCounter}`;
    const interceptorEntry = {
      id,
      interceptor,
      options: options || {},
      enabled: options?.enabled !== false,
    };

    this.interceptors.push(interceptorEntry);

    // Sort by priority (higher priority first)
    this.interceptors.sort((a, b) => {
      const priorityA = a.options.priority || 0;
      const priorityB = b.options.priority || 0;
      return priorityB - priorityA;
    });

    const handle: InterceptorHandle = {
      id,
      name: options?.name,
      remove: () => {
        this.removeInterceptor(id);
      },
      enable: () => {
        const entry = this.interceptors.find(i => i.id === id);
        if (entry) entry.enabled = true;
      },
      disable: () => {
        const entry = this.interceptors.find(i => i.id === id);
        if (entry) entry.enabled = false;
      },
      isEnabled: () => {
        const entry = this.interceptors.find(i => i.id === id);
        return entry ? entry.enabled : false;
      },
    };

    return handle;
  }

  /**
   * Remove an interceptor by handle or ID
   */
  async removeInterceptor(handle: InterceptorHandle | string): Promise<void> {
    const id = typeof handle === 'string' ? handle : handle.id;
    const index = this.interceptors.findIndex(i => i.id === id);
    if (index !== -1) {
      this.interceptors.splice(index, 1);
    }
  }

  /**
   * Remove all interceptors
   */
  async removeAllInterceptors(): Promise<void> {
    this.interceptors = [];
  }

  /**
   * Get all registered interceptors
   */
  async getInterceptors(): Promise<InterceptorHandle[]> {
    return this.interceptors.map(entry => ({
      id: entry.id,
      name: entry.options.name,
      remove: () => this.removeInterceptor(entry.id),
      enable: () => {
        entry.enabled = true;
      },
      disable: () => {
        entry.enabled = false;
      },
      isEnabled: () => entry.enabled,
    }));
  }

  /**
   * Execute request interceptors
   */
  async executeRequestInterceptors(config: HttpRequestOptions): Promise<HttpRequestOptions> {
    const context = createInterceptorContext();
    let modifiedConfig = { ...config };

    for (const entry of this.interceptors) {
      if (!entry.enabled || !entry.interceptor.onRequest) {
        continue;
      }

      // Check scope if defined
      if (entry.options.scope) {
        const { urlPattern, methods } = entry.options.scope;
        
        if (urlPattern && !new RegExp(urlPattern).test(modifiedConfig.url)) {
          continue;
        }
        
        if (methods && modifiedConfig.method && !methods.includes(modifiedConfig.method)) {
          continue;
        }
      }

      try {
        modifiedConfig = await Promise.resolve(entry.interceptor.onRequest(modifiedConfig));
      } catch (error) {
        console.error(`[Interceptor ${entry.id}] Request interceptor error:`, error);
        throw error;
      }
    }

    return modifiedConfig;
  }

  /**
   * Execute response interceptors
   */
  async executeResponseInterceptors(response: HttpResponse): Promise<HttpResponse> {
    const context = createInterceptorContext();
    let modifiedResponse = { ...response };

    for (const entry of this.interceptors) {
      if (!entry.enabled || !entry.interceptor.onResponse) {
        continue;
      }

      try {
        modifiedResponse = await Promise.resolve(entry.interceptor.onResponse(modifiedResponse));
      } catch (error) {
        console.error(`[Interceptor ${entry.id}] Response interceptor error:`, error);
        throw error;
      }
    }

    return modifiedResponse;
  }

  /**
   * Execute error interceptors
   */
  async executeErrorInterceptors(error: HttpError): Promise<HttpResponse | void> {
    const context = createInterceptorContext();

    for (const entry of this.interceptors) {
      if (!entry.enabled || !entry.interceptor.onError) {
        continue;
      }

      try {
        const result = await Promise.resolve(entry.interceptor.onError(error));
        if (result) {
          // Interceptor returned a response, use it
          return result;
        }
      } catch (interceptorError) {
        console.error(`[Interceptor ${entry.id}] Error interceptor error:`, interceptorError);
        // Continue to next interceptor
      }
    }

    // No interceptor handled the error, return void
    return;
  }

  /**
   * Get all interceptors (internal format)
   */
  getInterceptorsInternal(): Array<{
    id: string;
    interceptor: Interceptor;
    options: InterceptorOptions;
    enabled: boolean;
  }> {
    return this.interceptors;
  }
}