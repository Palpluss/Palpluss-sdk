import type { PaylinkPrefill } from './types.js'

export const PAYLINK_BASE_URL = 'https://link.palpluss.com'

const MAX_NAME_LENGTH = 120

/**
 * Build the URL of the hosted payment page, optionally pre-filled.
 *
 * Embedded (default) URLs carry `embed=1` so the page talks to the parent via
 * postMessage. Pass `{ embed: false }` for a plain shareable link.
 *
 * Throws `TypeError` for invalid pre-fill values so mistakes surface during
 * development instead of silently showing an empty field.
 */
export function buildPaylinkUrl(
  paylinkId: string,
  prefill: PaylinkPrefill = {},
  { embed = true }: { embed?: boolean } = {},
): string {
  if (typeof paylinkId !== 'string' || !paylinkId.trim()) {
    throw new TypeError('paylinkId is required')
  }

  const params = new URLSearchParams()
  if (embed) params.set('embed', '1')

  if (prefill.amount !== undefined) {
    const amount = Number(prefill.amount)
    if (!Number.isFinite(amount) || amount < 1) {
      throw new TypeError('amount must be a number of at least 1 (KES)')
    }
    params.set('amount', String(Math.round(amount * 100) / 100))
  }

  if (prefill.phone !== undefined) {
    const phone = String(prefill.phone).trim()
    if (!phone) throw new TypeError('phone must be a non-empty string')
    params.set('phone', phone)
  }

  if (prefill.customerName !== undefined) {
    const name = String(prefill.customerName).trim()
    if (name.length > MAX_NAME_LENGTH) {
      throw new TypeError(`customerName must be at most ${MAX_NAME_LENGTH} characters`)
    }
    if (name) params.set('customer_name', name)
  }

  if (prefill.lockPrefill) params.set('lock', '1')

  const query = params.toString()
  return `${PAYLINK_BASE_URL}/${encodeURIComponent(paylinkId.trim())}${query ? `?${query}` : ''}`
}
