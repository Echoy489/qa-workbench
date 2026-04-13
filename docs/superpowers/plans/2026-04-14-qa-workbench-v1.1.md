# QA Workbench v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden QA Workbench v1.0 with unit tests, bug capsule editing, search/filter, and keyboard shortcut capture.

**Architecture:** All changes are additive to the existing React + TypeScript + Vite Chrome extension. Tests use Vitest. No new dependencies except `vitest` and `@testing-library/react`.

**Tech Stack:** React 18, TypeScript, Vite 4, Vitest, Chrome Extension MV3, chrome.storage.local

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add vitest, @testing-library/react |
| `vite.config.ts` | Modify | Add vitest config block |
| `src/shared/types.ts` | Read-only reference | |
| `src/store/xpathStore.ts` | Read-only reference | |
| `src/store/capsuleStore.ts` | Read-only reference | |
| `src/content/index.ts` | Read-only reference | |
| `tests/xpathGeneration.test.ts` | Create | Unit tests for XPath generation logic |
| `tests/capsuleStore.test.ts` | Create | Unit tests for capsule store operations |
| `tests/xpathStore.test.ts` | Create | Unit tests for xpath store operations |
| `src/components/bug-capsule/CapsuleDetail.tsx` | Modify | Add Edit mode |
| `src/components/bug-capsule/BugCapsule.tsx` | Modify | Add search/filter bar |
| `src/components/xpath-vault/XPathVault.tsx` | Read — already has search | No change needed |
| `src/background/index.ts` | Modify | Register keyboard shortcut handler |
| `manifest.json` | Modify | Add `commands` for keyboard shortcut |

---

## Task 1: Set Up Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Expected: packages added to `package.json` devDependencies.

- [ ] **Step 2: Add test script to package.json**

Open `package.json`. In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Add vitest config to vite.config.ts**

Open `vite.config.ts`. After the `build` block (before the closing `}`), add:

```typescript
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
```

Also add `/// <reference types="vitest" />` as the very first line of the file.

- [ ] **Step 4: Create test setup file**

Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Verify vitest runs**

```bash
npm test
```

Expected: `No test files found` — that's fine, no tests exist yet. Exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.ts tests/setup.ts
git commit -m "chore: add vitest test infrastructure"
```

---

## Task 2: Unit Tests — XPath Generation

The XPath generation logic lives in `src/content/index.ts` inside `generateXPathCandidates(el: Element)`. To test it, extract it to a pure module.

**Files:**
- Create: `src/shared/xpathUtils.ts`
- Modify: `src/content/index.ts`
- Create: `tests/xpathGeneration.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `tests/xpathGeneration.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { generateXPathCandidates } from '../src/shared/xpathUtils'

function makeEl(tag: string, attrs: Record<string, string> = {}): Element {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

describe('generateXPathCandidates', () => {
  it('returns id-based xpath when element has id', () => {
    const el = makeEl('input', { id: 'username' })
    const candidates = generateXPathCandidates(el)
    expect(candidates[0].strategy).toBe('id')
    expect(candidates[0].xpath).toBe("//input[@id='username']")
  })

  it('returns data-testid xpath when element has data-testid', () => {
    const el = makeEl('button', { 'data-testid': 'submit-btn' })
    const candidates = generateXPathCandidates(el)
    const testIdCandidate = candidates.find(c => c.strategy === 'data-testid')
    expect(testIdCandidate).toBeDefined()
    expect(testIdCandidate!.xpath).toBe("//button[@data-testid='submit-btn']")
  })

  it('returns name xpath when element has name attribute', () => {
    const el = makeEl('input', { name: 'email' })
    const candidates = generateXPathCandidates(el)
    const nameCandidate = candidates.find(c => c.strategy === 'name')
    expect(nameCandidate).toBeDefined()
    expect(nameCandidate!.xpath).toBe("//input[@name='email']")
  })

  it('always returns at least one candidate', () => {
    const el = makeEl('div')
    const candidates = generateXPathCandidates(el)
    expect(candidates.length).toBeGreaterThan(0)
  })

  it('id strategy ranks first when id is present', () => {
    const el = makeEl('button', { id: 'login', 'data-testid': 'login-btn', name: 'login' })
    const candidates = generateXPathCandidates(el)
    expect(candidates[0].strategy).toBe('id')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/shared/xpathUtils'`

- [ ] **Step 3: Extract XPath logic to shared module**

