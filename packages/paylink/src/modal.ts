import type { IframeEvent, PaymentResult, PayOptions } from './types.js'

const BASE_URL = 'https://link.palpluss.com'

// Injected once, shared across all modal instances on the page.
let sharedStyles: HTMLStyleElement | null = null

function ensureStyles() {
  if (sharedStyles) return
  sharedStyles = document.createElement('style')
  sharedStyles.setAttribute('data-palpluss-styles', '')
  sharedStyles.textContent = `
    dialog[data-palpluss] {
      padding: 0;
      border: none;
      border-radius: 12px;
      width: calc(100% - 32px);
      max-width: 860px;
      max-height: calc(100vh - 32px);
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      box-shadow: 0 24px 64px rgba(0,0,0,0.20);
      margin: auto;
    }
    dialog[data-palpluss]::backdrop {
      background: rgba(0,0,0,0.55);
    }
    @media (max-width: 639px) {
      dialog[data-palpluss] {
        width: 100%;
        max-width: 100%;
        height: 100vh;
        height: 100dvh;
        max-height: 100vh;
        max-height: 100dvh;
        border-radius: 0;
        margin: 0;
        inset: 0;
      }
      dialog[data-palpluss] [data-palpluss-close] {
        background: rgba(255,255,255,0.92) !important;
        border-radius: 50% !important;
        width: 32px !important;
        height: 32px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
    }
  `
  document.head.appendChild(sharedStyles)
}

export function openModal(
  paylinkId: string,
  options: PayOptions,
  resolve: (result: PaymentResult) => void,
  reject:  (reason?: unknown) => void,
): () => void {

  ensureStyles()

  // ── Build DOM ─────────────────────────────────────────────────────────────

  const dialog = document.createElement('dialog')
  dialog.setAttribute('data-palpluss', '')

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'
  closeBtn.setAttribute('aria-label', 'Close payment')
  closeBtn.setAttribute('data-palpluss-close', '')
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

  dialog.appendChild(closeBtn)
  dialog.appendChild(iframe)
  document.body.appendChild(dialog)

  // showModal() puts the dialog in the browser top layer:
  // - body scroll is locked automatically
  // - no z-index needed
  // - Escape fires a native 'cancel' event
  dialog.showModal()

  // ── Cleanup ───────────────────────────────────────────────────────────────

  function cleanup() {
    dialog.close()
    document.body.removeChild(dialog)
    window.removeEventListener('message', onMessage)
  }

  // ── postMessage handler ───────────────────────────────────────────────────

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

  // ── Close handlers ────────────────────────────────────────────────────────

  function close() {
    options.onClose?.()
    cleanup()
    reject(new Error('Payment modal closed by user'))
  }

  // Escape key — browser fires 'cancel' on the dialog natively
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault() // let our close() handle teardown
    close()
  })

  closeBtn.addEventListener('click', close)

  // Backdrop click — clicks on ::backdrop land on the dialog element itself,
  // outside its content box. Compare pointer position against dialog bounds.
  dialog.addEventListener('click', (e) => {
    const rect = dialog.getBoundingClientRect()
    const outsideDialog =
      e.clientX < rect.left  ||
      e.clientX > rect.right ||
      e.clientY < rect.top   ||
      e.clientY > rect.bottom
    if (outsideDialog) close()
  })

  window.addEventListener('message', onMessage)

  return cleanup
}
