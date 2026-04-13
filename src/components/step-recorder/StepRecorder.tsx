import { useState, useEffect, useCallback } from 'react'
import { getRecordings, saveRecording, deleteRecording } from '../../store/recorderStore'
import { normalizeSteps, toPlainText, toGherkin, toCSharpSkeleton } from '../../shared/recorderUtils'
import type { Recording, RecordedStep, RecordedStepType } from '../../shared/types'

interface Props {
  recording: boolean
  liveSteps: RecordedStep[]
  onStartRecording: () => void
  onStopRecording: () => void
  /** Called when user wants to use steps in a new bug capture */
  onUseInBug: (steps: string[]) => void
  refreshKey: number
}

type OutputMode = 'plain' | 'gherkin' | 'csharp'

export default function StepRecorder({
  recording, liveSteps, onStartRecording, onStopRecording, onUseInBug, refreshKey,
}: Props) {
  const [savedRecordings, setSavedRecordings] = useState<Recording[]>([])
  const [selected, setSelected] = useState<Recording | null>(null)
  const [editSteps, setEditSteps] = useState<RecordedStep[]>([])
  const [recordingName, setRecordingName] = useState('')
  const [outputMode, setOutputMode] = useState<OutputMode>('plain')
  const [outputText, setOutputText] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setSavedRecordings(await getRecordings())
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  // When a recording is stopped, prompt to save it
  const [pendingSteps, setPendingSteps] = useState<RecordedStep[] | null>(null)
  const [savingName, setSavingName] = useState('')

  useEffect(() => {
    if (!recording && liveSteps.length > 0 && pendingSteps === null) {
      setPendingSteps(normalizeSteps(liveSteps))
      setSavingName(`Recording ${new Date().toLocaleTimeString()}`)
    }
  }, [recording, liveSteps, pendingSteps])

  const handleSaveRecording = async () => {
    if (!pendingSteps || !savingName.trim()) return
    const rec: Recording = {
      id: crypto.randomUUID(),
      name: savingName.trim(),
      steps: pendingSteps,
      startedAt: pendingSteps[0]?.timestamp ?? new Date().toISOString(),
      stoppedAt: new Date().toISOString(),
    }
    await saveRecording(rec)
    setPendingSteps(null)
    setSavingName('')
    load()
  }

  const handleDiscardPending = () => {
    setPendingSteps(null)
    setSavingName('')
  }

  const openRecording = (rec: Recording) => {
    setSelected(rec)
    setEditSteps(normalizeSteps(rec.steps))
    generateOutput(rec, 'plain')
  }

  const generateOutput = (rec: Recording, mode: OutputMode) => {
    const effective = { ...rec, steps: normalizeSteps(rec.steps) }
    let text = ''
    if (mode === 'plain') text = toPlainText(effective)
    else if (mode === 'gherkin') text = toGherkin(effective)
    else text = toCSharpSkeleton(effective)
    setOutputText(text)
    setOutputMode(mode)
  }

  const handleModeChange = (mode: OutputMode) => {
    if (!selected) return
    generateOutput({ ...selected, steps: editSteps }, mode)
  }

  const handleDeleteStep = (id: string) => {
    const updated = editSteps.filter(s => s.id !== id).map((s, i) => ({ ...s, stepNumber: i + 1 }))
    setEditSteps(updated)
    if (selected) generateOutput({ ...selected, steps: updated }, outputMode)
  }

  const handleMoveStep = (id: string, dir: -1 | 1) => {
    const idx = editSteps.findIndex(s => s.id === id)
    if (idx < 0) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= editSteps.length) return
    const updated = [...editSteps]
    ;[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]]
    const renumbered = updated.map((s, i) => ({ ...s, stepNumber: i + 1 }))
    setEditSteps(renumbered)
    if (selected) generateOutput({ ...selected, steps: renumbered }, outputMode)
  }

  const handleEditDescription = (id: string, desc: string) => {
    const updated = editSteps.map(s => s.id === id ? { ...s, description: desc } : s)
    setEditSteps(updated)
  }

  const handleSaveEdits = async () => {
    if (!selected) return
    const updated = { ...selected, steps: editSteps }
    await saveRecording(updated)
    setSelected(updated)
    load()
  }

  const handleDeleteRecording = async (id: string) => {
    if (!confirm('Delete this recording?')) return
    await deleteRecording(id)
    if (selected?.id === id) setSelected(null)
    load()
  }

  const handleCopyOutput = async () => {
    await navigator.clipboard.writeText(outputText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleUseInBug = () => {
    if (!selected) return
    const steps = editSteps.map(s => s.description)
    onUseInBug(steps)
  }

  // ── Live recording view ──────────────────────────────────────────────────
  if (recording) {
    return (
      <div>
        <div className="rec-banner">
          <span className="rec-dot" />
          <span style={{ flex: 1 }}>Recording… {liveSteps.length} steps</span>
          <button className="btn btn-danger btn-sm" onClick={onStopRecording}>■ Stop</button>
        </div>
        <div className="rec-steps">
          {liveSteps.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>
              Interact with the page to record steps.
            </div>
          ) : (
            normalizeSteps(liveSteps).map(s => (
              <div key={s.id} className="rec-step">
                <span className="rec-step-num">{s.stepNumber}</span>
                <span className="rec-step-type">{s.type}</span>
                <span className="rec-step-desc">{s.description}</span>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Pending save prompt ─────────────────────────────────────────────────
  if (pendingSteps !== null) {
    return (
      <div>
        <div className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>
            Save recording? ({pendingSteps.length} steps)
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <input type="text" value={savingName} onChange={e => setSavingName(e.target.value)}
              placeholder="Recording name…" autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSaveRecording()} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSaveRecording}
              disabled={!savingName.trim()}>Save</button>
            <button className="btn btn-ghost btn-sm" onClick={handleDiscardPending}>Discard</button>
          </div>
        </div>
        <div className="rec-steps">
          {pendingSteps.map(s => (
            <div key={s.id} className="rec-step">
              <span className="rec-step-num">{s.stepNumber}</span>
              <span className="rec-step-type">{s.type}</span>
              <span className="rec-step-desc">{s.description}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Recording detail view ───────────────────────────────────────────────
  if (selected) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>← Back</button>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected.name}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleUseInBug}
            title="Copy steps to a new bug capture">🐛 Use in Bug</button>
          <button className="btn btn-danger btn-sm"
            onClick={() => handleDeleteRecording(selected.id)}>🗑</button>
        </div>

        {/* Editable step list */}
        <div style={{ marginBottom: 10 }}>
          {editSteps.map((s, i) => (
            <div key={s.id} className="rec-step rec-step-edit">
              <span className="rec-step-num">{s.stepNumber}</span>
              <input
                className="rec-step-input"
                value={s.description}
                onChange={e => handleEditDescription(s.id, e.target.value)}
              />
              <button className="btn-icon btn-sm" title="Move up" disabled={i === 0}
                onClick={() => handleMoveStep(s.id, -1)}>↑</button>
              <button className="btn-icon btn-sm" title="Move down" disabled={i === editSteps.length - 1}
                onClick={() => handleMoveStep(s.id, 1)}>↓</button>
              <button className="btn-icon btn-sm" title="Delete step"
                onClick={() => handleDeleteStep(s.id)}>✕</button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }}
            onClick={handleSaveEdits}>💾 Save edits</button>
        </div>

        {/* Output */}
        <div style={{ marginBottom: 6, display: 'flex', gap: 4 }}>
          {(['plain', 'gherkin', 'csharp'] as OutputMode[]).map(m => (
            <button key={m}
              className={`btn btn-sm ${outputMode === m ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => handleModeChange(m)}>
              {m === 'plain' ? 'Steps' : m === 'gherkin' ? 'Gherkin' : 'C#'}
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
            onClick={handleCopyOutput}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
        <pre className="output-pre">{outputText}</pre>
      </div>
    )
  }

  // ── List view ───────────────────────────────────────────────────────────
  return (
    <div>
      <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }}
        onClick={onStartRecording}>
        ⏺ Start Recording
      </button>

      {savedRecordings.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🎬</div>
          <p>No recordings yet.</p>
          <p style={{ marginTop: 6, fontSize: 11 }}>Click "Start Recording" then interact with the page.</p>
        </div>
      ) : (
        savedRecordings.map(r => (
          <div key={r.id} className="capsule-row" onClick={() => openRecording(r)}>
            <div className="capsule-info">
              <div className="capsule-title">🎬 {r.name}</div>
              <div className="capsule-meta">
                {r.steps.length} steps · {new Date(r.startedAt).toLocaleString()}
              </div>
            </div>
            <button className="btn-icon" title="Delete"
              onClick={e => { e.stopPropagation(); handleDeleteRecording(r.id) }}>🗑</button>
          </div>
        ))
      )}
    </div>
  )
}