Read `src/content/index.ts` and find the `generateXPathCandidates` function. Create `src/shared/xpathUtils.ts` with the extracted logic:

```typescript
export interface XPathCandidate {
  xpath: string
  strategy: 'id' | 'data-testid' | 'name' | 'text' | 'structural'
  label: string
}

export function generateXPathCandidates(el: Element): XPathCandidate[] {
  const tag = el.tagName.toLowerCase()
  const candidates: XPathCandidate[] = []

  const id = el.getAttribute('id')
  if (id) {
    candidates.push({ xpath: `//${tag}[@id='${id}']`, strategy: 'id', label: 'By ID (most stable)' })
  }

  for (const attr of ['data-testid', 'data-test-id', 'data-cy', 'data-test']) {
    const val = el.getAttribute(attr)
    if (val) {
      candidates.push({ xpath: `//${tag}[@${attr}='${val}']`, strategy: 'data-testid', label: `By ${attr} (automation-ready)` })
      break
    }
  }

  const name = el.getAttribute('name')
  if (name) {
    candidates.push({ xpath: `//${tag}[@name='${name}']`, strategy: 'name', label: 'By name attribute' })
  }

  const text = el.textContent?.trim()
  if (text && text.length > 0 && text.length < 50) {
    candidates.push({ xpath: `//${tag}[normalize-space()='${text}']`, strategy: 'text', label: 'By text (fragile)' })
  }

  // Structural fallback
  const parent = el.parentElement
  if (parent) {
    const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName)
    const idx = siblings.indexOf(el) + 1
    const parentTag = parent.tagName.toLowerCase()
    candidates.push({ xpath: `//${parentTag}/${tag}[${idx}]`, strategy: 'structural', label: 'Structural (last resort)' })
  } else {
    candidates.push({ xpath: `//${tag}`, strategy: 'structural', label: 'Structural (last resort)' })
  }

  return candidates
}
```

- [ ] **Step 4: Update content script to import from shared module**

Open `src/content/index.ts`. Replace the inline `generateXPathCandidates` function body with an import:

```typescript
import { generateXPathCandidates } from '../shared/xpathUtils'
```

Remove the old inline function definition. Keep all other content script code intact.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Verify build still works**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/xpathUtils.ts src/content/index.ts tests/xpathGeneration.test.ts
git commit -m "refactor: extract XPath generation to shared module with tests"
```

---

## Task 3: Unit Tests — Stores

The stores use `chrome.storage.local`. Tests mock the chrome API.

**Files:**
- Create: `tests/mocks/chrome.ts`
- Create: `tests/capsuleStore.test.ts`
- Create: `tests/xpathStore.test.ts`

- [ ] **Step 1: Create chrome mock**

Create `tests/mocks/chrome.ts`:

```typescript
const store: Record<string, unknown> = {}

export const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string[]) => {
        const result: Record<string, unknown> = {}
        for (const k of keys) result[k] = store[k]
        return result
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items)
      }),
    },
  },
  runtime: { lastError: null },
}

export function resetStore() {
  for (const k of Object.keys(store)) delete store[k]
}

// Attach to global
;(globalThis as unknown as Record<string, unknown>).chrome = chromeMock
```

- [ ] **Step 2: Write failing capsule store tests**

Create `tests/capsuleStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import '../mocks/chrome'
import { resetStore } from '../mocks/chrome'
import { getCapsules, saveCapsule, deleteCapsule } from '../src/store/capsuleStore'
import type { BugCapsule } from '../src/shared/types'

function makeCapsule(overrides: Partial<BugCapsule> = {}): BugCapsule {
  return {
    id: crypto.randomUUID(),
    title: 'Test bug',
    severity: 'medium',
    url: 'https://example.com',
    pageTitle: 'Example',
    browser: 'Chrome 120',
    os: 'Windows 11',
    screenshotDataUrl: '',
    consoleErrors: [],
    preconditions: '',
    steps: ['Step 1'],
    expected: 'Should work',
    actual: 'Does not work',
    notes: '',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('capsuleStore', () => {
  beforeEach(() => resetStore())

  it('returns empty array when no capsules saved', async () => {
    const result = await getCapsules()
    expect(result).toEqual([])
  })

  it('saves and retrieves a capsule', async () => {
    const capsule = makeCapsule({ title: 'Login bug' })
    await saveCapsule(capsule)
    const result = await getCapsules()
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Login bug')
  })

  it('prepends newest capsule to list', async () => {
    await saveCapsule(makeCapsule({ title: 'First' }))
    await saveCapsule(makeCapsule({ title: 'Second' }))
    const result = await getCapsules()
    expect(result[0].title).toBe('Second')
    expect(result[1].title).toBe('First')
  })

  it('deletes a capsule by id', async () => {
    const capsule = makeCapsule({ id: 'abc-123' })
    await saveCapsule(capsule)
    await deleteCapsule('abc-123')
    const result = await getCapsules()
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run tests — they should fail**

```bash
npm test
```

Expected: FAIL — chrome is not defined or mock not wired correctly.

- [ ] **Step 4: Add mock import to setup file**

Open `tests/setup.ts`. Add:

```typescript
import './mocks/chrome'
```

- [ ] **Step 5: Run tests — should pass now**

```bash
npm test
```

Expected: All capsule store tests PASS.

- [ ] **Step 6: Write xpath store tests**

Create `tests/xpathStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStore } from '../mocks/chrome'
import { getProjects, addProject, deleteProject, addPage, addElement, deleteElement } from '../src/store/xpathStore'

