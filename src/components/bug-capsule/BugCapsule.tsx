import { useState, useEffect, useCallback } from 'react'
import { getCapsules, deleteCapsule } from '../../store/capsuleStore'
import type { BugCapsule as Bug } from '../../shared/types'
import CapsuleDetail from './CapsuleDetail'

const SEV_DOT: Record<string, string> = {
  critical: 'sev-critical', high: 'sev-high', medium: 'sev-medium', low: 'sev-low',
}

interface Props {
  refreshKey: number
}

export default function BugCapsule({ refreshKey }: Props) {
  const [capsules, setCapsules] = useState<Bug[]>([])
  const [selected, setSelected] = useState<Bug | null>(null)

  const load = useCallback(async () => setCapsules(await getCapsules()), [])
  useEffect(() => { load() }, [load, refreshKey])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bug capsule?')) return
    await deleteCapsule(id)
    if (selected?.id === id) setSelected(null)
    load()
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  if (selected) {
    return <CapsuleDetail capsule={selected} onBack={() => setSelected(null)} onDelete={() => handleDelete(selected.id)} />
  }

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
        Click <strong>🐛 Capture Bug</strong> in the header to capture a new bug. Saved capsules appear here.
      </p>
      {capsules.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🐛</div>
          <p>No bug capsules yet.</p>
          <p style={{ marginTop: 6, fontSize: 11 }}>Click "Capture Bug" while on any page.</p>
        </div>
      ) : (
        capsules.map(c => (
          <div key={c.id} className="capsule-row" onClick={() => setSelected(c)}>
            <span className={`sev-dot ${SEV_DOT[c.severity]}`} />
            <div className="capsule-info">
              <div className="capsule-title">{c.title}</div>
              <div className="capsule-meta">{c.url} · {fmtDate(c.createdAt)}</div>
            </div>
            <button className="btn-icon" title="Delete"
              onClick={e => { e.stopPropagation(); handleDelete(c.id) }}>🗑</button>
          </div>
        ))
      )}
    </div>
  )
}
