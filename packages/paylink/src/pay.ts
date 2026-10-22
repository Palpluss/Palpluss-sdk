import { openModal } from './modal.js'
import type { PaymentResult, PayOptions } from './types.js'

export function pay(
  paylinkId: string,
  options: PayOptions = {},
): Promise<PaymentResult> {
  return new Promise((resolve, reject) => {
    // A throw here (e.g. invalid pre-fill) rejects the returned Promise.
    openModal(paylinkId, options, resolve, reject)
  })
}
