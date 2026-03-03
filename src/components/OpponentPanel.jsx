import { useState } from 'react'
import UnitCard from './UnitCard.jsx'
import './OpponentPanel.css'

function OpponentPanel({
  isOpen,
  onClose,
  onRefresh,
  wsReady,
  opponentRefreshAt,
  opponentRenderState,
  opponentKillteam,
  opponentAllUnits,
  debugInfo,
  roomCode,
  playerId,
}) {
  const [openDetailsByUnit, setOpenDetailsByUnit] = useState({})
  const hasDebug = debugInfo && Object.keys(debugInfo).length > 0
  const selectedUnitSet = new Set(opponentRenderState?.selectedUnits ?? [])
  const visibleOpponentUnits = selectedUnitSet.size
    ? opponentAllUnits.filter((unit) => selectedUnitSet.has(unit.key))
    : opponentAllUnits
  return (
    <>
      <div
        className={`opponent-backdrop${isOpen ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <aside
        className={`opponent-panel${isOpen ? ' open' : ''}`}
        aria-hidden={!isOpen}
      >
        <div className="opponent-panel-header">
          <div>
            <p className="opponent-eyebrow">Opponent</p>
            <h2>{opponentRenderState?.name || 'Waiting for opponent'}</h2>
            <p className="opponent-subtitle">
              {opponentKillteam?.killteamName || 'No team selected yet.'}
            </p>
          </div>
          <div className="opponent-panel-actions">
            <button
              className="ghost-link opponent-refresh"
              type="button"
              onClick={onRefresh}
              disabled={!wsReady}
            >
              Refresh
            </button>
            <button
              className="ghost-link"
              type="button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="opponent-panel-body">
          {opponentRefreshAt ? (
            <p className="opponent-refresh-note">
              Requested at {new Date(opponentRefreshAt).toLocaleTimeString()}
            </p>
          ) : null}
          {opponentKillteam ? (
            visibleOpponentUnits.length ? (
              <div className="game-grid opponent-grid">
                {visibleOpponentUnits.map(
                  ({ opType, instance, instanceCount, key }) => {
                    const maxWounds = Number.parseInt(opType.WOUNDS, 10)
                    const safeMax = Number.isNaN(maxWounds) ? 0 : maxWounds
                    const isDeadMarked = Boolean(opponentRenderState?.deadUnits?.[key])
                    const currentWounds =
                      isDeadMarked
                        ? 0
                        : opponentRenderState?.woundsByUnit?.[key] == null
                        ? safeMax
                        : opponentRenderState.woundsByUnit[key]
                    const detailsOpen = Boolean(openDetailsByUnit[key])
                    const aplAdjustment =
                      opponentRenderState?.aplAdjustByUnit?.[key] ?? 0
                    const isLegionary = /\bLEGIONARY\b/i.test(
                      opType?.keywords ?? '',
                    )
                    const legionaryMark = isLegionary
                      ? opponentRenderState?.legionaryMarkByUnit?.[key] ??
                        null
                      : null
                    return (
                      <UnitCard
                        key={`opponent-${key}`}
                        opType={opType}
                        instance={instance}
                        instanceCount={instanceCount}
                        currentWounds={currentWounds}
                        detailsOpen={detailsOpen}
                        onToggleDetails={() =>
                          setOpenDetailsByUnit((prev) => ({
                            ...prev,
                            [key]: !prev[key],
                          }))
                        }
                        aplAdjustment={aplAdjustment}
                        legionaryMark={legionaryMark}
                        state={
                          opponentRenderState?.unitStates?.[key] ?? 'ready'
                        }
                        stance={
                          opponentRenderState?.stanceByUnit?.[key] ?? 'conceal'
                        }
                        selectedStatuses={
                          opponentRenderState?.statusesByUnit?.[key] ?? []
                        }
                        readOnly
                      />
                    )
                  },
                )}
              </div>
            ) : (
              <div className="empty-state">No opponent units available.</div>
            )
          ) : (
            <div className="empty-state">Waiting for opponent data.</div>
          )}
          <div className="opponent-debug">
            <div>room: {roomCode || 'n/a'}</div>
            <div>player: {playerId || 'n/a'}</div>
            <div>wsReady: {wsReady ? 'yes' : 'no'}</div>
            <div>
              mounted: {debugInfo?.mountedAt
                ? new Date(debugInfo.mountedAt).toLocaleTimeString()
                : 'n/a'}
            </div>
            <div>
              last request: {debugInfo?.lastRequestAt
                ? new Date(debugInfo.lastRequestAt).toLocaleTimeString()
                : 'n/a'}
            </div>
            <div>
              panel open click: {debugInfo?.lastPanelOpenAt
                ? new Date(debugInfo.lastPanelOpenAt).toLocaleTimeString()
                : 'n/a'}
            </div>
            <div>
              panel state: {debugInfo?.lastPanelOpenState || 'n/a'}
              {debugInfo?.lastPanelOpenStateAt
                ? ` @ ${new Date(debugInfo.lastPanelOpenStateAt).toLocaleTimeString()}`
                : ''}
            </div>
            <div>
              request blocked: {debugInfo?.lastRequestBlocked == null
                ? 'n/a'
                : debugInfo.lastRequestBlocked
                  ? 'yes'
                  : 'no'}
            </div>
            <div>
              last opponent: {debugInfo?.lastOpponentAt
                ? new Date(debugInfo.lastOpponentAt).toLocaleTimeString()
                : 'n/a'}
            </div>
            <div>
              last source: {debugInfo?.lastOpponentSource || 'n/a'}
            </div>
            <div>
              summary: {debugInfo?.lastOpponentSummary
                ? `${debugInfo.lastOpponentSummary.name || 'unknown'} / ${debugInfo.lastOpponentSummary.killteamId || 'n/a'} / units ${debugInfo.lastOpponentSummary.selectedUnits}`
                : hasDebug
                  ? 'n/a'
                  : 'no debug events yet'}
            </div>
            <div>last error: {debugInfo?.lastError || 'n/a'}</div>
          </div>
        </div>
      </aside>
    </>
  )
}

export default OpponentPanel
