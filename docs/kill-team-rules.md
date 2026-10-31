# Kill Team rules reference (3rd edition, "Kill Team 2024")

The working rules reference for this project: what the official rules say, in our own words, with every number preserved. Build features to match this, and update it when Games Workshop publishes changes.

**Current as of 25 October 2026:**
- Core Rules, with the June 2026 commentary.
- Approved Ops 2025 card pack, v3 (August 2026).
- Universal Equipment (June 2026).
- Killzone rules as of the August 2026 dataslate.

**What's coming:**
- Approved Ops 2026 is expected soon but isn't out yet.
- Kill Team: Armageddon (Legion of the Damned vs Ork Nobz, with bunker terrain) is announced.
- A new edition is expected in 2027.

## Sources (in order of authority)

1. **Official Games Workshop documents** (precedence: online rules beat printed ones):
   - Kill Team downloads: https://www.warhammer-community.com/en-gb/downloads/kill-team/ (the page is JS-rendered; the PDFs live on `assets.warhammer-community.com`). Examples:
     - Core Rules update log: `eng_17-06_kill_team_key_downloads_core_rules_update_log-…pdf` (last saved May 2026; contains the June 2026 commentary).
     - Approved Ops update log: `eng_10-09_killteam_approved_ops_update_log-…pdf` (September 2025 errata).
   - Kill Team: The App holds the live rules.
2. **Wahapedia** (mirrors the official text):
   - Core rules: https://wahapedia.ru/kill-team3/the-rules/core-rules/
   - Killzones: https://wahapedia.ru/kill-team3/the-rules/killzones/
   - Appendix (weapon rules, game sequence): https://wahapedia.ru/kill-team3/the-rules/appendix/
   - Universal equipment: https://wahapedia.ru/kill-team3/the-rules/universal-equipment/
   - Approved Ops 2025: https://wahapedia.ru/kill-team3/the-rules/approved-ops-2025/ (the full crit/tac op card text is embedded in the page HTML as `cgCard` strings; fetch it with curl and strip the tags).
