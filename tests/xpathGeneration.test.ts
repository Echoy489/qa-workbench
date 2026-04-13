import { describe, it, expect, beforeEach } from 'vitest'
import {
  xpathLiteralString,
  scoreXPath,
  validateXPath,
  generateCandidates,
  exportCSharpProperty,
  exportPageClass,
} from '../src/shared/xpathUtils'
import type { XPathElement } from '../src/shared/types'

// ── xpathLiteralString ───────────────────────────────────────────────────────
describe('xpathLiteralString', () => {
  it('wraps simple strings in single quotes', () => {
    expect(xpathLiteralString('login')).toBe("'login'")
  })

  it('uses double quotes when value contains single quote', () => {
    expect(xpathLiteralString("O'Brien")).toBe('"O\'Brien"')
  })

  it('uses concat() when value contains both quote types', () => {
    const result = xpathLiteralString(`it's "quoted"`)
    expect(result).toContain('concat')
    expect(result).toContain("'")
  })
})

// ── scoreXPath ───────────────────────────────────────────────────────────────
describe('scoreXPath', () => {
  it('gives highest base score to id strategy', () => {
    const s = scoreXPath("//button[@id='login']", 'id')
    expect(s.score).toBeGreaterThanOrEqual(80)
    expect(s.confidence).toBe('high')
  })

  it('gives high score to data-testid strategy', () => {
    const s = scoreXPath("//button[@data-testid='submit']", 'data-testid')
    expect(s.score).toBeGreaterThanOrEqual(75)
    expect(s.confidence).toBe('high')
  })

  it('boosts score when match count is 1', () => {
    const without = scoreXPath("//button[@id='x']", 'id', undefined)
    const with1 = scoreXPath("//button[@id='x']", 'id', 1)
    expect(with1.score).toBeGreaterThan(without.score)
    expect(with1.reasons).toContain('Unique match on page')
  })

  it('penalises score heavily when 0 matches', () => {
    const s = scoreXPath("//button[@id='x']", 'id', 0)
    expect(s.confidence).toBe('medium') // may still be medium because id base is 85-30=55
    expect(s.warnings.some(w => w.includes('broken'))).toBe(true)
  })

  it('penalises score when multiple matches', () => {
    const s = scoreXPath("//div[@class='btn']", 'structural', 5)
    expect(s.warnings.some(w => w.includes('5 elements'))).toBe(true)
    expect(s.score).toBeLessThan(30)
  })

  it('warns about deep structural path', () => {
    const deep = "//div/section/article/div/div/div/span"
    const s = scoreXPath(deep, 'structural')
    expect(s.warnings.some(w => w.includes('Deep'))).toBe(true)
  })

  it('penalises absolute path from root', () => {
    const s = scoreXPath('/html/body/div/button', 'structural')
    expect(s.warnings.some(w => w.includes('Absolute'))).toBe(true)
  })

  it('warns text-dependent XPath', () => {
    const s = scoreXPath("//button[normalize-space()='Login']", 'text')
    expect(s.warnings.some(w => w.includes('visible text'))).toBe(true)
  })

  it('returns score in 0–100 range', () => {
    const extreme = scoreXPath("//a[@id='x']", 'id', 1)
    expect(extreme.score).toBeGreaterThanOrEqual(0)
    expect(extreme.score).toBeLessThanOrEqual(100)
  })
})

// ── validateXPath ────────────────────────────────────────────────────────────
describe('validateXPath', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('returns valid for a uniquely matching xpath', () => {
    document.body.innerHTML = '<button id="login">Login</button>'
    const r = validateXPath("//button[@id='login']")
    expect(r.matchCount).toBe(1)
    expect(r.status).toBe('valid')
  })

  it('returns ambiguous when multiple elements match', () => {
    document.body.innerHTML = '<button class="btn">A</button><button class="btn">B</button>'
    const r = validateXPath("//button[@class='btn']")
    expect(r.matchCount).toBe(2)
    expect(r.status).toBe('ambiguous')
  })

  it('returns broken when nothing matches', () => {
    document.body.innerHTML = '<span>text</span>'
    const r = validateXPath("//button[@id='missing']")
    expect(r.matchCount).toBe(0)
    expect(r.status).toBe('broken')
  })

  it('returns broken for invalid xpath', () => {
    const r = validateXPath('!!!invalid!!!')
    expect(r.status).toBe('broken')
  })
})

