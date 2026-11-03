import { useEffect, useMemo, useRef } from 'react'
import type { PaylinkPrefill, PaymentResult } from './types.js'
import { buildPaylinkUrl } from './url.js'
import { readIframeMessage } from './messages.js'

interface PalplussPaymentProps extends PaylinkPrefill {
  id:         string
  onSuccess?: (data: PaymentResult) => void
  className?: string
}

export function PalplussPayment({
  id,
  onSuccess,
  className,
  amount,
  phone,
  customerName,
  lockPrefill,
}: PalplussPaymentProps) {
  // Rebuild only when an input changes, so the iframe doesn't reload on every render.
  const src = useMemo(
    () => buildPaylinkUrl(id, { amount, phone, customerName, lockPrefill }),
    [id, amount, phone, customerName, lockPrefill],
  )

  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      // Only trust well-formed events from our own iframe on the Palpluss origin.
      const msg = readIframeMessage(e, iframeRef.current)
      if (!msg) return

      if (msg.type === 'RESIZE' && iframeRef.current) {
        iframeRef.current.style.height = `${msg.height}px`
      }

      if (msg.type === 'PAYMENT_SUCCESS') {
        onSuccess?.({ txId: msg.txId, amount: msg.amount, phone: msg.phone })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onSuccess])

  return (
    <iframe
      ref={iframeRef}
      src={src}
      allow="payment"
      className={className}
      style={{ width: '100%', border: 'none', minHeight: 560, display: 'block' }}
    />
  )
}
