import './BoardSide.css'

function BoardSide({
  mapClass,
  side,
  cardClassName,
  killOpClassName,
  cardContent,
  killOpContent,
  killOpFirst = false,
}) {
  const isMap02 = mapClass?.includes('is-map-02')
  const cardInnerClassName = isMap02
    ? `board-side__inner board-side__inner--card ${side}`
    : 'board-side__inner'
  const killOpInnerClassName = isMap02
    ? `board-side__inner board-side__inner--killop ${side}`
    : 'board-side__inner'

  return (
    <div className={`board-op-group ${mapClass} ${side}`}>
      {killOpFirst ? (
        <>
          <div
            className={`board-side__slot board-side__slot--primary board-side__slot--killop ${killOpClassName}`}
          >
            <div className={killOpInnerClassName}>{killOpContent}</div>
          </div>
          <div className="board-side__placeholder board-side__placeholder--tac">
            TAC
          </div>
          <div className="board-side__placeholder board-side__placeholder--cat">
            CAT
          </div>
          <div
            className={`board-side__slot board-side__slot--secondary board-side__slot--card ${cardClassName}`}
          >
            <div className={cardInnerClassName}>{cardContent}</div>
          </div>
        </>
      ) : (
        <>
          <div
            className={`board-side__slot board-side__slot--primary board-side__slot--card ${cardClassName}`}
          >
            <div className={cardInnerClassName}>{cardContent}</div>
          </div>
          <div className="board-side__placeholder board-side__placeholder--tac">
            TAC
          </div>
          <div className="board-side__placeholder board-side__placeholder--cat">
            CAT
          </div>
          <div
            className={`board-side__slot board-side__slot--secondary board-side__slot--killop ${killOpClassName}`}
          >
            <div className={killOpInnerClassName}>{killOpContent}</div>
          </div>
        </>
      )}
    </div>
  )
}

export default BoardSide
