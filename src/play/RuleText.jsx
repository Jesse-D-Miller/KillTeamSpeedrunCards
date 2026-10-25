import { createContext, useContext, useMemo, useState } from 'react'
import { getRuleDescription, getRuleSuggestions, tokenizeWeaponRuleText } from '../data/ktData.js'

// Rule-aware text: weapon/ability rule names become tappable and open a shared modal.
// (Moved from the inline helpers in pages/Game.jsx.)

const RuleContext = createContext(() => {})

const isRangeRule = (rule) => /^(Rng|Range)\b/i.test(rule)

export function RuleText({ text }) {
  const openRule = useContext(RuleContext)
  return String(text ?? '')
    .split('\n')
    .map((line, lineIndex, lines) => (
      <span key={lineIndex}>
        {tokenizeWeaponRuleText(line).map((token, tokenIndex) =>
          token.type === 'rule' && !isRangeRule(token.value) ? (
            <button
              key={tokenIndex}
              type="button"
              className="rule-link"
              onClick={(event) => {
                event.stopPropagation()
                openRule(token.ruleName)
              }}
            >
              {token.value}
            </button>
          ) : (
            <span key={tokenIndex}>{token.value}</span>
          ),
        )}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    ))
}

export function RuleProvider({ children }) {
  const [ruleName, setRuleName] = useState(null)
  const details = useMemo(() => (ruleName ? getRuleDescription(ruleName) : null), [ruleName])
  const suggestions = useMemo(
    () => (ruleName && !details ? getRuleSuggestions(ruleName, 3) : []),
    [ruleName, details],
  )
  return (
    <RuleContext.Provider value={setRuleName}>
      {children}
      {ruleName ? (
        <div className="sheet-backdrop" onClick={() => setRuleName(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head">
              <h3>{details?.name ?? ruleName}</h3>
              <button type="button" className="btn" onClick={() => setRuleName(null)}>
                Close
              </button>
            </div>
            <div className="sheet-body">
              {details?.description ?? (
                <>
                  <p>Rule details were not found in the data.</p>
                  {suggestions.length ? <p>Possible matches: {suggestions.join(', ')}</p> : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </RuleContext.Provider>
  )
}
