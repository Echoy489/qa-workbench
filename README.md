# QA Workbench

A private Chrome extension for professional QA engineers. Three focused tools — XPath capture, bug evidence collection, and test flow recording — accessible from a persistent browser side panel.

No account. No server. No data leaves your machine.

---

## Tools

### 1. XPath Vault

Capture and organise element locators from any live web page for use in Selenium Page Object Models.

- **Inspect mode** — click any element on the page to capture up to 5 XPath candidates
- **Scoring** — each candidate is scored 0–100 based on stability strategy (ID, data-testid, Angular formControlName, name, placeholder, aria-label, ancestor-scoped, text)
- **Live validation** — match count and status shown at capture time: ✓ valid · ⚠ ambiguous · ✗ broken
- **Fallback support** — mark secondary candidates as fallbacks; included as comments in exported code
- **Organised storage** — saved as Project → Page → Element tree; searchable
- **Re-validate on demand** — ↻ button re-runs DOM validation against the currently loaded page

**Export options per element:**
- 📋 Copy raw XPath
- 🔷 Copy C# property (`public IWebElement X => _driver.FindElement(By.XPath("..."));`)

**Export options per page:**
- 👁 Preview full C# Page Object class before copying
- 📋 Copy full C# Page Object class to clipboard (one click)
- ⬇ Download as `.cs` file

Generated class includes: generation date, source URL, element notes, and fallback XPaths as inline comments.

---

### 2. Evidence Capsule

Capture a complete bug report in one click — everything a developer needs to reproduce the issue without a back-and-forth.

- **One-click capture** — screenshot, console errors, action timeline, network failures, and environment metadata collected automatically
- **Action timeline** — passive record of clicks, inputs, navigation, and key presses leading up to the bug
- **Network failures** — any HTTP ≥ 400 response recorded since page load
- **Environment snapshot** — browser version, OS, viewport, device pixel ratio, online status
- **Severity levels** — Critical / High / Medium / Low
- **Structured form** — fill in title, preconditions, steps, expected, and actual result; all evidence pre-filled

**Export options:**
- Copy as rich HTML (screenshot embedded, all sections)
- Export as self-contained `.html` file
- Plain text export

---

### 3. Step Recorder

Record a user flow as an ordered step list, then export it in the format your team uses.

- **Live recording** — start/stop from the Recorder tab; interactions captured as you work through the flow
- **Edit before export** — rename, reorder, or delete steps; noise-filtered (consecutive inputs on the same field collapsed to one step)
- **"Use in Bug"** — pre-fills the Evidence Capsule steps field directly from a recording

**Export formats:**
- Plain text (numbered list)
- Gherkin scenario (Given / When / Then / And)
- C# Selenium method skeleton (`[When("...")] public void Step()`)

---

## Requirements

- Chrome 114 or newer (or Brave)
- Windows or Linux
- No internet connection required

---

## Installation

The extension is distributed as a zip file — load it directly in Chrome without going through the Chrome Web Store.

1. Download `qa-workbench-v1.1.0.zip` from the [Releases page](https://github.com/Echoy489/qa-workbench/releases)
2. Unzip the file — you will get a `dist/` folder
3. Open Chrome and go to `chrome://extensions`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked** and select the `dist/` folder
6. Pin the extension from the Chrome toolbar
7. Click the QA Workbench icon to open the side panel

**Updating to a newer build:** unzip the new release over the existing `dist/` folder, then click the ↻ reload button next to the extension in `chrome://extensions`.

---

## Quick Start

**Capture an XPath:**
1. Open any web application in Chrome
2. Open the QA Workbench side panel → **XPath Vault** tab
3. Click **Activate Inspect** → hover over the target element → click it
4. Review the scored candidates, select the best one, mark fallbacks if needed
5. Name the element, assign it to a Project and Page → **Save**
6. On the Page row, click 📋 to copy the full C# Page Object class to clipboard

**Capture a bug:**
1. Reproduce the issue in Chrome
2. Click **Capture Bug** in the side panel header
3. Fill in title, severity, and reproduction steps — all evidence is pre-filled
4. Export as HTML or copy to clipboard, paste into your bug tracker

**Record a test flow:**
1. Go to the **Recorder** tab → click **Start Recording**
2. Perform the test flow on the page
3. Click **Stop** → name the recording → **Save**
4. Export as Gherkin or C# skeleton, or click **Use in Bug** to attach it to a bug report

---

## Privacy & Data Handling

All data is stored locally in Chrome's storage on your machine. Nothing is transmitted.

**Never captured:**
- Passwords or values from fields named `password`, `token`, `secret`, `key`, `api`
- `localStorage` / `sessionStorage` values (keys only are logged, never values)
- Network request or response bodies
- Cookies or authentication headers

**Captured locally only:**
- Click targets and navigation events (no typed values from sensitive fields)
- HTTP status codes of failed requests (≥ 400) — not request contents
- Screenshots of the visible tab at capture time
- Console error messages

---

## Limitations

- Chrome 114+ required — the Side Panel API is Chrome-only (no Firefox)
- Network failure capture is a snapshot at the moment you click "Capture Bug" — not a continuous monitor
- Cannot capture interactions inside cross-origin iframes
- XPath validation reflects the current DOM state — dynamic pages may show different results on re-validation
- Screenshots are base64 PNG; high-resolution displays increase storage usage
