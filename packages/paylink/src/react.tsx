import { useEffect, useMemo, useRef } from 'react'
import type { IframeEvent, PaylinkPrefill, PaymentResult } from './types.js'
import { buildPaylinkUrl } from './url.js'

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
    function handleMessage(e: MessageEvent<IframeEvent>) {
      if (!e.data || typeof e.data !== 'object') return

      if (e.data.type === 'RESIZE' && iframeRef.current) {
        iframeRef.current.style.height = `${e.data.height}px`
      }

      if (e.data.type === 'PAYMENT_SUCCESS') {
        onSuccess?.({ txId: e.data.txId, amount: e.data.amount, phone: e.data.phone })
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
