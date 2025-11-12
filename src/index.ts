import { registerPlugin } from '@capacitor/core';

import type { CorsBypassPlugin } from './definitions';

const CorsBypass = registerPlugin<CorsBypassPlugin>('CorsBypass', {
  web: () => import('./web').then(m => new m.CorsBypassWeb()),
});

export * from './definitions';
export { CorsBypass };
