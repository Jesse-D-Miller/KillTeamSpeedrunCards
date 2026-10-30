import { tokenRadiusIn } from '../../../../shared/game.js'
import { analyseTarget, defaultShooterPoint } from '../../../../shared/targeting.js'
import { distance } from '../../../../shared/geometry.js'
import { keywordsOf } from '../../weaponRules.js'
import { CONTROL_RANGE, abilityNamed, gapBetween, operativeOf } from '../context.js'
import { mod } from '../effects.js'

// Vespid Stingwings (TAU-VESP), hand-checked against the June 2026 team rules
// (official online rules, including their errata and FAQ).

const PLOYS = {
  sting: 'TAU-VESP-S-ST',
  hardenedExoskeleton: 'TAU-VESP-S-HES',
  viciousVenom: 'TAU-VESP-T-VV',
  aerialAgility: 'TAU-VESP-S-AA',
  airbornePredators: 'TAU-VESP-S-AP',
  neutronOverload: 'TAU-VESP-T-NO',
  ocelli: 'TAU-VESP-T-OCL',
}
const COMMUNION_RANGE = 8
const COMMUNION_REROLL = 'TAU-VESP-communion-reroll'

const isNeutron = (weapon) => /neutron/i.test(weapon?.name ?? '')

// Communion: a Stingwing can only target the closest enemy within 8" of it (ignoring
// enemies within control range of other friendly Stingwings) unless a Communion point
// is spent. FAQ: a target more than 8" away always needs the point. -> reason or null
const communionSpendReason = (ctx) => {
  if (ctx.gap > COMMUNION_RANGE) return 'Target more than 8" away'
  const friends = ctx.operatives(ctx.shooter.seat, ctx.shooterToken)
  const candidates = ctx
    .operatives(ctx.target.seat)
    .filter((enemy) => gapBetween(enemy, ctx.shooterToken) <= COMMUNION_RANGE)
    .filter((enemy) => !friends.some((friend) => gapBetween(friend, enemy) <= CONTROL_RANGE))
  const closest = Math.min(...candidates.map((enemy) => gapBetween(enemy, ctx.shooterToken)))
  return ctx.gap > closest + 0.05 ? 'Not the closest enemy within 8"' : null
}

// Aerial Guidance (SUPPORT) needs a friendly Oversight Drone that the shooter is
// visible to and within 6" of, that can see the target, and isn't engaged.
const guidingDrone = (ctx) =>
  ctx.operatives(ctx.shooter.seat, ctx.shooterToken).find((drone) => {
    if (!keywordsOf(operativeOf(ctx.game, drone).opType).has('OVERSIGHT')) return false
    if (gapBetween(drone, ctx.shooterToken) > 6) return false
    if (ctx.operatives(ctx.target.seat).some((enemy) => gapBetween(enemy, drone) <= CONTROL_RANGE)) return false
    const sees = (token) =>
      !analyseTarget({
        tokens: ctx.tokens,
        players: ctx.game.players,
        walls: ctx.layout.walls,
        areas: ctx.layout.areas,
        shooter: drone,
        target: token,
        point: defaultShooterPoint(drone, token),
      }).hidden
    return sees(ctx.shooterToken) && sees(ctx.targetToken)
  }) ?? null

