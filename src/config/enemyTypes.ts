// ─── Enemy Type System ───
// Each named enemy type has a fixed size, color, sprite, and a list of intent definitions.
// Intent countdowns are rolled fresh for each instance on spawn.

export type EnemyIntentType =
  | 'spawnIce'
  | 'spawnStone'
  | 'spreadVines'
  | 'regenerate'
  | 'drainCharge'
  | 'shield';

export interface IntentDef {
  id: EnemyIntentType;
  /** Short label shown on the badge (≤5 chars). */
  label: string;
  /** Hover description — countdown is appended dynamically. */
  tooltip: string;
  intervalMin: number;
  intervalMax: number;
}

export interface EnemyTypeDef {
  /** Matches the suffix of the sprite key, e.g. 'fireImp' → 'enemy-fireImp'. */
  type: string;
  widthInCells: number;
  heightInCells: number;
  /** Body color, shown as fallback and behind the sprite. */
  color: number;
  intents: IntentDef[];
}

export const ENEMY_TYPES: Record<string, EnemyTypeDef> = {
  fireImp: {
    type: 'fireImp',
    widthInCells: 1,
    heightInCells: 2,
    color: 0xcc4444,
    intents: [
      {
        id: 'regenerate',
        label: 'regen',
        tooltip: 'recovers HP',
        intervalMin: 3,
        intervalMax: 5,
      },
    ],
  },

  iceWhelp: {
    type: 'iceWhelp',
    widthInCells: 2,
    heightInCells: 2,
    color: 0x88ccff,
    intents: [
      {
        id: 'spawnIce',
        label: 'ice',
        tooltip: 'spawns an ice hazard',
        intervalMin: 3,
        intervalMax: 4,
      },
    ],
  },

  lightningWraith: {
    type: 'lightningWraith',
    widthInCells: 2,
    heightInCells: 3,
    color: 0xffdd00,
    intents: [
      {
        id: 'drainCharge',
        label: 'drain',
        tooltip: 'drains a power charge',
        intervalMin: 4,
        intervalMax: 5,
      },
    ],
  },

  vineMonster: {
    type: 'vineMonster',
    widthInCells: 3,
    heightInCells: 3,
    color: 0x2d8a4e,
    intents: [
      {
        id: 'spreadVines',
        label: 'vine',
        tooltip: 'spawns a vine hazard',
        intervalMin: 3,
        intervalMax: 4,
      },
    ],
  },

  earthGolem: {
    type: 'earthGolem',
    widthInCells: 3,
    heightInCells: 4,
    color: 0x8b6914,
    intents: [
      {
        id: 'spawnStone',
        label: 'stone',
        tooltip: 'spawns a stone hazard',
        intervalMin: 4,
        intervalMax: 5,
      },
      {
        id: 'shield',
        label: 'shld',
        tooltip: 'shields an adjacent enemy',
        intervalMin: 5,
        intervalMax: 7,
      },
    ],
  },
};
