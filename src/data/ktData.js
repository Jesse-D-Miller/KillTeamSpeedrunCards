import ktData from './kt24_v4.json'
import weaponRulesData from './weaponRules.json'

const RULE_PATTERN = /\*\*([^*]+)\*\*:\s*([\s\S]*?)(?=\n\s*\*\*|$)/g

const normalizeRuleName = (value) =>
  String(value).toLowerCase().replace(/\s+/g, ' ').trim()

const collapseRuleName = (value) => normalizeRuleName(value).replace(/\s/g, '')

const stripRuleToken = (value) =>
  normalizeRuleName(value)
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9]/g, '')

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const createPlaceholderRegex = (template) => {
  if (!template || !String(template).includes('_')) return null
  const escaped = escapeRegExp(template)
  const pattern = escaped.replace(/_+/g, '(.+?)')
  return new RegExp(`^${pattern}$`, 'i')
}

const substitutePlaceholder = (template, value) => {
  if (!template || value == null) return template
  return String(template).replace(/_+/g, String(value).trim())
}

const weaponRules = weaponRulesData?.weaponrules ?? []

const buildWeaponRuleIndex = (rules) => {
  const index = {
    exact: new Map(),
    exactStripped: new Map(),
    codeExact: new Map(),
    codeStripped: new Map(),
    regex: [],
    names: [],
  }

  rules.forEach((rule) => {
    if (!rule?.ruleName || !rule?.description) return

    const nameKey = normalizeRuleName(rule.ruleName)
    const nameStripped = stripRuleToken(rule.ruleName)
    const codeKey = normalizeRuleName(rule.code)
    const codeStripped = stripRuleToken(rule.code)

    if (!index.exact.has(nameKey)) index.exact.set(nameKey, rule)
    if (nameStripped && !index.exactStripped.has(nameStripped)) {
      index.exactStripped.set(nameStripped, rule)
    }
    if (codeKey && !index.codeExact.has(codeKey)) {
      index.codeExact.set(codeKey, rule)
    }
    if (codeStripped && !index.codeStripped.has(codeStripped)) {
      index.codeStripped.set(codeStripped, rule)
    }

    const nameRegex = createPlaceholderRegex(rule.ruleName)
    if (nameRegex) index.regex.push({ rule, regex: nameRegex })

    const codeRegex = createPlaceholderRegex(rule.code)
    if (codeRegex) index.regex.push({ rule, regex: codeRegex })

    index.names.push({
      name: rule.ruleName,
      normalized: nameKey,
      stripped: nameStripped,
    })
  })

  return index
}

const weaponRuleIndex = buildWeaponRuleIndex(weaponRules)

const buildWeaponRuleTextMatchers = (rules) =>
  rules
    .filter((rule) => rule?.ruleName)
    .map((rule) => {
      const template = String(rule.ruleName).trim()
      if (!template) return null
      const escaped = escapeRegExp(template)
      const pattern = template.includes('_')
        ? escaped.replace(/_+/g, '\\s*[^\\s,.;:()]+')
        : `\\b${escaped}\\b`
      return {
        ruleName: template,
        regex: new RegExp(pattern, 'gi'),
      }
    })
    .filter(Boolean)

const weaponRuleTextMatchers = buildWeaponRuleTextMatchers(weaponRules)

const tokenizeWeaponRuleText = (text) => {
  if (!text || !weaponRuleTextMatchers.length) {
    return [{ type: 'text', value: String(text ?? '') }]
  }

  const content = String(text)
  const segments = []
  let cursor = 0

  while (cursor < content.length) {
    let bestMatch = null

    for (const matcher of weaponRuleTextMatchers) {
      matcher.regex.lastIndex = cursor
      const match = matcher.regex.exec(content)
      if (!match) continue

      const matchStart = match.index
      const matchValue = match[0]
      const matchEnd = matchStart + matchValue.length

      if (
        !bestMatch ||
        matchStart < bestMatch.start ||
        (matchStart === bestMatch.start &&
          matchValue.length > bestMatch.value.length)
      ) {
        bestMatch = {
          start: matchStart,
          end: matchEnd,
          value: matchValue,
          ruleName: matchValue,
        }
      }
    }

    if (!bestMatch) {
      segments.push({ type: 'text', value: content.slice(cursor) })
      break
    }

    if (bestMatch.start > cursor) {
      segments.push({
        type: 'text',
        value: content.slice(cursor, bestMatch.start),
      })
    }

    segments.push({
      type: 'rule',
      value: bestMatch.value,
      ruleName: bestMatch.ruleName,
    })

    cursor = bestMatch.end
  }

  return segments
}

