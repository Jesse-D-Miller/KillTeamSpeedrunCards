import { COMMAND_REROLL } from '../../../shared/game.js'
import { mod } from './effects.js'

// Rules every kill team has: universal equipment, the Command Re-roll firefight
// ploy, Grenadier-style grenades, and the core shooting rules read off the targeting
// check (cover, obscured, Vantage, injured, Heavy, Silent).

export const AMMO_CACHE = 'UNIVERSAL-UE-AC'
export const PORTABLE_BARRICADE = 'UNIVERSAL-UE-PB'
export { COMMAND_REROLL }
export const COVER_CHOICE = 'core-cover-choice'

export const universalAttack = (ctx) => {
  const { weapon } = ctx
  if (!weapon) return []
  const mods = []
  if (weapon.grenadier?.hitBonus) {
    mods.push(
      mod({
        id: 'grenadier',
        owner: 'attacker',
        source: 'ability',
        name: 'Grenadier',
        text: `Hit +${weapon.grenadier.hitBonus} with grenades`,
        effect: { hit: -weapon.grenadier.hitBonus },
        tone: 'good',
      }),
    )
  }
  if (weapon.uses) mods.push(mod({ id: 'weapon-uses', owner: 'attacker', source: 'equipment', name: weapon.name, mode: 'note', text: weapon.uses }))
  if (weapon.grenade === 'stun') {
    mods.push(
      mod({
        id: 'stun-grenade',
        owner: 'attacker',
        source: 'equipment',
        name: 'Stun grenade',
        mode: 'note',
        text: 'No attack dice: the target and every operative within 1" of it take a stun test',
      }),
    )
    return mods
  }
  if (ctx.hasEquipment('attacker', AMMO_CACHE) && weapon.source === 'datacard') {
    mods.push(
      mod({
        id: AMMO_CACHE,
        owner: 'attacker',
        source: 'equipment',
        name: 'Ammo Cache',
        mode: 'toggle',
        text: 'If it resupplied this turning point: re-roll one attack die',
        effect: { reroll: 'attack' },
        tone: 'good',
      }),
    )
  }
  if (ctx.inBattle) {
    mods.push(
      mod({
        id: COMMAND_REROLL,
        owner: 'attacker',
        source: 'firefight',
        name: 'Command Re-roll',
        mode: 'toggle',
        cost: 1,
        text: 'Re-roll one attack die',
        effect: { reroll: 'attack' },
        tone: 'good',
      }),
    )
  }
  return mods
}

export const universalDefence = (ctx) => {
  const mods = []
  if (ctx.weapon?.grenade === 'stun') {
    mods.push(
      mod({
        id: 'stun-test',
        owner: 'defender',
        source: 'equipment',
        name: 'Stun test',
        mode: 'note',
        text: 'Roll one D6: on a 3+, −1 APL until the end of its next activation',
      }),
    )
  }
  if (ctx.hasEquipment('defender', PORTABLE_BARRICADE)) {
    mods.push(
      ctx.gap <= 2
        ? mod({ id: PORTABLE_BARRICADE, owner: 'defender', source: 'equipment', name: 'Portable Barricade', mode: 'inactive', text: 'Within 2": no cover' })
        : mod({
            id: PORTABLE_BARRICADE,
            owner: 'defender',
            source: 'equipment',
            name: 'Portable Barricade',
            mode: 'toggle',
            text: 'Connected and in cover from it: a cover save, and Save +1 (max 2+)',
            effect: { assumeCover: true, save: -1 },
            tone: 'good',
          }),
    )
  }
  if (ctx.inBattle && ctx.weapon?.atk != null) {
    mods.push(
      mod({
        id: COMMAND_REROLL,
        owner: 'defender',
        source: 'firefight',
        name: 'Command Re-roll',
        mode: 'toggle',
        cost: 1,
        text: 'Re-roll one defence die',
        effect: { reroll: 'defence' },
        tone: 'good',
      }),
    )
  }
  return mods
}

const HEAVY_ONLY = { dash: 'Dash', reposition: 'Reposition' }

