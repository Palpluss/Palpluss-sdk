import { useEffect, useRef } from 'react'
import type { IframeEvent, PaymentResult } from './types.js'

const BASE_URL = 'https://link.palpluss.com'

interface PalplussPaymentProps {
  id:         string
  onSuccess?: (data: PaymentResult) => void
  className?: string
}

export function PalplussPayment({ id, onSuccess, className }: PalplussPaymentProps) {
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
      src={`${BASE_URL}/${encodeURIComponent(id)}?embed=1`}
      allow="payment"
      className={className}
      style={{ width: '100%', border: 'none', minHeight: 560, display: 'block' }}
    />
  )
}
