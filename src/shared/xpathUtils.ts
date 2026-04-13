import type {
  XPathCandidate, XPathElement, XPathScore, XPathStrategy,
  Confidence, XPathValidationStatus, ValidationResult,
} from './types'

// ── String helpers ───────────────────────────────────────────────────────────

/** Produce a valid XPath string literal, handling apostrophes via concat(). */
export function xpathLiteralString(s: string): string {
  if (!s.includes("'")) return `'${s}'`
  if (!s.includes('"')) return `"${s}"`
  const parts = s.split("'").map(p => `'${p}'`).join(`, "'", `)
  return `concat(${parts})`
}

// ── Scoring ──────────────────────────────────────────────────────────────────

const BASE_SCORES: Record<XPathStrategy, number> = {
  id: 85,
  'data-testid': 80,
  name: 65,
  aria: 60,
  text: 35,
  structural: 30,
}

/**
 * Score an XPath candidate based on strategy, XPath structure, and optional
 * match count. Pure function — no DOM access required.
 */
export function scoreXPath(
  xpath: string,
  strategy: XPathStrategy,
  matchCount?: number,
): XPathScore {
  const reasons: string[] = []
  const warnings: string[] = []
  let score = BASE_SCORES[strategy]

  // Strategy-level reasons
  if (strategy === 'id') reasons.push('Unique id attribute')
  else if (strategy === 'data-testid') reasons.push('Automation-ready test attribute')
  else if (strategy === 'name') reasons.push('Stable name attribute')
  else if (strategy === 'aria') reasons.push('Accessible aria-label attribute')

  // Match count adjustments
  if (matchCount === 1) {
    score += 10
    reasons.push('Unique match on page')
  } else if (matchCount === 0) {
    score -= 30
    warnings.push('No elements matched — XPath may be broken')
  } else if (matchCount !== undefined && matchCount > 1) {
    score -= 20
    warnings.push(`Matches ${matchCount} elements — ambiguous`)
  }

  // Structural depth penalty
  const depth = (xpath.match(/\//g) || []).length
  if (depth > 5) {
    const penalty = (depth - 5) * 3
    score -= penalty
    warnings.push(`Deep structural path (${depth} levels)`)
  }

  // Positional index
  if (/\[\d+\]/.test(xpath) && strategy === 'structural') {
    score -= 10
    warnings.push('Positional index — fragile if layout changes')
  }

  // Text dependency
  if (strategy === 'text') {
    warnings.push('Depends on visible text — fragile if copy changes')
  }

  // XPath length
  if (xpath.length > 100) {
    score -= 8
    warnings.push('Very long XPath — harder to maintain')
  } else if (xpath.length > 60) {
    score -= 3
  } else if (xpath.length <= 35) {
    score += 3
    reasons.push('Concise XPath')
  }

  // Likely auto-generated class (e.g. .css-a4f2b1, .sc-cAjFTk)
  if (/\[@class[^]]*[a-z0-9]{5,}-[a-f0-9]{4,}/.test(xpath)) {
    score -= 15
    warnings.push('May contain auto-generated class — unstable')
  }

  // Absolute path from root
  if (xpath.startsWith('/html') || xpath.startsWith('/body')) {
    score -= 15
    warnings.push('Absolute DOM path — very fragile')
  }

  score = Math.max(0, Math.min(100, score))
  const confidence: Confidence = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'

  return { score, confidence, reasons, warnings }
}

// ── DOM-dependent helpers ────────────────────────────────────────────────────

/** Build a relative XPath anchored at the nearest ancestor with an id. */
export function buildRelativeXPath(el: Element): string {
  const parts: string[] = []
  let cur: Element | null = el

  while (cur && cur !== document.body) {
    const tag = cur.tagName.toLowerCase()
    if (cur.id) {
      parts.unshift(`//${tag}[@id=${xpathLiteralString(cur.id)}]`)
      break
    }
    const parent = cur.parentElement
    if (parent) {
      const sibs = Array.from(parent.children).filter(c => c.tagName === cur!.tagName)
      const idx = sibs.indexOf(cur as Element) + 1
      parts.unshift(sibs.length > 1 ? `${tag}[${idx}]` : tag)
    }
    cur = cur.parentElement
  }

  if (!parts.length) return ''
  return parts[0].startsWith('//') ? parts.join('/') : '//' + parts.join('/')
}

/** Build an absolute XPath from the document root. */
export function buildAbsoluteXPath(el: Element): string {
  if (!el.parentElement || el === document.body) return `/${el.tagName.toLowerCase()}`
  const parent = el.parentElement
  const sibs = Array.from(parent.children).filter(c => c.tagName === el.tagName)
  const idx = sibs.indexOf(el) + 1
  const part = sibs.length > 1 ? `${el.tagName.toLowerCase()}[${idx}]` : el.tagName.toLowerCase()
  return `${buildAbsoluteXPath(parent)}/${part}`
}

/**
 * Validate an XPath expression against the live DOM.
 * Returns match count and derived status.
 */
export function validateXPath(xpath: string): ValidationResult {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    )
    const matchCount = result.snapshotLength
    const status: XPathValidationStatus =
      matchCount === 0 ? 'broken' :
      matchCount === 1 ? 'valid' :
      'ambiguous'
    return { xpath, matchCount, status }
  } catch {
    return { xpath, matchCount: 0, status: 'broken' }
  }
}