// The core rules, read off the final targeting check.
//   state: { cover, obscured, choose, chooseCover } after the defender's choice.
export const coreModifiers = (ctx, analysis, rules, effects, state) => {
  const { shooter, weapon } = ctx
  const attack = []
  const defence = []
  const warn = (id, text) => attack.push(mod({ id, owner: 'attacker', source: 'core', name: 'Can’t shoot', mode: 'warning', text, tone: 'bad' }))
  if (effects.skipTargeting !== 'explosive') {
    if (shooter.order === 'conceal' && !rules?.silent) warn('core-conceal', 'Conceal order: only Silent weapons can shoot')
    if (analysis.shooterWarnings.some((text) => text.startsWith('ENGAGED'))) warn('core-engaged', 'Within an enemy’s control range')
  }
  if (rules?.heavy && ctx.movedThisActivation) {
    if (rules.heavy === 'any') warn('core-heavy', 'Heavy: it moved this activation')
    else {
      attack.push(
        mod({
          id: 'core-heavy',
          owner: 'attacker',
          source: 'weapon',
          name: 'Heavy',
          mode: 'note',
          text: `It moved: only if that move was a ${HEAVY_ONLY[rules.heavy]}`,
        }),
      )
    }
  }
  if (shooter.order === 'conceal' && rules?.silent) {
    attack.push(mod({ id: 'core-silent', owner: 'attacker', source: 'weapon', name: 'Silent', mode: 'note', text: 'Can shoot on a Conceal order' }))
  }
  // No weapon picked yet still shows what applies to any weapon (not the stun grenade).
  const rolls = !weapon || weapon.atk != null
  if (rolls && shooter.injured) {
    attack.push(
      mod({ id: 'core-injured', owner: 'attacker', source: 'core', name: 'Injured', text: 'Below half wounds: Hit worse by 1', effect: { hit: 1 }, tone: 'bad' }),
    )
  }
  if (rolls && analysis.vantageAccurate) {
    const x = analysis.vantageAccurate
    attack.push(
      mod({
        id: 'core-vantage-accurate',
        owner: 'attacker',
        source: 'core',
        name: 'Vantage',
        text: `Engage target ${x === 2 ? '4' : '2'}"+ lower: Accurate ${x}`,
        effect: { accurate: x },
        tone: 'good',
      }),
    )
  }
  if (state.obscured) {
    attack.push(
      mod({
        id: 'core-obscured',
        owner: 'attacker',
        source: 'core',
        name: analysis.terrainObscured ? 'Obscured' : 'Smoke',
        text: 'Discard 1 success; crits count as normal successes',
        tone: 'bad',
      }),
    )
  }
  if (state.choose) {
    defence.push(
      mod({
        id: COVER_CHOICE,
        owner: 'defender',
        source: 'core',
        name: 'Cover or obscured',
        mode: 'toggle',
        text: state.chooseCover
          ? 'Same terrain: taking the cover save (tap for obscured)'
          : 'Same terrain: taking obscured (tap for the cover save)',
        effect: { chooseCover: true },
        tone: 'good',
      }),
    )
  }
  if (state.cover) {
    defence.push(
      rules?.saturate
        ? mod({ id: 'core-cover', owner: 'defender', source: 'core', name: 'Cover', text: 'Saturate: no cover save', tone: 'bad' })
        : mod({ id: 'core-cover', owner: 'defender', source: 'core', name: 'Cover', text: 'Keep 1 normal success without rolling', tone: 'good' }),
    )
    if (analysis.vantageCoverImprove && !rules?.saturate) {
      defence.push(
        mod({
          id: 'core-vantage-cover',
          owner: 'defender',
          source: 'core',
          name: 'Vantage',
          text: 'Shooter 2"+ higher: keep the cover save as a crit, or keep 1 more',
          tone: 'good',
        }),
      )
    }
  } else if (analysis.tooClose && !effects.noCover && analysis.lines.some((line) => line.crossings.some((crossing) => crossing.covers))) {
    defence.push(mod({ id: 'core-within-2', owner: 'defender', source: 'core', name: 'Within 2"', mode: 'note', text: 'No cover this close' }))
  }
  if (analysis.smokePiercing && (rules?.piercing === 2 || rules?.piercingCrits === 2)) {
    defence.push(
      mod({ id: 'core-smoke-piercing', owner: 'defender', source: 'core', name: 'Smoke', text: 'Piercing 2 counts as Piercing 1', tone: 'good' }),
    )
  }
  return { attack, defence }
}
