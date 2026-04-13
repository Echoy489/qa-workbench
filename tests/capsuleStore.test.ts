import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/chrome'
import { resetChromeMock } from './mocks/chrome'
import { getCapsules, saveCapsule, deleteCapsule, updateCapsule } from '../src/store/capsuleStore'
import type { BugCapsule } from '../src/shared/types'

beforeEach(() => resetChromeMock())

function makeCapsule(overrides: Partial<BugCapsule> = {}): BugCapsule {
  return {
    id: crypto.randomUUID(),
    title: 'Test bug',
    severity: 'medium',
    url: 'https://example.com',
    pageTitle: 'Example',
    browser: 'Chrome 120',
    os: 'Windows',
    screenshotDataUrl: '',
    consoleErrors: [],
    preconditions: '',
    steps: ['Step 1'],
    expected: 'Works',
    actual: 'Broken',
    notes: '',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('saveCapsule', () => {
  it('saves and retrieves a capsule', async () => {
    const c = makeCapsule({ title: 'First bug' })
    await saveCapsule(c)
    const capsules = await getCapsules()
    expect(capsules).toHaveLength(1)
    expect(capsules[0].title).toBe('First bug')
  })

  it('prepends new capsules (newest first)', async () => {
    await saveCapsule(makeCapsule({ title: 'Older' }))
    await saveCapsule(makeCapsule({ title: 'Newer' }))
    const capsules = await getCapsules()
    expect(capsules[0].title).toBe('Newer')
    expect(capsules[1].title).toBe('Older')
  })

  it('stores v2 evidence fields correctly', async () => {
    const c = makeCapsule({
      environment: {
        url: 'https://example.com', pageTitle: 'Home',
        browser: 'Chrome 120', os: 'Windows',
        viewport: { width: 1280, height: 720 },
        devicePixelRatio: 1, language: 'en-GB',
        online: true, readyState: 'complete',
        timestamp: new Date().toISOString(),
      },
      actionTimeline: [
        { type: 'click', description: 'Clicked #btn', targetHint: '#btn', url: 'https://example.com', timestamp: new Date().toISOString() },
      ],
      networkFailures: [
        { url: 'https://api.example.com/data', status: 500, timestamp: new Date().toISOString() },
      ],
    })
    await saveCapsule(c)
    const capsules = await getCapsules()
    expect(capsules[0].environment?.viewport.width).toBe(1280)
    expect(capsules[0].actionTimeline).toHaveLength(1)
    expect(capsules[0].networkFailures?.[0].status).toBe(500)
  })
})

describe('deleteCapsule', () => {
  it('removes capsule by id', async () => {
    const c = makeCapsule()
    await saveCapsule(c)
    await deleteCapsule(c.id)
    expect(await getCapsules()).toHaveLength(0)
  })

  it('is a no-op for non-existent id', async () => {
    await saveCapsule(makeCapsule())
    await deleteCapsule('nonexistent')
    expect(await getCapsules()).toHaveLength(1)
  })
})

describe('updateCapsule', () => {
  it('replaces capsule by id', async () => {
    const c = makeCapsule({ title: 'Original' })
    await saveCapsule(c)
    await updateCapsule({ ...c, title: 'Updated' })
    const capsules = await getCapsules()
    expect(capsules[0].title).toBe('Updated')
  })
})

describe('backward compatibility', () => {
  it('reads old v1 capsule (no evidence fields) without error', async () => {
    // Simulate a v1 capsule with no optional fields
    const v1: BugCapsule = {
      id: 'v1-id',
      title: 'Old bug',
      severity: 'high',
      url: 'https://example.com',
      pageTitle: 'Page',
      browser: 'Chrome 100',
      os: 'Windows',
      screenshotDataUrl: '',
      consoleErrors: ['err1'],
      preconditions: '',
      steps: ['Click login'],
      expected: 'Works',
      actual: 'Fails',
      notes: '',
      createdAt: '2024-01-01T00:00:00Z',
    }
    await saveCapsule(v1)
    const capsules = await getCapsules()
    expect(capsules[0].title).toBe('Old bug')
    expect(capsules[0].environment).toBeUndefined()
    expect(capsules[0].actionTimeline).toBeUndefined()
  })
})
