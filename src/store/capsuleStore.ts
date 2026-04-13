import type { BugCapsule } from '../shared/types'

const KEY = 'qa_bug_capsules'

export async function getCapsules(): Promise<BugCapsule[]> {
  const r = await chrome.storage.local.get(KEY)
  return (r[KEY] as BugCapsule[]) || []
}

export async function saveCapsule(capsule: BugCapsule): Promise<void> {
  const capsules = await getCapsules()
  await chrome.storage.local.set({ [KEY]: [capsule, ...capsules] })
}

export async function updateCapsule(capsule: BugCapsule): Promise<void> {
  const capsules = await getCapsules()
  await chrome.storage.local.set({
    [KEY]: capsules.map(c => c.id === capsule.id ? capsule : c),
  })
}

export async function deleteCapsule(id: string): Promise<void> {
  const capsules = await getCapsules()
  await chrome.storage.local.set({ [KEY]: capsules.filter(c => c.id !== id) })
}
