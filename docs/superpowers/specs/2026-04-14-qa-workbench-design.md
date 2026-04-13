# QA Workbench — Design Spec

**Date:** 2026-04-14  
**Status:** Implemented (v1.0)  
**Author:** tevukas

---

## Overview

QA Workbench is a personal, offline Chrome extension for a senior QA engineer working with Reqnroll + POM + BDD (C#). It provides two focused tools accessible from a persistent Chrome Side Panel:

1. **XPath Vault** — capture, organise, and export XPaths from live pages
2. **Bug Capsule** — capture, document, and export bug reports with screenshots

No server, no account, no external dependencies. All data stored in `chrome.storage.local`.

---

## Architecture

### Extension Components

| Component | File | Role |
|-----------|------|------|
| Side Panel | `src/sidepanel/` | React UI (App.tsx, App.css) served via Chrome Side Panel API |
| Background | `src/background/index.ts` | Service worker — message routing, screenshot capture, context menu |
| Content Script | `src/content/index.ts` | Injected into all pages — inspect overlay, XPath extraction, console error buffering |
| Stores | `src/store/` | `chrome.storage.local` CRUD wrappers for XPaths and bug capsules |
| Shared Types | `src/shared/types.ts` | TypeScript interfaces shared across all components |

### Build

- **Vite** with manual Rollup multi-entry (no CRXJS — requires Node 20+, dev machine is Node 18)
- Outputs: `dist/sidepanel.html`, `dist/background.js`, `dist/content.js`, `dist/assets/*`
- Manifest V3

### Data Storage

All data persists in `chrome.storage.local` (with `unlimitedStorage` permission):

```
storage.local = {
  xpath_projects: XPathProject[],   // XPath Vault data
  bug_capsules:   BugCapsule[],     // Bug Capsule data (newest first)
}
```

---

## Tool 1: XPath Vault

### Purpose

Capture XPaths from any web page by clicking elements, organise them into a project/page hierarchy, and export them as C# POM properties for Reqnroll test automation.

### Capture Triggers

- **Inspect Mode button** in the side panel — activates overlay on the active tab
- **Right-click context menu** — "Save XPath of this element" on any element

### XPath Generation Strategy (priority order)

1. `id` attribute → `//tag[@id='value']` *(most stable)*
2. `data-testid` / `data-test-id` / `data-cy` → `//tag[@data-testid='value']` *(best for automation)*
3. `name` attribute → `//tag[@name='value']`
4. Unique visible text → `//tag[normalize-space()='text']` *(fragile — use with caution)*
5. Structural relative XPath → `//parent/child[n]` *(last resort)*

Multiple candidates (up to 5) are shown with stability badges. The engineer picks the best one.

### Data Model

```typescript
interface XPathProject {
  id: string
  name: string
  pages: XPathPage[]
}

interface XPathPage {
  id: string
  name: string
  elements: XPathElement[]
}

interface XPathElement {
  id: string
  name: string        // human label, e.g. "Login Button"
  xpath: string
  strategy: string    // 'id' | 'data-testid' | 'name' | 'text' | 'structural'
  tag: string
  capturedAt: string
}
```

### Export Formats

| Action | Output |
|--------|--------|
| 📋 Copy XPath | Raw XPath string to clipboard |
| 🔷 Copy C# POM property | `public IWebElement LoginButton => _driver.FindElement(By.XPath("..."));` |
| ⬇ Export page .cs | Full C# Page Object class file downloaded |

### C# Class Output Example

```csharp
public class LoginPage
{
    private readonly IWebDriver _driver;

    public LoginPage(IWebDriver driver) => _driver = driver;

    public IWebElement UsernameField => _driver.FindElement(By.XPath("//input[@id='username']"));
    public IWebElement PasswordField => _driver.FindElement(By.XPath("//input[@id='password']"));
    public IWebElement LoginButton => _driver.FindElement(By.XPath("//button[@data-testid='login-btn']"));
}
```

---

## Tool 2: Bug Capsule

### Purpose

Capture a full bug report snapshot (screenshot + console errors + metadata) with one click, fill in structured fields, and export or copy the report for Jira/email.

### Capture Flow

1. Engineer clicks **🐛 Capture Bug** in the header
2. Background service worker calls `chrome.tabs.captureVisibleTab()` → screenshot as base64 data URL
3. Console errors buffered by content script are fetched
4. Page metadata (URL, title, browser, OS) is collected
5. `CaptureForm` modal opens pre-filled with the above data
6. Engineer fills in: title, severity, preconditions, steps, expected, actual, notes
7. Saved to `chrome.storage.local`

### Data Model

```typescript
type Severity = 'critical' | 'high' | 'medium' | 'low'

interface BugCapsule {
  id: string
  title: string
  severity: Severity
  url: string
  pageTitle: string
  browser: string
  os: string
  screenshotDataUrl: string    // base64 PNG
  consoleErrors: string[]
  preconditions: string        // app state required before testing
  steps: string[]
  expected: string
  actual: string
  notes: string
  createdAt: string            // ISO 8601
}
```

### Export Formats

| Action | Output |
|--------|--------|
| 📋 Copy all | HTML + plain text to clipboard. HTML embeds screenshot inline — pastes with image into Jira/email |
| ⬇ HTML | Self-contained `.html` file download with embedded screenshot |

### Console Error Capture

Content script hooks three sources:
- `console.error` override
- `window.onerror`
- `window.addEventListener('unhandledrejection', ...)`

Errors are buffered per page load and fetched at capture time via `GET_CONSOLE_ERRORS` message.

---

## UI / UX

- Persistent **Chrome Side Panel** (Chrome 114+) — stays open while navigating
- Two tabs: **XPath Vault** | **Bug Capsule**
- Minimal dark-ish design using CSS custom properties (`--bg`, `--surface`, `--accent`, etc.)
- Severity badges: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low
- All operations local — no network requests, no telemetry

---

## Permissions

```json
["storage", "tabs", "activeTab", "scripting", "contextMenus", "sidePanel", "unlimitedStorage"]
```

---

## Constraints & Decisions

| Decision | Rationale |
|----------|-----------|
| Chrome extension only (no local server) | Zero setup — download, load unpacked, use |
| `chrome.storage.local` not IndexedDB | Simpler API, sufficient for personal tool scale |
| No CRXJS | Incompatible with Node 18 (requires Node 20+) |
| Manual Vite multi-entry rollup | Works on Node 18, full control over output file names |
| Side Panel over popup | Stays open across page navigation — essential for inspect mode workflow |
| Base64 screenshot in storage | Enables offline HTML export and clipboard embed without a server |
| Web only (no desktop/network tools) | Scope decision — Chrome extension can only access web pages |
