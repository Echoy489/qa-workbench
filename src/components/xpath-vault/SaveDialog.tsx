import { useState, useEffect } from 'react'
import { getProjects, addProject, addPage, addElement } from '../../store/xpathStore'
import type { CapturedXPathData, XPathProject, XPathCandidate, Confidence } from '../../shared/types'

interface Props {
  captured: CapturedXPathData
  onClose: () => void
  onSaved: () => void
}

function ConfidenceChip({ c }: { c: Confidence }) {
  const cls = c === 'high' ? 'conf-high' : c === 'medium' ? 'conf-med' : 'conf-low'
  const label = c === 'high' ? 'HIGH' : c === 'medium' ? 'MED' : 'LOW'
  return <span className={`conf-chip ${cls}`}>{label}</span>
}

function scoreBar(score: number) {
  const pct = `${score}%`
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626'
  return (
    <span className="score-bar-wrap" title={`Score: ${score}/100`}>
      <span className="score-bar" style={{ width: pct, background: color }} />
      <span className="score-num">{score}</span>
    </span>
  )
}

const stabilityBadge = (s: string) =>
  s === 'best' ? 'badge-best' : s === 'good' ? 'badge-good' : 'badge-fragile'

export default function SaveDialog({ captured, onClose, onSaved }: Props) {
  const [projects, setProjects] = useState<XPathProject[]>([])
  const [projectId, setProjectId] = useState('')
  const [newProject, setNewProject] = useState('')
  const [pageId, setPageId] = useState('')
  const [newPage, setNewPage] = useState('')
  const [name, setName] = useState('')
  const [selectedXPath, setSelectedXPath] = useState(captured.candidates[0]?.xpath ?? '')
  const [fallbackIds, setFallbackIds] = useState<Set<number>>(new Set())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProjects().then(ps => {
      setProjects(ps)
      if (ps.length > 0) {
        setProjectId(ps[0].id)
        if (ps[0].pages.length > 0) setPageId(ps[0].pages[0].id)
      }
    })
    const txt = captured.innerText
    const tag = captured.tagName
    if (txt) setName(txt.slice(0, 30))
    else setName(tag.charAt(0).toUpperCase() + tag.slice(1))
  }, [captured])

  const currentProject = projects.find(p => p.id === projectId)

  const toggleFallback = (i: number) => {
    setFallbackIds(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim() || !selectedXPath) return
    setSaving(true)
    try {
      let pId = projectId
      let pgId = pageId
      if (!pId && newProject.trim()) {
        const np = await addProject(newProject)
        pId = np.id
      }
      if (!pgId && newPage.trim() && pId) {
        const np = await addPage(pId, newPage)
        pgId = np.id
      }
      if (!pId || !pgId) { setSaving(false); return }

      const fallbacks = captured.candidates
        .filter((c, i) => c.xpath !== selectedXPath && fallbackIds.has(i))
        .map(c => c.xpath)

      await addElement(pId, pgId, {
        name: name.trim(),
        xpath: selectedXPath,
        candidates: captured.candidates as XPathCandidate[],
        fallbacks: fallbacks.length > 0 ? fallbacks : undefined,
        url: captured.url,
        pageTitle: captured.pageTitle,
        notes,
        attrSnapshot: captured.attrSnapshot,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          💾 Save XPath
          <button className="close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Login Button" autoFocus />
          </div>

          <div className="form-group">
            <label>Project</label>
            {projects.length > 0 ? (
              <select value={projectId} onChange={e => { setProjectId(e.target.value); setPageId('') }}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="">+ New project…</option>
              </select>
            ) : null}
            {(projectId === '' || projects.length === 0) && (
              <input type="text" value={newProject} onChange={e => setNewProject(e.target.value)}
                placeholder="New project name…" style={{ marginTop: 4 }} />
            )}
          </div>

          <div className="form-group">
            <label>Page</label>
            {currentProject && currentProject.pages.length > 0 ? (
              <select value={pageId} onChange={e => setPageId(e.target.value)}>
                {currentProject.pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="">+ New page…</option>
              </select>
            ) : null}
            {(pageId === '' || !currentProject || currentProject.pages.length === 0) && (
              <input type="text" value={newPage} onChange={e => setNewPage(e.target.value)}
                placeholder="New page name… e.g. LoginPage" style={{ marginTop: 4 }} />
            )}
          </div>

          <div className="form-group">
            <label>XPath — select primary</label>
            {captured.candidates.map((c, i) => {
              const isSelected = selectedXPath === c.xpath
              const isFallback = !isSelected && fallbackIds.has(i)
              return (
                <div key={i} className={`candidate${isSelected ? ' candidate-selected' : ''}`}>
                  <input type="radio" name="xpath" checked={isSelected}
                    onChange={() => { setSelectedXPath(c.xpath); setFallbackIds(new Set()) }} />
                  <div className="candidate-body">
                    <div className="candidate-label">
                      {c.label}
                      <span className={`badge ${stabilityBadge(c.stability)}`} style={{ marginLeft: 4 }}>
                        {c.stability}
                      </span>
                      {c.score && (
                        <>
                          {scoreBar(c.score.score)}
                          <ConfidenceChip c={c.score.confidence} />
                        </>
                      )}
                      {c.validationStatus && c.validationStatus !== 'unknown' && (
                        <span className={`vstatus vstatus-${c.validationStatus}`}>
                          {c.validationStatus === 'valid' ? `✓ ${c.matchCount}` :
                           c.validationStatus === 'ambiguous' ? `⚠ ${c.matchCount}` : '✗ broken'}
                        </span>
                      )}
                    </div>
                    <div className="candidate-xpath">{c.xpath}</div>
                    {c.score?.reasons && c.score.reasons.length > 0 && (
                      <div className="score-reasons">
                        {c.score.reasons.map((r, ri) => <span key={ri} className="score-reason">✓ {r}</span>)}
                      </div>
                    )}
                    {c.score?.warnings && c.score.warnings.length > 0 && (
                      <div className="score-reasons">
                        {c.score.warnings.map((w, wi) => <span key={wi} className="score-warn">⚠ {w}</span>)}
                      </div>
                    )}
                    {!isSelected && (
                      <label className="fallback-check">
                        <input type="checkbox" checked={isFallback} onChange={() => toggleFallback(i)} />
                        <span>Save as fallback</span>
                      </label>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this element…" rows={2} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : '✓ Save XPath'}
          </button>
        </div>
      </div>
    </div>
  )
}
