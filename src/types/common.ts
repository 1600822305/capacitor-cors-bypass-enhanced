/**
 * Common Types
 */

export interface PluginListenerHandle {
  remove(): Promise<void>;
}