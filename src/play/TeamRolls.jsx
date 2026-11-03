import { usePlayer } from './usePlayer.js'

// Rolls the app is waiting for that aren't about one operative or marker (e.g. Vespid
// Communion in the Ready step): the player rolls and taps the result here.
//   die: 3 | 6; onPick(value).
export function DiceButtons({ die, onPick }) {
  return (
    <div className="dice-buttons" role="group" aria-label={`D${die} result`}>
      {Array.from({ length: die }, (_, index) => (
        <button key={index} type="button" className="btn dice-button" aria-label={`Rolled ${index + 1}`} onClick={() => onPick(index + 1)}>
          {index + 1}
        </button>
      ))}
    </div>
  )
}

function TeamRolls() {
  const { state: game, seat, act } = usePlayer()
  const rolls = (game.battle.rolls ?? []).filter((roll) => roll.seat === seat && roll.tokenId == null)
  if (!rolls.length) return null
  return (
    <section className="strategy-step team-rolls" data-team-rolls>
      <h4>Ready step: roll</h4>
      {rolls.map((roll) => (
        <div key={roll.id} className="team-roll" data-roll-kind={roll.kind}>
          <p>{roll.label}</p>
          <DiceButtons die={roll.max ?? roll.die} onPick={(value) => act({ type: 'battle/roll', id: roll.id, value })} />
        </div>
      ))}
    </section>
  )
}

export default TeamRolls
