#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(CorsBypassPlugin, "CorsBypass",
           CAP_PLUGIN_METHOD(request, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(get, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(post, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(put, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(patch, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(delete, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(startSSE, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopSSE, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(streamRequest, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(cancelStream, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(addInterceptor, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(removeInterceptor, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(removeAllInterceptors, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getInterceptors, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(enableCache, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(disableCache, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getCacheStats, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(clearCache, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(cleanupCache, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getCacheKeys, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(deleteCacheEntry, CAPPluginReturnPromise);
)
