export interface GemType {
  id: number;
  name: string;
  color: number;
}

export const GAME_CONFIG = {
  // Canvas settings
  width: 720,
  height: 1280,

  // Grid settings
  gridRows: 8,
  gridCols: 8,
  gemSize: 70,
  gemPadding: 5,

  // Grid positioning (centered on screen)
  gridOffsetX: 60,
  gridOffsetY: 300,

  // Gem types (primordial theme)
  gemTypes: [
    { id: 0, name: 'fire', color: 0xff4444 },
    { id: 1, name: 'water', color: 0x4488ff },
    { id: 2, name: 'earth', color: 0x8b6914 },
    { id: 3, name: 'air', color: 0xe8e8e8 },
    { id: 4, name: 'lightning', color: 0xffdd00 },
  ] as GemType[],

  // Animation settings
  swapDuration: 200,
  fallDuration: 300,
  matchDelay: 100,
  clearDuration: 200,
  cascadeDelay: 150,

  // Gem HP
  defaultGemHp: 1,

  // Round settings
  turnsPerRound: 15,

  // Physics
  physics: {
    default: 'arcade' as const,
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },

  // Scene configuration
  backgroundColor: '#1a0a2e',
} as const;

// Mutable debug flags — flip debugStats to true to log per-round balance data
export const DEBUG_CONFIG = {
  debugStats: false,
};
