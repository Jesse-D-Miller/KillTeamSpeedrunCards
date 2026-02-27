import './CritOpsCard.css'

function CritOpsCard({ card, isTwoColumn = false, layoutVariant = '' }) {
	if (!card) return null
	const mission = card.missionAction ?? {}
	const victory = card.victoryPoints ?? {}
	const additional = card.additionalRules ?? {}
	const missionBullets = mission.bullets ?? []
	const victoryBullets = victory.bullets ?? []

	const missionBlock = (
		<section className="critops-card__section">
			<div className="critops-card__section-head">
				<h3 className="critops-card__section-title">
					{mission.title || 'MISSION ACTION'}
				</h3>
			</div>
			<div className="critops-card__section-box critops-card__section-box--mission">
				{mission.subtitle || mission.cost ? (
					<div className="critops-card__subtitle-row">
						<p className="critops-card__subtitle">{mission.subtitle || ''}</p>
						{mission.cost ? (
							<span className="critops-card__cost">{mission.cost}</span>
						) : null}
					</div>
				) : null}
				{missionBullets.length ? (
					<ul className="critops-card__bullets">
						{missionBullets.map((bullet, index) => (
							<li
								key={`${bullet.type || 'bullet'}-${index}`}
								className={`critops-card__bullet critops-card__bullet--${
									bullet.type || 'note'
								}`}
							>
								<span className="critops-card__bullet-label">
									{bullet.type ? bullet.type.toUpperCase() : 'NOTE'}
								</span>
								<span className="critops-card__bullet-text">
									{bullet.text || ''}
								</span>
							</li>
						))}
					</ul>
				) : null}
			</div>
		</section>
	)

	const isSplitLayout =
		isTwoColumn &&
		(layoutVariant === 'op8-wide' ||
			layoutVariant === 'op4-left-narrow' ||
			layoutVariant === 'op6-left-tuned' ||
			layoutVariant === 'op9-split')

	return (
		<div
			className={`critops-card${
				isTwoColumn ? ' critops-card--two-column' : ''
			}${layoutVariant ? ` critops-card--${layoutVariant}` : ''}`}
			role="img"
			aria-label="Crit Ops card"
		>
			<div className="critops-card__title">{card.title || 'CRIT OP'}</div>
			<div
				className={`critops-card__body${
					layoutVariant ? ` critops-card__body--${layoutVariant}` : ''
				}`}
			>
				{isSplitLayout ? (
					<>
						<div className="critops-card__column critops-card__column--primary">
							<div className="critops-card__header">
								<div className="critops-card__name">
									{card.opNumber ? (
										<span className="critops-card__number">{card.opNumber}.</span>
									) : null}
									<span className="critops-card__opname">{card.opName || ''}</span>
								</div>
							</div>

							<section className="critops-card__section">
								<h3 className="critops-card__section-title">
									{victory.title || 'VICTORY POINTS'}
								</h3>
								{victory.text ? (
									<p className="critops-card__text">{victory.text}</p>
								) : null}
								{victoryBullets.length ? (
									<ul className="critops-card__bullets critops-card__bullets--plain">
										{victoryBullets.map((text, index) => (
											<li key={`vp-${index}`} className="critops-card__bullet">
												<span className="critops-card__bullet-text">{text}</span>
											</li>
										))}
									</ul>
								) : null}
								{victory.textAfter ? (
									<p className="critops-card__text">{victory.textAfter}</p>
								) : null}
							</section>

							{additional?.text ? (
								<section className="critops-card__section">
									<h3 className="critops-card__section-title">
										{additional.title || 'ADDITIONAL RULES'}
									</h3>
									<p className="critops-card__text">{additional.text}</p>
								</section>
							) : null}
						</div>
						<div className="critops-card__column critops-card__column--secondary">
							{missionBlock}
						</div>
					</>
				) : (
					<>
						<div className="critops-card__header">
							<div className="critops-card__name">
								{card.opNumber ? (
									<span className="critops-card__number">{card.opNumber}.</span>
								) : null}
								<span className="critops-card__opname">{card.opName || ''}</span>
							</div>
						</div>

						{isTwoColumn ? null : missionBlock}

						<section className="critops-card__section">
							<h3 className="critops-card__section-title">
								{victory.title || 'VICTORY POINTS'}
							</h3>
							{victory.text ? (
								<p className="critops-card__text">{victory.text}</p>
							) : null}
							{victoryBullets.length ? (
								<ul className="critops-card__bullets critops-card__bullets--plain">
									{victoryBullets.map((text, index) => (
										<li key={`vp-${index}`} className="critops-card__bullet">
											<span className="critops-card__bullet-text">{text}</span>
										</li>
									))}
								</ul>
							) : null}
							{victory.textAfter ? (
								<p className="critops-card__text">{victory.textAfter}</p>
							) : null}
						</section>

						{additional?.text ? (
							<section className="critops-card__section">
								<h3 className="critops-card__section-title">
									{additional.title || 'ADDITIONAL RULES'}
								</h3>
								<p className="critops-card__text">{additional.text}</p>
							</section>
						) : null}

						{isTwoColumn ? missionBlock : null}
					</>
				)}
			</div>
		</div>
	)
}

export default CritOpsCard
