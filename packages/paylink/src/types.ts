export type PaymentResult = {
  txId:   string
  amount: number
  phone:  string
}

export type PayOptions = {
  onSuccess?: (data: PaymentResult) => void
  onClose?:   () => void
}

export type IframeEvent =
  | { type: 'RESIZE';          height: number }
  | { type: 'PAYMENT_SUCCESS'; txId: string; amount: number; phone: string }
