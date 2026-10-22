export type PaymentResult = {
  txId:   string
  amount: number
  phone:  string
}

/**
 * Values to pre-fill on the payment form. Fields the merchant already fixed on
 * the paylink (amount / phone set in the Console) always win — a pre-fill can
 * never change a merchant-fixed value.
 */
export type PaylinkPrefill = {
  /** Amount in KES (≥ 1). Pre-fills the amount when the paylink has none. */
  amount?:       number
  /** Customer M-PESA number, e.g. `0712345678` or `254712345678`. */
  phone?:        string
  /** Customer name / payment note (max 120 characters). */
  customerName?: string
  /**
   * Make the pre-filled fields read-only so the customer can't edit them
   * (e.g. an amount computed from your cart). Default `false`.
   */
  lockPrefill?:  boolean
}

export type PayOptions = PaylinkPrefill & {
  onSuccess?: (data: PaymentResult) => void
  onClose?:   () => void
}

export type IframeEvent =
  | { type: 'RESIZE';          height: number }
  | { type: 'PAYMENT_SUCCESS'; txId: string; amount: number; phone: string }
