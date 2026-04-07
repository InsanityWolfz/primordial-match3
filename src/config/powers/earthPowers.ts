import type { PowerUpDefinition } from '../powerUpConfig.ts';

export const EARTHQUAKE: PowerUpDefinition = {
  id: 'earthquake',
  name: 'Earthquake',
  element: 'earth',
  category: 'activePower',
  needsTarget: false,
  description: 'Shuffles the board and strikes 20 random tiles',
  params: { targetCount: 20 },
};

export const EARTH_POWERS: PowerUpDefinition[] = [EARTHQUAKE];