describe('xpathStore', () => {
  beforeEach(() => resetStore())

  it('returns empty array initially', async () => {
    expect(await getProjects()).toEqual([])
  })

  it('adds a project', async () => {
    await addProject('My App')
    const projects = await getProjects()
    expect(projects).toHaveLength(1)
    expect(projects[0].name).toBe('My App')
    expect(projects[0].pages).toEqual([])
  })

  it('deletes a project', async () => {
    await addProject('To Delete')
    const projects = await getProjects()
    await deleteProject(projects[0].id)
    expect(await getProjects()).toHaveLength(0)
  })

  it('adds a page to a project', async () => {
    await addProject('App')
    const [proj] = await getProjects()
    await addPage(proj.id, 'Login Page', 'https://example.com/login')
    const updated = await getProjects()
    expect(updated[0].pages).toHaveLength(1)
    expect(updated[0].pages[0].name).toBe('Login Page')
  })

  it('adds an element to a page', async () => {
    await addProject('App')
    const [proj] = await getProjects()
    await addPage(proj.id, 'Login Page', 'https://example.com/login')
    const withPage = await getProjects()
    const page = withPage[0].pages[0]
    await addElement(proj.id, page.id, {
      id: 'el-1', name: 'Username Field',
      xpath: "//input[@id='username']", strategy: 'id', tag: 'input',
      capturedAt: new Date().toISOString(),
    })
    const final = await getProjects()
    expect(final[0].pages[0].elements).toHaveLength(1)
    expect(final[0].pages[0].elements[0].name).toBe('Username Field')
  })

  it('deletes an element', async () => {
    await addProject('App')
    const [proj] = await getProjects()
    await addPage(proj.id, 'Login Page', 'https://example.com/login')
    const withPage = await getProjects()
    const page = withPage[0].pages[0]
    await addElement(proj.id, page.id, {
      id: 'el-1', name: 'Username Field',
      xpath: "//input[@id='username']", strategy: 'id', tag: 'input',
      capturedAt: new Date().toISOString(),
    })
    await deleteElement(proj.id, page.id, 'el-1')
    const final = await getProjects()
    expect(final[0].pages[0].elements).toHaveLength(0)
  })
})
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: All tests PASS (xpathGeneration + capsuleStore + xpathStore).

- [ ] **Step 8: Commit**

```bash
git add tests/ src/shared/xpathUtils.ts
git commit -m "test: add unit tests for stores and XPath generation"
```

---

## Task 4: Edit Bug Capsule

Allow engineers to edit a saved bug capsule (title, severity, steps, etc.) without re-capturing.

**Files:**
- Modify: `src/components/bug-capsule/CapsuleDetail.tsx`
- Modify: `src/store/capsuleStore.ts`

- [ ] **Step 1: Add updateCapsule to the store**

Open `src/store/capsuleStore.ts`. Add this function:

```typescript
export async function updateCapsule(updated: BugCapsule): Promise<void> {
  const { bug_capsules = [] } = await chrome.storage.local.get('bug_capsules') as { bug_capsules: BugCapsule[] }
  const next = bug_capsules.map(c => c.id === updated.id ? updated : c)
  await chrome.storage.local.set({ bug_capsules: next })
}
```

- [ ] **Step 2: Add edit state to CapsuleDetail**

Open `src/components/bug-capsule/CapsuleDetail.tsx`. Add edit state at the top of the component:

