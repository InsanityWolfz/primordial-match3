import type { PowerUpDefinition } from '../powerUpConfig.ts';

export const FIREBALL: PowerUpDefinition = {
  id: 'fireball',
  name: 'Fireball',
  element: 'fire',
  category: 'activePower',
  needsTarget: true,
  description: 'Area blast in a 5×5 radius around the target tile',
  params: { radius: 2 },
};

export const FIRE_POWERS: PowerUpDefinition[] = [FIREBALL];
