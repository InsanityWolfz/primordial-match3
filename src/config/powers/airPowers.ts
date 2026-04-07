import type { PowerUpDefinition } from '../powerUpConfig.ts';

export const GUST: PowerUpDefinition = {
  id: 'gust',
  name: 'Gust',
  element: 'air',
  category: 'activePower',
  needsTarget: true,
  description: 'Strikes the full row and column of the target tile',
  params: {},
};

export const AIR_POWERS: PowerUpDefinition[] = [GUST];