```typescript
import { useState } from 'react'
import { updateCapsule } from '../../store/capsuleStore'

// Inside the component, add:
const [editing, setEditing] = useState(false)
const [editTitle, setEditTitle] = useState(c.title)
const [editSeverity, setEditSeverity] = useState(c.severity)
const [editPreconditions, setEditPreconditions] = useState(c.preconditions)
const [editSteps, setEditSteps] = useState<string[]>(c.steps.length > 0 ? c.steps : [''])
const [editExpected, setEditExpected] = useState(c.expected)
const [editActual, setEditActual] = useState(c.actual)
const [editNotes, setEditNotes] = useState(c.notes)
const [saving, setSaving] = useState(false)
```

- [ ] **Step 3: Add save edit handler**

Inside the component, add:

```typescript
const handleSaveEdit = async () => {
  if (!editTitle.trim()) return
  setSaving(true)
  try {
    await updateCapsule({
      ...c,
      title: editTitle.trim(),
      severity: editSeverity,
      preconditions: editPreconditions.trim(),
      steps: editSteps.filter(s => s.trim()),
      expected: editExpected.trim(),
      actual: editActual.trim(),
      notes: editNotes.trim(),
    })
    setEditing(false)
    onBack() // refresh list
  } finally {
    setSaving(false)
  }
}
```

- [ ] **Step 4: Add Edit button to the header row**

In the JSX, add an Edit button next to the Copy button:

```tsx
<button className="btn btn-ghost btn-sm" onClick={() => setEditing(e => !e)}>
  {editing ? '✕ Cancel' : '✏ Edit'}
</button>
```

- [ ] **Step 5: Add edit form section**

Below the header row div, add a conditional edit form:

```tsx
{editing && (
  <div className="card" style={{ marginBottom: 10 }}>
    <div className="form-group">
      <label>Title</label>
      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
    </div>
    <div className="form-group">
      <label>Severity</label>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['critical','high','medium','low'] as Severity[]).map(s => (
          <button key={s}
            className={`btn btn-sm ${editSeverity === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setEditSeverity(s)}
            style={{ flex: 1, fontSize: 11 }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
    </div>
    <div className="form-group">
      <label>Preconditions</label>
      <textarea value={editPreconditions} onChange={e => setEditPreconditions(e.target.value)} rows={2} />
    </div>
    <div className="form-group">
      <label>Steps</label>
      {editSteps.map((step, i) => (
        <div key={i} className="step-row">
          <span style={{ fontSize: 11, color: 'var(--muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
          <input type="text" value={step}
            onChange={e => setEditSteps(s => s.map((x, j) => j === i ? e.target.value : x))} />
          {editSteps.length > 1 && (
            <button className="btn-icon btn-sm"
              onClick={() => setEditSteps(s => s.filter((_, j) => j !== i))}>✕</button>
          )}
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => setEditSteps(s => [...s, ''])}
        style={{ marginTop: 4 }}>+ Add step</button>
    </div>
    <div className="form-group">
      <label>Expected</label>
      <textarea value={editExpected} onChange={e => setEditExpected(e.target.value)} rows={2} />
    </div>
    <div className="form-group">
      <label>Actual</label>
      <textarea value={editActual} onChange={e => setEditActual(e.target.value)} rows={2} />
    </div>
    <div className="form-group">
      <label>Notes</label>
      <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} />
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
      <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}
        disabled={saving || !editTitle.trim()}>
        {saving ? 'Saving…' : '✓ Save Changes'}
      </button>
    </div>
  </div>
)}
```

Also add the `Severity` import at the top:
```typescript
import type { BugCapsule, Severity } from '../../shared/types'
```

- [ ] **Step 6: Build and verify no TypeScript errors**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/bug-capsule/CapsuleDetail.tsx src/store/capsuleStore.ts
git commit -m "feat: add edit mode to bug capsule detail view"
```

---

## Task 5: Bug Capsule Search/Filter

Add a search bar to the bug list to filter by title, URL, or severity.

**Files:**
- Modify: `src/components/bug-capsule/BugCapsule.tsx`

- [ ] **Step 1: Add search state**

Open `src/components/bug-capsule/BugCapsule.tsx`. Add:

```typescript
const [search, setSearch] = useState('')
```

- [ ] **Step 2: Add filtered capsules derived value**

After the `load` and `handleDelete` functions, add:

```typescript
const q = search.toLowerCase()
const filtered = capsules.filter(c =>
  !q ||
  c.title.toLowerCase().includes(q) ||
  c.url.toLowerCase().includes(q) ||
  c.severity.includes(q)
)
```

- [ ] **Step 3: Add search input to JSX**

Replace the intro paragraph with:

```tsx
<div style={{ marginBottom: 10 }}>
  <input
    type="text"
    placeholder="Search bugs…"
    value={search}
    onChange={e => setSearch(e.target.value)}
    style={{ width: '100%', boxSizing: 'border-box' }}
  />
</div>
```

- [ ] **Step 4: Render `filtered` instead of `capsules`**

Change `capsules.map(...)` to `filtered.map(...)`.

Update the empty state to distinguish "no bugs yet" from "no results":

```tsx
{filtered.length === 0 ? (
  <div className="empty">
    <div className="empty-icon">🐛</div>
    <p>{capsules.length === 0 ? 'No bug capsules yet.' : 'No results.'}</p>
    {capsules.length === 0 && (
      <p style={{ marginTop: 6, fontSize: 11 }}>Click "Capture Bug" while on any page.</p>
    )}
  </div>
) : (
  filtered.map(c => ( /* existing row JSX unchanged */ ))
)}
```

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/bug-capsule/BugCapsule.tsx
git commit -m "feat: add search/filter to bug capsule list"
```

---

## Task 6: Keyboard Shortcut — Capture Bug

Add `Alt+Shift+B` (Windows) / `Alt+Shift+B` (Linux) to trigger bug capture without clicking the toolbar button.

**Files:**
- Modify: `manifest.json`
- Modify: `src/background/index.ts`

- [ ] **Step 1: Register the command in manifest.json**

Open `manifest.json`. Add a `"commands"` key:

```json
"commands": {
  "capture-bug": {
    "suggested_key": {
      "default": "Alt+Shift+B",
      "windows": "Alt+Shift+B",
      "linux": "Alt+Shift+B"
    },
    "description": "Capture bug on current page"
  }
}
```

- [ ] **Step 2: Handle the command in the background service worker**

Open `src/background/index.ts`. Add a `chrome.commands.onCommand` listener:

```typescript
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'capture-bug') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.windowId) return

  try {
    const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
    const consoleErrors = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CONSOLE_ERRORS' })
      .catch(() => ({ errors: [] })) as { errors: string[] }

    const data: CapturedBugData = {
      url: tab.url ?? '',
      pageTitle: tab.title ?? '',
      browser: 'Chrome',
      os: navigator.platform,
      screenshotDataUrl: screenshot,
      consoleErrors: consoleErrors.errors ?? [],
      timestamp: new Date().toISOString(),
    }

    // Open side panel and send data
    await chrome.sidePanel.open({ windowId: tab.windowId })
    // Small delay to allow side panel to mount
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'BUG_CAPTURED_SHORTCUT', payload: data })
    }, 300)
  } catch (e) {
    console.error('Shortcut capture failed', e)
  }
})
```

Make sure `CapturedBugData` is imported at the top:
```typescript
import type { CapturedBugData } from '../shared/types'
```

- [ ] **Step 3: Handle BUG_CAPTURED_SHORTCUT in App.tsx**

Open `src/sidepanel/App.tsx`. In the `chrome.runtime.onMessage` listener, add a handler:

```typescript
} else if (msg.type === 'BUG_CAPTURED_SHORTCUT') {
  setCapturedBug(msg.payload as CapturedBugData)
  setTab('bugs')
}
```

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add manifest.json src/background/index.ts src/sidepanel/App.tsx
git commit -m "feat: add Alt+Shift+B keyboard shortcut for bug capture"
```

---

## Self-Review

| Spec Requirement | Task |
|-----------------|------|
| Unit tests for XPath generation | Task 2 |
| Unit tests for stores | Task 3 |
| Edit bug capsule | Task 4 |
| Search/filter bug list | Task 5 |
| Keyboard shortcut capture | Task 6 |
| Test infrastructure | Task 1 |

**Placeholder scan:** No TBDs, TODOs, or "add appropriate X" patterns present.

**Type consistency:**
- `BugCapsule.preconditions: string` — used correctly in Task 4 edit form
- `updateCapsule(updated: BugCapsule)` defined in Task 4 Step 1, used in Step 3
- `CapturedBugData` imported from `../shared/types` in Task 6 Step 2
- `Severity` type imported in Task 4 Step 5
- `XPathCandidate` interface defined in Task 2 Step 3, matches usage in tests

All references consistent.