3. **Write-ups of each update** (Goonhammer / Tabletop Battles "Hot Takes", Can I Shoot It). `tabletopbattles.com` pages fetch fine with curl.
   - Approved Ops 2025 review (Sep 2025)
   - FAQ (Nov 2025)
   - Dataslates: Jan 2026, Apr 2026, Aug 2026 (https://canishoot.it/news/2026-08-26-dataslate)

---

## 1. Battle structure

- **Turning points:** a battle is a series of turning points (TPs). The Approved Ops battle lasts **4 TPs**.
- **Phases:** each TP has a **Strategy phase**, then a **Firefight phase**.

### Strategy phase

1. **Initiative.** The core rules say: TP1 is set by the mission pack; in later TPs, roll off, and a tie goes to the player who did *not* have initiative last TP. Approved Ops replaces this with initiative cards (see §9).
2. **Ready.**
   - Each player gains **1CP**. From TP2 on, the player **without** initiative gains **2CP** instead.
   - All friendly operatives become ready; their order token flips to its lighter side.
   - CP are kept until spent.
3. **Gambit.** Starting with the player with initiative, players alternate using a **STRATEGIC GAMBIT** (strategy ploys are the usual ones) or passing, until both pass in a row. Each gambit can be used once per TP.

### Firefight phase

- **Alternating activations:** players take turns activating one ready operative, starting with the player with initiative.
- **When an operative activates:**
  1. Choose its order (**Engage** or **Conceal**); it lasts until its next activation.
  2. It spends AP on actions, one at a time, up to its **APL**.
  3. It's **expended**: the order token flips to its darker side.
- **AP rules:**
  - The same action can't be performed twice in one activation.
  - An action's cost can't go below 0AP.
  - An action that can't be completed is cancelled, and no AP is spent.
- **Counteract:** when a player would activate but all their operatives are expended while the opponent still has ready ones, they may pick an expended friendly **Engage** operative to perform **one 1AP action** (not Guard) for free.
  - Each operative can counteract once per TP.
  - It can't move more than 2" (or be set up more than 2" away).
  - It isn't an activation, so action restrictions don't apply.
  - It's optional.
- **End:** the phase ends when every operative is expended.

### Orders

- **Engage:** acts normally and can counteract.
- **Conceal:**
  - can't **Shoot** or **Charge** (unless a weapon is Silent) and can't counteract;
  - **isn't a valid target while in cover**.
- Operatives are set up with Conceal orders. The order can change each time the operative activates.

## 2. Universal actions

| Action | AP | Rules |
|---|---|---|
| Reposition | 1 | Move up to Move, in straight-line increments rounded up to the inch. Can't move within an enemy's control range unless a friendly operative is already within that enemy's control range, and can't finish there. Not allowed while within enemy control range, or in the same activation as Fall Back or Charge. |
| Dash | 1 | Move up to 3". Can't climb (can drop and jump). Not allowed within enemy control range, or with Charge. |
| Fall Back | 2 | Like Reposition but may move through enemy control range (can't finish in it). Requires an enemy within control range. Not with Reposition or Charge. |
| Charge | 1 | Reposition + 2". Must finish within an enemy's control range. If it reaches an enemy nobody else is engaging, it can't leave that enemy's control range. Not on Conceal, not if already within enemy control range, not with Reposition, Dash or Fall Back. |
| Pick Up Marker | 1 | Take a marker you control; you now carry, contest and control it. Not within enemy control range or while already carrying one. |
| Place Marker | 1 | Put a carried marker within control range. Not in the same activation as Pick Up, except when incapacitated (then free, mandatory). |
| Shoot | 1 | Shooting sequence. Not on Conceal (unless Silent), not within enemy control range. |
| Fight | 1 | Fighting sequence. Requires an enemy within control range. |

**Guard** is not a core action: it's a close-quarters rule for Gallowdark and Tomb World, and the Compound Siege bunker (see §6).

- **Free actions** cost no AP but still count for action restrictions.
- **Mission actions** come from mission packs, killzones and equipment.

## 3. Shooting and fighting

### Shooting sequence

1. **Weapon:** pick a ranged weapon and roll its **Atk** dice.
2. **Target:** pick a **valid target** with no friendly operatives within its control range.
   - An Engage target is valid if visible.
   - A Conceal target is valid if visible **and not in cover**.
3. **Attack roll:** results ≥ **Hit** succeed. **6 is always a crit**; **1 always fails**.
   - **Obscured** target: discard one success, and all crits become normal successes.
4. **Defence roll:** the defender rolls **3 dice**.
   - **In cover:** they may keep one normal success without rolling (the cover save).
   - Results ≥ **Save** succeed; 6 is a crit, 1 fails.
5. **Blocks:**
   - a normal success blocks a normal;
   - two normals block a crit;
   - a crit blocks either.
6. **Damage:** each unblocked success deals **Dmg** (normal / crit). Incapacitated operatives are removed after the whole action.

### Fighting sequence

1. **Target:** pick an enemy within control range; it **retaliates**.
   - A Conceal order doesn't stop the Fight action; it stops Shoot and Charge.
   - A rule that says an operative can't retaliate still lets it be fought; its dice just aren't rolled.
2. **Rolls:** both sides pick a melee weapon and roll at the same time.
   - **Assist:** each other friendly operative within the enemy's control range (and not within another enemy's control range) improves Hit by 1. No maximum is stated, and it applies to whichever operative is assisted, attacker or retaliator.
   - Injured operatives' Hit is worse by 1 here too.
3. **Resolve:** starting with the attacker, players alternate resolving one success: either **strike** (deal damage) or **block** (cancel one opposing unresolved success, using the block rules above).
   - When one side runs out, the other resolves the rest.
   - It ends early if either operative is incapacitated.

### Dice

- **D3:** a D6 halved, rounded up.
- **Re-rolls:** a die can be re-rolled only once, and the new result must be kept. Dice retained without rolling (cover saves, Accurate) can't be re-rolled and have no numeric result.
- **Command Re-roll (1CP firefight ploy):** re-roll one attack or defence die. It's the only ploy usable more than once per TP.
- **Ploys:** each costs 1CP unless stated, and each can be used once per TP.

## 4. Key principles

### Stats

- **APL:**
  - total AP per activation, also used for marker control;
  - can change by **at most ±1** from its normal value.
- **Move:** never below **4"**.
- **Save:** defence roll target.
- **Wounds:** starting wounds.
- **Weapons:** Atk / Hit / Dmg (normal/crit) / weapon rules.
- **Bases:** given in mm.

### Wounds

- **Wounded:** below starting wounds.
- **Injured:** below **half** starting wounds. Injured operatives get **−2" Move** and **Hit worsened by 1**.
- **Incapacitated:** at 0 wounds or less, then removed (these are separate steps).

### Control range

- Something is in an operative's control range if it's **visible to it and within 1"**. It's mutual.

### Distances

- Measure from the closest part (operatives: the base), horizontally across areas.
- "Within" means any part is within; "wholly within" means every part is.

### Visibility

- An unobstructed **1mm line** from the head of the active operative's model to any part of the target model (not its base).

### Cover and obscured

- **Cover:** intervening terrain within the target's control range. An operative can't be in cover from an operative within 2".
- **Obscured:** intervening **Heavy** terrain, unless that terrain is within 1" of either operative. An operative can't be both in cover and obscured from the same feature; the defender picks one.
- **Intervening:** judged with targeting lines from the shooter's base to the target's base (top-down unless heights differ).

### Markers

- **Objective markers are 40mm across.** All other markers are **20mm**.
- **Control:** operatives contest markers within their control range. Whoever has the higher **total APL** contesting a marker controls it, and control can't change mid-action.
- **Carrying:** an operative carrying a marker is the only one that contests and controls it.

### Tokens (appendix list)

- **Order tokens:** Engage and Conceal, with a light side for ready and a dark side for expended.
- **Status tokens:** Injured, Guard, APL +1, APL −1.
- **Grenade tokens:** Frag, Krak, Stun.
- **Markers:** Ammo Cache, Comms Device, Mine, Smoke Grenade, Objective, Initiative, generic, and the tac op markers.

### Precedence

1. A rule that says it takes precedence.
2. The online designer's commentary.
3. A rule from outside the core book (over core rules).
4. A "cannot" rule.
5. The active operative's controlling player.
6. The player with initiative.

### Equipment

- Each option can be taken once per player per game.

## 5. Weapon rules

| Rule | Effect |
|---|---|
| Accurate x | Keep up to x attack dice as normal successes without rolling (two Accurate rules on one weapon count as Accurate 2). |
| Balanced | Re-roll one attack die. |
| Blast x | Shoot the primary target, then every other operative visible to and within x of it (in any order, rolled separately). Secondary targets don't have to be valid targets, and take the primary's cover/obscured status. |
| Brutal | The opponent can only block with crits. |
| Ceaseless | Re-roll attack dice showing one chosen result. |
| Devastating x | Each kept crit immediately deals x damage. A distance version ("1" Devastating x") also hits others within that distance of the target. |
| Heavy | Can't use the weapon in an activation or counteraction in which the operative moved, and can't move after using it. "Heavy (Dash only)" allows that one move. |
| Hot | After use, roll a D6; if it's below Hit, the user takes the result × 2 damage. |
| Lethal x+ | Successes of x+ are crits. |
| Limited x | Can be used x times per battle. |
| Piercing x | The defender rolls x fewer dice. |
| Piercing Crits x | Piercing x, only if a crit is kept. |
| Punishing | If any crit is kept, keep one fail as a normal success. |
| Range x | Targets must be within x. |
| Relentless | Re-roll any attack dice. |
| Rending | If any crit is kept, turn one normal success into a crit. |
| Saturate | The defender can't keep cover saves. |
| Seek / Seek Light | Targets can't use terrain (Seek Light: Light terrain) for cover when picking valid targets. |
| Severe | If no crit is kept, change one normal into a crit. Devastating and Piercing Crits still apply; Punishing and Rending don't. |
| Shock | The first crit strike in each sequence also discards one of the opponent's unresolved normal successes (or a crit if there are no normals). |
| Silent | Can Shoot while on Conceal. |
| Stun | If any crit is kept, the target gets −1 APL until the end of its next activation. |
| Torrent x | Pick a primary target, then any number of other valid targets within x of it that aren't within a friendly operative's control range. Shoot each, rolled separately. |

- **The same rule twice** (appendix): a weapon gains no benefit from having a weapon rule more than once. For a rule with an x (Lethal, Piercing, Blast…), pick which x to use. Accurate is the exception: two or more instances count as Accurate 2.
- **Obscured beats crit rules:** an obscured target's crits are kept as normal successes and "cannot be changed to critical successes (this takes precedence over all other rules)". So Punishing, Rending, Severe, Devastating, Piercing Crits and Stun can't trigger.
- **"Cannot be selected as a valid target, taking precedence over all other rules (e.g. Seek, Vantage terrain) except being within 2"":** used by In Position (Hernkyn Yaegirs), Evasive Drone (Vespid Oversight Drone) and Sneaky Zogger (Kommando Grot). Being in cover counts even against Seek and Vantage, but nobody is in cover within 2".

## 6. Terrain and killzones

### Board sizes

- **Default:** 30" × 22".
- **Gallowdark and Tomb World:** 606mm × 703mm, on a 6 × 7 grid.

### Terrain types (applied per part of a feature)

- **Heavy:** can obscure.
- **Light:** no rules of its own.
- **Blocking:** gaps you can't see through.
- **Vantage** (also Light):
  - Shooting at an Engage target ≥2" lower gives **Accurate 1**; ≥4" lower gives **Accurate 2**.
  - A Conceal target ≥2" lower can't use Light terrain for cover, but keeps its cover save as a crit, or retains one extra cover save.
  - Ignore Heavy terrain connected to the Vantage level either operative stands on, for obscuring.
- **Accessible:** can be moved through for +1" of movement.
- **Insignificant:** ignored for climbing and dropping.
- **Exposed:** never intervening.
- **Ceiling:** bases of 50mm or less (or 60 × 35mm ovals) can move underneath.
- **Wall** (close quarters only):
  - impassable, and can't be seen through;
  - measure distances around it;
  - only its corners and ends count as intervening;
  - nothing ever moves through it, not even Breach-marker rules (June 2026 commentary).
- **Obstructing:** crossing within 1" of it costs +1".

### Moving over terrain

- **Climb:** the terrain must be within 1" horizontally and 3" vertically, and each climb counts as at least 2" vertical. Vertical distance is totalled for the whole action, then rounded.
- **Drop:** the first 2" of drop per action is free.
- **Jump:** from Vantage more than 2" up, move up to 4" horizontally in one straight line, then drop or climb. Height differences of 1" or less are ignored when landing.

### Volkus

- **Terrain:** 2 strongholds, 2 large ruins, 2 small ruins, 2 heavy rubble, 3 light rubble.
- **Condensed Stronghold:** Blast, Torrent and x" Devastating weapons get **Lethal 5+** against targets wholly inside a stronghold, on the floor or a fire step.
- **Garrisoned Stronghold:** inside an operative retaliates first.
- **Door Fight (1AP):** fight across a door.
- **Compound Siege upgrade:** stockades with breach points, and bunkers.

### Gallowdark and Tomb World (close quarters)

- **Walls and hatchways:** Wall terrain, plus hatchways with **Operate Hatch (1AP)**.
- **Guard (1AP):**
  - Goes on guard; once per enemy activation, after an enemy action, the operative can interrupt to Fight or Shoot for free.
  - It then can't counteract that TP.
  - A point-blank guard shot gets Hit −1.
- **Hatchway Fight (1AP).**
- **Condensed Environment:** Blast, Torrent and x" Devastating weapons get Lethal 5+.
- **Tomb World only:**
  - **Breach points:** **Breach is 2AP**, or 1AP for "breach marker", grenadier or mine operatives and Piercing 2 weapons. It can't drop below 2AP in an activation that also Shoots or Charges.
  - **Teleport pads:** from TP2.

### Bheta-Decima

- **Gantries:** Accessible and Vantage.
- **Hazardous areas:** no base may touch one.
- **Restricted targeting:**
  - floor to floor through 4" of hazardous area;
  - Vantage to floor through a gantry footprint.
- Equipment may go on Vantage and within 2" of Accessible terrain.
- It's the only killzone where objective markers may be off the floor.

### Octarius

- Official layouts and keywords were added in April 2026; the barricades are Light.

## 7. Universal equipment

Players take **up to 4 options**, each once.

| Option | Rules |
|---|---|
| Ammo Cache (x1) | Marker set up wholly within your territory. **Ammo Resupply (0AP):** while controlling it (once per TP per marker), re-roll one attack die when shooting until the next TP. |
| Comms Device (x1) | Marker wholly within your territory. While you control it, your SUPPORT ranges get +3". |
| Mines (x1) | Marker wholly within your territory, more than 2" from other markers, access points and Accessible terrain. The first operative within its control range takes **D3+3** damage, then the marker is removed. |
| Razor Wire (x1) | Exposed and Obstructing. |
| Light Barricades (x2) | Light. |
| Heavy Barricade (x1) | Heavy, set up within 4" of your drop zone. |
| Ladders (x2) | Climbing next to one counts as 1" vertical. |
| Portable Barricade (x1) | Light, Protective (+1 Save in cover), Portable. **Move With Barricade (1AP):** move up to Move − 2". |
| Utility Grenades (pick 2) | **Smoke (1AP):** a marker within 6"; 1" of smoke. An operative wholly within smoke is obscured to anything more than 2" away, and Piercing 2 drops to 1 against it. The marker lasts D3 activations into the next TP. **Stun (1AP):** a target within 6", plus everyone within 1" of it, takes a stun test: on a 3+, APL −1. |
| Explosive Grenades (pick 2) | **Frag:** 4 / 4+ / 2/4, Rng 6", Blast 2", Saturate. **Krak:** 4 / 4+ / 4/5, Rng 6", Piercing 1, Saturate. |
| Breaching Charge (once per battle) | Breach for 1AP less. |

Setup rules:
- Equipment terrain goes on the floor, more than 2" from other equipment terrain, access points and Accessible terrain.
- No equipment within 2" of a teleport pad.

## 8. Approved Ops 2025: game sequence

1. **Set up the battle:**
   - Pick kill teams.
   - Pick the killzone and terrain.
   - Pick **one shared crit op** and set up the objective markers (on the floor, except Bheta-Decima).
   - Roll off; the **winner decides who has initiative**.
   - The initiative player picks a drop zone. **The other player gets the Re-roll initiative card.**
2. **Select operatives:**
   - Secretly pick operatives, then reveal.
   - Secretly pick **up to 4 equipment** options, then reveal.
   - **Each player starts with 2CP.**
   - Secretly pick a **tac op from one of your kill team's archetypes**.
3. **Set up operatives:**
   - Alternate placing equipment **item by item**, initiative player first.
   - Then alternate setting up **one third of the kill team (rounded up)**, initiative player first: wholly within your drop zone, on **Conceal**.
4. **Play the battle:** 4 TPs (initiative cards in §9).
   - As a **STRATEGIC GAMBIT in TP1**, each player secretly picks their **primary op** (crit, kill or tac).
5. **End:**
   - After TP4, reveal primary ops. Each player scores **half the VP of their primary op, rounded up**.
   - **Each op is capped at 6VP**, so the maximum is 6 + 6 + 6 + 3 = **21VP**.
   - Most VP wins; a tie is a draw.

**There is no Scouting step any more** (it was removed in Approved Ops 2025).

## 9. Initiative cards (Approved Ops 2025)

- **Each TP, including TP1:** roll off, without re-rolling ties.
  1. The **roll-off loser** goes first; players alternate playing initiative cards or passing until both pass.
  2. Kill team rules that affect the roll-off are used first, starting with the losing player.
  3. The **winner decides who has initiative**.
  4. **The loser of the roll-off** gains the **±N card**, where N is the TP number (±1 in TP1, ±2 in TP2, ±3 in TP3; nothing in TP4).
- **Ties:** go to the player who doesn't currently have initiative.
- **Re-roll card:** re-rolls your die. The new result replaces any modifiers already played.
- **±N card:** changes your result up or down by N (it can go above 6 or below 1).
- **Initiative held:** a player keeps initiative until the next roll-off winner decides.

## 10. Approved Ops 2025: scoring

### Kill Op

- Your kill grade rises as enemies are incapacitated, up to **5**.
- **+1VP** each time you reach a new grade.
- **+1VP** at the end if your grade is higher than your opponent's.

Enemy operatives incapacitated needed for each grade, by the enemy's starting operative count (this matches `KILL_OP_GRID`):

| Start | G1 | G2 | G3 | G4 | G5 |
|---|---|---|---|---|---|
| 5 | 1 | 2 | 3 | 4 | 5 |
| 6 | 1 | 2 | 4 | 5 | 6 |
| 7 | 1 | 3 | 4 | 6 | 7 |
| 8 | 2 | 3 | 5 | 6 | 8 |
| 9 | 2 | 4 | 5 | 7 | 9 |
| 10 | 2 | 4 | 6 | 8 | 10 |
| 11 | 2 | 4 | 7 | 9 | 11 |
| 12 | 2 | 5 | 7 | 10 | 12 |
| 13 | 3 | 5 | 8 | 10 | 13 |
| 14 | 3 | 6 | 8 | 11 | 14 |

- Hierotek Reanimation lowers the opponent's kill grade again; the VP is lost too, though tac op VP stays.
- Operatives that are "ignored for the kill op" (expendables) don't count.

### Crit ops

There are nine; the tournament groups are {1, 2, 3}, {4, 6, 7} and {5, 8, 9}. Unless stated, actions can't be taken in TP1 or within enemy control range. "Majority" below means friendly operatives control **more objective markers than the enemy**.

1. **Secure:**
   - **Action:** Secure (1AP); a marker you control is secured until the enemy secures it.
   - **Scoring:** at the end of each TP after the first, **+1** if any marker is secured by you, and **+1** if you have more secured markers than the opponent.
2. **Loot:**
   - **Action:** Loot (1AP); a marker can be looted once per TP.
   - **Scoring:** **+1VP per Loot**, max 2 per TP.
3. **Transmission:**
   - **Action:** Initiate Transmission (1AP); the marker transmits until the next TP.
   - **Scoring:** at the end of each TP after the first, **+1** if you control any transmitting marker, and **+1** if you control more transmitting markers than the opponent.
4. **Orb:**
   - **Setup:** the centre marker starts with the **Orb token**.
   - **Action:** Move Orb (1AP), while controlling the Orb's marker; centre → either player's marker, or a player's marker → centre.
   - **Scoring:** at the end of each TP after the first, **+1 per marker you control without the Orb**.
5. **Stake Claim:**
   - **Claim:** at the start of the Gambit step of each TP after the first (initiative player first), each player picks one objective marker **and** one claim:
     - "we'll control it at the end of the TP", or
     - "the enemy won't contest it at the end of the TP".
   - Each marker must be picked exactly once over the battle. The Stake Claim marker is removed at the end of the TP (April 2026).
   - **Scoring:** at the end of each TP after the first, **+1** for majority, and **+1** if your claim came true.
6. **Energy Cells:**
   - **Picking up objective markers:** Pick Up Marker can be used on them in TP2 for **+2AP**, in TP3 for **+1AP** (neither can be free or reduced), and normally in TP4.
   - A carrier can't be set up again more than 6" away.
   - **Scoring:** at the end of each TP after the first, **+1** for majority; at the end of the battle, **+1 per objective marker you're carrying**.
7. **Download:**
   - **Action:** Download (1AP), on the centre or the opponent's marker; not in TP1–2, and each marker only once per battle.
   - **Scoring:**
     - at the end of each TP after the first, **+1** for majority (ignoring downloaded markers);
     - **+1 per Download in TP3, +2 per Download in TP4**.
8. **Data:**
   - **Compile Data (1AP):** the marker gains 1 Data point (track it with a die); once per marker per TP.
   - **Send Data (1AP):** TP4 only; removes all Data points from a marker you control.
   - **Scoring:**
     - at the end of TP2 and TP3, **+1** if you performed more Compile Data actions that TP than the enemy did;
     - **+VP equal to the points removed** by Send Data.
9. **Reboot:**
   - **Setup:** number the markers 1–3.
   - **Each Gambit step:** both players secretly pick a number. If they match, that marker is **inert** this TP; otherwise the marker neither picked is inert.
   - **Action:** Reboot (2AP); an inert marker you control is no longer inert.
   - **Scoring:** at the end of each TP after the first, **+1 per non-inert marker you control**.

### Tac ops

Pick one from your kill team's archetypes. Most cap at 2VP per TP; Dominate caps at 3 per TP.

**Recon**

- **Flank:**
  - **Reveal:** as a strategic gambit.
  - **Flanks:** the killzone is split into left and right flanks by a line from the centre of each player's edge. An operative contests a flank while **wholly within** that flank **and** the opponent's territory; higher total APL controls it.
  - **Scoring:** at the end of each TP after the first, +1 per flank you control. In TP4, a flank you also held at the end of TP3 scores **2** instead (Jan 2026).
- **Retrieval:**
  - **Action:** Retrieve (1AP), on a marker you control that hasn't been searched by you; you now carry a Retrieval marker. Not while already carrying a marker (Jan 2026).
  - **Scoring:** **+1** the first time each marker is searched; **+1 per Retrieval marker carried at the end**.
- **Scout Enemy Movement:**
  - **Action:** Scout (1AP), Conceal only; pick a ready enemy visible and more than 6" away. It's **monitored** until the next Ready step.
  - **Scoring:** at the end of each TP after the first, +1 per monitored enemy visible to any friendly operative (max 2).

**Security**

- **Plant Banner:**
  - **Action:** Plant Banner (1AP), once per battle; place your Banner marker wholly within the opponent's territory, more than 5" from a neutral edge. Anyone can pick it up.
  - **Scoring:** at the end of each TP after the first, +1 if it's in their territory and you control it; **+2** if it's also uncontested. It must be on the board, not carried.
- **Martyrs:**
  - **Tokens:** when a friendly operative is incapacitated while contesting a marker, that marker gains a **Martyr token**.
  - **Scoring:** at the end of each TP after the first, remove tokens from markers you contest: +1 each, or **+2** if you control the marker.
- **Envoy:**
  - **Pick:** as a strategic gambit in each TP after the first, pick an envoy that hasn't been picked before and isn't ignored for the kill op.
  - **Scoring:** at the end of the TP, +1 if it's wholly within enemy territory and not within enemy control range; **+2** if it also lost no wounds that TP.

**Seek & Destroy**

- **Rout:**
  - **Scoring:** whenever a friendly operative incapacitates an enemy while within 6" of the opponent's drop zone, **+1**, or **+2** if the enemy had 12+ Wounds.
- **Sweep & Clear:**
  - **Swept:** a marker is **swept** when an enemy contesting it is incapacitated.
  - **Action:** Clear (1AP); a marker you control is cleared for the TP.
  - **Scoring:** at the end of each TP after the first, **+1** if the **centre or opponent's** marker (Aug 2026) is cleared and uncontested, or **+2** if it's also swept; **+1** if you control a swept marker.
- **Dominate:**
  - **Tokens:** the friendly operative that incapacitates an enemy gains **1 Dominate token**, or **2** if the enemy had 12+ Wounds (Apr 2026).
  - **Scoring:** at the end of TP3 and TP4, remove tokens from friendly operatives **that are in the killzone** (Aug 2026) for +1 each, max 3 per TP.

**Infiltration**

- **Plant Devices:**
  - **Action:** Plant Device (1AP); a marker you control gains your Device token.
  - **Scoring:** at the end of each TP after the first, +1 if the opponent's marker has your Device, and +1 per other marker with your Device that the enemy contests.
- **Steal Intelligence:**
  - **Markers:** when an enemy is incapacitated, place an **Intelligence marker** within its control range. Each friendly operative can carry two.
  - **Scoring:** at the end of each TP after the first, +1 if you're carrying any; at the end of the battle, **+1 per marker carried**.
- **Track Enemy:**
  - **Tracking:** an enemy is tracked if it's a valid target for a friendly **Conceal** operative within 6", which isn't a valid target for that enemy and isn't within enemy control range.
  - **Scoring:** at the end of each TP after the first, 1 tracked = +1 (**+2 in TP4**); 2 or more tracked = +2.

### Approved Ops 2024 (the previous pack; its physical cards are photographed in `public/images`)

- **Crit ops** 4–9 were: Upload, Intel, Extraction, Sabotage, Power Surge, Coordinates.
- **Tac ops** included Confirm Kill, Plant Beacons, Storm Objective, Implant, Wiretap, Champion and others.
- **It also had a Scouting step.**

All of these were replaced in Approved Ops 2025.

## 11. Update timeline (what changed and when)

- **Sep 2025** (Approved Ops errata): Stake Claim and Energy Cells score "at the end of each TP after the first".
- **Nov 2025** (FAQ):
  - Guard also applies in Tomb World, and triggers when an operative is set up.
  - Jumping requires Vantage more than 2" high.
  - Precedence gained step 5 (the active operative's controller).
  - Flank needs "wholly within".
  - Envoy can't be an expendable operative.
  - Dominate counts ability damage.
  - Smoke stacks with other Piercing reductions.
- **Jan 2026** (dataslate):
  - Breaching Charge universal equipment added.
  - Tomb World Breach can't cost less than 2AP after a Shoot or Charge.
  - Flank's TP4 bonus only applies for holding the same flank.
  - Retrieve can't be performed while carrying.
- **Apr 2026** (dataslate):
  - Climbing across features clarified.
  - Martyrs works whatever caused the incapacitation.
  - Sweep & Clear scoring reworked.
  - Dominate gives 2 tokens for 12+ Wound enemies.
  - Stake Claim marker removed at the end of the TP.
  - Octarius layouts added to the Tournament Companion.
  - Tomb Crawler down to 18 Wounds.
- **Jun 2026** (commentary): Wall terrain can never be moved through, Breach markers included.
- **Aug 2026** (dataslate):
  - Dominate only scores from operatives in the killzone.
  - Sweep & Clear only scores the centre or opponent's marker.
  - Octarius Ramshackle Wall upper rampart is Light.
  - Tomb World teleporting can't bypass "not closer to…" restrictions.
  - Many team changes (Raveners lose wounds, Goremongers, Wolf Scouts, Stealth Battlesuits and others).

## 12. App compliance status (25 Oct 2026)

**Matches the rules:**
- Kill op table and grades.
- Max 6VP per op; primary op adds half, rounded up.
- 4 turning points.
- Injured below half wounds.
- +1CP each Ready step, +2CP for the player without initiative from TP2.
- **Start with 2CP**, +1 in the TP1 Ready step (fixed 25 Oct 2026).
- **Up to 4 equipment options**, with a grenade pair counting as one, and no auto-selection (fixed 25 Oct 2026).
- Objective markers 40mm; other markers 20mm (fixed 25 Oct 2026).
- Deploy in thirds, initiative player first, on Conceal orders.
- Operatives start on Conceal.
- Tac ops are limited to the kill team's archetypes.

**Moved to Approved Ops 2025 (25 Oct 2026; the user chose the current pack):**
- **Crit ops:** all 9 (`src/data/critOpsCards.json`; Data has two mission actions).
- **Tac ops:** the 12 as text cards (`src/data/tacOps.js`), limited to the kill team's archetypes.
- **Scouting:** the step is removed.
- **Mustering:** Ready waits until a player has picked operatives, at least one equipment option and a tac op. (House rule at the user's request: the core rules allow taking no equipment.)
- **Equipment that adds a weapon** (checked 2026-10-30 against every team's equipment):
  - "Friendly X operatives have the following weapon. Note that some operatives already have this weapon but with better stats; use the better version": Yaegir and Hearthkyn Salvager Plasma Knives, Kommando Choppas, Scout Squad Combat Blades. An operative that has the weapon on its datacard keeps that version only; everyone else gains the equipment version alongside their own weapons (e.g. Fists).
  - Name-matched exactly: a Yaegir Bladekyn's Dual Plasma Knives is a different weapon, so it also gains a Plasma Knife.
  - Keyword limits apply (Kommando Choppas exclude the Bomb Squig and Grot).
  - Yaegir Plasma Knives also gives the better (datacard) knife Balanced for the battle; the hand-checked Yaegir rules apply it in shots and fights, with its reason shown.
  - Rules that change a weapon's rules for an action (Special Issue Shells, Piercing Shot, Drill Rokkits, Targeting Oculars…) are stats-drawer switches, not new weapons.
- **Setting up operatives:** only before the battle (deployment). From the first turning point the iPad map has no Units tool.
- **Vantage on the iPad:** picked by floor from an operative's action ring: Ground, 1st floor (treated as 2" up) or 2nd floor (4" up). Those heights drive the Vantage rules in the targeting check; the operative shows one chevron per floor.
- **Primary op:** a secret pick in the TP1 strategy sheet (`battle/primaryOp`, TP1 only). Its bonus (half that op's VP, rounded up) is added to every VP total automatically when the game ends: projector, both iPads and the results screen. Until then it's left out of the totals, and only its owner's VP sheet shows it.
- **Setup:** roll off; the winner decides initiative; the initiative player picks the drop zone (enforced); the other player gets the Re-roll card.
- **Each turning point:** a roll-off (ties go to the player without initiative); the winner decides; the loser gains the ±TP card (not in TP4). Played cards are discarded at the next TP.
- **Token tool:** crit op tokens for the 2025 crit ops, plus a Tac op category with the chosen tac op's markers and tokens.

**Semi-automatic activations (25 Oct 2026):**
- **Trigger:** once a turning point's Firefight phase starts (`battle/startFirefight`), moving or tapping a ready operative activates it.
- **Exclusivity:** only one operative is ever active, across both players, so the next activation expends the previous one, and its tag colour flips.
- **Counteract:** moving an expended operative counts as its counteract only when the rules allow it:
  - it's your turn (your opponent just activated);
  - you have no ready operatives and they do;
  - the operative has an Engage order;
  - it hasn't counteracted this turning point.

  The iPad warns past 2". Otherwise the move is treated as a correction.
- **Undo:** dragging an operative back to where its move started, or tapping that spot with Move on, puts it back and reverts the activation; it's ready again. There's no undo drawer or activation banner on the iPad any more; the board shows the status.
- **Turn order:** `turnState` works out whose activation is next; the projector shows Activating, Up next or Counteract badges.

**Sightline tool = targeting check (25 Oct 2026, `shared/targeting.js`):**
- **Lines:** one draggable point on the shooter's base, with lines to the facing arc of the target's base (core rules targeting lines).
- **Cover:** terrain within 1" of the target, and none when the operatives are within 2".
- **Obscured:** Heavy terrain (doors count as Heavy) more than 1" from both operatives.
- **Same feature:** cover or obscured from one feature means the defender chooses.
- **Not a valid target:** Conceal and in cover, or a friendly operative within 1" of the target.
- **Shooter warnings:** on Conceal, or engaged; an injured shooter's Hit is worsened by 1.
- **Vantage** (a per-operative 0/2/4" toggle in Select): Accurate 1/2, the Light-cover rule for Conceal targets, and the Heavy terrain of the feature they stand on ignored for obscuring.
- **Visibility stand-in (user's choice, 25 Oct 2026):** the rules check visibility from the shooter's head to any part of the target model, in 3D, separately from the base-to-base targeting lines. The app can't see heights, so it treats Heavy terrain as tall and solid. If every targeting line crosses Heavy terrain (wholly intervening), the target counts as not visible, so not a valid target. Partly behind Heavy terrain it's obscured, as the rules say. At the table, a model seen over a low wall or through a window is really obscured, not hidden.

**Shooting measurements (25 Oct 2026, Sightline weapon picker, `src/rules/weaponRules.js`):**
- **Picking a weapon:** with a shooter chosen, pick one of these:
  - a ranged weapon profile, filtered by loadout;
  - an equipment weapon the player took, for the operatives it's for, such as Kommando Dynamite or Harpoon ("excluding BOMB SQUIG and GROT");
  - a grenade: Frag, Krak or Stun from equipment, or from the operative's own Grenadier-style ability (frag and krak with Hit +1). Kommando Boys' Tactical Wot-Notz gives the Stun grenade.
- **Range:** a dashed ring; targets out of range are invalid.
- **Area rules:**
  - **Blast:** every operative within x of the target, friendlies included, visible to the target.
  - **Torrent:** valid enemy targets within x, not engaged with friendlies.
  - **x" Devastating:** everything within x of the target.
  - **Stun grenade:** everything within 1".
  - Each draws an orange ring and a tag on every operative it catches.
- **Rules that change targeting:**
  - Saturate: no cover save.
  - Seek / Seek Light: Conceal targets behind terrain become valid, keeping their cover save.
  - Silent: can shoot on Conceal.
  - Accurate stacks with Vantage up to 2.
  - Heavy and the rest show as chips.
- **Smoke** (Smoke Grenade markers): wholly within the 1" area means obscured to anything more than 2" away, and vice versa; Piercing 2 drops to 1.

**Sightline vs Shoot/Fight (26 Oct 2026):**
- **Sightline:** the line-of-sight check only: scan, badges and cover/obscured/not-valid chips, with no weapons.
- **Shoot/Fight:**
  - Tap an operative. Its weapon list opens with a **Shoot | Fight** switch; it starts on Fight if an enemy is within its control range.
  - The list shows every ranged or melee weapon for that action, including equipment weapons and grenades.
  - Then tap the enemy.

**Shot and fight stats (25–26 Oct 2026, `src/rules/shooting/`):** with an attacker, a target and a weapon picked, Shoot/Fight shows what each player rolls.
- **Where it shows:**
  - **Projector:** nothing in the play area. Each player's side bar keeps their name and initiative, and swaps the rest for their half of the attack (with their CP) until the tool is cleared.
    - Shoot: the scan, range and area rings stay on the mat.
    - Fight: the attacker's 1" ring, a line to the enemy, and ASSIST +1 tags.
    - The side bars list what applies; the options still on offer are only on the iPads.
  - **iPads:** a stats drawer on the right edge, **closed for each new attack** until its handle (Shot / Fight) is tapped. It shows on the attacker's map, and on the defender's iPad (any tab) when the attack is on their operative.
- **Fights:**
  - Both halves are attack dice: the attacker's chosen melee weapon, and the defender's retaliation weapon, which the defender picks in their drawer (`shot/weapon`; it defaults to their first).
  - Assists and injured change Hit; Brutal, Shock and the rest show as rules.
  - A resolve reminder covers strike or block, normal blocks normal, crit blocks either.
  - Not within control range: can't fight.
  - **Hand-checked melee rules:**
    - Hernkyn Yaegirs: Masterful Bladework (fighting, or retaliating on Conceal); Plasma Knives (Balanced on the better datacard knife); Fallen Kin; Tracker (fighting only).
    - Vespid Stingwings: Sting; Hardened Exoskeleton (less damage to it); Vicious Venom and Aggression Stimulant (fighting only, not the Drone).
    - Kommandos: WAAAGH!; Kunnin' But Brutal (a toggle, since the charge isn't tracked); Just A Scratch; the Choppas equipment weapon.
  - Other teams get fight suggestions read from their text, as for shooting.
- **Colours:** green means better than the datacard for whoever rolls it; red means worse. Colour always comes with an arrow (▲ / ▼), never on its own.
- **Why it changed:**
  - Every changed number lists its causes as pills right under it, each naming its source, e.g. "▼ Piercing 1 · Neutron Charge" (or "· weapon"), "▲ Assist · Hit +1", "▼ Obscured: crits count as normal", "▲ Ignores Piercing · Camouflaged".
  - The engine records each applied rule's effect (`effects.trace`), and `profile.js` turns that into reasons.
  - The projector shows up to 3 per number.
- **Attack numbers:**
  - **Dice:** Atk, with "rest + n AUTO" for Accurate.
  - **Hit:** never better than 2+ or worse than 6+.
  - **Crit:** Lethal, but a crit must also be a success. With obscured it shows "—" and the crit rules are struck out.
  - **Damage:** Normal/Crit, plus Devastating per crit.
  - **Re-rolls and rules:** listed, with added rules green, rules stopped by obscured struck out, and rules removed by the defender (e.g. Piercing ignored) in red.
- **Defence numbers:**
  - **Dice:** 3 minus Piercing (smoke turns Piercing 2 into 1; Piercing Crits shows "n if crit kept").
  - **Auto saves:** the cover save, none against Saturate. Vantage or Weavewërke give "1 crit or 2 normal", Camouflaged makes them crits, Skulk About adds one more.
  - **Save** and how many dice are rolled.
- **Modifiers:**
  - **What they are:** every rule that applies, or could, listed under the half whose player controls it. That includes core rules, strategy ploys active this turning point, firefight ploys, faction rules, abilities, equipment and weapon rules.
  - **States:** ✓ applies (its conditions are checked), ● / ○ on or off, i note, – in play but its conditions aren't met (with the reason), ! stops or limits the shot.
  - **Toggling:** each player toggles only their own, on their own iPad (`shot/toggle`), and the projector and the other iPad follow. Toggles are kept per shooter and target for the turning point.
- **Firefight ploys and limited equipment:**
  - Turning one on spends its CP and counts a use this turning point.
  - Turning it off again in the same shot refunds both.
  - Once used, another shot shows it as USED.
  - Command Re-roll can be used more than once.
  - Ploys used outside a shot or fight are played from the iPad's Team tab (`battle/firefightPloy`, Use / Undo). It counts the same uses, so a ploy played there shows as USED in the drawer and vice versa.
  - The projector's "Ploys this TP" lists strategy ploys (filled) and firefight ploys (dashed outline, ×N for repeats).
- **Hand-checked teams:** Hernkyn Yaegirs, Vespid Stingwings and Kommandos, checked against the current team rules.
  - **Hernkyn Yaegirs:**
    - Hidden Engagement: in cover from every point of the target's base, since the opponent picks the point.
    - In Position.
    - Tough Survivalists, as a note.
    - Sturdy.
    - Stalwart Defence.
    - The Fallen Kin marker within 3".
    - Pan Spectral Visor.
    - Tracker.
    - Bipod.
    - Weavewërke Cloak.
    - Firestorm and Stabilised Bolt Shells.
    - KV-Ceramide Undersuit: re-roll vs Blast/Torrent, and no x" Devastating splash.
    - Outright Conviction, Brazen Killer and Concealed Position, as notes.
  - **Vespid Stingwings:**
    - Airborne Predators.
    - Aerial Agility.
    - Neutron Charge, using `unitState.movedTp` to remember moving this turning point.
    - Communion, both the targeting point and the re-roll.
    - Warrior Instincts: off once a Communion point is spent.
    - Aerial Guidance: the shooter must be visible to and within 6" of a drone that can see the target.
    - Ocelli: +3" for Vantage.
    - Neutron Overload.
    - Camouflaged, Ghost Rig and Evasive Drone.
    - Skytorch: only operatives in the torch zone between the start and end of its move; no cover or obscured.
  - **Kommandos:**
    - DAKKA! DAKKA! DAKKA!
    - Skulk About.
    - Just A Scratch (not Bomb Squigs or Grots).
    - Sneaky Zogger.
    - Collapsible Stocks.
    - Explosive: the Squig is the primary target.
    - Boom!, as a note.
- **Communion, how the app reads it:**
  - The rule says a Stingwing "can only target the closest enemy operative within 8"" without a Communion point. The app reads that literally: the closest enemy, valid target or not, ignoring enemies within control range of other Stingwings.
  - The official FAQ adds that a target more than 8" away always needs a point.
- **Other teams:** suggestions are read from their rules text: active strategy ploys, firefight ploys (with their 1CP), equipment taken, and the two operatives' abilities.
  - **Recognised:** granted weapon rules, Hit/Atk/Dmg/Save changes (including "to a maximum of 3+"), ignore Piercing/Saturate, extra or crit cover saves, re-rolls, "cannot be obscured", "not a valid target" and damage reduction.
  - **When they apply:** only plain, unconditional text from an active strategy ploy or an ability applies by itself. Everything else is offered as a toggle marked "check its conditions".
  - **Left out:** rules with several options under headings.
- **Moved this activation:** the operative is active (or counteracting) and still holds the latest move on the board.

**Not modelled:** scoring is entered by hand, and the app doesn't automate VP conditions.

**Order tags:** the red/black swap is the user's table convention. The rules flip every token to its light (ready) side in each Ready step; tracking ready/expended by alternating colours each TP gives the same information.

### Game history and the stats page (app feature, not a rule)

- **What is saved:** every game that reaches the results is added to `server/data/history.json` on the table's Mac (gitignored, never pushed). Going back to the battle and on to the results again replaces that game's record instead of adding a second one.
- **Each record:** names, kill teams, VP with the primary op (as on the results screen), the op breakdown, kills (enemy operatives dead at the end) and losses, the winner (null for a draw) and the length. `durationMs` is the projector's game clock; `battleMs` runs from turning point 1 to the results.
- **Fixing it:** edit the file by hand. Players are matched by name, ignoring case and spacing, so correcting a typo merges them. Delete a record to drop a game. A file that doesn't parse is renamed `history.json.broken-<time>` when the next game is saved, so nothing is lost.
- **Stats page:** tap the logo on the opening screen. The leaderboard ranks by win rate (a draw counts as half a win), then games played, then average VP. Prizes go to the top three places, ties share a place, and each player (or pairing) takes only their best result: most VP in a game, total VP, total kills, most wins, games played, fastest and longest game, best average VP (3+ games) and biggest win (VP margin).

## 13. Data caveats in this repo

- **Kill team data:** `src/data/kt24_v4.json` (from vjosset/killteamjson) can lag behind balance dataslates; for example, it may not have the Aug 2026 Raveners Wounds change or the Apr 2026 Tomb Crawler 18W. **Spectre Squad** (released May 2026 with Terror on Devlan) is missing.
- **Corrected against the current rules (25 Oct 2026):** every weapon profile of the three hand-checked teams was compared with Wahapedia's team pages. Fixed:
  - Hernkyn Yaegir bolt shotgun (long range) is 4 / 5+ / **2/3**, not 2/2 (Theyn and Warrior).
  - Stabilised Bolt Shells also give **Accurate 1**.
  - The Kommando Burna Boy's burna (deluge) has **Seek**, not Seek Light.
  - The Comms Boy's weapon is the **shokka pistol** (Collapsible Stocks names it).
  - Vespid Stingwings matched the June 2026 official rules.
- **Kill team archetypes:** each team's tac op archetypes are in the `archetypes` field (e.g. "Seek & Destroy/Security").
