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

- **Meta powers** — cross-run upgrades or persistent unlocks that carry over between runs
- **Fusion powers** — combining two elements to create hybrid power-ups
- **Bosses** — special high-HP enemies with unique mechanics, likely at milestone rounds
- **Stages** — distinct themed areas with their own enemy pools, modifiers, and progression

### Roguelike Loop

Each **round** = 15 turns. **Essence** is the currency (earned per match, tracked with multipliers via `CascadeSystem` callbacks). Between rounds: `ShopScene` offers powers/passives/slot upgrades using essence. **Power slots** are shared between active powers and passives (start 4, max 8); **passive slots** are stat-only (start 2, max 8).