export const attack = (ctx) => {
  const { shooter, weapon } = ctx
  const owner = 'attacker'
  const mods = []
  if (ctx.stratActive(owner, PLOYS.airbornePredators)) {
    const base = { id: PLOYS.airbornePredators, owner, source: 'strat', name: 'Airborne Predators' }
    mods.push(
      ctx.movedThisActivation
        ? mod({ ...base, text: 'Moved this activation: Balanced', effect: { addRules: { balanced: true } }, tone: 'good' })
        : mod({ ...base, mode: 'inactive', text: 'It hasn’t moved this activation' }),
    )
  }
  if (!weapon) return mods
  if (isNeutron(weapon) && abilityNamed(shooter, 'Neutron Charge')) {
    const base = { id: 'TAU-VESP-neutron-charge', owner, source: 'faction', name: 'Neutron Charge' }
    mods.push(
      ctx.movedThisTp
        ? mod({ ...base, text: 'Moved this turning point: Piercing 1', effect: { addRules: { piercing: 1 } }, tone: 'good' })
        : mod({ ...base, mode: 'inactive', text: 'It hasn’t moved this turning point' }),
    )
  }
  const communion = abilityNamed(shooter, 'Communion') && !shooter.keywords.has('OVERSIGHT')
  if (communion && weapon.atk != null) {
    const reason = communionSpendReason(ctx)
    if (reason) {
      mods.push(
        mod({
          id: 'TAU-VESP-communion-target',
          owner,
          source: 'faction',
          name: 'Communion',
          mode: 'warning',
          text: `${reason}: spend 1 Communion point to target it`,
          effect: { spendsCommunion: true },
          tone: 'bad',
        }),
      )
    }
    mods.push(
      mod({
        id: COMMUNION_REROLL,
        owner,
        source: 'faction',
        name: 'Communion',
        mode: 'toggle',
        text: 'Spend 1 Communion point: re-roll one attack die',
        effect: { reroll: 'attack', spendsCommunion: true },
        tone: 'good',
      }),
    )
  }
  if (abilityNamed(shooter, 'Warrior Instincts') && /neutron blaster/i.test(weapon.name)) {
    mods.push(
      mod({
        id: 'TAU-VESP-warrior-instincts',
        owner,
        source: 'ability',
        name: 'Warrior Instincts',
        mode: 'default',
        text: 'No Communion point spent this sequence: Accurate 1',
        effect: { accurate: 1 },
        tone: 'good',
        blockedBy: (on) => (on.some((other) => other.effect?.spendsCommunion) ? 'A Communion point is spent this sequence' : null),
      }),
    )
  }
  const drone = weapon.atk != null ? guidingDrone(ctx) : null
  if (drone) {
    mods.push(
      mod({
        id: 'TAU-VESP-aerial-guidance',
        owner,
        source: 'ability',
        name: 'Aerial Guidance',
        mode: 'toggle',
        text: 'If the Oversight Drone used it: Lethal 5+ and Saturate',
        effect: { addRules: { lethal: 5, saturate: true } },
        tone: 'good',
      }),
    )
  }
  if (ctx.inBattle && ctx.movedThisActivation && weapon.atk != null) {
    mods.push(
      mod({
        id: PLOYS.ocelli,
        owner,
        source: 'firefight',
        name: 'Ocelli',
        mode: 'toggle',
        cost: 1,
        limit: 1,
        text: 'Used FLY this activation: Vantage benefits, counting 3" higher',
        effect: { vantageBonus: 3 },
        tone: 'good',
      }),
    )
  }
  if (ctx.inBattle && isNeutron(weapon) && ctx.movedThisActivation && ctx.gap <= 4 && weapon.atk != null) {
    const base = { id: PLOYS.neutronOverload, owner, source: 'firefight', name: 'Neutron Overload' }
    mods.push(
      ctx.certainlyObscured()
        ? mod({ ...base, mode: 'inactive', text: 'Obscured: no crits to resolve' })
        : mod({ ...base, mode: 'toggle', cost: 1, limit: 1, text: 'Within 4": D3 more damage when a crit is resolved', tone: 'good' }),
    )
  }
  if (weapon.rules.special.includes('Skytorch')) {
    mods.push(
      mod({
        id: 'TAU-VESP-skytorch',
        owner,
        source: 'weapon',
        name: 'Skytorch',
        text: 'No valid target: shoots everyone in its torch zone; they’re not in cover or obscured',
        effect: { skipTargeting: 'torch', noCover: true, noObscured: true },
      }),
    )
  }
  if (weapon.rules.special.includes('Neutron Fragment')) {
    mods.push(
      mod({
        id: 'TAU-VESP-neutron-fragment',
        owner,
        source: 'weapon',
        name: 'Neutron Fragment',
        mode: 'note',
        text: 'If the target survives any attack dice: it gains a Neutron Fragment token (D3 damage each activation)',
      }),
    )
  }
  if (weapon.rules.special.includes('Neutron Bombardment')) {
    mods.push(
      mod({
        id: 'TAU-VESP-neutron-bombardment',
        owner,
        source: 'weapon',
        name: 'Neutron Bombardment',
        mode: 'note',
        text: 'Place a Neutron Fallout marker within the primary target’s control range',
      }),
    )
  }
  return mods
}

