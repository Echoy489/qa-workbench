// Injected into every page at document_start

import {
  generateCandidates,
  captureAttrSnapshot,
  validateXPath,
} from '../shared/xpathUtils'
import type { ActionEvent, ActionEventType } from '../shared/types'

// ── Ring buffer ──────────────────────────────────────────────────────────────
class RingBuffer<T> {
  private buf: T[] = []
  constructor(private readonly cap: number) {}
  push(item: T) {
    if (this.buf.length >= this.cap) this.buf.shift()
    this.buf.push(item)
  }
  all(): T[] { return [...this.buf] }
  clear() { this.buf = [] }
}

// ── Console error buffering ──────────────────────────────────────────────────
const consoleBuf = new RingBuffer<string>(50)

const _origConsoleError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  consoleBuf.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '))
  _origConsoleError(...args)
}
window.addEventListener('error', (e: ErrorEvent) => {
  consoleBuf.push(`${e.message} (${e.filename}:${e.lineno})`)
})
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  consoleBuf.push(`Unhandled rejection: ${String(e.reason)}`)
})

// ── Action timeline ──────────────────────────────────────────────────────────
const actionBuf = new RingBuffer<ActionEvent>(100)

function isSensitiveField(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement) {
    const type = el.type?.toLowerCase()
    if (type === 'password') return true
    const probe = `${el.name} ${el.id} ${el.placeholder}`.toLowerCase()
    if (/password|token|secret|auth|key|api|credential/.test(probe)) return true
  }
  return false
}

function buildTargetHint(el: HTMLElement): string {
  if (el.id) return `#${el.id}`
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) return `[aria-label="${ariaLabel.slice(0, 30)}"]`
  const role = el.getAttribute('role')
  if (role) return `[role="${role}"]`
  const name = el.getAttribute('name')
  if (name) return `[name="${name}"]`
  const tag = el.tagName.toLowerCase()
  // Only include class fragments that look stable (no hash-like tokens)
  const stableClasses = Array.from(el.classList)
    .filter(c => !c.match(/[a-z0-9]{4,}-[a-f0-9]{4,}/) && c.length < 20)
    .slice(0, 2)
  return stableClasses.length ? `${tag}.${stableClasses.join('.')}` : tag
}

function recordAction(type: ActionEventType, description: string, targetHint: string) {
  actionBuf.push({
    type,
    timestamp: new Date().toISOString(),
    description,
    targetHint,
    url: location.href,
  })
  if (recording) {
    emitRecordingStep(type, description, targetHint)
  }
}

// Passive capture — attached once, always running
document.addEventListener('click', (e: MouseEvent) => {
  const el = e.target
  if (!(el instanceof HTMLElement)) return
  if (el.id?.startsWith('__qaw_')) return
  const hint = buildTargetHint(el)
  recordAction('click', `Clicked ${hint}`, hint)
}, { capture: true, passive: true })

document.addEventListener('input', (e: Event) => {
  const el = e.target
  if (!(el instanceof HTMLElement)) return
  if (el.id?.startsWith('__qaw_')) return
  const hint = buildTargetHint(el)
  const sensitive = isSensitiveField(el)
  // Never record values of sensitive fields
  const desc = sensitive ? `Entered text in ${hint}` : `Entered text in ${hint}`
  recordAction('input', desc, hint)
}, { capture: true, passive: true })

document.addEventListener('change', (e: Event) => {
  const el = e.target
  if (!(el instanceof HTMLElement)) return
  const hint = buildTargetHint(el)
  if (el instanceof HTMLSelectElement) {
    const selected = el.options[el.selectedIndex]?.text ?? ''
    recordAction('change', `Selected "${selected}" in ${hint}`, hint)
  } else {
    recordAction('change', `Changed ${hint}`, hint)
  }
}, { capture: true, passive: true })

document.addEventListener('keydown', (e: KeyboardEvent) => {
  const el = e.target
  if (!(el instanceof HTMLElement)) return
  if (!['Enter', 'Escape', 'Tab'].includes(e.key)) return
  recordAction('keydown', `Pressed ${e.key}`, buildTargetHint(el))
}, { capture: true, passive: true })

window.addEventListener('popstate', () => {
  recordAction('navigate', `Navigated to ${location.href}`, 'page')
})
window.addEventListener('hashchange', () => {
  recordAction('navigate', `Navigated to ${location.href}`, 'page')
})

// ── Inspect mode ─────────────────────────────────────────────────────────────
let inspectActive = false
let hlEl: HTMLElement | null = null
let bannerEl: HTMLElement | null = null

