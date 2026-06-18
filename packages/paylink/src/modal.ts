import type { IframeEvent, PaymentResult, PayOptions } from './types.js'

const BASE_URL = 'https://link.palpluss.com'

export function openModal(
  paylinkId: string,
  options: PayOptions,
  resolve: (result: PaymentResult) => void,
  reject:  (reason?: unknown) => void,
): () => void {

  const overlay = document.createElement('div')
  overlay.setAttribute('data-palpluss-overlay', '')
  Object.assign(overlay.style, {
    position:        'fixed',
    inset:           '0',
    backgroundColor: 'rgba(0,0,0,0.55)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          '2147483647',
    padding:         '16px',
    boxSizing:       'border-box',
  })

  const card = document.createElement('div')
  Object.assign(card.style, {
    position:     'relative',
    width:        '100%',
    maxWidth:     '860px',
    background:   '#fff',
    borderRadius: '12px',
    overflow:     'hidden',
    boxShadow:    '0 24px 64px rgba(0,0,0,0.20)',
  })

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'
  closeBtn.setAttribute('aria-label', 'Close payment')
  Object.assign(closeBtn.style, {
    position:   'absolute',
    top:        '12px',
    right:      '12px',
    zIndex:     '1',
    background: 'transparent',
    border:     'none',
    cursor:     'pointer',
    fontSize:   '18px',
    color:      '#6b7280',
    lineHeight: '1',
    padding:    '4px',
  })

  const iframe = document.createElement('iframe')
  iframe.src = `${BASE_URL}/${encodeURIComponent(paylinkId)}?embed=1`
  iframe.allow = 'payment'
  Object.assign(iframe.style, {
    display:    'block',
    width:      '100%',
    border:     'none',
    minHeight:  '560px',
    transition: 'height 0.2s ease',
  })

  card.appendChild(closeBtn)
  card.appendChild(iframe)
  overlay.appendChild(card)
  document.body.appendChild(overlay)

  const prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  function cleanup() {
    document.body.removeChild(overlay)
    document.body.style.overflow = prevOverflow
    window.removeEventListener('message', onMessage)
    document.removeEventListener('keydown', onKeydown)
  }

  function onMessage(e: MessageEvent<IframeEvent>) {
    if (!e.data || typeof e.data !== 'object') return

    if (e.data.type === 'RESIZE') {
      iframe.style.height = `${e.data.height}px`
    }

    if (e.data.type === 'PAYMENT_SUCCESS') {
      const result: PaymentResult = {
        txId:   e.data.txId,
        amount: e.data.amount,
        phone:  e.data.phone,
      }
      options.onSuccess?.(result)
      cleanup()
      resolve(result)
    }
  }

  function close() {
    options.onClose?.()
    cleanup()
    reject(new Error('Payment modal closed by user'))
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }

  closeBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  window.addEventListener('message', onMessage)
  document.addEventListener('keydown', onKeydown)

  return cleanup
}
