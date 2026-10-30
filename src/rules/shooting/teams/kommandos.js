import { abilityNamed } from '../context.js'
import { mod } from '../effects.js'

// Kommandos (ORK-KOM), hand-checked against the current team rules (Wahapedia).

const PLOYS = {
  waaagh: 'ORK-KOM-S-WAAGH',
  kunninButBrutal: 'ORK-KOM-T-KBB',
  dakka: 'ORK-KOM-S-DD',
  skulkAbout: 'ORK-KOM-S-SA',
  justAScratch: 'ORK-KOM-T-JAS',
}
const COLLAPSIBLE_STOCKS = 'ORK-KOM-CS'

export const attack = (ctx) => {
  const { weapon } = ctx
  const owner = 'attacker'
  const mods = []
  if (!weapon) return mods
  if (ctx.stratActive(owner, PLOYS.dakka) && weapon.atk != null) {
    mods.push(
      mod({ id: PLOYS.dakka, owner, source: 'strat', name: 'DAKKA! DAKKA! DAKKA!', text: 'Punishing', effect: { addRules: { punishing: true } }, tone: 'good' }),
    )
  }
  if (ctx.hasEquipment(owner, COLLAPSIBLE_STOCKS) && /^(slugga|shokka(?: pistol)?)$/i.test(weapon.name) && weapon.rules.range) {
    mods.push(
      mod({ id: COLLAPSIBLE_STOCKS, owner, source: 'equipment', name: 'Collapsible Stocks', text: 'No Range limit', effect: { removeRange: true }, tone: 'good' }),
    )
  }
  if (weapon.rules.special.includes('Explosive')) {
    mods.push(
      mod({
        id: 'ORK-KOM-explosive',
        owner,
        source: 'weapon',
        name: 'Explosive',
        text: 'The Bomb Squig is the primary target (never in cover or obscured); Blast hits everyone near it',
        effect: { skipTargeting: 'explosive', noCover: true, noObscured: true },
      }),
    )
  }
  if (weapon.rules.special.includes('Concealed Position')) {
    mods.push(
      mod({ id: 'ORK-KOM-concealed-position', owner, source: 'weapon', name: 'Concealed Position', mode: 'note', text: 'Only the first time it shoots in the battle' }),
    )
  }
  if (weapon.rules.special.includes('Torrent 0"')) {
    mods.push(mod({ id: 'ORK-KOM-torrent-0', owner, source: 'weapon', name: 'Torrent 0"', mode: 'note', text: 'No secondary targets' }))
  }
  return mods
}

export const defence = (ctx) => {
  const { target } = ctx
  const owner = 'defender'
  const mods = []
  if (ctx.stratActive(owner, PLOYS.skulkAbout)) {
    const base = { id: PLOYS.skulkAbout, owner, source: 'strat', name: 'Skulk About' }
    mods.push(
      target.order === 'conceal'
        ? mod({ ...base, text: 'Conceal order: keep 1 more normal success without rolling', effect: { extraAutoSaves: 1 }, tone: 'good' })
        : mod({ ...base, mode: 'inactive', text: 'Needs a Conceal order' }),
    )
  }
  const scratchable = !target.keywords.has('BOMB SQUIG') && !target.keywords.has('GROT')
  if (scratchable && ctx.inBattle && ctx.weapon?.atk != null) {
    mods.push(
      mod({
        id: PLOYS.justAScratch,
        owner,
        source: 'firefight',
        name: 'Just A Scratch',
        mode: 'toggle',
        cost: 1,
        limit: 1,
        text: 'Ignore the damage from one normal success',
        tone: 'good',
      }),
    )
  }
  if (abilityNamed(target, 'Sneaky Zogger')) {
    mods.push(
      ctx.analysis.cover
        ? mod({
            id: 'ORK-KOM-sneaky-zogger',
            owner,
            source: 'ability',
            name: 'Sneaky Zogger',
            text: 'In cover: not a valid target (beats Seek and Vantage)',
            effect: { notValid: 'Sneaky Zogger: in cover' },
            tone: 'good',
          })
        : mod({
            id: 'ORK-KOM-sneaky-zogger',
            owner,
            source: 'ability',
            name: 'Sneaky Zogger',
            mode: 'inactive',
            text: ctx.analysis.tooClose ? 'Within 2": no cover' : 'Not in cover',
          }),
    )
  }
  if (abilityNamed(target, 'Boom!')) {
    mods.push(
      mod({
        id: 'ORK-KOM-boom',
        owner,
        source: 'ability',
        name: 'Boom!',
        mode: 'note',
        text: 'If incapacitated before using its explosives: roll a D6 (or 2D6), any 4+ and it explodes first',
      }),
    )
  }
  return mods
}

// Fighting (side 'attacker') or retaliating (side 'defender').
export const fight = (ctx, side) => {
  const { operative, weapon, retaliating } = ctx.fighter(side)
  const owner = side
  const mods = []
  if (weapon && ctx.stratActive(owner, PLOYS.waaagh)) {
    mods.push(mod({ id: PLOYS.waaagh, owner, source: 'strat', name: 'WAAAGH!', text: 'Balanced', effect: { addRules: { balanced: true } }, tone: 'good' }))
  }
  if (weapon && !retaliating && operative.order === 'conceal' && ctx.inBattle) {
    mods.push(
      mod({
        id: PLOYS.kunninButBrutal,
        owner,
        source: 'firefight',
        name: 'Kunnin’ But Brutal',
        mode: 'toggle',
        cost: 1,
        limit: 1,
        text: 'If it charged this activation: its first strike with a normal success counts as a crit',
        tone: 'good',
      }),
    )
  }
  if (ctx.inBattle && !operative.keywords.has('BOMB SQUIG') && !operative.keywords.has('GROT')) {
    mods.push(
      mod({ id: PLOYS.justAScratch, owner, source: 'firefight', name: 'Just A Scratch', mode: 'toggle', cost: 1, limit: 1, text: 'Ignore the damage from one normal success', tone: 'good' }),
    )
  }
  if (!retaliating && abilityNamed(operative, 'Krumpin’ Time') ) {
    mods.push(mod({ id: 'ORK-KOM-krumpin-time', owner, source: 'ability', name: 'Krumpin’ Time', mode: 'note', text: 'It can fight twice this activation' }))
  }
  if (abilityNamed(operative, 'Dat All You Got?')) {
    mods.push(mod({ id: 'ORK-KOM-dat-all-you-got', owner, source: 'ability', name: 'Dat All You Got?', mode: 'note', text: 'If it survives the fight: D3 damage to the enemy' }))
  }
  if (abilityNamed(operative, 'Boom!')) {
    mods.push(mod({ id: 'ORK-KOM-boom', owner, source: 'ability', name: 'Boom!', mode: 'note', text: 'If incapacitated before using its explosives: roll a D6 (or 2D6), any 4+ and it explodes first' }))
  }
  return mods
}
