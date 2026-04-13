import type { RecordedStep, Recording } from './types'

/**
 * Collapse consecutive input events on the same target into one step.
 * Renumbers the result sequentially.
 */
export function normalizeSteps(steps: RecordedStep[]): RecordedStep[] {
  const result: RecordedStep[] = []

  for (const step of steps) {
    const prev = result[result.length - 1]
    if (
      step.type === 'input' &&
      prev?.type === 'input' &&
      prev.targetHint === step.targetHint
    ) {
      // Replace description/timestamp with the latest for this target
      result[result.length - 1] = {
        ...prev,
        description: step.description,
        timestamp: step.timestamp,
      }
    } else {
      result.push(step)
    }
  }

  return result.map((s, i) => ({ ...s, stepNumber: i + 1 }))
}

/** Plain numbered step list. */
export function toPlainText(recording: Recording): string {
  const steps = normalizeSteps(recording.steps)
  if (steps.length === 0) return `${recording.name}\n(no steps recorded)`
  const lines = [`${recording.name}`, `${'─'.repeat(Math.min(recording.name.length + 4, 60))}`]
  for (const s of steps) lines.push(`${s.stepNumber}. ${s.description}`)
  return lines.join('\n')
}

/**
 * Gherkin scenario draft.
 * Heuristic: first navigate → Given, subsequent actions → When, last step → Then.
 */
export function toGherkin(recording: Recording): string {
  const steps = normalizeSteps(recording.steps)
  const lines: string[] = [`Scenario: ${recording.name}`]

  steps.forEach((s, i) => {
    let kw: string
    if (i === 0) kw = 'Given'
    else if (i === steps.length - 1 && steps.length > 1) kw = 'Then'
    else kw = 'When'
    lines.push(`  ${kw} ${s.description}`)
  })

  return lines.join('\n')
}

/**
 * C# Selenium/Reqnroll method skeleton using only By.XPath(...) locators.
 * Steps without an xpathRef get a TODO comment.
 */
export function toCSharpSkeleton(recording: Recording, className?: string): string {
  const steps = normalizeSteps(recording.steps)
  const safeName = (className ?? recording.name)
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/(?:^|\s+)(.)/g, (_, c: string) => c.toUpperCase())
    || 'RecordedFlow'

  const lines: string[] = [
    `[When("I ${recording.name.toLowerCase()}")]`,
    `public void ${safeName}()`,
    `{`,
  ]

  for (const s of steps) {
    lines.push(`    // ${s.stepNumber}. ${s.description}`)
    if (s.xpathRef) {
      const xp = s.xpathRef.replace(/"/g, '\\"')
      if (s.type === 'click') {
        lines.push(`    _driver.FindElement(By.XPath("${xp}")).Click();`)
      } else if (s.type === 'input') {
        // Extract quoted value from description if present, else use placeholder
        const match = s.description.match(/"([^"]+)"$/)
        const val = match ? match[1].replace(/"/g, '\\"') : 'value'
        lines.push(`    _driver.FindElement(By.XPath("${xp}")).Clear();`)
        lines.push(`    _driver.FindElement(By.XPath("${xp}")).SendKeys("${val}");`)
      } else if (s.type === 'select') {
        lines.push(`    new SelectElement(_driver.FindElement(By.XPath("${xp}"))).SelectByText("value");`)
      } else {
        lines.push(`    _driver.FindElement(By.XPath("${xp}"));`)
      }
    } else {
      lines.push(`    // TODO: _driver.FindElement(By.XPath("..."));`)
    }
  }

  lines.push(`}`)
  return lines.join('\n')
}
