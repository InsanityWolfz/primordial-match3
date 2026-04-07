# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server for local development
npm run build     # TypeScript compile + Vite production bundle
npm run preview   # Preview production build locally
```

No test runner is configured. TypeScript strict mode is on (`noUnusedLocals`, `noUnusedParameters`) — the build will fail on unused variables.

## Architecture

**Phaser 3 + TypeScript match-3 roguelike** deployed to GitHub Pages (base path `/primordial-match3/`).

### Scene Flow
`BootScene` → `StarterScene` (pick starter power) → `GameScene` ↔ `ShopScene` (loop per round) → `FailScene`

### Key Patterns

**GameContext** (`src/types/GameContext.ts`) — a single context object passed to every system and executor. This is the primary coupling mechanism; when adding new systems, extend this interface.

**RunState** (`src/types/RunState.ts`) — persistent run data: round number, owned powers, owned modifiers. No essence or slot counts. Passed via `scene.start(key, data)`.

**DamageSystem** (`src/systems/DamageSystem.ts`) — all destructive actions go through here. Priority: enemy tile → hazard → gem. Never bypass this for destruction logic.

**CascadeSystem** (`src/systems/CascadeSystem.ts`) — match detection, gem removal, gravity. Fires callbacks (`onMatchGroupCb`) after each settled cascade. Calls back into `GameScene` after settling.

**PowerUpExecutor** (`src/systems/PowerUpExecutor.ts`) — dispatches to element-specific executors in `src/systems/powers/`. Adding a new element means: add config in `src/config/powers/`, add an executor in `src/systems/powers/`, register in the dispatcher.

**PassiveManager** (`src/systems/PassiveManager.ts`) — stub with hook signatures preserved. All hooks currently return zero/false defaults. The modifier system will populate these hooks when built.

### Grid

8×8 gem grid (70px per cell, 5px padding). Enemy positions are tracked in a parallel 2D array on `Grid` — enemies are overlays, not grid occupants. Gems fall through enemy tiles; enemies are never "on" a gem.

### Power System

Powers have a flat definition — no levels. All scaling comes from **modifiers** (applied via the shop between rounds).

```ts
interface PowerUpDefinition {
  id: string;
  name: string;
  element: string;          // 'fire' | 'ice' | 'earth' | 'air' | 'lightning'
  category: PowerCategory;  // 'activePower'
  needsTarget?: boolean;
  description: string;
  params: Record<string, number>;
}
```

Each owned power tracks accumulated charge:
```ts
interface OwnedPowerUp {
  powerUpId: string;
  base: number;           // accumulated from element gem matches
  multiplierPool: number; // accumulated from match-4/5 or theme mechanics
}
```

`computedDamage = base × max(1, multiplierPool)`. Both reset to 0 after firing.

### Current Powers (5)

| ID | Name | Element | Targeting | Effect |
|----|------|---------|-----------|--------|
| `fireball` | Fireball | Fire | Targeted | 5×5 area blast around target tile |
| `icelance` | Ice Lance | Ice | Untargeted | Random enemy; each tile they occupy takes damage |
| `earthquake` | Earthquake | Earth | Untargeted | Shuffles board, strikes 20 random tiles |
| `gust` | Gust | Air | Targeted | Full row + full column of target tile (cross pattern) |
| `chainstrike` | Chain Strike | Lightning | Targeted | Zig-zag chain through 14 tiles from target |

### Elements (5)

`fire`, `ice`, `earth`, `air`, `lightning` — each has a gem type in `GAME_CONFIG.gemTypes` and a corresponding power executor.

### Shop (Choice-Based)

Between rounds, `ShopScene` offers 3 random powers the player doesn't own yet. Player picks 1 for free (or skips). One free reroll per visit. No essence, no costs.

### Config is Data-Driven

- `src/config/powers/` — per-element power definitions
- `src/config/enemyConfig.ts` / `enemyTraits.ts` — spawn pools, traits (warded, shielded)
- `src/config/gameConfig.ts` — grid constants, gem types, animation timings
- `src/config/roundModifiers.ts` — per-round effects (not yet populated)

Balance changes belong in config files, not in system logic.

---

## Next Things to Build

### 1. Softlock Prevention
A "softlock" occurs when: the player has no `base > 0` on any power (can't fire), AND the board has no valid matches (all gem positions blocked by enemies/hazards). The player would be stuck.

Approaches to consider:
- Emergency shuffle button that costs a turn (always available)
- Guaranteed match detection after each gravity settle — if no matches exist, trigger a board reshuffle automatically
- Earthquake's board shuffle already helps; ensure it's always fireable as a last resort (give it 1 free base if all powers are at 0)

### 2. Nature Power
No Nature power is implemented yet. The element was planned but never designed. Before implementing, decide on the theme, charge mechanic, and what it targets. See `docs/modifiers.md` for modifier design context.

### 3. Modifier System
`PassiveManager` has stub hooks. The modifier system will attach effects to these hooks based on which modifiers the player has collected. Modifiers are granted in the shop (separate from the power choice). See `docs/modifiers.md` for the full design.

---

## Planned Progression Structure (do not implement until ready)

Runs are divided into **Stages** of 5 rounds each, each themed to a random element.

```
Rounds  1– 5  →  Stage 1  →  Boss fight
Rounds  6–10  →  Stage 2  →  Boss fight  →  Meta Power granted
Rounds 11–15  →  Stage 3  →  Boss fight  →  Meta Power granted
Rounds 16–20  →  Stage 4  →  Boss fight  →  Meta Power granted
Round  20     →  Fusion event (combine two element powers into one hybrid)
Rounds 21+    →  Endless scaling
```

**Bosses** — high HP, periodic board effects (spawn hazards, shield enemies, drain charges, randomise gem colors). Possibly multi-phase.

**Meta Powers** — granted (not picked) after boss kills. Board-level rule changers: match-3s count as match-4s, one element replaced by another, powers fire twice, etc. Stack across the run (4 total by round 20). These are the "Epic/Neutral" tier described in `docs/modifiers.md`.

**Fusion Powers** — player combines two owned element powers into a single hybrid. Merges base, multiplier potential, and available modifiers from both. Frees up a power slot.