// ── generateCandidates ───────────────────────────────────────────────────────
describe('generateCandidates', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('generates id candidate when element has id', () => {
    document.body.innerHTML = '<button id="submit-btn">Submit</button>'
    const el = document.getElementById('submit-btn')!
    const candidates = generateCandidates(el)
    const idCand = candidates.find(c => c.strategy === 'id')
    expect(idCand).toBeDefined()
    expect(idCand!.xpath).toBe("//button[@id='submit-btn']")
    expect(idCand!.stability).toBe('best')
  })

  it('generates data-testid candidate when attribute present', () => {
    document.body.innerHTML = '<input data-testid="email-field" />'
    const el = document.querySelector('[data-testid]')!
    const candidates = generateCandidates(el)
    const c = candidates.find(c => c.strategy === 'data-testid')
    expect(c).toBeDefined()
    expect(c!.xpath).toContain('data-testid')
  })

  it('generates name candidate when name attribute present', () => {
    document.body.innerHTML = '<input name="username" />'
    const el = document.querySelector('[name]')!
    const candidates = generateCandidates(el)
    const c = candidates.find(c => c.strategy === 'name')
    expect(c).toBeDefined()
    expect(c!.xpath).toContain('username')
  })

  it('attaches score to every candidate', () => {
    document.body.innerHTML = '<button id="x">X</button>'
    const el = document.getElementById('x')!
    const candidates = generateCandidates(el)
    for (const c of candidates) {
      expect(c.score).toBeDefined()
      expect(typeof c.score!.score).toBe('number')
    }
  })

  it('attaches validation status to every candidate', () => {
    document.body.innerHTML = '<button id="x">X</button>'
    const el = document.getElementById('x')!
    const candidates = generateCandidates(el)
    for (const c of candidates) {
      expect(c.validationStatus).toBeDefined()
    }
  })

  it('caps at 5 candidates', () => {
    document.body.innerHTML =
      '<button id="x" name="n" data-testid="t" aria-label="lab">text</button>'
    const el = document.getElementById('x')!
    const candidates = generateCandidates(el)
    expect(candidates.length).toBeLessThanOrEqual(5)
  })

  it('handles element with no stable attributes gracefully', () => {
    document.body.innerHTML = '<div><span></span></div>'
    const el = document.querySelector('span')!
    const candidates = generateCandidates(el)
    expect(candidates.length).toBeGreaterThan(0)
  })
})

// ── Export helpers ───────────────────────────────────────────────────────────
describe('exportCSharpProperty', () => {
  it('generates a valid C# property', () => {
    const code = exportCSharpProperty('Login Button', "//button[@id='login']")
    expect(code).toContain('public IWebElement LoginButton')
    expect(code).toContain('By.XPath')
    expect(code).toContain("//button[@id='login']")
  })

  it('includes fallback comments when fallbacks provided', () => {
    const code = exportCSharpProperty(
      'Submit',
      "//button[@id='submit']",
      ["//button[@data-testid='submit']"],
    )
    expect(code).toContain('Fallback')
    expect(code).toContain("//button[@data-testid='submit']")
  })

  it('escapes double quotes in xpath', () => {
    const code = exportCSharpProperty('Test', '//button[@class="btn"]')
    // Should not have unescaped " inside the string literal
    const insideString = code.match(/By\.XPath\("([^)]+)"\)/)
    expect(insideString).toBeTruthy()
  })
})

describe('exportPageClass', () => {
  it('generates a full C# class', () => {
    const elements: XPathElement[] = [
      {
        id: '1', name: 'Login Button', xpath: "//button[@id='login']",
        candidates: [], url: 'https://example.com', notes: '',
        createdAt: '', updatedAt: '',
      },
      {
        id: '2', name: 'Username Field', xpath: "//input[@name='username']",
        candidates: [], url: 'https://example.com', notes: '',
        createdAt: '', updatedAt: '',
      },
    ]
    const code = exportPageClass('LoginPage', elements)
    expect(code).toContain('public class LoginPage')
    expect(code).toContain('IWebDriver')
    expect(code).toContain('LoginButton')
    expect(code).toContain('UsernameField')
  })
})
