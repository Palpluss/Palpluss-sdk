import type { IframeEvent } from './types.js'
import { PAYLINK_BASE_URL } from './url.js'

const PAYLINK_ORIGIN = new URL(PAYLINK_BASE_URL).origin

/**
 * Accept a postMessage only when it is a well-formed event sent by OUR payment
 * iframe on the Palpluss origin. Anything else — other frames, browser
 * extensions, scripts on the host page — is ignored, so a forged
 * PAYMENT_SUCCESS can never resolve `pay()` or fire `onSuccess`.
 */
export function readIframeMessage(
  e: MessageEvent,
  iframe: HTMLIFrameElement | null,
): IframeEvent | null {
  if (e.origin !== PAYLINK_ORIGIN) return null
  if (!iframe || e.source !== iframe.contentWindow) return null

  const data = e.data as Partial<Record<string, unknown>> | null
  if (!data || typeof data !== 'object') return null

  if (data.type === 'RESIZE') {
    const height = Number(data.height)
    if (!Number.isFinite(height) || height <= 0) return null
    return { type: 'RESIZE', height: Math.min(height, 10_000) }
  }

  if (data.type === 'PAYMENT_SUCCESS') {
    const amount = Number(data.amount)
    if (typeof data.txId !== 'string' || !data.txId) return null
    if (!Number.isFinite(amount)) return null
    return {
      type: 'PAYMENT_SUCCESS',
      txId: data.txId,
      amount,
      phone: typeof data.phone === 'string' ? data.phone : '',
    }
  }

  return null
}
