import { weaponLabel, weaponRuleChips } from '../rules/weaponRules.js'
import { RuleText } from './RuleText.jsx'

// Shoot or Fight, picked from an operative's action ring: every weapon it can use for
// that, as big cards over the map, so each profile and its rules are easy to read.
// Each card: the profile in big type, its rules in full words, then the rules as
// printed on the datacard. Tapping the profile picks it; tapping a printed rule's name
// explains it.
//   mode: 'shoot' | 'fight'
function WeaponChooser({ mode, operativeName, weapons, selectedId, onChoose, onClose }) {
  return (
    <div className="weapon-chooser" role="dialog" aria-modal="true" aria-label="Choose a weapon">
      <header className="weapon-chooser-head">
        <h2>
          {mode === 'fight' ? 'Fight' : 'Shoot'} <span className="muted">· {operativeName}</span>
        </h2>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </header>
      {weapons.length ? (
        <div className="weapon-chooser-grid">
          {weapons.map((weapon) => (
            <article key={weapon.id} className={`weapon-card${weapon.id === selectedId ? ' is-selected' : ''}`}>
              <button
                type="button"
                className="weapon-card-pick"
                aria-pressed={weapon.id === selectedId}
                onClick={() => onChoose(weapon.id)}
              >
                <span className="weapon-card-name">{weaponLabel(weapon)}</span>
                {weapon.atk != null ? (
                  <span className="weapon-card-stats">
                    {[
                      ['ATK', weapon.atk],
                      ['HIT', `${weapon.hit}+`],
                      ['DMG', `${weapon.dmg.normal}/${weapon.dmg.crit}`],
                    ].map(([label, value]) => (
                      <span key={label} className="weapon-card-stat">
                        <span className="weapon-card-stat-label">{label}</span>
                        <span className="weapon-card-stat-value">{value}</span>
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
              <div className="weapon-card-rules">
                {weaponRuleChips(weapon.rules).length ? (
                  <ul className="weapon-card-chips">
                    {weaponRuleChips(weapon.rules).map((chip) => (
                      <li key={chip}>{chip}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted">No weapon rules</span>
                )}
                {weapon.note ? <p>{weapon.note}</p> : null}
                {weapon.uses ? <p className="muted">{weapon.uses}</p> : null}
                {weapon.wr && weapon.wr !== '-' ? (
                  <p className="weapon-card-printed">
                    <span className="muted">As printed: </span>
                    <RuleText text={weapon.wr} />
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted weapon-chooser-empty">{mode === 'fight' ? 'No melee weapons.' : 'No ranged weapons.'}</p>
      )}
    </div>
  )
}

export default WeaponChooser
