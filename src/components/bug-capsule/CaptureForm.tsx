import { useState } from 'react'
import { saveCapsule } from '../../store/capsuleStore'
import type { CapturedBugData, Severity } from '../../shared/types'

interface Props {
  captured: CapturedBugData
  onClose: () => void
  onSaved: () => void
  /** Pre-filled steps from a linked recording (optional). */
  initialSteps?: string[]
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']
const SEV_LABELS = { critical: '🔴 Critical', high: '🟠 High', medium: '🟡 Medium', low: '🟢 Low' }

export default function CaptureForm({ captured, onClose, onSaved, initialSteps }: Props) {
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [preconditions, setPreconditions] = useState('')
  const [steps, setSteps] = useState<string[]>(initialSteps ?? [''])
  const [expected, setExpected] = useState('')
  const [actual, setActual] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const addStep = () => setSteps(s => [...s, ''])
  const updateStep = (i: number, v: string) => setSteps(s => s.map((x, j) => j === i ? v : x))
  const removeStep = (i: number) => setSteps(s => s.filter((_, j) => j !== i))

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await saveCapsule({
        id: crypto.randomUUID(),
        title: title.trim(),
        severity,
        url: captured.url,
        pageTitle: captured.pageTitle,
        browser: captured.browser,
        os: captured.os,
        screenshotDataUrl: captured.screenshotDataUrl,
        consoleErrors: captured.consoleErrors,
        preconditions: preconditions.trim(),
        steps: steps.filter(s => s.trim()),
        expected: expected.trim(),
        actual: actual.trim(),
        notes: notes.trim(),
        createdAt: captured.timestamp,
        environment: captured.environment,
        actionTimeline: captured.actionTimeline,
        networkFailures: captured.networkFailures,
        domSnippet: captured.domSnippet,
        storageKeys: captured.storageKeys,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const timeline = captured.actionTimeline ?? []
  const netFails = captured.networkFailures ?? []
  const env = captured.environment

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          🐛 New Evidence Capsule
          <button className="close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {captured.screenshotDataUrl && (
            <img src={captured.screenshotDataUrl} className="screenshot" alt="screenshot" />
          )}

          {env && (
            <div className="evidence-meta">
              <span>🌐 {env.url}</span>
              <span>🖥 {env.browser}</span>
              <span>💻 {env.os}</span>
              <span>📐 {env.viewport.width}×{env.viewport.height}</span>
              {!env.online && <span className="badge badge-crit">OFFLINE</span>}
            </div>
          )}

          {captured.consoleErrors.length > 0 && (
            <div className="form-group">
              <label>Console errors ({captured.consoleErrors.length})</label>
              <div className="console-errors">
                {captured.consoleErrors.map((e, i) => (
                  <div key={i} className="console-err-item">{e}</div>
                ))}
              </div>
            </div>
          )}

          {netFails.length > 0 && (
            <div className="form-group">
              <label>Network failures ({netFails.length})</label>
              <div className="console-errors">
                {netFails.map((f, i) => (
                  <div key={i} className="console-err-item network-fail">
                    {f.status ? `[${f.status}] ` : ''}{f.url}
                  </div>
                ))}
              </div>
            </div>
          )}

          {timeline.length > 0 && (
            <div className="form-group">
              <label>Recent actions ({timeline.length})</label>
              <div className="console-errors">
                {timeline.slice(-10).map((a, i) => (
                  <div key={i} className="console-err-item" style={{ color: 'var(--text)' }}>
                    {a.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Short description of the bug…" autoFocus />
          </div>

          <div className="form-group">
            <label>Severity</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {SEVERITIES.map(s => (
                <button key={s}
                  className={`btn btn-sm ${severity === s ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setSeverity(s)}
                  style={{ flex: 1, fontSize: 11 }}>
                  {SEV_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Preconditions</label>
            <textarea value={preconditions} onChange={e => setPreconditions(e.target.value)}
              placeholder="What state must the app be in before testing?…" rows={2} />
          </div>

          <div className="form-group">
            <label>Steps to reproduce</label>
            {steps.map((step, i) => (
              <div key={i} className="step-row">
                <span style={{ fontSize: 11, color: 'var(--muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                <input type="text" value={step} onChange={e => updateStep(i, e.target.value)}
                  placeholder={`Step ${i + 1}…`} />
                {steps.length > 1 && (
                  <button className="btn-icon btn-sm" onClick={() => removeStep(i)}>✕</button>
                )}
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={addStep} style={{ marginTop: 4 }}>+ Add step</button>
          </div>

          <div className="form-group">
            <label>Expected result</label>
            <textarea value={expected} onChange={e => setExpected(e.target.value)}
              placeholder="What should happen…" rows={2} />
          </div>

          <div className="form-group">
            <label>Actual result</label>
            <textarea value={actual} onChange={e => setActual(e.target.value)}
              placeholder="What actually happens…" rows={2} />
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any additional context…" rows={2} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : '✓ Save Capsule'}
          </button>
        </div>
      </div>
    </div>
  )
}
