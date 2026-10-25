// Moved from pages/Game.jsx: equipment effects on operatives and their weapons.

export const parseEquipmentWeaponEffects = (effects) => {
  if (!effects) return []
  return String(effects)
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith('ADDWEP:'))
    .map((entry, index) => {
      const parts = entry.replace('ADDWEP:', '').split('|')
      const [name, range, atk, hit, dmg, wr] = parts
      return {
        key: `${name ?? 'weapon'}-${index}`,
        name: name?.trim() || 'Weapon',
        range: range?.trim() || '',
        ATK: atk?.trim() || '—',
        HIT: hit?.trim() || '—',
        DMG: dmg?.trim() || '—',
        WR: wr?.trim() || '—',
      }
    })
}

export const stripEquipmentTable = (description) => {
  if (!description) return ''
  const lines = String(description).split('\n')
  let inTable = false
  const result = []

  lines.forEach((line) => {
    if (line.includes('|**Name**|')) {
      inTable = true
      return
    }

    if (inTable) {
      if (!line.trim().startsWith('|')) {
        inTable = false
      } else {
        return
      }
    }

    result.push(line)
  })

  return result.join('\n').trim()
}

export const parseRules = (wrValue) => {
  if (!wrValue || wrValue === '—') return []
  return String(wrValue)
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean)
}

const addWeaponRule = (wrValue, ruleLabel) => {
  if (!ruleLabel) return wrValue
  if (!wrValue || wrValue === '—') return ruleLabel
  const rules = wrValue
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean)
  if (rules.some((rule) => rule.toLowerCase() === ruleLabel.toLowerCase())) {
    return wrValue
  }
  return `${wrValue}, ${ruleLabel}`
}

export const formatCostLabel = (item) => {
  if (!item) return null
  if (item.AP != null) return `${item.AP}AP`
  if (item.CP != null) return `${item.CP}CP`
  return null
}

export const isLegionaryUnit = (opType) =>
  /\bLEGIONARY\b/i.test(opType?.keywords ?? '')

const isPlasmaKnifeWeapon = (weapon) =>
  /plasma\s*knife/i.test(String(weapon?.wepName ?? ''))

const isFistsWeapon = (weapon) =>
  /^fists$/i.test(String(weapon?.wepName ?? '').trim())

const PHOBOS_PURITY_SEALS_IDS = new Set(['IMP-PHO-PS'])
const PHOBOS_ADDITIONAL_UTILITY_GRENADES_IDS = new Set(['IMP-PHO-AUG'])
const PHOBOS_COMBAT_BLADES_IDS = new Set(['IMP-PHO-CB'])
const PHOBOS_SPECIAL_ISSUE_AMMUNITION_IDS = new Set(['IMP-PHO-SIA'])

const HERNKYN_BOLT_SHELL_IDS = new Set(['VOT-HKY-FSBS', 'VOT-HKY-SBS'])
const HERNKYN_KV_UNDERSUIT_IDS = new Set(['VOT-HKY-KVCU'])
const NAVY_BREACHER_SLUGS_IDS = new Set(['IMP-INB-SL'])

const isHernkynBoltShellEquipment = (equipment) =>
  HERNKYN_BOLT_SHELL_IDS.has(String(equipment?.eqId ?? '')) ||
  /bolt\s*shell/i.test(String(equipment?.eqName ?? ''))

const isHernkynKvUndersuitEquipment = (equipment) =>
  HERNKYN_KV_UNDERSUIT_IDS.has(String(equipment?.eqId ?? '')) ||
  /kv[\s-]*ceramide\s*undersuit/i.test(String(equipment?.eqName ?? ''))

const isNavyBreacherSlugsEquipment = (equipment) =>
  NAVY_BREACHER_SLUGS_IDS.has(String(equipment?.eqId ?? '')) ||
  /^slugs$/i.test(String(equipment?.eqName ?? '').trim())

const unitHasNavisShotgun = (unit) =>
  (unit?.opType?.weapons ?? []).some((weapon) =>
    /navis\s*shotgun/i.test(String(weapon?.wepName ?? '')),
  )