/**
 * Capture key attributes of an element for debugging context when XPaths break.
 * Never captures input values.
 */
export function captureAttrSnapshot(el: Element): Record<string, string> {
  const snap: Record<string, string> = {}
  const attrs = [
    'id', 'name', 'class', 'type', 'role',
    'data-testid', 'data-test', 'data-cy', 'data-qa',
    'aria-label', 'href', 'placeholder',
  ]
  for (const a of attrs) {
    const v = el.getAttribute(a)
    if (v) snap[a] = v.slice(0, 100)
  }
  return snap
}

/**
 * Generate up to 5 scored, validated XPath candidates for an element.
 * Runs inside the content script where the page DOM is available.
 */
export function generateCandidates(el: Element): XPathCandidate[] {
  const tag = el.tagName.toLowerCase()
  type RawCandidate = Omit<XPathCandidate, 'score' | 'matchCount' | 'validationStatus'>
  const raw: RawCandidate[] = []

  // 1. id
  if (el.id && el.id.trim()) {
    raw.push({
      strategy: 'id',
      xpath: `//${tag}[@id=${xpathLiteralString(el.id)}]`,
      stability: 'best',
      label: 'By ID',
    })
  }

  // 2. data-testid variants
  for (const attr of ['data-testid', 'data-test', 'data-cy', 'data-qa'] as const) {
    const v = el.getAttribute(attr)
    if (v) {
      raw.push({
        strategy: 'data-testid',
        xpath: `//${tag}[@${attr}=${xpathLiteralString(v)}]`,
        stability: 'best',
        label: `By ${attr}`,
      })
      break
    }
  }

  // 3. name
  const name = el.getAttribute('name')
  if (name) {
    raw.push({
      strategy: 'name',
      xpath: `//${tag}[@name=${xpathLiteralString(name)}]`,
      stability: 'good',
      label: 'By name',
    })
  }

  // 4. aria-label (only if reasonably short and stable-looking)
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel && ariaLabel.length <= 50) {
    raw.push({
      strategy: 'aria',
      xpath: `//${tag}[@aria-label=${xpathLiteralString(ariaLabel)}]`,
      stability: 'good',
      label: 'By aria-label',
    })
  }

  // 5. Text content (fragile fallback)
  const txt = el.textContent?.trim() ?? ''
  if (txt && txt.length > 0 && txt.length <= 50) {
    raw.push({
      strategy: 'text',
      xpath: `//${tag}[normalize-space()=${xpathLiteralString(txt)}]`,
      stability: 'fragile',
      label: 'By text (fragile)',
    })
  }

  // 6. Relative structural
  const rel = buildRelativeXPath(el)
  if (rel && !raw.find(c => c.xpath === rel)) {
    raw.push({
      strategy: 'structural',
      xpath: rel,
      stability: raw.length > 0 ? 'good' : 'fragile',
      label: 'Relative structural',
    })
  }

  // Fallback: absolute
  if (raw.length === 0) {
    raw.push({
      strategy: 'structural',
      xpath: buildAbsoluteXPath(el),
      stability: 'fragile',
      label: 'Absolute (fragile)',
    })
  }

  // Validate each and attach scores — cap at 5 candidates
  return raw.slice(0, 5).map(c => {
    const { matchCount, status } = validateXPath(c.xpath)
    const score = scoreXPath(c.xpath, c.strategy, matchCount)
    return { ...c, score, matchCount, validationStatus: status }
  })
}

// ── Export helpers ───────────────────────────────────────────────────────────

/** Sanitize an element name into a valid C# property identifier. */
function toCSharpIdentifier(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/(?:^|\s+)(.)/g, (_, c: string) => c.toUpperCase())
    || 'Element'
}

/** C# `By.XPath(...)` snippet for a single property. */
export function exportCSharpProperty(
  name: string,
  xpath: string,
  fallbacks?: string[],
): string {
  const prop = toCSharpIdentifier(name)
  const escaped = xpath.replace(/"/g, '\\"')
  let code = `public IWebElement ${prop} => _driver.FindElement(By.XPath("${escaped}"));`

  if (fallbacks && fallbacks.length > 0) {
    const fbLines = fallbacks
      .map(fb => `//   ${fb.replace(/"/g, '\\"')}`)
      .join('\n')
    code = `// Fallback XPaths (in priority order):\n${fbLines}\n${code}`
  }

  return code
}

/** Full C# Page Object class for a page's elements. */
export function exportPageClass(pageName: string, elements: XPathElement[]): string {
  const className = toCSharpIdentifier(pageName) || 'Page'
  const props = elements.map(el => {
    const prop = toCSharpIdentifier(el.name)
    const escaped = el.xpath.replace(/"/g, '\\"')
    return `    public IWebElement ${prop} => _driver.FindElement(By.XPath("${escaped}"));`
  }).join('\n')

  return [
    `public class ${className}`,
    `{`,
    `    private readonly IWebDriver _driver;`,
    ``,
    `    public ${className}(IWebDriver driver) => _driver = driver;`,
    ``,
    props,
    `}`,
  ].join('\n')
}
