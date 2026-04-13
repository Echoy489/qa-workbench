import { describe, it, expect } from 'vitest'
import { normalizeSteps, toPlainText, toGherkin, toCSharpSkeleton } from '../src/shared/recorderUtils'
import type { RecordedStep, Recording } from '../src/shared/types'

function makeStep(overrides: Partial<RecordedStep> = {}): RecordedStep {
  return {
    id: crypto.randomUUID(),
    stepNumber: 1,
    timestamp: new Date().toISOString(),
    type: 'click',
    description: 'Clicked #btn',
    targetHint: '#btn',
    url: 'https://example.com',
    ...overrides,
  }
}

function makeRecording(steps: RecordedStep[], name = 'Test Flow'): Recording {
  return {
    id: crypto.randomUUID(),
    name,
    steps,
    startedAt: new Date().toISOString(),
  }
}

// ── normalizeSteps ───────────────────────────────────────────────────────────
describe('normalizeSteps', () => {
  it('returns steps in order with sequential numbers', () => {
    const steps = [makeStep({ type: 'click' }), makeStep({ type: 'click' })]
    const result = normalizeSteps(steps)
    expect(result[0].stepNumber).toBe(1)
    expect(result[1].stepNumber).toBe(2)
  })

  it('collapses consecutive input events on same target', () => {
    const steps = [
      makeStep({ type: 'input', targetHint: '#email', description: 'Entered text in #email' }),
      makeStep({ type: 'input', targetHint: '#email', description: 'Entered text in #email' }),
      makeStep({ type: 'input', targetHint: '#email', description: 'Entered text in #email' }),
    ]
    const result = normalizeSteps(steps)
    expect(result).toHaveLength(1)
  })

  it('does not collapse input events on different targets', () => {
    const steps = [
      makeStep({ type: 'input', targetHint: '#email', description: 'Entered text in #email' }),
      makeStep({ type: 'input', targetHint: '#password', description: 'Entered text in #password' }),
    ]
    const result = normalizeSteps(steps)
    expect(result).toHaveLength(2)
  })

  it('does not collapse non-input events', () => {
    const steps = [
      makeStep({ type: 'click', targetHint: '#btn' }),
      makeStep({ type: 'click', targetHint: '#btn' }),
    ]
    const result = normalizeSteps(steps)
    expect(result).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(normalizeSteps([])).toEqual([])
  })
})

// ── toPlainText ──────────────────────────────────────────────────────────────
describe('toPlainText', () => {
  it('produces numbered steps', () => {
    const rec = makeRecording([
      makeStep({ description: 'Navigate to login page', type: 'navigate' }),
      makeStep({ description: 'Enter email', type: 'input' }),
      makeStep({ description: 'Click submit', type: 'click' }),
    ], 'Login Flow')
    const text = toPlainText(rec)
    expect(text).toContain('Login Flow')
    expect(text).toContain('1. Navigate to login page')
    expect(text).toContain('2. Enter email')
    expect(text).toContain('3. Click submit')
  })

  it('handles empty steps gracefully', () => {
    const rec = makeRecording([], 'Empty')
    expect(toPlainText(rec)).toContain('no steps')
  })
})

// ── toGherkin ────────────────────────────────────────────────────────────────
describe('toGherkin', () => {
  it('prefixes first step with Given', () => {
    const steps = [makeStep({ description: 'the user is on the login page' })]
    const text = toGherkin(makeRecording(steps))
    expect(text).toContain('Given the user is on the login page')
  })

  it('prefixes last step with Then (when more than one step)', () => {
    const steps = [
      makeStep({ description: 'the user is on login page' }),
      makeStep({ description: 'the user clicks login' }),
      makeStep({ description: 'the user is redirected to dashboard' }),
    ]
    const text = toGherkin(makeRecording(steps))
    expect(text).toContain('Given the user is on login page')
    expect(text).toContain('Then the user is redirected to dashboard')
  })

  it('includes Scenario label', () => {
    const rec = makeRecording([makeStep()], 'User logs in')
    expect(toGherkin(rec)).toContain('Scenario: User logs in')
  })
})

// ── toCSharpSkeleton ─────────────────────────────────────────────────────────
describe('toCSharpSkeleton', () => {
  it('generates a method skeleton', () => {
    const steps = [
      makeStep({ type: 'click', description: 'Clicked login button', xpathRef: "//button[@id='login']" }),
    ]
    const code = toCSharpSkeleton(makeRecording(steps, 'User Login'))
    expect(code).toContain('public void UserLogin()')
    expect(code).toContain('By.XPath(')
    expect(code).toContain('.Click()')
  })

  it('adds TODO comment when step has no xpathRef', () => {
    const steps = [makeStep({ type: 'click', xpathRef: undefined })]
    const code = toCSharpSkeleton(makeRecording(steps))
    expect(code).toContain('TODO')
  })

  it('generates SendKeys for input steps with xpathRef', () => {
    const steps = [
      makeStep({
        type: 'input',
        description: 'Entered text in #email',
        xpathRef: "//input[@name='email']",
      }),
    ]
    const code = toCSharpSkeleton(makeRecording(steps))
    expect(code).toContain('SendKeys(')
  })

  it('generates SelectByText for select steps with xpathRef', () => {
    const steps = [
      makeStep({
        type: 'select',
        description: 'Selected "Option A" in #dropdown',
        xpathRef: "//select[@id='dropdown']",
      }),
    ]
    const code = toCSharpSkeleton(makeRecording(steps))
    expect(code).toContain('SelectByText(')
  })

  it('handles recording name with special characters', () => {
    const steps = [makeStep({ type: 'click' })]
    const code = toCSharpSkeleton(makeRecording(steps, 'User: logs in (v2)!'))
    // Should not crash and should produce valid-ish method name
    expect(code).toContain('public void')
  })
})
