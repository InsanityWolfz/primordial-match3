import type { PowerUpDefinition } from '../powerUpConfig.ts';

export const LIGHTNING: PowerUpDefinition = {
  id: 'chainstrike',
  name: 'Lightning',
  element: 'lightning',
  category: 'activePower',
  needsTarget: true,
  description: 'Chains through 14 tiles in a zig-zag path from the target',
  params: { chainCount: 14 },
};

export const LIGHTNING_POWERS: PowerUpDefinition[] = [LIGHTNING];
