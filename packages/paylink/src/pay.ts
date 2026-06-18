import { openModal } from './modal.js'
import type { PaymentResult, PayOptions } from './types.js'

export function pay(
  paylinkId: string,
  options: PayOptions = {},
): Promise<PaymentResult> {
  return new Promise((resolve, reject) => {
    openModal(paylinkId, options, resolve, reject)
  })
}
