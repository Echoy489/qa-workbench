// ── Strategy & stability ────────────────────────────────────────────────────
export type XPathStrategy = 'id' | 'data-testid' | 'name' | 'aria' | 'text' | 'structural'
export type Stability = 'best' | 'good' | 'fragile'
export type Confidence = 'high' | 'medium' | 'low'
export type XPathValidationStatus = 'valid' | 'ambiguous' | 'broken' | 'unknown'
export type Severity = 'critical' | 'high' | 'medium' | 'low'

// ── XPath Intelligence ──────────────────────────────────────────────────────
export interface XPathScore {
  score: number        // 0–100
  confidence: Confidence
  reasons: string[]
  warnings: string[]
}

export interface XPathCandidate {
  strategy: XPathStrategy
  xpath: string
  stability: Stability
  label: string
  score?: XPathScore
  matchCount?: number
  validationStatus?: XPathValidationStatus
}

export interface XPathElement {
  id: string
  name: string
  xpath: string
  candidates: XPathCandidate[]
  fallbacks?: string[]          // ordered fallback XPaths; primary is xpath
  url: string
  pageTitle?: string
  notes: string
  validationStatus?: XPathValidationStatus
  matchCount?: number
  lastValidated?: string
  attrSnapshot?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface XPathPage {
  id: string
  name: string
  elements: XPathElement[]
}

export interface XPathProject {
  id: string
  name: string
  pages: XPathPage[]
  createdAt: string
}

// ── Evidence / Bug Capsule ──────────────────────────────────────────────────
export type ActionEventType = 'click' | 'input' | 'change' | 'navigate' | 'keydown'

export interface ActionEvent {
  type: ActionEventType
  timestamp: string
  description: string
  targetHint: string
  url: string
}

export interface NetworkFailure {
  url: string
  method?: string
  status?: number
  timestamp: string
}

export interface EnvironmentMeta {
  url: string
  pageTitle: string
  browser: string
  os: string
  viewport: { width: number; height: number }
  devicePixelRatio: number
  language: string
  online: boolean
  readyState: string
  timestamp: string
}

/**
 * Unified capsule. v1 fields always present; v2 evidence fields optional
 * so existing stored capsules continue to deserialise correctly.
 */
export interface BugCapsule {
  id: string
  title: string
  severity: Severity
  url: string
  pageTitle: string
  browser: string
  os: string
  screenshotDataUrl: string
  consoleErrors: string[]
  preconditions: string
  steps: string[]
  expected: string
  actual: string
  notes: string
  createdAt: string
  // v2 evidence fields (optional)
  environment?: EnvironmentMeta
  actionTimeline?: ActionEvent[]
  networkFailures?: NetworkFailure[]
  domSnippet?: string
  storageKeys?: { localStorage: string[]; sessionStorage: string[] }
}

// ── Step Recorder ───────────────────────────────────────────────────────────
export type RecordedStepType = 'navigate' | 'click' | 'input' | 'select' | 'key'

export interface RecordedStep {
  id: string
  stepNumber: number
  timestamp: string
  type: RecordedStepType
  description: string
  targetHint: string
  url: string
  xpathRef?: string
}

export interface Recording {
  id: string
  name: string
  steps: RecordedStep[]
  startedAt: string
  stoppedAt?: string
  linkedCapsuleId?: string
}

// ── Message payloads ─────────────────────────────────────────────────────────
export interface CapturedXPathData {
  candidates: XPathCandidate[]
  url: string
  pageTitle: string
  tagName: string
  innerText: string
  attrSnapshot?: Record<string, string>
}

export interface CapturedBugData {
  screenshotDataUrl: string
  url: string
  pageTitle: string
  browser: string
  os: string
  consoleErrors: string[]
  timestamp: string
  environment?: EnvironmentMeta
  actionTimeline?: ActionEvent[]
  networkFailures?: NetworkFailure[]
  domSnippet?: string
  storageKeys?: { localStorage: string[]; sessionStorage: string[] }
}

export interface ValidationResult {
  xpath: string
  matchCount: number
  status: XPathValidationStatus
}