const unitHasBoltShotgun = (unit) =>
  (unit?.opType?.weapons ?? []).some((weapon) =>
    /bolt\s*shotgun/i.test(String(weapon?.wepName ?? '')),
  )

const KOMMANDO_EXCLUDED_OP_IDS = new Set(['ORK-KOM-GROT', 'ORK-KOM-SQUIG'])
const KOMMANDO_CHOPPAS_IDS = new Set(['ORK-KOM-CHP'])
const KOMMANDO_COLLAPSIBLE_STOCKS_IDS = new Set(['ORK-KOM-CS'])
const KOMMANDO_DYNAMITE_IDS = new Set(['ORK-KOM-DYN'])
const KOMMANDO_HARPOON_IDS = new Set(['ORK-KOM-HRP'])

const isKommandoExcludedUnit = (unit) =>
  KOMMANDO_EXCLUDED_OP_IDS.has(String(unit?.opType?.opTypeId ?? ''))

const unitHasSluggaOrShokka = (unit) =>
  (unit?.opType?.weapons ?? []).some((weapon) =>
    /slugga|shokka/i.test(String(weapon?.wepName ?? '')),
  )

const isKommandoChoppasEquipment = (equipment) =>
  KOMMANDO_CHOPPAS_IDS.has(String(equipment?.eqId ?? ''))

const isKommandoCollapsibleStocksEquipment = (equipment) =>
  KOMMANDO_COLLAPSIBLE_STOCKS_IDS.has(String(equipment?.eqId ?? ''))

const isKommandoDynamiteEquipment = (equipment) =>
  KOMMANDO_DYNAMITE_IDS.has(String(equipment?.eqId ?? ''))

const isKommandoHarpoonEquipment = (equipment) =>
  KOMMANDO_HARPOON_IDS.has(String(equipment?.eqId ?? ''))

const isPhobosPuritySealsEquipment = (equipment) =>
  PHOBOS_PURITY_SEALS_IDS.has(String(equipment?.eqId ?? '')) ||
  /purity\s*seals/i.test(String(equipment?.eqName ?? ''))

const isPhobosAdditionalUtilityGrenadesEquipment = (equipment) =>
  PHOBOS_ADDITIONAL_UTILITY_GRENADES_IDS.has(String(equipment?.eqId ?? '')) ||
  /additional\s*utility\s*grenades/i.test(String(equipment?.eqName ?? ''))

const isPhobosCombatBladesEquipment = (equipment) =>
  PHOBOS_COMBAT_BLADES_IDS.has(String(equipment?.eqId ?? '')) ||
  /combat\s*blades/i.test(String(equipment?.eqName ?? ''))

const isPhobosSpecialIssueAmmunitionEquipment = (equipment) =>
  PHOBOS_SPECIAL_ISSUE_AMMUNITION_IDS.has(String(equipment?.eqId ?? '')) ||
  /special\s*issue\s*ammunition/i.test(String(equipment?.eqName ?? ''))

const unitHasPhobosSiaWeapon = (unit) =>
  (unit?.opType?.weapons ?? []).some((weapon) => {
    const weaponName = String(weapon?.wepName ?? '').trim().toLowerCase()
    return (
      weaponName === 'bolt carbine' ||
      weaponName === 'marksman bolt carbine' ||
      weaponName === 'occulus bolt carbine'
    )
  })

const buildKommandoAssignedEquipmentForUnit = ({ unit, selectedEquipment }) => {
  if (isKommandoExcludedUnit(unit)) return []
  return (selectedEquipment ?? []).filter((equipment) => {
    if (isKommandoChoppasEquipment(equipment)) return false
    if (isKommandoDynamiteEquipment(equipment)) return true
    if (isKommandoHarpoonEquipment(equipment)) return true
    if (isKommandoCollapsibleStocksEquipment(equipment)) {
      return unitHasSluggaOrShokka(unit)
    }
    return false
  })
}