const resolveWeaponRule = (ruleName) => {
  if (!ruleName) return null
  const normalized = normalizeRuleName(ruleName)
  const stripped = stripRuleToken(ruleName)

  const directRule =
    weaponRuleIndex.exact.get(normalized) ??
    weaponRuleIndex.exactStripped.get(stripped) ??
    weaponRuleIndex.codeExact.get(normalized) ??
    weaponRuleIndex.codeStripped.get(stripped)

  if (directRule) {
    return {
      name: directRule.ruleName,
      description: directRule.description,
    }
  }

  for (const entry of weaponRuleIndex.regex) {
    const match = String(ruleName).match(entry.regex)
    if (!match) continue
    const value = match[1]
    return {
      name: substitutePlaceholder(entry.rule.ruleName, value),
      description: substitutePlaceholder(entry.rule.description, value),
    }
  }

  return null
}

const buildRuleGlossary = (data) => {
  const glossary = new Map()

  const addRule = (name, description) => {
    const trimmedName = String(name).trim()
    const trimmedDescription = String(description).trim()
    if (!trimmedName || !trimmedDescription) return

    const normalized = normalizeRuleName(trimmedName)
    const collapsed = collapseRuleName(trimmedName)
    const stripped = stripRuleToken(trimmedName)

    if (!glossary.has(normalized)) {
      glossary.set(normalized, {
        name: trimmedName,
        description: trimmedDescription,
      })
    }
    if (!glossary.has(collapsed)) {
      glossary.set(collapsed, {
        name: trimmedName,
        description: trimmedDescription,
      })
    }
    if (stripped && !glossary.has(stripped)) {
      glossary.set(stripped, {
        name: trimmedName,
        description: trimmedDescription,
      })
    }
  }

  const extractRulesFromText = (text) => {
    if (!text.includes('**') || !text.includes(':')) return
    let match
    while ((match = RULE_PATTERN.exec(text)) !== null) {
      addRule(match[1], match[2])
    }
  }

  const walk = (value) => {
    if (!value) return
    if (typeof value === 'string') {
      extractRulesFromText(value)
      return
    }
    if (Array.isArray(value)) {
      value.forEach(walk)
      return
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(walk)
    }
  }

  data.forEach(walk)
  return glossary
}

const ruleGlossary = buildRuleGlossary(ktData)
const ruleNameIndex = Array.from(ruleGlossary.values()).reduce(
  (accumulator, entry) => {
    const key = normalizeRuleName(entry.name)
    if (!accumulator.seen.has(key)) {
      accumulator.seen.set(key, true)
      accumulator.list.push({
        name: entry.name,
        normalized: key,
        stripped: stripRuleToken(entry.name),
      })
    }
    return accumulator
  },
  { list: [], seen: new Map() },
).list

const killteamSummaries = ktData
  .map((team) => ({
    killteamId: team.killteamId,
    killteamName: team.killteamName,
    factionId: team.factionId,
    description: team.description,
    archetypes: team.archetypes,
    roster: team.defaultRoster,
    opTypes: team.opTypes ?? [],
  }))
  .sort((a, b) => a.killteamName.localeCompare(b.killteamName))

const killteamById = new Map(ktData.map((team) => [team.killteamId, team]))

const getKillteams = () => killteamSummaries

const getKillteamById = (killteamId) => {
  if (!killteamId) return null
  return killteamById.get(killteamId) ?? null
}

const getOperativeById = (killteam, opTypeId) => {
  if (!killteam || !opTypeId) return null
  return killteam.opTypes?.find((opType) => opType.opTypeId === opTypeId) ?? null
}

const getRuleDescription = (ruleName) => {
  if (!ruleName) return null
  const weaponRule = resolveWeaponRule(ruleName)
  if (weaponRule) return weaponRule
  const normalized = normalizeRuleName(ruleName)
  const collapsed = collapseRuleName(ruleName)
  const stripped = stripRuleToken(ruleName)
  return (
    ruleGlossary.get(normalized) ??
    ruleGlossary.get(collapsed) ??
    ruleGlossary.get(stripped) ??
    null
  )
}

const getRuleSuggestions = (ruleName, limit = 3) => {
  if (!ruleName) return []
  const normalized = normalizeRuleName(ruleName)
  const stripped = stripRuleToken(ruleName)
  if (!normalized && !stripped) return []
  const weaponMatches = weaponRuleIndex.names
    .filter(
      (entry) =>
        (normalized && entry.normalized.includes(normalized)) ||
        (stripped && entry.stripped.includes(stripped)),
    )
    .map((entry) => entry.name)

  const glossaryMatches = ruleNameIndex
    .filter(
      (entry) =>
        (normalized && entry.normalized.includes(normalized)) ||
        (stripped && entry.stripped.includes(stripped)),
    )
    .map((entry) => entry.name)

  return Array.from(new Set([...weaponMatches, ...glossaryMatches])).slice(
    0,
    limit,
  )
}

export {
  getKillteams,
  getKillteamById,
  getOperativeById,
  getRuleDescription,
  getRuleSuggestions,
  tokenizeWeaponRuleText,
}
