// Background service worker

// Open side panel when toolbar icon clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.sidePanel.open({ tabId: tab.id })
})

// Register context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'qaw-save-xpath',
    title: '🔬 Save XPath to Vault (QA Workbench)',
    contexts: ['all'],
  })
})

// Context menu → activate inspect mode on the page
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'qaw-save-xpath' || !tab?.id) return
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_INSPECT_MODE' })
    await chrome.sidePanel.open({ tabId: tab.id })
  } catch (_) { /* tab may not have content script */ }
})

// ── Helper: send message to active tab's content script ─────────────────────
async function sendToActiveTab(message: object): Promise<unknown> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return null
  return chrome.tabs.sendMessage(tab.id, message).catch(() => null)
}

// ── Helper: run script in page's MAIN world ──────────────────────────────────
async function execInMainWorld(tabId: number, func: () => unknown): Promise<unknown> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func,
    })
    return results?.[0]?.result ?? null
  } catch {
    return null
  }
}

// ── Message hub ───────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {

    // Side panel → forward ACTIVATE_INSPECT_MODE to active tab
    case 'ACTIVATE_INSPECT_MODE': {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id)
          chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_INSPECT_MODE' })
            .then(() => sendResponse({ ok: true }))
            .catch(e => sendResponse({ ok: false, error: String(e) }))
      })
      return true
    }

    // Content script → rebroadcast XPATH_CAPTURED / INSPECT_CANCELLED to side panel
    case 'XPATH_CAPTURED':
    case 'INSPECT_CANCELLED': {
      chrome.runtime.sendMessage({ type: msg.type, payload: msg.payload }).catch(() => {})
      break
    }

    // Side panel → orchestrate full evidence capture
    case 'CAPTURE_BUG': {
      ;(async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (!tab?.id) { sendResponse({ ok: false }); return }

          const tabId = tab.id

          // Screenshot
          const screenshotDataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' })

          // Console errors + action timeline + basic env from content script
          let consoleErrors: string[] = []
          let actionTimeline: unknown[] = []
          let contentEnv: Record<string, unknown> = {}
          try {
            const r = await chrome.tabs.sendMessage(tabId, { type: 'GET_EVIDENCE_DATA' }) as {
              consoleErrors?: string[]
              actionTimeline?: unknown[]
              environment?: Record<string, unknown>
            }
            consoleErrors = r?.consoleErrors ?? []
            actionTimeline = r?.actionTimeline ?? []
            contentEnv = r?.environment ?? {}
          } catch (_) {
            // Fallback: try just console errors
            try {
              const r2 = await chrome.tabs.sendMessage(tabId, { type: 'GET_CONSOLE_ERRORS' }) as { errors?: string[] }
              consoleErrors = r2?.errors ?? []
            } catch (_) {}
          }

          // Page-level data via MAIN world script
          const pageData = await execInMainWorld(tabId, () => {
            const now = Date.now()
            const t0 = performance.now()

            // Network failures from PerformanceResourceTiming
            const networkFailures = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
              .filter(e => {
                const s = (e as PerformanceResourceTiming & { responseStatus?: number }).responseStatus
                return s !== undefined && (s < 200 || s >= 400)
              })
              .slice(-20)
              .map(e => ({
                url: e.name.slice(0, 200),
                status: (e as PerformanceResourceTiming & { responseStatus?: number }).responseStatus,
                timestamp: new Date(now - t0 + e.startTime).toISOString(),
              }))

            // Storage keys only (no values)
            const lsKeys: string[] = (() => { try { return Object.keys(localStorage) } catch { return [] } })()
            const ssKeys: string[] = (() => { try { return Object.keys(sessionStorage) } catch { return [] } })()

            // Lightweight DOM snippet around active element
            let domSnippet = ''
            try {
              const target = (document.activeElement as HTMLElement | null) ?? document.body
              domSnippet = (target?.outerHTML ?? '')
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '<script>...</script>')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '<style>...</style>')
                .slice(0, 1000)
            } catch (_) {}

            return {
              networkFailures,
              storageKeys: { localStorage: lsKeys, sessionStorage: ssKeys },
              domSnippet,
            }
          })

          const pd = pageData as {
            networkFailures?: unknown[]
            storageKeys?: { localStorage: string[]; sessionStorage: string[] }
            domSnippet?: string
          } | null

          // UA metadata (from background service worker)
          const ua = navigator.userAgent
          const chromeVer = ua.match(/Chrome\/([\d.]+)/)?.[1] ?? ''
          const os = ua.includes('Windows') ? 'Windows'
            : ua.includes('Mac') ? 'macOS'
            : ua.includes('Linux') ? 'Linux'
            : 'Unknown'

          const environment = {
            url: tab.url ?? '',
            pageTitle: tab.title ?? '',
            browser: `Chrome ${chromeVer}`,
            os,
            viewport: (contentEnv.viewport as { width: number; height: number } | undefined)
              ?? { width: 0, height: 0 },
            devicePixelRatio: (contentEnv.devicePixelRatio as number | undefined) ?? 1,
            language: (contentEnv.language as string | undefined) ?? '',
            online: (contentEnv.online as boolean | undefined) ?? true,
            readyState: (contentEnv.readyState as string | undefined) ?? '',
            timestamp: new Date().toISOString(),
          }

          sendResponse({
            ok: true,
            data: {
              screenshotDataUrl,
              url: tab.url ?? '',
              pageTitle: tab.title ?? '',
              browser: `Chrome ${chromeVer}`,
              os,
              consoleErrors,
              timestamp: new Date().toISOString(),
              environment,
              actionTimeline,
              networkFailures: pd?.networkFailures ?? [],
              domSnippet: pd?.domSnippet ?? '',
              storageKeys: pd?.storageKeys ?? { localStorage: [], sessionStorage: [] },
            },
          })
        } catch (e) {
          sendResponse({ ok: false, error: String(e) })
        }
      })()
      return true
    }

    // Side panel → relay VALIDATE_XPATHS to active tab content script
    case 'VALIDATE_XPATHS': {
      ;(async () => {
        const result = await sendToActiveTab({ type: 'VALIDATE_XPATHS', payload: msg.payload })
        sendResponse(result ?? { results: [] })
      })()
      return true
    }

    // Recording — relay START/STOP to content script; relay STEP back to side panel
    case 'START_RECORDING':
    case 'STOP_RECORDING': {
      ;(async () => {
        const result = await sendToActiveTab({ type: msg.type })
        sendResponse(result ?? { ok: false })
      })()
      return true
    }

    case 'RECORDING_STEP':
    case 'RECORDING_STOPPED': {
      chrome.runtime.sendMessage({ type: msg.type, payload: msg.payload }).catch(() => {})
      break
    }
  }

  return false
})
