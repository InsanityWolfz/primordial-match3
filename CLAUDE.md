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

**RunState** (`src/types/RunState.ts`) — persistent run data: essence, owned powers, slot counts. Lives in `ShopScene` and is passed into `GameScene` each round.

**DamageSystem** (`src/systems/DamageSystem.ts`) — all destructive actions go through here. Priority: enemy tile → hazard → gem. Never bypass this for destruction logic.

**CascadeSystem** (`src/systems/CascadeSystem.ts`) — match detection, gem removal, gravity. Fires callbacks (`onMatchGroupCb`) for essence tracking and post-match passives. The cascade chain calls back into `GameScene` after settling.

**PowerUpExecutor** (`src/systems/PowerUpExecutor.ts`) — dispatches to element-specific executors in `src/systems/powers/`. Each element (Fire/Water/Earth/Air/Lightning/Nature) has its own file. Adding a new element means: add config in `src/config/powers/`, add an executor in `src/systems/powers/`, register in the dispatcher.

### Grid

8×8 gem grid (70px per cell, 5px padding). Enemy positions are tracked in a parallel 2D array on `Grid` — enemies are overlays, not grid occupants. Gems fall through enemy tiles; enemies are never "on" a gem.

### Config is Data-Driven

- `src/config/powers/` — per-element power definitions (cost, targeting, effects)
- `src/config/enemyConfig.ts` / `enemyTraits.ts` — spawn pools, traits (warded, shielded)
- `src/config/shopConfig.ts` — shop costs, reroll escalation
- `src/config/roundModifiers.ts` — per-round essence multipliers and effects

Balance changes belong in config files, not in system logic.

## Planned Next Features

### Progression Structure (do not implement until ready)

The run is divided into **Stages** of 5 rounds each. Each stage is randomly themed to an element (Fire, Water, Earth, etc.) affecting its enemy pool, hazard types, and round modifiers. The full loop looks like this:

```
Rounds  1– 5  →  Stage 1 (random element theme)  →  Boss fight
Rounds  6–10  →  Stage 2                          →  Boss fight  →  Meta Power granted
Rounds 11–15  →  Stage 3                          →  Boss fight  →  Meta Power granted
Rounds 16–20  →  Stage 4                          →  Boss fight  →  Meta Power granted
Round  20     →  Fusion event (combine two elements into a hybrid power)
Rounds 21+    →  Endless scaling (enemy HP ×1.5/round, no new content cap)
Round  ~30    →  Bonus boss for players still alive at this point
```

**Bosses** appear at the end of every 5-round stage. They are special enemies with:
- Much higher HP than normal enemies
- Unique periodic effects every few turns (e.g. spawn hazards, shield all enemies, drain player charges, randomise gem colors)
- Possibly multi-phase (behaviour changes at 50% HP)

**Meta Powers** are granted (not purchased) after each boss kill from round 5 onward. They are board-level rule changers with no element theme — examples:
- All match-3s count as match-4s
- One element is replaced by another for the rest of the run
- Every power activation fires twice
- Unspent charges convert to essence at round end
- Match-5+ destroys an entire row
These are permanent passive modifiers that stack across the run (4 total by round 20).

**Fusion Powers** — around round 20, the player combines two of their owned element powers into a single hybrid power-up with combined effects.

**Stages** are the named unit of progression (e.g. "Stage 1 — Fire Wastes"). Each stage has a themed enemy color palette, preferred hazard type, and a unique round modifier pool.

### Other Planned Work
- Content registry spreadsheet to track all powers/enemies/hazards as content is added

### Roguelike Loop

Each **round** = 15 turns. **Essence** is the currency (earned per match, tracked with multipliers via `CascadeSystem` callbacks). Between rounds: `ShopScene` offers powers/passives/slot upgrades using essence. **Power slots** are shared between active powers and passives (start 4, max 8); **passive slots** are stat-only (start 2, max 8).
