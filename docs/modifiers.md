# Modifier Design

Modifiers are permanent upgrades applied to powers between rounds. They are distinct from powers themselves — powers are the action, modifiers change how that action charges, fires, or what it does on top of damage.

**Rarity tiers:** Common → Uncommon → Rare → Epic → Legendary

---

## How Charges Work (per element theme)

Each element has a thematic charging identity that modifiers build on:

| Element | Base charges from | Multiplier charges from |
|---------|-------------------|------------------------|
| **Fire** | Fire gem matches | Consecutive fire match streak (resets on non-fire turn) |
| **Ice** | Ice gem matches | Number of living enemies on board at fire time |
| **Earth** | Earth gem matches | Turns waited without firing Earthquake (patience) |
| **Lightning** | Lightning gem matches | Number of active enemy intents at fire time |
| **Air** | Air gem matches | Cascades triggered in the current turn |

### Fire Streak Detail
- Streak starts at x1, +x1 per subsequent fire match turn
- Match-4 fire: +x3 to streak instead of +x1
- Match-5 fire: +x10 to streak instead of +x1
- Any turn with no fire match: streak resets to 0 (multiplier lost)

### Air Cascade Detail
- Multiplier resets each turn (incentivises setting up big cascade turns)
- Each cascade in a single turn adds +1 multiplier (base behavior, modifiable)

---

## Element Debuffs

Each element can apply a status effect to enemies. Debuffs are added via modifiers, not built into base powers.

| Element | Debuff | Effect |
|---------|--------|--------|
| **Fire** | **Burn** | Enemy takes X% of the hit damage per turn for 3 turns (damage over time) |
| **Ice** | **Chill** | Enemy's next intent delayed by +1 turn (countdown extended) |
| **Ice** (rare) | **Freeze** | Enemy skips their next intent entirely |
| **Earth** | **Stun** | Enemy's next intent is cancelled (they lose the action, not just delayed) |
| **Lightning** | **Shock** | Enemy's next intent deals 50% less damage |
| **Lightning** (rare) | **Discharge** | Enemy's next intent damage is reflected back at them |
| **Air** | **Scatter** | Shuffles the target positions of one enemy intent randomly |
| **Air** (rare) | **Knockback** | Pushes gems in the hit row to random positions (seeds cascades) |

---

## Fire Modifiers — Fireball

**Theme:** Hot streak. Base from fire gems. Multiplier from unbroken consecutive fire match turns.

### Common
- **Kindling** — Fireball starts each round with 10 base damage already loaded
- **Wide Burn** — Fireball radius +1 (now hits a 7×7 area)
- **Embers** — Each fire gem match also grants +1 extra base (on top of the normal charge)
- **Heat Retention** — Streak doesn't reset if you skip one non-fire turn (grace period of 1)

### Uncommon
- **Scorched Earth** — Fireball applies Burn: target takes 10% of hit damage/turn for 3 turns
- **Backdraft** — Fireball also destroys all hazards within the blast radius
- **Pyromaniac** — If streak is x3+, Fireball deals +50% damage
- **Flash Fire** — Firing Fireball at streak x5+ does not reset the streak; only base resets

### Rare
- **Conflagration** — Burn spreads: enemies adjacent to a Burning enemy also catch Burn at 50% potency
- **Chain Reaction** — Gems destroyed by Fireball's blast are counted as matched, triggering cascades
- **Wildfire** — Streak never fully resets; instead it decays by -x1 per non-fire turn (minimum x1)
- **Nova** — Once per round, if streak is x10+, Fireball hits the entire board at 50% damage

### Epic
*(Combined effects from Fusion — design later)*

### Legendary
- **Primordial Flame** — Streak adds simultaneously to both base AND multiplier each fire match turn

---

## Ice Modifiers — Ice Lance

**Theme:** Danger. More enemies = more multiplier. Targets random enemy; each tile they occupy takes damage.

### Common
- **Cold Snap** — Ice Lance starts each round with 10 base damage already loaded
- **Frostbite** — Ice Lance applies Chill to the target (intent delayed +1 turn)
- **Permafrost** — Each ice gem match also grants +1 extra base
- **Heavy Impact** — Base damage is doubled if the target enemy occupies 4+ tiles

### Uncommon
- **Glacial Wrath** — Hazards on the board also each add +1 multiplier (in addition to enemies)
- **Hypothermia** — Chill lasts 2 turns instead of 1
- **Cryo-Lock** — Chilled enemies take 25% more damage from all sources
- **Cold Front** — If 3+ enemies are alive when Ice Lance fires, hit 2 random enemies instead of 1

