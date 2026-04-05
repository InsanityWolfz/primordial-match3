# Primordial Match-3 — Next Major Gameplay Redesign

This document captures the full design discussion for the next round of core gameplay changes.
Implement these together as a cohesive system — they are deeply interconnected.

---

## 1. Remove Nature Element

**What gets removed:**
- Nature gem type (the 6th element)
- Transmute active power (nature's active)
- Any nature-specific passive powers
- Nature color from ELEMENT_COLORS and all config

**What stays:**
- Vine Monster enemy (rename/recolor to something neutral if needed — it's size-based anyway)
- Thorn Vine hazard (now spawned by Vine Monster via intent system — see section 3)

**Result:** 5 elements — Fire, Water, Earth, Air, Lightning

---

## 2. New Power System — Base Damage + Multiplier

Each power now has two components that combine on firing:

**Damage = Base × Multiplier**

Both reset to zero after the power fires.

### Base Damage
Matching gems of your element always feeds base damage — this never changes per element.
Every match of your element adds to the base pool regardless of size.

### Multiplier
Each element has a unique condition that adds to the multiplier pool (additive stacking).

| Element | Power | Base Source | Multiplier Trigger | Multiplier Added |
|---|---|---|---|---|
| **Fire** | Fireball | Match fire gems | Match-4 fire | +×2 |
| **Fire** | Fireball | Match fire gems | Match-5 fire | +×3 |
| **Water** | Splash | Match water gems | Match adjacent to enemy or hazard | +×1.5 |
| **Earth** | Earthquake | Match earth gems | Any match-4 or larger (any element) | +×2 |
| **Air** | Windslash | Match air gems | Per cascade hop | +×1.5 |
| **Lightning** | Chain Strike | Match lightning gems | Per enemy intent that fires | +×2 |

### Additive Stacking Rules
Multipliers always stack additively. Two ×2 events = ×4 total. Never multiplicative compounding.

Examples:
- Fire player hits two match-4s before firing → ×4 multiplier
- Fire player hits match-4 + match-5 before firing → ×5 multiplier
- Air player engineers a 4-hop cascade → 4 × 1.5 = ×6 multiplier
- Lightning player lets 3 enemy intents fire → 3 × 2 = ×6 multiplier

**No cap.** Broken builds are intentional. A player who engineers ×10 Fireball earned it.

### Power Activation
- Powers now **cost 1 turn** to activate (same as making a match)
- Powers can be fired at any charge level — the turn cost itself prevents firing for 1 damage
- The decision: fire now at moderate base×multiplier, or spend more turns charging for a bigger hit
- Enemy intents counting down creates urgency against holding too long

### UI Changes Required
- Power display shows **base × multiplier** live (e.g. "12 × 4")
- Both numbers update in real time as matches are made
- Multiplier number jumps visibly when a trigger fires (match-4, cascade, etc.)
- Turn cost indicator on power button

---

## 3. Enemy Intent System

Enemies are no longer passive HP bars. Each enemy type has timed abilities (intents) that
count down each turn and fire when they reach zero, then reset.

### How Intents Work
- Every enemy displays its upcoming intent(s) directly on its sprite
- Intent badge: small icon + turn countdown number
- Badge color changes by urgency: grey (4+ turns) → amber (2-3 turns) → red pulse (1 turn)
- Multiple intents stack vertically on the enemy if it has more than one behavior
- Countdown ticks on EVERY player action — match OR power use

### Enemy Intent Assignments

| Enemy | Intent | Effect |
|---|---|---|
| **Fire Imp** | Regenerate | Recovers HP on a timer — kill it fast |
| **Ice Whelp** | Spawn Ice | Places ice hazards on the board |
| **Earth Golem** | Spawn Stone | Places stone hazards on the board |
| **Vine Monster** | Spread Vines | Places/spreads thorn vine hazards |
| **Lightning Wraith** | Drain Charge | Drains base damage from your highest-charged power |
| **Earth Giant** | Shield | Gives an adjacent enemy a damage-absorbing shield |

Enemies can have multiple intents at different intervals — e.g. Vine Monster could spread
vines every 3 turns AND do a secondary effect every 6 turns. Both shown simultaneously.

### Strategic Impact
- Killing an enemy eliminates its intent permanently — clear threat prioritization
- Lightning players benefit from letting intents fire (charges their multiplier) — creates
  a genuine dilemma: kill the wraith or let it drain you for a bigger counter-strike?
- The board is now a map of threats you're racing against, not a static puzzle

---

## 4. Hazards Come From Enemies Only

**Remove:**
- Dynamic hazard spawning (`maybeSpawnHazardOnGem`) — no more random spawn chance
- Round-start hazard placement (`placeHazards`) — board starts clean every round
- Energy Siphon hazard entirely (Lightning Wraith does this job now)

**Result:** Hazards only appear when an enemy intent fires. The board starts clean each round
and enemies build the threat over time. Players know exactly why hazards are appearing and
which enemy to prioritize to stop them.

**Remaining hazard types:** Ice, Stone, Thorn Vine (3 total, each owned by a specific enemy)

---

## 5. Shop Redesign — No More Essence

**Remove essence entirely.** The currency layer adds bookkeeping without meaningful decisions.
The interesting decision was always WHICH item to pick, never WHETHER you could afford it.

### New Shop Model
Round end: offered 3 items, pick 1 for free. No currency, no affordability.

**Item pool contains:**
- **Active power** — a new element power you don't own yet (max ~3 active powers)
- **Modifier** — improves an existing power's base gain or multiplier trigger values

### Modifier Examples (per element)
These are the "upgrades" — they improve how a power charges rather than a generic damage number:

**Fire modifiers:**
- "Match-4 fire multiplies by ×3 instead of ×2"
- "Match-5 fire multiplies by ×4 instead of ×3"
- "Fire gems give +1 extra base damage per match"

**Water modifiers:**
- "Adjacent matching adds ×2 instead of ×1.5"
- "Match-4 water adjacent to an enemy adds ×3"
- "Water base damage carries over between rounds (doesn't reset)"

**Earth modifiers:**
- "Match-3 earth also contributes to multiplier at +×1"
- "Earthquake hits all enemies for full damage (not split)"

**Air modifiers:**
- "Cascade multiplier triggers at 2 hops instead of 3"
- "Each hop adds ×2 instead of ×1.5"

**Lightning modifiers:**
- "Each intent adds ×3 instead of ×2"
- "Lightning base damage carries between rounds"
- "Draining an enemy intent also deals 2 direct damage to that enemy"

### Rerolls
TBD — reroll mechanic not yet decided.

---

## 6. Passive Powers — Rethought

Passives that auto-clear gems are now **hostile to your own setup** (destroying the board
state you're engineering for big multiplier hits).

**New passive role:** Amplify your active power, never touch the board independently.

Passives trigger WHEN your active power fires, not on their own schedule.

**Examples:**
- **Fire passive** — when Fireball fires, also deals half damage to all adjacent enemies
- **Earth passive** — Earthquake destroys all hazards in addition to enemy damage
- **Air passive** — after Windslash fires, the next cascade this round gets +2 free hops
- **Lightning passive** — when Chain Strike fires, also silences one enemy (delays its next intent by 2 turns)
- **Water passive** — Splash destroys all hazards in its area of effect

Passives appear in the shop item pool and slot onto an existing active power.

---

## 7. Playstyle Identities Per Element

Each element now creates a genuinely different way of reading and playing the board:

| Element | Playstyle | Core Loop |
|---|---|---|
| **Fire** | Setup | Engineer big fire matches before firing — patience and board reading |
| **Water** | Positional | Play your matches near threats, not in safe open space |
| **Earth** | Patient | Any big combo charges Earth — slow but hits everything |
| **Air** | Engineering | Deliberately set up cascade chains before firing |
| **Lightning** | Counter | Let enemies act to charge up, then punish them |

Mixed builds (two active powers) create hybrid playstyles with interesting tradeoffs.

---

## 8. Turn Economy Changes

| Action | Turn Cost (old) | Turn Cost (new) |
|---|---|---|
| Make a match | 1 turn | 1 turn (no change) |
| Use a power | 0 turns (free) | **1 turn** |
| Enemy intents | tick on match | tick on match OR power use |

**Lose condition simplifies:** turns = 0 AND enemies alive. No more charges check.

This means using 3 powers in a round costs 3 turns — real resource management,
not a free action you spam whenever charged.

---

## Implementation Order (Suggested)

1. Remove Nature gem + Transmute power from all configs
2. Remove Energy Siphon hazard
3. Remove dynamic hazard spawning (maybeSpawnHazardOnGem + placeHazards)
4. Add intent system to Enemy class (intents array, countdown, fire logic)
5. Add intent UI rendering to Enemy (badge, icon, countdown, urgency color)
6. Wire enemy intents to hazard spawning (IceWhelp spawns ice on intent fire, etc.)
7. Rework power charging: base pool + multiplier pool per power
8. Wire each element's unique multiplier trigger
9. Power activation costs 1 turn
10. Update power UI to show base × multiplier live
11. Remove essence from RunState, shop, and all UI
12. Implement choice-based shop (pick 1 of 3)
13. Add modifier item type to shop pool
14. Add reroll token system
15. Rework passives to amplify-on-fire model
