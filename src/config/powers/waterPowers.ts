import type { PowerUpDefinition } from '../powerUpConfig.ts';

export const ICE_LANCE: PowerUpDefinition = {
  id: 'icelance',
  name: 'Ice Lance',
  element: 'ice',
  category: 'activePower',
  needsTarget: false,
  description: 'Strikes a random enemy — each tile they occupy takes damage',
  params: {},
};

export const WATER_POWERS: PowerUpDefinition[] = [ICE_LANCE];