### Rare
- **Blizzard** — Ice Lance hits ALL living enemies at 40% damage instead of one random target
- **Absolute Zero** — If multiplier is 6+, applies Freeze instead of Chill (enemy skips next intent)
- **Permafrost Field** — Ice gem matches have a 25% chance to destroy a random hazard
- **Avalanche** — Ice Lance always targets the largest enemy (most tiles) instead of random

### Epic
*(Combined effects from Fusion — design later)*

### Legendary
- **Glacier Heart** — Ice Lance's multiplier is now permanent across rounds (doesn't reset at round start); it can only grow, never shrink

---

## Earth Modifiers — Earthquake

**Theme:** Patience. Wait for the right moment, clear out your options, then hit for enormous damage and reshuffle.

### Common
- **Seismic** — Earthquake starts each round with 10 base damage already loaded
- **Aftershock** — Earthquake hits 5 additional random tiles (25 total)
- **Rubble** — Earthquake has a 50% chance to destroy each hazard it hits
- **Slow Build** — Each earth gem match also grants +1 extra base

### Uncommon
- **Tremor** — Earthquake applies Stun to all enemies it hits (they lose their next intent)
- **Fault Line** — Earthquake always destroys all hazards on the board (not just what it hits)
- **Tectonic Shift** — The board reshuffle after Earthquake guarantees at least one valid match-3
- **Patient Earth** — Patience multiplier grows 2x faster (+2 per waiting turn instead of +1)

### Rare
- **Richter Scale** — Each hazard destroyed by Earthquake permanently adds +5 to its base for the rest of the run
- **Continental Drift** — Earthquake hits ALL tiles on the board
- **Bedrock** — While Earthquake has 10+ multiplier stacked, the first lethal intent each round leaves you at 1 HP instead
- **Sinkholes** — Tiles hit by Earthquake that don't contain enemies or hazards become new hazards (boosts Ice multiplier)

### Epic
*(Combined effects from Fusion — design later)*

### Legendary
- **World Shaker** — Earthquake's patience multiplier never resets on fire. It halves instead, and continues growing from there

---

## Lightning Modifiers — Chain Strike

**Theme:** Counter-attack. Weak at the start of a round, terrifying when enemies are primed to act.

### Common
- **Charged** — Chain Strike starts each round with 10 base damage already loaded
- **Extended Chain** — Chain Strike hits 4 more tiles (18 total)
- **Static Buildup** — Each lightning gem match also grants +1 extra base
- **Conductor** — Chain Strike ignores shields on the first tile it hits

### Uncommon
- **Thunderstruck** — Chain Strike applies Shock to every enemy it passes through (50% less intent damage)
- **Overload** — Chain Strike deals +75% damage if 3+ intents are currently active
- **Arc Flash** — After Chain Strike fires, the next enemy intent costs you 0 turns to resolve
- **Faraday Shield** — Once per round, the first intent that would damage you is blocked and instead grants +2 multiplier to Chain Strike

### Rare
- **Surge Protector** — Each intent blocked by Faraday Shield permanently adds +5 base to Chain Strike for the run
- **Discharge** — Enemies hit by Chain Strike deal their full intent damage back to themselves instead of you
- **Ball Lightning** — Chain Strike bounces randomly until it reaches an enemy tile, guaranteeing at least one enemy hit regardless of start position
- **Electromagnetic Pulse** — Chain Strike cancels ALL active intents on hit (not just Shocks them — full cancellation)

### Epic
*(Combined effects from Fusion — design later)*

### Legendary
- **Storm God** — Chain Strike's multiplier is based on total intents fired this run (not just active ones) — scales infinitely across the run

---

## Air Modifiers — Gust

**Theme:** Cascades. Set up the board, then let Gust clean it up and chain into massive cascade turns.

### Common
- **Headwind** — Gust starts each round with 10 base damage already loaded
- **Crosswind** — Gust hits an additional perpendicular row and column (+1 row and +1 column)
- **Turbulence** — Each cascade in a turn adds +2 multiplier instead of +1
- **Windfall** — After Gust fires, all gems in cleared columns slide to center, pushing tiles together

### Uncommon
- **Tailwind** — Gust applies Scatter to all enemies hit (their next intent targets a random tile instead of you)
- **Vortex** — After Gust clears its cross, new gems immediately spawn at board edges in the cleared row/column, seeding new cascade opportunities
- **Eye of the Storm** — If Gust triggers 3+ cascades, trigger an automatic board reshuffle after settling
- **Cyclone** — Before destroying, Gust rotates all gems in the blast area clockwise one position, seeding matches

