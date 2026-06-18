import type { IframeEvent, PaymentResult, PayOptions } from './types.js'

const BASE_URL = 'https://link.palpluss.com'

// Injected once, shared across all modal instances on the page.
let sharedStyles: HTMLStyleElement | null = null

function ensureStyles() {
  if (sharedStyles) return
  sharedStyles = document.createElement('style')
  sharedStyles.setAttribute('data-palpluss-styles', '')
  sharedStyles.textContent = `
    @media (max-width: 639px) {
      [data-palpluss-overlay] {
        padding: 0 !important;
        align-items: stretch !important;
      }
      [data-palpluss-card] {
        max-width: 100% !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        margin: 0 !important;
        min-height: 100vh !important;
        min-height: 100dvh !important;
      }
      [data-palpluss-close] {
        background: rgba(255,255,255,0.92) !important;
        border-radius: 50% !important;
        width: 32px !important;
        height: 32px !important;
        top: 14px !important;
        right: 14px !important;
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

  const overlay = document.createElement('div')
  overlay.setAttribute('data-palpluss-overlay', '')
  Object.assign(overlay.style, {
    position:                 'fixed',
    inset:                    '0',
    backgroundColor:          'rgba(0,0,0,0.55)',
    display:                  'flex',
    // no alignItems — defaults to stretch; card uses margin:auto to center
    // when it fits, and the overlay scrolls when the card is taller
    overflowY:                'auto',
    WebkitOverflowScrolling:  'touch',  // momentum scroll on iOS
    zIndex:                   '2147483647',
    padding:                  '16px',
    boxSizing:                'border-box',
  })

  const card = document.createElement('div')
  card.setAttribute('data-palpluss-card', '')
  Object.assign(card.style, {
    position:     'relative',
    width:        '100%',
    maxWidth:     '860px',
    background:   '#fff',
    borderRadius: '12px',
    overflow:     'hidden',
    boxShadow:    '0 24px 64px rgba(0,0,0,0.20)',
    margin:       'auto',   // centers in overlay when card < viewport height;
    flexShrink:   '0',      // prevents flex from squishing the card
  })

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
    display:   'block',
    width:     '100%',
    border:    'none',
    minHeight: '560px',
    transition: 'height 0.2s ease',
  })

  card.appendChild(closeBtn)
  card.appendChild(iframe)
  overlay.appendChild(card)
  document.body.appendChild(overlay)

  // Scroll lock — only applied on desktop; on mobile the overlay itself scrolls.
  const prevOverflow = document.body.style.overflow
  if (window.innerWidth >= 640) {
    document.body.style.overflow = 'hidden'
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  function cleanup() {
    document.body.removeChild(overlay)
    document.body.style.overflow = prevOverflow
    window.removeEventListener('message', onMessage)
    document.removeEventListener('keydown', onKeydown)
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