export const buildAssignedEquipmentForUnit = ({ unit, selectedEquipment, killteamId }) => {
  if (killteamId === 'VOT-HKY') {
    const hasBoltShotgun = unitHasBoltShotgun(unit)
    return (selectedEquipment ?? []).filter((equipment) => {
      if (isHernkynKvUndersuitEquipment(equipment)) return true
      if (isHernkynBoltShellEquipment(equipment)) return hasBoltShotgun
      return false
    })
  }

  if (killteamId === 'ORK-KOM') {
    return buildKommandoAssignedEquipmentForUnit({
      unit,
      selectedEquipment,
    })
  }

  if (killteamId === 'IMP-PHO') {
    const hasSiaWeapon = unitHasPhobosSiaWeapon(unit)
    return (selectedEquipment ?? []).filter((equipment) => {
      if (isPhobosAdditionalUtilityGrenadesEquipment(equipment)) return false
      if (isPhobosPuritySealsEquipment(equipment)) return true
      if (isPhobosCombatBladesEquipment(equipment)) return false
      if (isPhobosSpecialIssueAmmunitionEquipment(equipment)) return hasSiaWeapon
      return false
    })
  }

  if (killteamId === 'IMP-INB') {
    const hasNavisShotgun = unitHasNavisShotgun(unit)
    return (selectedEquipment ?? []).filter((equipment) => {
      if (isNavyBreacherSlugsEquipment(equipment)) return hasNavisShotgun
      return true
    })
  }

  return []
}

const buildEquipmentWeapon = (equipment, weaponEffect) => {
  const normalizedName = String(weaponEffect.name ?? 'weapon')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const wepId = `${equipment.eqId}-${normalizedName || 'weapon'}`
  return {
    wepId,
    wepName: weaponEffect.name || 'Plasma Knife',
    wepType: weaponEffect.range || 'M',
    profiles: [
      {
        wepprofileId: `${wepId}-0`,
        wepId,
        ATK: weaponEffect.ATK,
        HIT: weaponEffect.HIT,
        DMG: weaponEffect.DMG,
        WR: weaponEffect.WR,
      },
    ],
  }
}

const applyYaegirPlasmaKnifeEquipment = (weapons, equipmentWeapon) => {
  if (!equipmentWeapon) return weapons
  const sourceWeapons = Array.isArray(weapons) ? weapons : []
  const hasPlasmaKnife = sourceWeapons.some((weapon) => isPlasmaKnifeWeapon(weapon))

  if (hasPlasmaKnife) {
    return sourceWeapons.map((weapon) => {
      if (!isPlasmaKnifeWeapon(weapon)) return weapon
      const profiles = (weapon.profiles ?? []).map((profile) => ({
        ...profile,
        WR: addWeaponRule(profile.WR, 'Balanced'),
      }))
      return {
        ...weapon,
        profiles,
      }
    })
  }

  const fistsIndex = sourceWeapons.findIndex((weapon) => isFistsWeapon(weapon))
  if (fistsIndex >= 0) {
    return sourceWeapons.map((weapon, index) =>
      index === fistsIndex ? equipmentWeapon : weapon,
    )
  }

  return [...sourceWeapons, equipmentWeapon]
}

const applyKommandoChoppasEquipment = (weapons, equipmentWeapon) => {
  if (!equipmentWeapon) return weapons
  const sourceWeapons = Array.isArray(weapons) ? weapons : []
  return sourceWeapons.map((weapon) =>
    isFistsWeapon(weapon)
      ? {
          ...equipmentWeapon,
          wepId: `${equipmentWeapon.wepId}-${weapon.wepId ?? 'fists'}`,
          profiles: (equipmentWeapon.profiles ?? []).map((profile, profileIndex) => ({
            ...profile,
            wepprofileId: `${equipmentWeapon.wepId}-${weapon.wepId ?? 'fists'}-${profileIndex}`,
          })),
        }
      : weapon,
  )
}

const isKommandoCollapsibleStocksWeapon = (weapon) =>
  /slugga|shokka/i.test(String(weapon?.wepName ?? ''))

const removeRangeWeaponRule = (wrValue) => {
  if (!wrValue || wrValue === '—') return wrValue
  const remainingRules = String(wrValue)
    .split(',')
    .map((rule) => rule.trim())
    .filter((rule) => rule && !/^(rng|range)\b/i.test(rule))
  return remainingRules.length ? remainingRules.join(', ') : '—'
}