export const defence = (ctx) => {
  const { target } = ctx
  const owner = 'defender'
  const mods = []
  if (ctx.stratActive(owner, PLOYS.aerialAgility)) {
    const base = { id: PLOYS.aerialAgility, owner, source: 'strat', name: 'Aerial Agility' }
    mods.push(
      ctx.counteracting || ctx.movedThisActivation
        ? mod({
            ...base,
            mode: 'note',
            text: 'Shooter moved or is counteracting: roll a D6 when a normal success would deal damage, 5+ ignores it (once)',
            tone: 'good',
          })
        : mod({ ...base, mode: 'inactive', text: 'The shooter hasn’t moved this activation' }),
    )
  }
  if (abilityNamed(target, 'Camouflaged')) {
    mods.push(
      mod({
        id: 'TAU-VESP-camouflaged',
        owner,
        source: 'ability',
        name: 'Camouflaged',
        text: 'Ignores Piercing; cover saves are crits',
        effect: { ignorePiercing: true, coverAsCrit: true },
        tone: 'good',
      }),
    )
  }
  if (abilityNamed(target, 'Ghost Rig') && target.order === 'conceal') {
    const base = { id: 'TAU-VESP-ghost-rig', owner, source: 'ability', name: 'Ghost Rig' }
    mods.push(
      ctx.gap > 6
        ? mod({ ...base, text: 'Conceal order, more than 6" away: not a valid target', effect: { notValid: 'Ghost Rig: Conceal order, more than 6" away' }, tone: 'good' })
        : mod({ ...base, mode: 'inactive', text: 'Within 6"' }),
    )
  }
  if (abilityNamed(target, 'Evasive Drone')) {
    mods.push(
      mod({ id: 'TAU-VESP-evasive-drone', owner, source: 'ability', name: 'Evasive Drone', text: 'Ignores Piercing', effect: { ignorePiercing: true }, tone: 'good' }),
    )
    if (target.order === 'conceal' && ctx.analysis.cover) {
      mods.push(
        mod({
          id: 'TAU-VESP-evasive-drone-cover',
          owner,
          source: 'ability',
          name: 'Evasive Drone',
          text: 'Conceal order and in cover: not a valid target (beats Seek and Vantage)',
          effect: { notValid: 'Evasive Drone: Conceal order and in cover' },
          tone: 'good',
        }),
      )
    }
  }
  return mods
}

const AGGRESSION_STIMULANT = 'TAU-VESP-AGS'

// Fighting (side 'attacker') or retaliating (side 'defender').
export const fight = (ctx, side) => {
  const { operative, weapon, retaliating } = ctx.fighter(side)
  const owner = side
  const mods = []
  const drone = operative.keywords.has('DRONE') || operative.keywords.has('OVERSIGHT')
  if (weapon && ctx.stratActive(owner, PLOYS.sting) && /^claws$/i.test(weapon.name)) {
    mods.push(
      mod({ id: PLOYS.sting, owner, source: 'strat', name: 'Sting', text: 'Claws: Hit +1, Lethal 5+, Shock', effect: { hit: -1, addRules: { lethal: 5, shock: true } }, tone: 'good' }),
    )
  }
  if (!drone && ctx.stratActive(owner, PLOYS.hardenedExoskeleton)) {
    mods.push(
      mod({
        id: PLOYS.hardenedExoskeleton,
        owner,
        source: 'strat',
        name: 'Hardened Exoskeleton',
        text: 'Normal Dmg of 4 or more deals 1 less to it',
        effect: { opponentDmgReduction: { atLeast: 4, by: 1 } },
        tone: 'good',
      }),
    )
  }
  if (!drone && !retaliating && weapon && ctx.hasEquipment(owner, AGGRESSION_STIMULANT)) {
    mods.push(mod({ id: AGGRESSION_STIMULANT, owner, source: 'equipment', name: 'Aggression Stimulant', text: 'Fighting: Ceaseless', effect: { addRules: { ceaseless: true } }, tone: 'good' }))
  }
  if (!drone && !retaliating && weapon && ctx.inBattle) {
    mods.push(
      mod({ id: PLOYS.viciousVenom, owner, source: 'firefight', name: 'Vicious Venom', mode: 'toggle', cost: 1, limit: 1, text: 'When it strikes with a crit: D3 more damage', tone: 'good' }),
    )
  }
  return mods
}

// The Swarmguard's torch zone: the area between where it started and ended its move
// (a 28mm Skytorch marker under its starting point marks it). Any part of an
// operative's base in it counts.
export const inTorchZone = (shooterToken, token) => {
  const from = shooterToken.lastMove?.from
  if (!from) return false
  const zoneR = Math.max(28 / 25.4 / 2, tokenRadiusIn(shooterToken))
  const dx = shooterToken.x - from.x
  const dy = shooterToken.y - from.y
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq ? Math.min(1, Math.max(0, ((token.x - from.x) * dx + (token.y - from.y) * dy) / lengthSq)) : 0
  const nearest = { x: from.x + dx * t, y: from.y + dy * t }
  return distance(nearest, token) <= zoneR + tokenRadiusIn(token)
}