### Rare
- **Supercell** — Gust also destroys all hazards on the board (swept away by the wind)
- **Jet Stream** — Cascade multiplier doesn't fully reset between turns; it retains 50% of its value going into the next turn
- **Hurricane** — If Gust triggers 5+ cascades, it fires a second time automatically at 50% damage
- **Twister** — Gust randomly relocates 8 gems to new empty positions on the board before firing, seeding cascade chains

### Epic
*(Combined effects from Fusion — design later)*

### Legendary
- **Primordial Wind** — Gust fires once for every cascade that happened last turn (minimum 1). Each instance deals full computed damage

---

## Neutral Modifiers

Neutral modifiers have no element affinity. They affect multiple powers, board rules, or run-wide mechanics.

### Common
- **Headstart** — All powers begin each round with 5 base damage already loaded
- **Efficiency** — Match-4s grant +3 base to your lowest-charged power (instead of +2)
- **Scavenger** — Destroying a hazard grants +2 base to a random owned power
- **Momentum** — Firing any power grants +1 base to every other power you own

### Uncommon
- **Synergy** — Each distinct element power you own grants +1 multiplier to all powers at round start
- **Volatile** — If you fire two powers in the same round, the second deals +50% damage
- **Overflow** — If any power hits 10+ base without firing, excess base converts to multiplier at 2:1
- **Opportunist** — Each enemy that dies grants +3 base to your currently highest-charged power

### Rare
- **Double Tap** — Once per round, the first power you fire also fires a second time at 30% damage
- **Elemental Surge** — Every 5th match-3 (across all elements, tracked across the round) auto-fires your highest-charged power
- **Chain Reaction (Neutral)** — Firing any power has a 25% chance to grant +5 base to a random other power
- **Overkill** — Damage dealt beyond an enemy's remaining HP is split equally among all other enemies

### Epic / Meta (Board-Level — granted via boss kills, not the shop)
These are the "Meta Powers" granted after boss fights. Not pickable from normal shop offerings.

- **Match Memory** — Match-3s count as match-4s for all charge and essence purposes
- **Elemental Harmony** — Once you own all 5 element powers, all powers permanently deal +25% damage
- **Power Surge** — After killing any enemy, all your powers receive base equal to the kill count this round
- **Chain Mastery** — Every 3rd cascade you trigger this run permanently adds +1 to all cascade multiplier gains

### Legendary
- **Primordial Awakening** — All your powers fire simultaneously when any one is activated (each at 40% damage)
- **Endless Storm** — Powers no longer reset base and multiplier after firing; they accumulate across rounds
- **World Ender** — Match-3s of any element deal bonus damage to a random enemy equal to match length × round number

---

## Fusion Powers (Late Game — Round ~20)

Fusion combines two owned element powers into a single slot. The fused power:
- Charges from **both** elements' gem matches
- Has access to **all modifiers** from both source powers
- `computedDamage = (base1 + base2) × max(1, multiplierPool1 + multiplierPool2)`
- Fires the effect of **both** source powers sequentially in one activation

Example fusions to design later:
- **Fireball + Chain Strike** → "Thunderfire" — chain of fire tiles that each explode in a small AoE
- **Gust + Ice Lance** → "Polar Vortex" — clears cross pattern AND hits a random enemy per cleared tile
- **Earthquake + Fireball** → "Magma Surge" — shuffles board, hits random tiles, each tile hit explodes in small AoE

---

## Implementation Notes

### PassiveManager hooks to wire when implementing modifiers:
- `onGemDestroyed(element)` — for "Scavenger", per-element base bonuses
- `onMatchCompleted(element, length)` — for streak tracking, cascade tracking, bonus base/multiplier
- `onDamageDealt(element, amount, powerId)` — for Burn/Chill/Shock application
- `onTurnConsumed()` — for patience multiplier growth, streak decay
- `onHazardDestroyed(row, col)` — for "Richter Scale", hazard-to-multiplier modifiers
- `onEarthquakeUsed()` — earth-specific hooks

### Modifier data structure (proposed):
```ts
interface ModifierDefinition {
  id: string;
  name: string;
  element: string | 'neutral';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  targetPower?: string;   // which power ID this applies to (omit for global modifiers)
  description: string;
  params: Record<string, number>;
}
```

Owned modifiers are stored in `RunState.ownedModifiers: string[]` (array of modifier IDs). At round start, `PassiveManager` reads the owned modifier list and wires up the appropriate hooks.