const applyKommandoCollapsibleStocksEquipment = (weapons, isSelected) => {
  if (!isSelected) return weapons
  const sourceWeapons = Array.isArray(weapons) ? weapons : []
  return sourceWeapons.map((weapon) => {
    if (!isKommandoCollapsibleStocksWeapon(weapon)) return weapon
    return {
      ...weapon,
      profiles: (weapon.profiles ?? []).map((profile) => ({
        ...profile,
        WR: removeRangeWeaponRule(profile.WR),
      })),
    }
  })
}

const applyPhobosCombatBladesEquipment = (weapons, equipmentWeapon) => {
  if (!equipmentWeapon) return weapons
  const sourceWeapons = Array.isArray(weapons) ? weapons : []
  return sourceWeapons.map((weapon) =>
    isFistsWeapon(weapon)
      ? {
          ...equipmentWeapon,
          wepId: `${equipmentWeapon.wepId}-${weapon.wepId ?? 'fists'}`,
          profiles: (equipmentWeapon.profiles ?? []).map((profile, profileIndex) => ({
            ...profile,
            wepprofileId: `${equipmentWeapon.wepId}-${weapon.wepId ?? 'fists'}-${profileIndex}`,
          })),
        }
      : weapon,
  )
}

const findEquipmentWeapon = (selectedEquipment, matchEquipment, rowPattern) => {
  for (const equipment of selectedEquipment) {
    if (matchEquipment && !matchEquipment(equipment)) continue
    const row = parseEquipmentWeaponEffects(equipment.effects).find((candidate) =>
      rowPattern.test(String(candidate.name ?? '')),
    )
    if (row) return buildEquipmentWeapon(equipment, row)
  }
  return null
}

// Kill-team-specific weapon changes from selected equipment (was inline in Game.jsx).
const applyEquipmentToWeapons = (killteamId, weapons, selectedEquipment) => {
  if (killteamId === 'VOT-HKY') {
    return applyYaegirPlasmaKnifeEquipment(
      weapons,
      findEquipmentWeapon(selectedEquipment, null, /plasma\s*knife/i),
    )
  }
  if (killteamId === 'ORK-KOM') {
    const choppas = findEquipmentWeapon(selectedEquipment, isKommandoChoppasEquipment, /choppa/i)
    const stocks = selectedEquipment.some((equipment) => isKommandoCollapsibleStocksEquipment(equipment))
    return applyKommandoCollapsibleStocksEquipment(applyKommandoChoppasEquipment(weapons, choppas), stocks)
  }
  if (killteamId === 'IMP-PHO') {
    return applyPhobosCombatBladesEquipment(
      weapons,
      findEquipmentWeapon(selectedEquipment, isPhobosCombatBladesEquipment, /combat\s*blade/i),
    )
  }
  return weapons
}

export const selectedEquipmentFor = (killteam, equipmentIds) => {
  const ids = new Set(equipmentIds ?? [])
  return (killteam?.equipments ?? []).filter((equipment) => ids.has(equipment.eqId))
}

// The player's chosen operatives with weapon selections and equipment applied.
//   units: output of expandUnits(killteam)
export const buildRosterUnits = ({ killteam, units, selectedKeys, weaponsByUnit, equipmentIds }) => {
  if (!killteam) return []
  const killteamId = killteam.killteamId
  const chosen = new Set(selectedKeys ?? [])
  const selectedEquipment = selectedEquipmentFor(killteam, equipmentIds)
  return units
    .filter((unit) => chosen.has(unit.key))
    .map((unit) => {
      const selection = weaponsByUnit?.[unit.key]
      const allowed = Array.isArray(selection) ? new Set(selection) : null
      const baseWeapons = (unit.opType.weapons ?? []).filter(
        (weapon, index) => !allowed || allowed.has(weapon.wepId ?? `${weapon.wepName ?? 'weapon'}-${index}`),
      )
      return {
        ...unit,
        opType: { ...unit.opType, weapons: applyEquipmentToWeapons(killteamId, baseWeapons, selectedEquipment) },
        assignedEquipment: buildAssignedEquipmentForUnit({ unit, selectedEquipment, killteamId }),
      }
    })
}
