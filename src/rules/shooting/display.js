// How a shot or fight reads: one model for the iPad stats drawer
// (src/play/CombatPanel.jsx) and the projector side bars
// (src/table/panel/CombatBoard.jsx), so both say the same thing.

export const MODE_ICON = { auto: '✓', warning: '!', note: 'i', inactive: '–' }
export const modifierIcon = (modifier) => MODE_ICON[modifier.mode] ?? (modifier.on ? '●' : '○')

// Better and worse are never shown by colour alone: an arrow goes with them.
export const TONE_ARROW = { better: '▲', worse: '▼', info: '•', same: '' }

const switchable = (modifier) => modifier.mode === 'toggle' || modifier.mode === 'default'

// Whether a player can turn this modifier on or off on their own iPad.
export const canToggle = (modifier, seat) => modifier.seat === seat && switchable(modifier) && !modifier.used

export const badgeOf = (modifier) => (modifier.used ? 'Used' : modifier.cost ? `${modifier.cost}CP` : '')

// Resolving a fight, as a reminder (core rules).
export const FIGHT_RESOLVE =
  'Starting with the attacker, take turns resolving one success: strike, or block one of theirs (a normal blocks a normal, a crit blocks either).'

// 'attack' (the shooter or attacker) or 'defence' (the target, retaliating in a fight).
export const roleOf = (combat, side) =>
  side === 'attack' ? (combat.mode === 'fight' ? 'Fight' : 'Shoot') : combat.mode === 'fight' ? 'Retaliate' : 'Defence'

export const operativeOf = (combat, side) => (side === 'attack' ? combat.shooter : combat.target)

export const weaponOf = (combat, side) =>
  side === 'attack' ? combat.weapon : combat.mode === 'fight' ? combat.defenderWeapon : null

export const profileOf = (combat, side) =>
  side === 'attack' ? combat.attack : combat.mode === 'fight' ? combat.retaliation : combat.defence

// 'Neutron Blaster  4 · 4+ · 3/3' as two parts.
export const weaponProfileText = (weapon) =>
  weapon?.atk != null ? `${weapon.atk} · ${weapon.hit}+ · ${weapon.dmg.normal}/${weapon.dmg.crit}` : ''

// Whether the action can go ahead, in a line.
export const statusOf = (combat) =>
  combat.valid
    ? { ok: true, text: combat.mode === 'fight' ? 'In control range' : 'Valid target' }
    : { ok: false, text: combat.blocks.map((block) => block.text).join(' · ') }

// The big numbers. Each tile: { cell, label, value (text, or parts with their own
// tone), tone, was (the datacard value, when it changed), hint, reasons }.
export const statTiles = (combat, side) => {
  const profile = profileOf(combat, side)
  if (!profile) return []
  if (side === 'attack' || combat.mode === 'fight') {
    const { dice, hit, crit, dmg } = profile
    return [
      {
        cell: 'dice',
        label: 'Attack dice',
        value: String(dice.value),
        tone: dice.tone,
        was: dice.value !== dice.base ? String(dice.base) : null,
        hint: dice.auto ? `${dice.rolled} rolled + ${dice.auto} auto` : null,
        reasons: dice.reasons,
      },
      { cell: 'hit', label: 'Hit', value: `${hit.value}+`, tone: hit.tone, was: hit.tone !== 'same' ? `${hit.base}+` : null, reasons: hit.reasons },
      {
        cell: 'crit',
        label: 'Crit',
        value: crit.crits === 'none' ? '—' : `${crit.value}+`,
        tone: crit.tone,
        was: crit.tone !== 'same' ? `${crit.base}+` : null,
        // Crits on less than a 6 come from Lethal: say so, even when it's the weapon's own.
        hint: crit.crits === 'normal' ? 'Count as normal' : crit.crits === 'yes' && crit.value < 6 ? `Lethal ${crit.value}+` : null,
        reasons: crit.reasons,
      },
      {
        cell: 'dmg',
        label: 'Damage',
        value: [
          { text: String(dmg.normal.value), tone: dmg.normal.tone },
          { text: '/', tone: 'same' },
          { text: String(dmg.crit.value), tone: dmg.crit.tone },
        ],
        tone: [dmg.normal.tone, dmg.crit.tone].includes('worse') ? 'worse' : [dmg.normal.tone, dmg.crit.tone].includes('better') ? 'better' : 'same',
        was:
          dmg.normal.tone !== 'same' || dmg.crit.tone !== 'same' ? `${dmg.normal.base}/${dmg.crit.base}` : null,
        hint: 'Normal / crit',
        reasons: dmg.reasons,
      },
    ]
  }
  const { dice, auto, save, rolled } = profile
  return [
    { cell: 'dice', label: 'Defence dice', value: String(dice.value), tone: dice.tone, was: dice.tone !== 'same' ? '3' : null, reasons: dice.reasons },
    {
      cell: 'auto',
      label: 'Auto saves',
      value: auto.alt ? `${auto.crit}✱ or ${auto.alt.normal}` : auto.crit ? `${auto.crit}✱${auto.normal ? ` + ${auto.normal}` : ''}` : String(auto.normal),
      tone: auto.tone,
      hint: auto.crit ? '✱ kept as a crit' : auto.count ? 'Kept without rolling' : null,
      reasons: auto.reasons,
    },
    {
      cell: 'save',
      label: 'Save',
      value: save ? `${save.value}+` : '—',
      tone: save?.tone ?? 'same',
      was: save && save.tone !== 'same' ? `${save.base}+` : null,
      hint: `Roll ${rolled}`,
      reasons: save?.reasons ?? [],
    },
  ]
}

// A side's modifiers, for the screen that shows them:
//   warnings  what stops or limits the action
//   applied   in effect (and not switchable by this viewer)
//   options   the viewer's own switches, on or off (and used-up ones, disabled)
//   reminders notes, and rules in play whose conditions aren't met
// The opponent's unused options aren't listed.
export const groupModifiers = (modifiers, seat) => ({
  warnings: modifiers.filter((modifier) => modifier.mode === 'warning'),
  applied: modifiers.filter(
    (modifier) => modifier.on && modifier.mode !== 'warning' && !(modifier.seat === seat && switchable(modifier)),
  ),
  options: modifiers.filter((modifier) => modifier.seat === seat && switchable(modifier)),
  reminders: modifiers.filter((modifier) => modifier.mode === 'note' || modifier.mode === 'inactive'),
})
