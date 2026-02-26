import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import mapsData from '../data/killzoneMaps.json'
import terrainData from '../data/terrain.json'
import terrainPiecesData from '../data/terrainPieces.json'
import critOpsCardsData from '../data/critOpsCards.json'
import CritOpsCard from '../components/CritOpsCard'
import KillOp from '../components/KillOp'
import BoardSide from '../components/BoardSide'
import './Board.css'

function Board() {
  const maps = mapsData?.maps ?? []
  const [selectedMapId, setSelectedMapId] = useState(maps[0]?.id || '')
  const activeMap = useMemo(
    () => maps.find((map) => map.id === selectedMapId) || maps[0],
    [maps, selectedMapId],
  )
  const board = mapsData?.meta?.board || { width: 30, height: 22 }
  const grid = mapsData?.renderDefaults?.grid || { enabled: false, cell: 1 }
  const arrangements = terrainData?.arrangements ?? []
  const terrainPieces = terrainPiecesData?.pieces ?? []
  const objectiveDefaultRadius =
    terrainData?.meta?.objective?.defaultRadius ?? 0.5
  const mapArrangements = useMemo(
    () => arrangements.filter((arr) => arr.mapId === activeMap?.id),
    [arrangements, activeMap?.id],
  )
  const critOpsCards = critOpsCardsData?.cards ?? []
  const [arrangementIndex, setArrangementIndex] = useState(0)
  const activeArrangement = mapArrangements[arrangementIndex] || null
  const hasRandomizedMapRef = useRef(false)
  const boardSurfaceRef = useRef(null)
  const boardFrameRef = useRef(null)
  const [selectedCardIndex, setSelectedCardIndex] = useState(0)
  const shouldRotateZones = activeMap?.id === 'map_02'
  const sourceWidth = shouldRotateZones ? board.height : board.width
  const sourceHeight = shouldRotateZones ? board.width : board.height
  const textureByMapIdRef = useRef(new Map())
  const [textureVersion, setTextureVersion] = useState(0)
  const boardTextureRef = useRef(null)
  const boardWindRef = useRef(null)
  const [showTextureWatermark, setShowTextureWatermark] = useState(false)
  const textureStyles = useMemo(
    () => [
      {
        label: 'Sand + Wind',
        base: '#3a2f1e',
        accent: 'rgba(230, 200, 150, 0.35)',
        noiseAlpha: 0.32,
        mode: 'wind',
        sand: true,
      },
      {
        label: 'City Rain',
        base: '#14181c',
        accent: 'rgba(120, 150, 170, 0.18)',
        noiseAlpha: 0.16,
        mode: 'rain',
      },
      {
        label: 'Compound',
        base: '#1b2418',
        accent: 'rgba(150, 170, 140, 0.12)',
        noiseAlpha: 0.18,
        mode: 'pulse',
        grass: true,
      },
    ],
    [],
  )
  const terrainPieceById = useMemo(
    () => new Map(terrainPieces.map((piece) => [piece.id, piece])),
    [terrainPieces],
  )

  const toPercent = (value, max) => `${(value / max) * 100}%`

  const renderZone = (zone, className) => {
    if (!zone) return null
    const rotated = shouldRotateZones
      ? {
          x: (zone.y / sourceHeight) * board.width,
          y: (zone.x / sourceWidth) * board.height,
          w: (zone.h / sourceHeight) * board.width,
          h: (zone.w / sourceWidth) * board.height,
        }
      : zone
    return (
      <div
        className={`board-zone ${className}`}
        style={{
          left: toPercent(rotated.x, board.width),
          bottom: toPercent(rotated.y, board.height),
          width: toPercent(rotated.w, board.width),
          height: toPercent(rotated.h, board.height),
        }}
      />
    )
  }

  useEffect(() => {
    if (!maps.length || hasRandomizedMapRef.current) return
    const randomMap = maps[Math.floor(Math.random() * maps.length)]
    setSelectedMapId(randomMap.id)
    hasRandomizedMapRef.current = true
  }, [maps])

  useEffect(() => {
    if (!maps.length) return
    let updated = false
    maps.forEach((map) => {
      if (!textureByMapIdRef.current.has(map.id)) {
        textureByMapIdRef.current.set(map.id, Math.floor(Math.random() * 3))
        updated = true
      }
    })
    if (updated) {
      setTextureVersion((prev) => prev + 1)
    }
  }, [maps])

  useEffect(() => {
    if (!mapArrangements.length) {
      setArrangementIndex(0)
      return
    }
    const randomIndex = Math.floor(
      Math.random() * mapArrangements.length,
    )
    setArrangementIndex(randomIndex)
  }, [activeMap?.id, mapArrangements.length])

  useEffect(() => {
    if (!critOpsCards.length) return
    const randomIndex = Math.floor(Math.random() * critOpsCards.length)
    setSelectedCardIndex(randomIndex)
  }, [critOpsCards.length])

  useLayoutEffect(() => {
    const surface = boardSurfaceRef.current
    const frame = boardFrameRef.current
    if (!surface || !frame) return

    const centerBoard = () => {
      const canScrollSurface =
        surface.scrollHeight > surface.clientHeight + 1 ||
        surface.scrollWidth > surface.clientWidth + 1
      if (canScrollSurface) {
        const scrollLeft = Math.max(
          0,
          (surface.scrollWidth - surface.clientWidth) / 2,
        )
        const scrollTop = Math.max(
          0,
          (surface.scrollHeight - surface.clientHeight) / 2,
        )
        surface.scrollTo({
          left: scrollLeft,
          top: scrollTop,
          behavior: 'auto',
        })
        return
      }

      const rect = frame.getBoundingClientRect()
      const targetLeft =
        rect.left + window.scrollX + rect.width / 2 - window.innerWidth / 2
      const targetTop =
        rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2
      window.scrollTo({ left: targetLeft, top: targetTop, behavior: 'auto' })
    }

    const rafId = requestAnimationFrame(() =>
      requestAnimationFrame(centerBoard),
    )
    const timeoutIds = [
      window.setTimeout(centerBoard, 0),
      window.setTimeout(centerBoard, 150),
      window.setTimeout(centerBoard, 500),
    ]
    const handleResize = () => centerBoard()
    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(rafId)
      timeoutIds.forEach((id) => window.clearTimeout(id))
      window.removeEventListener('resize', handleResize)
    }
  }, [activeMap?.id, arrangementIndex])

  const activeTextureIndex = useMemo(() => {
    if (!activeMap?.id) return 0
    return textureByMapIdRef.current.get(activeMap.id) ?? 0
  }, [activeMap?.id, textureVersion])

  const activeTexture =
    textureStyles[activeTextureIndex % textureStyles.length]

  useEffect(() => {
    if (!activeTexture?.label) return
    setShowTextureWatermark(true)
    const timeoutId = window.setTimeout(() => {
      setShowTextureWatermark(false)
    }, 10000)
    return () => window.clearTimeout(timeoutId)
  }, [activeMap?.id, activeTexture?.label])

  useEffect(() => {
    const canvas = boardTextureRef.current
    const windCanvas = boardWindRef.current
    const frame = boardFrameRef.current
    if (!canvas || !frame) return

    const context = canvas.getContext('2d')
    const windContext = windCanvas ? windCanvas.getContext('2d') : null
    if (!context) return

    const style = textureStyles[activeTextureIndex % textureStyles.length]
    const offscreen = document.createElement('canvas')
    const offscreenContext = offscreen.getContext('2d')
    const noiseCanvas = document.createElement('canvas')
    const noiseContext = noiseCanvas.getContext('2d')
    const effectState = {
      streaks: [],
      particles: [],
      drops: [],
      splashes: [],
      impacts: [],
      rainStreaks: [],
      rainAccumulator: 0,
      pulseOrigin: {
        x: 0.5,
        y: 0.5,
      },
    }
    let animationFrame = 0
    let lastTime = 0
    let width = 0
    let height = 0

    const createNoisePattern = () => {
      if (!noiseContext) return null
      const size = 128
      noiseCanvas.width = size
      noiseCanvas.height = size
      const image = noiseContext.createImageData(size, size)
      for (let i = 0; i < image.data.length; i += 4) {
        const shade = 90 + Math.floor(Math.random() * 80)
        image.data[i] = shade
        image.data[i + 1] = shade
        image.data[i + 2] = shade
        image.data[i + 3] = 255
      }
      noiseContext.putImageData(image, 0, 0)
      return offscreenContext?.createPattern(noiseCanvas, 'repeat') || null
    }

    const noisePattern = createNoisePattern()

    const buildBaseTexture = () => {
      if (!offscreenContext) return
      offscreen.width = width
      offscreen.height = height
      offscreenContext.clearRect(0, 0, width, height)
      offscreenContext.fillStyle = style.base
      offscreenContext.fillRect(0, 0, width, height)

      const gradient = offscreenContext.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, style.sand ? 'rgba(255, 230, 170, 0.08)' : 'rgba(255, 255, 255, 0.05)')
      gradient.addColorStop(1, style.sand ? 'rgba(20, 12, 6, 0.45)' : 'rgba(0, 0, 0, 0.25)')
      offscreenContext.fillStyle = gradient
      offscreenContext.fillRect(0, 0, width, height)

      if (style.sand) {
        const duneGradient = offscreenContext.createRadialGradient(
          width * 0.2,
          height * 0.8,
          Math.max(width, height) * 0.1,
          width * 0.2,
          height * 0.8,
          Math.max(width, height) * 0.8,
        )
        duneGradient.addColorStop(0, 'rgba(255, 214, 150, 0.12)')
        duneGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
        offscreenContext.fillStyle = duneGradient
        offscreenContext.fillRect(0, 0, width, height)

        const hazeGradient = offscreenContext.createLinearGradient(0, 0, width, 0)
        hazeGradient.addColorStop(0, 'rgba(255, 220, 170, 0.08)')
        hazeGradient.addColorStop(0.5, 'rgba(255, 210, 160, 0.04)')
        hazeGradient.addColorStop(1, 'rgba(255, 210, 160, 0.1)')
        offscreenContext.fillStyle = hazeGradient
        offscreenContext.fillRect(0, 0, width, height)


        offscreenContext.save()
        offscreenContext.lineWidth = Math.max(34, width * 0.045)
        offscreenContext.lineCap = 'round'
        for (let i = 0; i < 7; i += 1) {
          const baseY = (i / 6) * height + (-0.1 + Math.random() * 0.2) * height
          const amplitude = 10 + Math.random() * 22
          const stripeGradient = offscreenContext.createLinearGradient(
            -width * 0.1,
            0,
            width * 1.1,
            0,
          )
          stripeGradient.addColorStop(0, 'rgba(255, 215, 165, 0)')
          stripeGradient.addColorStop(0.2, 'rgba(255, 215, 165, 0.08)')
          stripeGradient.addColorStop(0.5, 'rgba(255, 215, 165, 0.12)')
          stripeGradient.addColorStop(0.8, 'rgba(255, 215, 165, 0.08)')
          stripeGradient.addColorStop(1, 'rgba(255, 215, 165, 0)')
          const yFade = 1 - Math.abs(baseY / height - 0.5) * 1.6
          offscreenContext.strokeStyle = stripeGradient
          offscreenContext.globalAlpha = Math.max(0.2, yFade) * 0.6
          offscreenContext.globalCompositeOperation = 'source-over'
          offscreenContext.beginPath()
          offscreenContext.moveTo(-width * 0.1, baseY)
          for (let x = 0; x <= width * 1.1; x += width / 7) {
            const y = baseY + Math.sin((x / width) * Math.PI * 2) * amplitude
            offscreenContext.lineTo(x, y)
          }
          offscreenContext.stroke()
          offscreenContext.globalAlpha = 1
        }
        offscreenContext.restore()
      }

      if (style.grass) {
        const fieldGradient = offscreenContext.createLinearGradient(0, 0, 0, height)
        fieldGradient.addColorStop(0, 'rgba(120, 150, 110, 0.08)')
        fieldGradient.addColorStop(1, 'rgba(40, 32, 18, 0.35)')
        offscreenContext.fillStyle = fieldGradient
        offscreenContext.fillRect(0, 0, width, height)
      }

      if (style.mode === 'rain') {
        const puddleCanvas = document.createElement('canvas')
        const puddleContext = puddleCanvas.getContext('2d')
        if (puddleContext) {
          puddleCanvas.width = width
          puddleCanvas.height = height
          const puddleShapes = []
          const drawSmoothPuddle = (ctx, vertices) => {
            const first = vertices[0]
            const second = vertices[1] || first
            ctx.beginPath()
            ctx.moveTo((first.x + second.x) / 2, (first.y + second.y) / 2)
            for (let p = 1; p < vertices.length; p += 1) {
              const current = vertices[p]
              const next = vertices[(p + 1) % vertices.length]
              const midX = (current.x + next.x) / 2
              const midY = (current.y + next.y) / 2
              ctx.quadraticCurveTo(current.x, current.y, midX, midY)
            }
            ctx.closePath()
          }

          for (let i = 0; i < 24; i += 1) {
            const puddleX = Math.random() * width
            const puddleY = Math.random() * height
            const puddleW = 40 + Math.random() * 120
            const puddleH = 24 + Math.random() * 80
            const points = 8 + Math.floor(Math.random() * 6)
            const baseRadius = Math.min(puddleW, puddleH) * 0.5
            const angleOffset = Math.random() * Math.PI * 2
            const vertices = []
            for (let p = 0; p < points; p += 1) {
              const angle = angleOffset + (p / points) * Math.PI * 2
              const radiusJitter = 0.65 + Math.random() * 0.6
              const radiusX = baseRadius * (puddleW / Math.max(1, puddleH))
              const radiusY = baseRadius
              vertices.push({
                x: puddleX + Math.cos(angle) * radiusX * radiusJitter,
                y: puddleY + Math.sin(angle) * radiusY * radiusJitter,
              })
            }
            puddleShapes.push(vertices)
          }

          puddleContext.fillStyle = 'rgba(255, 255, 255, 1)'
          puddleShapes.forEach((vertices) => {
            drawSmoothPuddle(puddleContext, vertices)
            puddleContext.fill()
          })

          puddleContext.globalCompositeOperation = 'source-in'
          puddleContext.fillStyle = 'rgba(6, 10, 14, 0.6)'
          puddleContext.fillRect(0, 0, width, height)
          puddleContext.globalCompositeOperation = 'source-over'
          puddleContext.strokeStyle = 'rgba(4, 8, 12, 0.85)'
          puddleContext.lineWidth = 1.8
          puddleShapes.forEach((vertices) => {
            drawSmoothPuddle(puddleContext, vertices)
            puddleContext.stroke()
          })
          puddleContext.strokeStyle = 'rgba(90, 120, 140, 0.25)'
          puddleContext.lineWidth = 1
          puddleShapes.forEach((vertices) => {
            drawSmoothPuddle(puddleContext, vertices)
            puddleContext.stroke()
          })

          offscreenContext.drawImage(puddleCanvas, 0, 0)
        }
      }

      if (noisePattern) {
        offscreenContext.fillStyle = noisePattern
        offscreenContext.globalAlpha = style.noiseAlpha
        offscreenContext.fillRect(0, 0, width, height)
        offscreenContext.globalAlpha = 1
      }

      if (style.mode === 'rain') {
        for (let i = 0; i < 4; i += 1) {
          const patchX = Math.random() * width
          const patchY = Math.random() * height
          const patchRadius = 320 + Math.random() * 520
          const patchGradient = offscreenContext.createRadialGradient(
            patchX,
            patchY,
            patchRadius * 0.2,
            patchX,
            patchY,
            patchRadius,
          )
          patchGradient.addColorStop(0, 'rgba(10, 12, 14, 0.5)')
          patchGradient.addColorStop(1, 'rgba(4, 6, 8, 0)')
          offscreenContext.fillStyle = patchGradient
          offscreenContext.beginPath()
          offscreenContext.arc(patchX, patchY, patchRadius, 0, Math.PI * 2)
          offscreenContext.fill()
        }

        offscreenContext.save()
        const rubbleDots = []
        for (let i = 0; i < 60; i += 1) {
          const startX = Math.random() * width
          const startY = Math.random() * height
          const segments = 2 + Math.floor(Math.random() * 3)
          let currentX = startX
          let currentY = startY
          let angle = Math.random() * Math.PI * 2
          offscreenContext.beginPath()
          offscreenContext.moveTo(currentX, currentY)
          for (let s = 0; s < segments; s += 1) {
            const length = 4 + Math.random() * 10
            angle += (-0.35 + Math.random() * 0.7)
            currentX += Math.cos(angle) * length
            currentY += Math.sin(angle) * length
            offscreenContext.lineTo(currentX, currentY)

            if (Math.random() < 0.25) {
              const branchAngle = angle + (-0.8 + Math.random() * 1.6)
              const branchLength = 4 + Math.random() * 10
              offscreenContext.moveTo(currentX, currentY)
              offscreenContext.lineTo(
                currentX + Math.cos(branchAngle) * branchLength,
                currentY + Math.sin(branchAngle) * branchLength,
              )
              offscreenContext.moveTo(currentX, currentY)
            }

            if (Math.random() < 0.6) {
              const rubbleCount = 1 + Math.floor(Math.random() * 3)
              for (let r = 0; r < rubbleCount; r += 1) {
                rubbleDots.push({
                  x: currentX + (-6 + Math.random() * 12),
                  y: currentY + (-6 + Math.random() * 12),
                  size: 1 + Math.random() * 2.4,
                })
              }
            }
          }
          offscreenContext.strokeStyle = 'rgba(8, 10, 12, 0.5)'
          offscreenContext.lineWidth = 1 + Math.random() * 0.6
          offscreenContext.stroke()
        }
        offscreenContext.fillStyle = 'rgba(12, 14, 16, 0.55)'
        rubbleDots.forEach((dot) => {
          offscreenContext.fillRect(dot.x, dot.y, dot.size, dot.size)
        })

        offscreenContext.fillStyle = 'rgba(10, 12, 14, 0.65)'
        for (let i = 0; i < 16; i += 1) {
          const chunkX = Math.random() * width
          const chunkY = Math.random() * height
          const chunkW = 6 + Math.random() * 10
          const chunkH = 4 + Math.random() * 8
          offscreenContext.save()
          offscreenContext.translate(chunkX, chunkY)
          offscreenContext.rotate(Math.random() * Math.PI)
          offscreenContext.fillRect(-chunkW / 2, -chunkH / 2, chunkW, chunkH)
          offscreenContext.restore()
        }

        for (let i = 0; i < 6; i += 1) {
          const pileX = Math.random() * width
          const pileY = Math.random() * height
          const pileSize = 22 + Math.random() * 40
          const pileCount = 14 + Math.floor(Math.random() * 18)
          offscreenContext.fillStyle = 'rgba(8, 10, 12, 0.6)'
          for (let p = 0; p < pileCount; p += 1) {
            const offsetX = (-0.5 + Math.random()) * pileSize
            const offsetY = (-0.5 + Math.random()) * pileSize
            const chipW = 4 + Math.random() * 8
            const chipH = 3 + Math.random() * 6
            offscreenContext.save()
            offscreenContext.translate(pileX + offsetX, pileY + offsetY)
            offscreenContext.rotate(Math.random() * Math.PI)
            offscreenContext.fillRect(-chipW / 2, -chipH / 2, chipW, chipH)
            offscreenContext.restore()
          }
        }
        offscreenContext.restore()

      }

      for (let i = 0; i < 18; i += 1) {
        const blotchX = Math.random() * width
        const blotchY = Math.random() * height
        const blotchRadius = 40 + Math.random() * 120
        const blotchGradient = offscreenContext.createRadialGradient(
          blotchX,
          blotchY,
          blotchRadius * 0.2,
          blotchX,
          blotchY,
          blotchRadius,
        )
        blotchGradient.addColorStop(0, 'rgba(255, 255, 255, 0.02)')
        blotchGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
        offscreenContext.fillStyle = blotchGradient
        offscreenContext.beginPath()
        offscreenContext.arc(blotchX, blotchY, blotchRadius, 0, Math.PI * 2)
        offscreenContext.fill()
      }

      if (style.sand) {
        offscreenContext.fillStyle = 'rgba(255, 224, 170, 0.14)'
        for (let i = 0; i < 320; i += 1) {
          const speckX = Math.random() * width
          const speckY = Math.random() * height
          const speckSize = Math.random() * 1.4
          offscreenContext.fillRect(speckX, speckY, speckSize, speckSize)
        }

        offscreenContext.fillStyle = 'rgba(70, 60, 45, 0.35)'
        for (let i = 0; i < 520; i += 1) {
          const rubbleX = Math.random() * width
          const rubbleY = Math.random() * height
          const rubbleSize = 1 + Math.random() * 2.6
          offscreenContext.fillRect(rubbleX, rubbleY, rubbleSize, rubbleSize)
        }

        offscreenContext.fillStyle = 'rgba(60, 50, 36, 0.45)'
        for (let i = 0; i < 80; i += 1) {
          const chunkX = Math.random() * width
          const chunkY = Math.random() * height
          const chunkW = 4 + Math.random() * 12
          const chunkH = 3 + Math.random() * 10
          offscreenContext.save()
          offscreenContext.translate(chunkX, chunkY)
          offscreenContext.rotate(Math.random() * Math.PI)
          offscreenContext.fillRect(-chunkW / 2, -chunkH / 2, chunkW, chunkH)
          offscreenContext.restore()
        }

        offscreenContext.fillStyle = 'rgba(54, 44, 32, 0.55)'
        for (let i = 0; i < 26; i += 1) {
          const boulderX = Math.random() * width
          const boulderY = Math.random() * height
          const boulderW = 14 + Math.random() * 26
          const boulderH = 10 + Math.random() * 22
          offscreenContext.save()
          offscreenContext.translate(boulderX, boulderY)
          offscreenContext.rotate(Math.random() * Math.PI)
          offscreenContext.fillRect(-boulderW / 2, -boulderH / 2, boulderW, boulderH)
          offscreenContext.restore()
        }

        for (let i = 0; i < 12; i += 1) {
          const pileX = Math.random() * width
          const pileY = Math.random() * height
          const pileSize = 36 + Math.random() * 60
          const pileCount = 24 + Math.floor(Math.random() * 30)
          offscreenContext.fillStyle = 'rgba(50, 42, 30, 0.6)'
          for (let p = 0; p < pileCount; p += 1) {
            const offsetX = (-0.5 + Math.random()) * pileSize
            const offsetY = (-0.5 + Math.random()) * pileSize
            const chipW = 6 + Math.random() * 14
            const chipH = 4 + Math.random() * 12
            offscreenContext.save()
            offscreenContext.translate(pileX + offsetX, pileY + offsetY)
            offscreenContext.rotate(Math.random() * Math.PI)
            offscreenContext.fillRect(-chipW / 2, -chipH / 2, chipW, chipH)
            offscreenContext.restore()
          }
        }
      }

      if (style.grass) {
        offscreenContext.fillStyle = 'rgba(110, 140, 90, 0.12)'
        for (let i = 0; i < 240; i += 1) {
          const bladeX = Math.random() * width
          const bladeY = Math.random() * height
          const bladeLength = 6 + Math.random() * 12
          offscreenContext.fillRect(bladeX, bladeY, 0.8, bladeLength)
        }
        offscreenContext.fillStyle = 'rgba(90, 70, 40, 0.2)'
        for (let i = 0; i < 26; i += 1) {
          const trackY = Math.random() * height
          const trackHeight = 4 + Math.random() * 6
          offscreenContext.fillRect(0, trackY, width, trackHeight)
        }
      }
    }

    const getWindPoint = (streak, t) => {
      const clamped = Math.max(0, Math.min(1, t))
      const startX = -width * 2.2
      const spanX = width * 8.4
      const x = startX + spanX * clamped
      const y =
        streak.baseY +
        Math.sin(clamped * Math.PI * 2 * streak.curl + streak.phaseA) *
          streak.amplitude +
        Math.sin(clamped * Math.PI * 2 * streak.curl * 1.7 + streak.phaseB) *
          streak.amplitude * 0.35
      return { x, y }
    }

    const buildEffectState = () => {
      const streakCount = style.sand ? 120 : 18
      const lengthBase = style.sand ? 160 : 80
      const lengthRange = style.sand ? 260 : 160
      const speedBase = style.sand ? 10 : 6
      const speedRange = style.sand ? 18 : 14
      const thicknessBase = style.sand ? 0.8 : 1
      const thicknessRange = style.sand ? 1.2 : 2
      effectState.streaks = Array.from({ length: streakCount }).map(() => {
        const baseY = Math.random() * height
        const amplitude = style.sand ? 22 + Math.random() * 42 : 6 + Math.random() * 14
        const curl = style.sand ? 1.6 + Math.random() * 2.2 : 0.8 + Math.random() * 1.2
        const phaseA = Math.random() * Math.PI * 2
        const phaseB = Math.random() * Math.PI * 2
        const grainCount = style.sand ? 12 + Math.floor(Math.random() * 8) : 0
        return {
          length: lengthBase + Math.random() * lengthRange,
          speed: speedBase + Math.random() * speedRange,
          thickness: thicknessBase + Math.random() * thicknessRange,
          baseY,
          amplitude,
          curl,
          phaseA,
          phaseB,
          progress: Math.random(),
          grainOffsets: Array.from({ length: grainCount }).map(() => ({
            tOffset: Math.random(),
            jitterX: -12 + Math.random() * 24,
            jitterY: -8 + Math.random() * 16,
            size: 0.8 + Math.random() * 1.8,
          })),
        }
      })
      effectState.particles = Array.from({ length: 24 }).map(() => ({
        x: Math.random() * width,
        y: height + Math.random() * height,
        vx: -8 + Math.random() * 16,
        vy: -22 - Math.random() * 20,
        life: Math.random() * 1,
      }))
      effectState.drops = Array.from({ length: 120 }).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        length: 14 + Math.random() * 26,
        speed: 420 + Math.random() * 380,
        thickness: 0.6 + Math.random() * 0.8,
        targetY: Math.random() * height,
        tilt: -0.6 + Math.random() * 1.2,
        drift: 0,
      }))
      effectState.splashes = []
      effectState.impacts = []
      effectState.rainStreaks = Array.from({ length: 160 }).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        length: 18 + Math.random() * 26,
        speed: 140 + Math.random() * 180,
        tilt: -1 + Math.random() * 2,
        targetY: Math.random() * height,
        alpha: 0.04 + Math.random() * 0.06,
      }))
      effectState.rainAccumulator = 0
      effectState.pulseOrigin = {
        x: 0.25 + Math.random() * 0.5,
        y: 0.25 + Math.random() * 0.5,
      }
    }

    const renderWind = (deltaSeconds) => {
      const ctx = windContext || context
      ctx.save()
      const windStroke = style.sand
        ? 'rgba(220, 200, 160, 0.35)'
        : style.accent
      ctx.strokeStyle = windStroke
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.shadowColor = windStroke
      ctx.shadowBlur = style.sand ? 90 : 6
      ctx.globalAlpha = style.sand ? 0.03 : 1
      const sandGrain = 'rgba(225, 205, 160, 0.32)'
      ctx.fillStyle = sandGrain
      const speedFactor = style.sand ? 0.65 : 1
      effectState.streaks.forEach((streak) => {
        const progressDelta =
          (streak.speed * speedFactor * deltaSeconds) / (width * 0.55)
        streak.progress += progressDelta
        if (streak.progress > 1.2) {
          const baseY = Math.random() * height
          const amplitude = style.sand
            ? 22 + Math.random() * 42
            : 6 + Math.random() * 14
          const curl = style.sand ? 1.6 + Math.random() * 2.2 : 0.8 + Math.random() * 1.2
          const phaseA = Math.random() * Math.PI * 2
          const phaseB = Math.random() * Math.PI * 2
          streak.progress = -Math.random() * 0.2
          streak.baseY = baseY
          streak.amplitude = amplitude
          streak.curl = curl
          streak.phaseA = phaseA
          streak.phaseB = phaseB
          if (style.sand) {
            const grainCount = 12 + Math.floor(Math.random() * 8)
            streak.grainOffsets = Array.from({ length: grainCount }).map(() => ({
              tOffset: Math.random(),
              jitterX: -12 + Math.random() * 24,
              jitterY: -8 + Math.random() * 16,
              size: 0.8 + Math.random() * 1.8,
            }))
          }
        }
        ctx.lineWidth = style.sand ? streak.thickness * 7.2 : streak.thickness
        const tipT = Math.max(0, Math.min(1, streak.progress))
        const trailSpan = Math.max(
          0.05,
          Math.min(0.6, streak.length / (width * 1.6) + 0.25),
        )
        const startT = Math.max(0, tipT - trailSpan)
        const segments = Math.max(60, Math.round(streak.length / 1.6))
        ctx.beginPath()
        const startPoint = getWindPoint(streak, startT)
        ctx.moveTo(startPoint.x, startPoint.y)
        for (let i = 1; i <= segments; i += 1) {
          const t = startT + ((tipT - startT) * i) / segments
          const prev = getWindPoint(streak, t - (tipT - startT) / segments)
          const current = getWindPoint(streak, t)
          const midX = (prev.x + current.x) / 2
          const midY = (prev.y + current.y) / 2
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY)
        }
        const tip = getWindPoint(streak, tipT)
        ctx.lineTo(tip.x, tip.y)
        ctx.stroke()

        if (style.sand) {
          ctx.save()
          ctx.globalAlpha = 0.18
          ctx.strokeStyle = 'rgba(235, 215, 175, 0.18)'
          ctx.lineWidth = streak.thickness * 2.2
          ctx.setLineDash([18, 26])
          ctx.beginPath()
          ctx.moveTo(startPoint.x, startPoint.y)
          for (let i = 1; i <= segments; i += 1) {
            const t = startT + ((tipT - startT) * i) / segments
            const prev = getWindPoint(streak, t - (tipT - startT) / segments)
            const current = getWindPoint(streak, t)
            const midX = (prev.x + current.x) / 2
            const midY = (prev.y + current.y) / 2
            ctx.quadraticCurveTo(prev.x, prev.y, midX, midY)
          }
          ctx.lineTo(tip.x, tip.y)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.restore()
        }

        if (style.sand) {
          ctx.save()
          ctx.globalAlpha = 0.3
          ctx.shadowBlur = 0
          ctx.fillStyle = 'rgba(235, 215, 175, 0.35)'
          for (let i = 0; i < segments; i += 3) {
            const t = startT + ((tipT - startT) * i) / segments
            const grain = getWindPoint(streak, t)
            const jitterX = -2 + Math.random() * 4
            const jitterY = -2 + Math.random() * 4
            const size = 0.6 + Math.random() * 1.2
            ctx.fillRect(grain.x + jitterX, grain.y + jitterY, size, size)
          }
          ctx.restore()
        }

        if (style.sand) {
          ctx.save()
          ctx.globalAlpha = 0.25
          ctx.shadowColor = 'rgba(220, 200, 160, 0.35)'
          ctx.shadowBlur = 150
          ctx.lineWidth = streak.thickness * 12
          ctx.strokeStyle = 'rgba(210, 190, 150, 0.18)'
          ctx.beginPath()
          ctx.moveTo(startPoint.x, startPoint.y)
          for (let i = 1; i <= segments; i += 1) {
            const t = startT + ((tipT - startT) * i) / segments
            const prev = getWindPoint(streak, t - (tipT - startT) / segments)
            const current = getWindPoint(streak, t)
            const midX = (prev.x + current.x) / 2
            const midY = (prev.y + current.y) / 2
            ctx.quadraticCurveTo(prev.x, prev.y, midX, midY)
          }
          ctx.lineTo(tip.x, tip.y)
          ctx.stroke()
          ctx.restore()
        }

        if (style.sand) {
          const span = Math.max(0.001, tipT - startT)
          ctx.save()
          ctx.globalAlpha = 0.5
          ctx.shadowColor = 'rgba(230, 210, 170, 0.4)'
          ctx.shadowBlur = 30
          streak.grainOffsets.forEach((grainOffset) => {
            const t = startT + grainOffset.tOffset * span
            const grain = getWindPoint(streak, t)
            ctx.fillRect(
              grain.x + grainOffset.jitterX,
              grain.y + grainOffset.jitterY,
              grainOffset.size,
              grainOffset.size,
            )
          })
          ctx.globalAlpha = 0.18
          ctx.shadowBlur = 44
          streak.grainOffsets.forEach((grainOffset) => {
            const t = startT + grainOffset.tOffset * span
            const grain = getWindPoint(streak, t)
            const size = grainOffset.size * 2.2
            ctx.fillRect(
              grain.x + grainOffset.jitterX * 1.6,
              grain.y + grainOffset.jitterY * 1.6,
              size,
              size,
            )
          })
          ctx.restore()
        }
      })
      ctx.globalAlpha = 1
      ctx.restore()
    }

    const renderSparks = (deltaSeconds) => {
      effectState.particles.forEach((particle) => {
        particle.x += particle.vx * deltaSeconds
        particle.y += particle.vy * deltaSeconds
        particle.life -= deltaSeconds * 0.6
        if (particle.y < -20 || particle.life <= 0) {
          particle.x = Math.random() * width
          particle.y = height + Math.random() * height * 0.4
          particle.vx = -12 + Math.random() * 24
          particle.vy = -22 - Math.random() * 26
          particle.life = 0.6 + Math.random() * 0.6
        }
        context.fillStyle = `rgba(255, 188, 120, ${0.08 + particle.life * 0.3})`
        context.beginPath()
        context.arc(particle.x, particle.y, 1.2 + particle.life * 1.6, 0, Math.PI * 2)
        context.fill()
      })
    }

    const renderRain = (deltaSeconds) => {
      const spawnRate = 160
      effectState.rainAccumulator += deltaSeconds * spawnRate
      while (effectState.rainAccumulator >= 1) {
        effectState.rainAccumulator -= 1
        effectState.impacts.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 1 + Math.random() * 2,
          life: 0.6 + Math.random() * 0.4,
        })
      }

      context.strokeStyle = 'rgba(170, 190, 205, 0.2)'
      context.fillStyle = 'rgba(200, 210, 220, 0.12)'
      effectState.impacts = effectState.impacts.filter((impact) => {
        impact.life -= deltaSeconds * 2
        if (impact.life <= 0) return false
        const expansion = 1 - impact.life
        const rippleRadius = impact.radius + expansion * 6
        context.beginPath()
        context.arc(impact.x, impact.y, rippleRadius, 0, Math.PI * 2)
        context.stroke()
        context.beginPath()
        context.arc(impact.x, impact.y, Math.max(0.3, impact.life * 1.1), 0, Math.PI * 2)
        context.fill()
        return true
      })

      context.lineCap = 'round'
      effectState.rainStreaks.forEach((streak) => {
        streak.y += streak.speed * deltaSeconds
        streak.x += streak.tilt * streak.speed * deltaSeconds * 0.02
        if (streak.y >= streak.targetY) {
          effectState.impacts.push({
            x: streak.x,
            y: streak.targetY,
            radius: 1 + Math.random() * 2,
            life: 0.6 + Math.random() * 0.4,
          })
          streak.y = -Math.random() * height * 0.2
          streak.x = Math.random() * width
          streak.targetY = Math.random() * height
        }
        if (streak.x < -20 || streak.x > width + 20) {
          streak.x = Math.random() * width
        }
        context.strokeStyle = `rgba(190, 210, 225, ${streak.alpha})`
        context.lineWidth = 0.6
        context.beginPath()
        context.moveTo(streak.x, streak.y)
        context.lineTo(streak.x - streak.tilt, streak.y - streak.length)
        context.stroke()
      })

    }

    const renderPulse = (timeSeconds) => {
      const pulse = 0.35 + Math.sin(timeSeconds * 0.6) * 0.25
      const centerX = width * effectState.pulseOrigin.x
      const centerY = height * effectState.pulseOrigin.y
      const radius = Math.max(width, height) * 0.7
      const gradient = context.createRadialGradient(
        centerX,
        centerY,
        radius * 0.1,
        centerX,
        centerY,
        radius,
      )
      gradient.addColorStop(0, `rgba(120, 200, 255, ${pulse})`)
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
    }

    const drawFrame = (time) => {
      if (!width || !height) return
      const timeSeconds = time / 1000
      const deltaSeconds = lastTime ? (time - lastTime) / 1000 : 0
      lastTime = time

      context.clearRect(0, 0, width, height)
      if (windContext) {
        windContext.clearRect(0, 0, width, height)
      }
      if (offscreen.width && offscreen.height) {
        context.drawImage(offscreen, 0, 0, width, height)
      }

      if (style.mode === 'wind') {
        renderWind(deltaSeconds)
      }
      if (style.mode === 'sparks') {
        renderSparks(deltaSeconds)
      }
      if (style.mode === 'rain') {
        renderRain(deltaSeconds)
      }
      if (style.mode === 'pulse') {
        renderPulse(timeSeconds)
      }

      animationFrame = requestAnimationFrame(drawFrame)
    }

    const resize = () => {
      const rect = frame.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      if (windCanvas) {
        windCanvas.width = Math.floor(width * dpr)
        windCanvas.height = Math.floor(height * dpr)
        windCanvas.style.width = `${width}px`
        windCanvas.style.height = `${height}px`
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (windContext) {
        windContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      buildBaseTexture()
      buildEffectState()
    }

    resize()
    animationFrame = requestAnimationFrame(drawFrame)

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(frame)

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [activeTextureIndex, activeMap?.id, textureStyles])

  const advanceArrangement = () => {
    if (!mapArrangements.length) return
    setArrangementIndex((prev) => (prev + 1) % mapArrangements.length)
  }

  const transformPoint = ([x, y], placement) => {
    const offsetX = placement?.x || 0
    const offsetY = placement?.y || 0
    const rotation = placement?.rotation || 0
    if (!rotation) return [x + offsetX, y + offsetY]
    const radians = (rotation * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const rotatedX = x * cos - y * sin
    const rotatedY = x * sin + y * cos
    return [rotatedX + offsetX, rotatedY + offsetY]
  }

  const renderPoints = (points, placement) =>
    points
      .map((point) => {
        const [x, y] = transformPoint(point, placement)
        return `${x},${y}`
      })
      .join(' ')

  const getPieceAreas = (piece) => {
    if (piece?.areas?.length) return piece.areas
    return piece?.area ? [piece.area] : []
  }

  const getPieceLabel = (piece) => {
    const source = piece?.name || piece?.id
    if (!source) return null
    const match = source.match(/volkus_([A-Za-z])$/)
    return match ? match[1].toUpperCase() : null
  }

  const resolveTerrainPiece = (entry) =>
    entry?.pieceId ? terrainPieceById.get(entry.pieceId) : entry

  const getWallClassName = (type) => {
    const normalized = ['heavy', 'light', 'door'].includes(type)
      ? type
      : 'heavy'
    return `board-wall board-wall-${normalized}`
  }

  const getSegmentType = (segment) =>
    Array.isArray(segment?.[0]) ? 'heavy' : segment?.type || 'heavy'

  const selectedCritOpsCard = critOpsCards[selectedCardIndex] || null
  useEffect(() => {
    if (!selectedCritOpsCard?.opNumber) return
    const padded = String(selectedCritOpsCard.opNumber).padStart(2, '0')
    try {
      localStorage.setItem('kt-crit-op-src', `/images/critOps/critops_${padded}.png`)
      localStorage.setItem('kt-crit-op-label', `Crit Op ${selectedCritOpsCard.opNumber}`)
    } catch (error) {
      console.warn('Failed to store crit op selection.', error)
    }
  }, [selectedCritOpsCard])
  const map1OpClass =
    selectedCritOpsCard?.opNumber === 4
      ? ' is-op-04'
      : selectedCritOpsCard?.opNumber === 5
        ? ' is-op-05'
        : selectedCritOpsCard?.opNumber === 6
          ? ' is-op-06'
          : selectedCritOpsCard?.opNumber === 7
            ? ' is-op-07'
            : selectedCritOpsCard?.opNumber === 8
              ? ' is-op-08'
              : selectedCritOpsCard?.opNumber === 9
                ? ' is-op-09'
                : ''
  const map2OpClass =
    selectedCritOpsCard?.opNumber === 1
      ? ' is-op-01'
      : selectedCritOpsCard?.opNumber === 2
        ? ' is-op-02'
        : selectedCritOpsCard?.opNumber === 3
          ? ' is-op-03'
          : selectedCritOpsCard?.opNumber === 4
            ? ' is-op-04'
            : selectedCritOpsCard?.opNumber === 5
              ? ' is-op-05'
              : selectedCritOpsCard?.opNumber === 6
                ? ' is-op-06'
                : selectedCritOpsCard?.opNumber === 7
                  ? ' is-op-07'
                  : selectedCritOpsCard?.opNumber === 9
                    ? ' is-op-09'
                    : ''

  return (
    <div className="board-view">
      <div className="board-toolbar" />
      <div
        ref={boardSurfaceRef}
        className="board-surface"
        style={{ '--board-width': board.width, '--board-height': board.height }}
      >
        <div ref={boardFrameRef} className="board-frame">
          {showTextureWatermark ? (
            <div className="board-texture-watermark">
              {activeTexture?.label || 'Texture'}
            </div>
          ) : null}
          <canvas ref={boardTextureRef} className="board-texture-canvas" />
          <canvas ref={boardWindRef} className="board-wind-canvas" />
          {grid.enabled ? (
            <div
              className="board-grid"
              style={{ '--grid-cell': grid.cell }}
            />
          ) : null}
          {activeMap ? (
            <>
              {renderZone(activeMap.zones?.playerA?.territory, 'zone-a-territory')}
              {renderZone(activeMap.zones?.playerB?.territory, 'zone-b-territory')}
              {renderZone(activeMap.zones?.playerA?.dropZone, 'zone-a-drop')}
              {renderZone(activeMap.zones?.playerB?.dropZone, 'zone-b-drop')}
            </>
          ) : null}
          <svg
            className="board-overlay"
            viewBox={`0 0 ${board.width} ${board.height}`}
            preserveAspectRatio="none"
          >
            <g transform={`scale(1,-1) translate(0, -${board.height})`}>
              <line
                className="board-centerline"
                x1={board.width / 2}
                y1={0}
                x2={board.width / 2}
                y2={board.height}
              />
              <line
                className="board-centerline"
                x1={0}
                y1={board.height / 2}
                x2={board.width}
                y2={board.height / 2}
              />
              {(activeArrangement?.objectives ?? []).map((objective) => {
                const radius = objective.radius ?? objectiveDefaultRadius
                return (
                  <g key={objective.id} className="board-objective">
                    <circle cx={objective.x} cy={objective.y} r={radius} />
                    <line
                      className="board-objective-slice"
                      x1={objective.x - radius}
                      y1={objective.y}
                      x2={objective.x + radius}
                      y2={objective.y}
                    />
                    <line
                      className="board-objective-slice"
                      x1={objective.x}
                      y1={objective.y - radius}
                      x2={objective.x}
                      y2={objective.y + radius}
                    />
                  </g>
                )
              })}
              {(activeArrangement?.terrain ?? []).map((entry) => {
                const piece = resolveTerrainPiece(entry)
                if (!piece) return null
                const placement = entry.placement
                const label = getPieceLabel(piece)
                const labelPosition = {
                  x: (placement?.x || 0) + 0.1,
                  y: (placement?.y || 0) + 0.45,
                }
                return (
                  <g className="board-terrain" key={entry.id || piece.id}>
                    {getPieceAreas(piece)
                      .filter((area) => area?.points?.length)
                      .map((area, areaIndex) => (
                        <polygon
                          key={`${entry.id || piece.id}-area-${areaIndex}`}
                          className="board-terrain-fill"
                          points={renderPoints(
                            area.points,
                            placement,
                          )}
                        />
                      ))}
                    {label ? (
                      <text
                        className="board-terrain-label"
                        fontSize={0.375}
                        x={labelPosition.x}
                        y={-labelPosition.y}
                        transform="scale(1,-1)"
                      >
                        {label}
                      </text>
                    ) : null}
                  </g>
                )
              })}
              {['light', 'heavy', 'door'].map((wallType) =>
                (activeArrangement?.terrain ?? []).map((entry) => {
                  const piece = resolveTerrainPiece(entry)
                  if (!piece) return null
                  const placement = entry.placement
                  return (piece.walls?.segments ?? []).map(
                    (segment, index) => {
                      const segmentType = getSegmentType(segment)
                      if (segmentType !== wallType) return null
                      const segmentPoints = Array.isArray(segment?.[0])
                        ? segment
                        : segment?.segment
                      if (!Array.isArray(segmentPoints)) return null
                      const [start, end] = segmentPoints
                      const [x1, y1] = transformPoint(start, placement)
                      const [x2, y2] = transformPoint(end, placement)
                      return (
                        <line
                          key={`${entry.id || piece.id}-wall-${wallType}-${index}`}
                          className={getWallClassName(segmentType)}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                        />
                      )
                    },
                  )
                }),
              )}
            </g>
          </svg>
          {activeMap?.id === 'map_01' && selectedCritOpsCard ? (
            <>
              <BoardSide
                mapClass="is-map-01"
                side="is-left"
                cardClassName={`board-card-overlay is-bottom-left is-map-01${map1OpClass}`}
                killOpClassName="board-killop-overlay is-map-01 is-left"
                cardContent={<CritOpsCard card={selectedCritOpsCard} />}
                killOpContent={<KillOp />}
                killOpFirst
              />
              <BoardSide
                mapClass="is-map-01"
                side="is-right"
                cardClassName={`board-card-overlay is-top-right is-map-01${map1OpClass}`}
                killOpClassName="board-killop-overlay is-map-01 is-right"
                cardContent={<CritOpsCard card={selectedCritOpsCard} />}
                killOpContent={<KillOp />}
                killOpFirst
              />
            </>
          ) : activeMap?.id === 'map_02' && selectedCritOpsCard ? (
            <>
              <BoardSide
                mapClass="is-map-02"
                side="is-left"
                cardClassName={`board-card-overlay is-top-left is-map-02${map2OpClass}`}
                killOpClassName={`board-killop-overlay is-map-02 is-left${map2OpClass}`}
                cardContent={
                  <CritOpsCard card={selectedCritOpsCard} isTwoColumn />
                }
                killOpContent={<KillOp />}
                killOpFirst
              />
              <BoardSide
                mapClass="is-map-02"
                side="is-right"
                cardClassName={`board-card-overlay is-bottom-right is-map-02${map2OpClass}`}
                killOpClassName={`board-killop-overlay is-map-02 is-right${map2OpClass}`}
                cardContent={
                  <CritOpsCard card={selectedCritOpsCard} isTwoColumn />
                }
                killOpContent={<KillOp />}
                killOpFirst
              />
            </>
          ) : null}
          </div>
      </div>
    </div>
  )
}

export default Board
