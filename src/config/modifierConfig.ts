export type ModifierRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export interface ModifierDef {
  id: string;
  name: string;
  /** 'fire' | 'ice' | 'earth' | 'air' | 'lightning' | 'neutral' */
  element: string;
  /** The powerUpId this modifier requires ('any' for neutral) */
  powerUpId: string;
  rarity: ModifierRarity;
  description: string;
}

const MODIFIERS: ModifierDef[] = [
  // ──────────────── FIRE (fireball) ────────────────
  {
    id: 'fire_kindling',
    name: 'Kindling',
    element: 'fire',
    powerUpId: 'fireball',
    rarity: 'Common',
    description: 'Fireball starts each round with 10 base damage already loaded.',
  },
  {
    id: 'fire_wide_burn',
    name: 'Wide Burn',
    element: 'fire',
    powerUpId: 'fireball',
    rarity: 'Common',
    description: 'Fireball radius +1 (now hits a 7×7 area).',
  },
  {
    id: 'fire_embers',
    name: 'Embers',
    element: 'fire',
    powerUpId: 'fireball',
    rarity: 'Common',
    description: 'Each fire gem match grants +10 extra base to Fireball (on top of normal charge).',
  },
  {
    id: 'fire_heat_retention',
    name: 'Heat Retention',
    element: 'fire',
    powerUpId: 'fireball',
    rarity: 'Common',
    description: "Fire streak doesn't reset if you skip one non-fire turn (grace period of 1).",
  },
  {
    id: 'fire_scorched_earth',
    name: 'Scorched Earth',
    element: 'fire',
    powerUpId: 'fireball',
    rarity: 'Uncommon',
    description: 'Fireball applies Burn: target takes 20% of hit damage per turn for 3 turns.',
  },
  {
    id: 'fire_backdraft',
    name: 'Backdraft',
    element: 'fire',
    powerUpId: 'fireball',
    rarity: 'Uncommon',
    description: 'Fireball also destroys all hazards within the blast radius.',
  },
  {
    id: 'fire_pyromaniac',
    name: 'Pyromaniac',
    element: 'fire',
    powerUpId: 'fireball',
    rarity: 'Uncommon',
    description: 'If fire streak is 3+, Fireball deals +50% damage.',
  },
  {
    id: 'fire_flash_fire',
    name: 'Flash Fire',
    element: 'fire',
    powerUpId: 'fireball',
    rarity: 'Uncommon',
    description: 'Firing Fireball at streak 5+ does not reset the multiplier; only base resets.',
  },
  {
    id: 'fire_conflagration',
    name: 'Conflagration',
    element: 'fire',
    powerUpId: 'fireball',
    rarity: 'Rare',
    description: 'Burn spreads: enemies sharing a row with a Burning enemy also catch Burn at 50% potency.',
  },
  {
    id: 'fire_wildfire',
    name: 'Wildfire',
    element: 'fire',
    powerUpId: 'fireball',
    rarity: 'Rare',
    description: 'Streak never fully resets; instead it decays by 1 per non-fire turn (minimum 1).',
  },
  {
    id: 'fire_nova',
    name: 'Nova',
    element: 'fire',
    powerUpId: 'fireball',
    rarity: 'Rare',
    description: 'Once per round, if streak is 10+, Fireball hits the entire board at 50% damage.',
  },

  // ──────────────── ICE (icelance) ────────────────
  {
    id: 'ice_cold_snap',
    name: 'Cold Snap',
    element: 'ice',
    powerUpId: 'icelance',
    rarity: 'Common',
    description: 'Ice Lance starts each round with 10 base damage already loaded.',
  },
  {
    id: 'ice_frostbite',
    name: 'Frostbite',
    element: 'ice',
    powerUpId: 'icelance',
    rarity: 'Common',
    description: 'Ice Lance applies Chill to the target (intent delayed +1 turn).',
  },
  {
    id: 'ice_permafrost',
    name: 'Permafrost',
    element: 'ice',
    powerUpId: 'icelance',
    rarity: 'Common',
    description: 'Each ice gem match grants +1 extra base to Ice Lance.',
  },
  {
    id: 'ice_heavy_impact',
    name: 'Heavy Impact',
    element: 'ice',
    powerUpId: 'icelance',
    rarity: 'Common',
    description: 'Base damage is doubled if the target enemy occupies 4+ tiles.',
  },
  {
    id: 'ice_glacial_wrath',
    name: 'Glacial Wrath',
    element: 'ice',
    powerUpId: 'icelance',
    rarity: 'Uncommon',
    description: 'Hazards on the board each add +1 multiplier to Ice Lance (in addition to enemy tiles).',
  },
  {
    id: 'ice_hypothermia',
    name: 'Hypothermia',
    element: 'ice',
    powerUpId: 'icelance',
    rarity: 'Uncommon',
    description: 'Chill lasts 2 turns instead of 1.',
  },
  {
    id: 'ice_cryo_lock',
    name: 'Cryo-Lock',
    element: 'ice',
    powerUpId: 'icelance',
    rarity: 'Uncommon',
    description: 'Chilled enemies take 25% more damage from all sources.',
  },
  {
    id: 'ice_cold_front',
    name: 'Cold Front',
    element: 'ice',
    powerUpId: 'icelance',
    rarity: 'Uncommon',
    description: 'If 3+ enemies are alive when Ice Lance fires, hit 2 random enemies instead of 1.',
  },
  {
    id: 'ice_blizzard',
    name: 'Blizzard',
    element: 'ice',
    powerUpId: 'icelance',
    rarity: 'Rare',
    description: 'Ice Lance hits ALL living enemies at 40% damage instead of one random target.',
  },
  {
    id: 'ice_absolute_zero',
    name: 'Absolute Zero',
    element: 'ice',
    powerUpId: 'icelance',
    rarity: 'Rare',
    description: 'If multiplier is 6+, applies Freeze instead of Chill (enemy intent delayed 5 turns).',
  },
  {
    id: 'ice_ice_shards',
    name: 'Ice Shards',
    element: 'ice',
    powerUpId: 'icelance',
    rarity: 'Rare',
    description: 'Ice gem matches have a 50% chance to deal Ice Lance damage to one random tile of a random enemy.',
  },
  {
    id: 'ice_avalanche',
    name: 'Avalanche',
    element: 'ice',
    powerUpId: 'icelance',
    rarity: 'Rare',
    description: 'Ice Lance always targets the largest enemy (most tiles) instead of random.',
  },

  // ──────────────── EARTH (earthquake) ────────────────
  {
    id: 'earth_seismic',
    name: 'Seismic',
    element: 'earth',
    powerUpId: 'earthquake',
    rarity: 'Common',
    description: 'Earthquake starts each round with 10 base damage already loaded.',
  },
  {
    id: 'earth_aftershock',
    name: 'Aftershock',
    element: 'earth',
    powerUpId: 'earthquake',
    rarity: 'Common',
    description: 'Earthquake hits 5 additional random tiles (25 total).',
  },
  {
    id: 'earth_rubble',
    name: 'Rubble',
    element: 'earth',
    powerUpId: 'earthquake',
    rarity: 'Common',
    description: 'Earthquake has a 25% chance to destroy each hazard it hits.',
  },
  {
    id: 'earth_slow_build',
    name: 'Slow Build',
    element: 'earth',
    powerUpId: 'earthquake',
    rarity: 'Common',
    description: 'Each earth gem match grants +10 extra base to Earthquake.',
  },
  {
    id: 'earth_tremor',
    name: 'Tremor',
    element: 'earth',
    powerUpId: 'earthquake',
    rarity: 'Uncommon',
    description: 'Earthquake applies Stun to all enemies it hits (their intent is paused until the next turn).',
  },
  {
    id: 'earth_fault_line',
    name: 'Fault Line',
    element: 'earth',
    powerUpId: 'earthquake',
    rarity: 'Uncommon',
    description: 'Earthquake always destroys all hazards on the board if multiplier is 10+.',
  },
  {
    id: 'earth_patient_earth',
    name: 'Patient Earth',
    element: 'earth',
    powerUpId: 'earthquake',
    rarity: 'Uncommon',
    description: 'Patience multiplier grows 2× faster (+2 per waiting turn instead of +1).',
  },
  {
    id: 'earth_richter_scale',
    name: 'Richter Scale',
    element: 'earth',
    powerUpId: 'earthquake',
    rarity: 'Rare',
    description: 'Each hazard destroyed by Earthquake permanently adds +5 to its base for the rest of the round.',
  },
  {
    id: 'earth_continental_drift',
    name: 'Continental Drift',
    element: 'earth',
    powerUpId: 'earthquake',
    rarity: 'Rare',
    description: 'Earthquake hits ALL tiles on the board.',
  },
  {
    id: 'earth_bedrock',
    name: 'Bedrock',
    element: 'earth',
    powerUpId: 'earthquake',
    rarity: 'Rare',
    description: 'While Earthquake has 10+ multiplier stacked, spending your last turn grants 5 more turns instead (once per round).',
  },
  {
    id: 'earth_sinkhole',
    name: 'Sinkhole',
    element: 'earth',
    powerUpId: 'earthquake',
    rarity: 'Rare',
    description: 'Tiles hit by Earthquake that had no enemy or hazard become stone hazards; half of base and multiplier is refunded.',
  },

  // ──────────────── LIGHTNING (chainstrike) ────────────────
  {
    id: 'lightning_charged',
    name: 'Charged',
    element: 'lightning',
    powerUpId: 'chainstrike',
    rarity: 'Common',
    description: 'Chain Strike starts each round with 10 base damage already loaded.',
  },
  {
    id: 'lightning_extended_chain',
    name: 'Extended Chain',
    element: 'lightning',
    powerUpId: 'chainstrike',
    rarity: 'Common',
    description: 'Chain Strike hits 7 more tiles (21 total).',
  },
  {
    id: 'lightning_static_buildup',
    name: 'Static Buildup',
    element: 'lightning',
    powerUpId: 'chainstrike',
    rarity: 'Common',
    description: 'Each lightning gem match grants +10 extra base to Chain Strike.',
  },
  {
    id: 'lightning_conductor',
    name: 'Conductor',
    element: 'lightning',
    powerUpId: 'chainstrike',
    rarity: 'Common',
    description: 'Chain Strike destroys shields on enemies before it deals damage.',
  },
  {
    id: 'lightning_thunderstruck',
    name: 'Thunderstruck',
    element: 'lightning',
    powerUpId: 'chainstrike',
    rarity: 'Uncommon',
    description: 'Chain Strike applies Shock to every enemy it passes through (50% less intent effect this turn).',
  },
  {
    id: 'lightning_overload',
    name: 'Overload',
    element: 'lightning',
    powerUpId: 'chainstrike',
    rarity: 'Uncommon',
    description: 'Chain Strike deals +75% damage if 2+ intents are currently active on the target enemy.',
  },
  {
    id: 'lightning_arc_flash',
    name: 'Arc Flash',
    element: 'lightning',
    powerUpId: 'chainstrike',
    rarity: 'Uncommon',
    description: 'After Chain Strike fires, three random hazards on the board are immediately destroyed.',
  },
  {
    id: 'lightning_faraday_shield',
    name: 'Faraday Shield',
    element: 'lightning',
    powerUpId: 'chainstrike',
    rarity: 'Uncommon',
    description: 'Once per round, negate the first healing or shielding intent that resolves; gain +10 multiplier to Chain Strike.',
  },
  {
    id: 'lightning_discharge',
    name: 'Discharge',
    element: 'lightning',
    powerUpId: 'chainstrike',
    rarity: 'Rare',
    description: "Enemies hit by Chain Strike have their next intent backfire (spawn destroys a hazard; heal damages them instead).",
  },
  {
    id: 'lightning_ball_lightning',
    name: 'Ball Lightning',
    element: 'lightning',
    powerUpId: 'chainstrike',
    rarity: 'Rare',
    description: 'Chain Strike bounces randomly until it reaches an enemy tile, guaranteeing at least one enemy hit.',
  },
  {
    id: 'lightning_emp',
    name: 'EMP',
    element: 'lightning',
    powerUpId: 'chainstrike',
    rarity: 'Rare',
    description: 'The first Chain Strike each round cancels ALL active intents on every enemy it hits.',
  },

  // ──────────────── AIR (gust) ────────────────
  {
    id: 'air_headwind',
    name: 'Headwind',
    element: 'air',
    powerUpId: 'gust',
    rarity: 'Common',
    description: 'Gust starts each round with 10 base damage already loaded.',
  },
  {
    id: 'air_turbulence',
    name: 'Turbulence',
    element: 'air',
    powerUpId: 'gust',
    rarity: 'Common',
    description: 'Each cascade in a turn adds +2 multiplier to Gust instead of the normal amount.',
  },
  {
    id: 'air_crosswind',
    name: 'Crosswind',
    element: 'air',
    powerUpId: 'gust',
    rarity: 'Uncommon',
    description: 'Gust hits an additional perpendicular row and column (+1 extra row and column).',
  },
  {
    id: 'air_tailwind',
    name: 'Tailwind',
    element: 'air',
    powerUpId: 'gust',
    rarity: 'Uncommon',
    description: 'Gust applies Haste to all enemies hit (their next intent speeds up by 1 turn, min 1).',
  },
  {
    id: 'air_eye_of_storm',
    name: 'Eye of the Storm',
    element: 'air',
    powerUpId: 'gust',
    rarity: 'Uncommon',
    description: 'If Gust triggers 3+ cascades, trigger an automatic board reshuffle after settling.',
  },
  {
    id: 'air_cyclone',
    name: 'Cyclone',
    element: 'air',
    powerUpId: 'gust',
    rarity: 'Uncommon',
    description: 'Gust fires a second smaller cross (3×3) centred on a random tile after the main blast.',
  },
  {
    id: 'air_supercell',
    name: 'Supercell',
    element: 'air',
    powerUpId: 'gust',
    rarity: 'Rare',
    description: 'Gust also destroys all hazards on the board (swept away by the wind).',
  },
  {
    id: 'air_jet_stream',
    name: 'Jet Stream',
    element: 'air',
    powerUpId: 'gust',
    rarity: 'Rare',
    description: "Gust's cascade multiplier doesn't fully reset between turns; it retains 50% going into the next turn.",
  },
  {
    id: 'air_hurricane',
    name: 'Hurricane',
    element: 'air',
    powerUpId: 'gust',
    rarity: 'Rare',
    description: 'If Gust triggers 5+ cascades this turn, it fires a second time automatically at 50% damage.',
  },
  {
    id: 'air_twister',
    name: 'Twister',
    element: 'air',
    powerUpId: 'gust',
    rarity: 'Rare',
    description: 'After Gust fires, convert all gems of the least-common element on the board into air gems.',
  },

  // ──────────────── NEUTRAL (any) ────────────────
  {
    id: 'neutral_headstart',
    name: 'Headstart',
    element: 'neutral',
    powerUpId: 'any',
    rarity: 'Common',
    description: 'All powers begin each round with 20 base damage already loaded.',
  },
  {
    id: 'neutral_efficiency',
    name: 'Efficiency',
    element: 'neutral',
    powerUpId: 'any',
    rarity: 'Common',
    description: 'Match-4s grant +30 base to your lowest-charged power.',
  },
  {
    id: 'neutral_scavenger',
    name: 'Scavenger',
    element: 'neutral',
    powerUpId: 'any',
    rarity: 'Common',
    description: 'Destroying a hazard grants +10 base to a random owned power.',
  },
  {
    id: 'neutral_momentum',
    name: 'Momentum',
    element: 'neutral',
    powerUpId: 'any',
    rarity: 'Common',
    description: 'Firing any power grants +5 base to every other power you own.',
  },
  {
    id: 'neutral_synergy',
    name: 'Synergy',
    element: 'neutral',
    powerUpId: 'any',
    rarity: 'Uncommon',
    description: 'Each distinct element power you own grants +1 multiplier to all powers at round start.',
  },
  {
    id: 'neutral_opportunist',
    name: 'Opportunist',
    element: 'neutral',
    powerUpId: 'any',
    rarity: 'Uncommon',
    description: 'Each enemy that dies grants +10 base to your currently highest-charged power.',
  },
  {
    id: 'neutral_double_tap',
    name: 'Double Tap',
    element: 'neutral',
    powerUpId: 'any',
    rarity: 'Rare',
    description: 'Once per round, the first power you fire also fires a second time at 30% damage.',
  },
  {
    id: 'neutral_elemental_surge',
    name: 'Elemental Surge',
    element: 'neutral',
    powerUpId: 'any',
    rarity: 'Rare',
    description: 'Every 5th match-3 this round auto-fires your highest-charged power at a random target for free.',
  },
  {
    id: 'neutral_chain_reaction',
    name: 'Chain Reaction',
    element: 'neutral',
    powerUpId: 'any',
    rarity: 'Rare',
    description: 'Firing any power has a 25% chance to grant +25 base to a random other power.',
  },
  {
    id: 'neutral_match_memory',
    name: 'Match Memory',
    element: 'neutral',
    powerUpId: 'any',
    rarity: 'Epic',
    description: 'Match-3s count as match-4s for all base and multiplier accumulation purposes.',
  },
  {
    id: 'neutral_elemental_harmony',
    name: 'Elemental Harmony',
    element: 'neutral',
    powerUpId: 'any',
    rarity: 'Epic',
    description: 'Once you own all 5 element powers, all powers permanently deal +50% damage.',
  },
  {
    id: 'neutral_power_surge',
    name: 'Power Surge',
    element: 'neutral',
    powerUpId: 'any',
    rarity: 'Epic',
    description: 'After killing any enemy, all your powers receive multiplier equal to kill count × 2 this round.',
  },
];

const MODIFIER_MAP = new Map<string, ModifierDef>(MODIFIERS.map(m => [m.id, m]));

export function getAllModifiers(): ModifierDef[] {
  return MODIFIERS;
}

export function getModifierDef(id: string): ModifierDef | undefined {
  return MODIFIER_MAP.get(id);
}

export function getModifiersByElement(element: string): ModifierDef[] {
  return MODIFIERS.filter(m => m.element === element);
}

export function getModifiersByPowerUp(powerUpId: string): ModifierDef[] {
  return MODIFIERS.filter(m => m.powerUpId === powerUpId);
}

/** Rarity weights for random selection */
export const RARITY_WEIGHT: Record<ModifierRarity, number> = {
  Common:    50,
  Uncommon:  30,
  Rare:      10,
  Epic:       5,
  Legendary:  1,
};

/** Weight used for powers in the shop pool (1.5× Common) */
export const POWER_SHOP_WEIGHT = 75;
