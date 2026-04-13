/**
 * Minimal chrome API mock for Vitest (jsdom environment).
 * Only mocks what the stores and utilities actually call.
 */

const store: Record<string, unknown> = {}

export const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(store, data)
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    captureVisibleTab: vi.fn(),
  },
  scripting: {
    executeScript: vi.fn(),
  },
}

/** Reset store and all mock call history. */
export function resetChromeMock() {
  for (const k of Object.keys(store)) delete store[k]
  vi.clearAllMocks()
  // Restore fresh implementations after clearAllMocks
  chromeMock.storage.local.get.mockImplementation(async (key: string) => ({ [key]: store[key] }))
  chromeMock.storage.local.set.mockImplementation(async (data: Record<string, unknown>) => {
    Object.assign(store, data)
  })
}

// Install globally so imports of chrome.storage.local etc. resolve
;(globalThis as unknown as Record<string, unknown>).chrome = chromeMock