function activateInspect() {
  if (inspectActive) return
  inspectActive = true

  hlEl = document.createElement('div')
  hlEl.id = '__qaw_hl__'
  Object.assign(hlEl.style, {
    position: 'fixed', border: '2px solid #2563eb',
    background: 'rgba(37,99,235,0.08)', pointerEvents: 'none',
    zIndex: '2147483645', borderRadius: '3px', transition: 'all 80ms',
    boxSizing: 'border-box', top: '0', left: '0', width: '0', height: '0',
  })
  document.body.appendChild(hlEl)

  bannerEl = document.createElement('div')
  bannerEl.id = '__qaw_banner__'
  bannerEl.innerHTML =
    '🔬 <strong>QA Inspect</strong> — Click an element to capture &nbsp;' +
    '<span style="background:#1d4ed8;padding:1px 7px;border-radius:3px;font-size:11px">ESC</span> to cancel'
  Object.assign(bannerEl.style, {
    position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
    background: '#2563eb', color: 'white', padding: '8px 18px',
    borderRadius: '8px', fontFamily: 'system-ui,sans-serif', fontSize: '13px',
    zIndex: '2147483647', boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    whiteSpace: 'nowrap', userSelect: 'none',
  })
  document.body.appendChild(bannerEl)

  document.addEventListener('mouseover', onInspectHover, true)
  document.addEventListener('click', onInspectClick, true)
  document.addEventListener('keydown', onInspectKey, true)
}

function deactivateInspect() {
  if (!inspectActive) return
  inspectActive = false
  hlEl?.remove(); hlEl = null
  bannerEl?.remove(); bannerEl = null
  document.removeEventListener('mouseover', onInspectHover, true)
  document.removeEventListener('click', onInspectClick, true)
  document.removeEventListener('keydown', onInspectKey, true)
}

function onInspectHover(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (!t || t.id?.startsWith('__qaw_')) return
  const r = t.getBoundingClientRect()
  if (hlEl) Object.assign(hlEl.style, {
    top: `${r.top}px`, left: `${r.left}px`,
    width: `${r.width}px`, height: `${r.height}px`,
  })
}

function onInspectClick(e: MouseEvent) {
  e.preventDefault()
  e.stopImmediatePropagation()
  const t = e.target as HTMLElement
  if (t.id?.startsWith('__qaw_')) return

  const candidates = generateCandidates(t)
  const attrSnapshot = captureAttrSnapshot(t)

  chrome.runtime.sendMessage({
    type: 'XPATH_CAPTURED',
    payload: {
      candidates,
      url: location.href,
      pageTitle: document.title,
      tagName: t.tagName.toLowerCase(),
      innerText: (t.textContent?.trim() || '').slice(0, 80),
      attrSnapshot,
    },
  })
  deactivateInspect()
}

function onInspectKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    deactivateInspect()
    chrome.runtime.sendMessage({ type: 'INSPECT_CANCELLED' })
  }
}

// ── Step Recorder ─────────────────────────────────────────────────────────────
let recording = false

function emitRecordingStep(type: string, description: string, targetHint: string) {
  chrome.runtime.sendMessage({
    type: 'RECORDING_STEP',
    payload: {
      id: crypto.randomUUID(),
      stepNumber: 0, // renumbered by sidepanel
      timestamp: new Date().toISOString(),
      type,
      description,
      targetHint,
      url: location.href,
    },
  }).catch(() => {})
}

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'ACTIVATE_INSPECT_MODE':
      activateInspect()
      sendResponse({ ok: true })
      break

    case 'DEACTIVATE_INSPECT_MODE':
      deactivateInspect()
      sendResponse({ ok: true })
      break

    case 'GET_CONSOLE_ERRORS':
      sendResponse({ errors: consoleBuf.all() })
      break

    case 'GET_EVIDENCE_DATA':
      sendResponse({
        consoleErrors: consoleBuf.all(),
        actionTimeline: actionBuf.all(),
        environment: {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          devicePixelRatio: window.devicePixelRatio,
          language: navigator.language,
          online: navigator.onLine,
          readyState: document.readyState,
        },
      })
      break

    case 'VALIDATE_XPATHS': {
      const xpaths: string[] = msg.payload?.xpaths ?? []
      const results = xpaths.map(xpath => validateXPath(xpath))
      sendResponse({ results })
      break
    }

    case 'START_RECORDING':
      recording = true
      sendResponse({ ok: true })
      break

    case 'STOP_RECORDING':
      recording = false
      sendResponse({ ok: true })
      break
  }
  return true
})
