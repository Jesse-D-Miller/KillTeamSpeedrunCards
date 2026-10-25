import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

function QrCode({ text, size = 240, className = '' }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(text, { margin: 1, width: size, color: { dark: '#000000', light: '#ffffff' } })
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [text, size])

  if (!src) return <div className={className} style={{ width: size, height: size }} />
  return <img className={className} src={src} width={size} height={size} alt={text} />
}

export default QrCode
