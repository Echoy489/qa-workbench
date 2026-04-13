import type { Recording } from '../shared/types'

const KEY = 'qa_recordings'

export async function getRecordings(): Promise<Recording[]> {
  const r = await chrome.storage.local.get(KEY)
  return (r[KEY] as Recording[]) || []
}

export async function saveRecording(recording: Recording): Promise<void> {
  const recordings = await getRecordings()
  const existing = recordings.findIndex(r => r.id === recording.id)
  if (existing >= 0) {
    recordings[existing] = recording
    await chrome.storage.local.set({ [KEY]: recordings })
  } else {
    await chrome.storage.local.set({ [KEY]: [recording, ...recordings] })
  }
}

export async function deleteRecording(id: string): Promise<void> {
  const recordings = await getRecordings()
  await chrome.storage.local.set({ [KEY]: recordings.filter(r => r.id !== id) })
}
