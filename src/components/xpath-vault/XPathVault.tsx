import { useState, useEffect, useCallback } from 'react'
import {
  getProjects, addProject, deleteProject, deletePage, deleteElement,
  updateElementValidation,
} from '../../store/xpathStore'
import type { XPathProject, XPathPage, XPathElement, XPathValidationStatus } from '../../shared/types'

// ── Local export helpers (pure — no DOM needed) ───────────────────────────────
function toCSharpId(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/(?:^|\s+)(.)/g, (_, c: string) => c.toUpperCase()) || 'Element'
}

function exportCSharpProperty(name: string, xpath: string, fallbacks?: string[]): string {
  const prop = toCSharpId(name)
  const escaped = xpath.replace(/"/g, '\\"')
  let code = `public IWebElement ${prop} => _driver.FindElement(By.XPath("${escaped}"));`
  if (fallbacks && fallbacks.length > 0) {
    const fb = fallbacks.map(f => `//   ${f.replace(/"/g, '\\"')}`).join('\n')
    code = `// Fallback XPaths (in priority order):\n${fb}\n${code}`
  }
  return code
}

function exportPageClass(pageName: string, elements: XPathElement[]): string {
  const cls = toCSharpId(pageName) || 'Page'
  const props = elements.map(el => {
    const prop = toCSharpId(el.name)
    const escaped = el.xpath.replace(/"/g, '\\"')
    return `    public IWebElement ${prop} => _driver.FindElement(By.XPath("${escaped}"));`
  }).join('\n')
  return [
    `public class ${cls}`,
    `{`,
    `    private readonly IWebDriver _driver;`,
    ``,
    `    public ${cls}(IWebDriver driver) => _driver = driver;`,
    ``,
    props,
    `}`,
  ].join('\n')
}

interface Props {
  inspectMode: boolean
  onInspectToggle: () => void
  refreshKey: number
}

function StatusDot({ status }: { status?: XPathValidationStatus }) {
  if (!status || status === 'unknown') return null
  const cls = status === 'valid' ? 'dot-valid'
    : status === 'ambiguous' ? 'dot-warn'
    : 'dot-broken'
  const title = status === 'valid' ? 'Valid — unique match'
    : status === 'ambiguous' ? 'Ambiguous — multiple matches'
    : 'Broken — no matches'
  return <span className={`status-dot ${cls}`} title={title} />
}

export default function XPathVault({ inspectMode, onInspectToggle, refreshKey }: Props) {
  const [projects, setProjects] = useState<XPathProject[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [newProject, setNewProject] = useState('')
  const [adding, setAdding] = useState(false)
  const [revalidating, setRevalidating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setProjects(await getProjects())
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const handleAddProject = async () => {
    if (!newProject.trim()) return
    await addProject(newProject)
    setNewProject(''); setAdding(false)
    load()
  }

  const handleDeleteEl = async (pId: string, pgId: string, elId: string) => {
    if (!confirm('Delete this XPath?')) return
    await deleteElement(pId, pgId, elId); load()
  }

  const handleDeletePage = async (pId: string, pgId: string) => {
    if (!confirm('Delete this page and all its XPaths?')) return
    await deletePage(pId, pgId); load()
  }

  const handleDeleteProject = async (pId: string) => {
    if (!confirm('Delete this project and all its data?')) return
    await deleteProject(pId); load()
  }

  const copyXPath = (xpath: string) => navigator.clipboard.writeText(xpath)

  const copyPOM = (el: XPathElement) => {
    navigator.clipboard.writeText(exportCSharpProperty(el.name, el.xpath, el.fallbacks))
  }

  const exportPageClassFile = (proj: XPathProject, page: XPathPage) => {
    const code = exportPageClass(page.name, page.elements)
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${page.name}.cs`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleRevalidate = async (pId: string, pgId: string, el: XPathElement) => {
    setRevalidating(el.id)
    try {
      const xpaths = [el.xpath, ...(el.fallbacks ?? [])]
        .concat(el.candidates.map(c => c.xpath))
        .filter((v, i, a) => a.indexOf(v) === i) // deduplicate

      const res = await chrome.runtime.sendMessage({
        type: 'VALIDATE_XPATHS',
        payload: { xpaths },
      }) as { results?: { xpath: string; matchCount: number; status: string }[] }

      if (res?.results) {
        await updateElementValidation(pId, pgId, el.id, res.results as import('../../shared/types').ValidationResult[])
        await load()
      }
    } finally {
      setRevalidating(null)
    }
  }

  const q = search.toLowerCase()
  const filtered = projects.map(proj => ({
    ...proj,
    pages: proj.pages.map(page => ({
      ...page,
      elements: page.elements.filter(el =>
        !q || el.name.toLowerCase().includes(q) || el.xpath.toLowerCase().includes(q)
      )
    })).filter(page => !q || page.elements.length > 0 || page.name.toLowerCase().includes(q))
  })).filter(proj => !q || proj.pages.length > 0 || proj.name.toLowerCase().includes(q))

  const total = projects.reduce((a, p) => a + p.pages.reduce((b, pg) => b + pg.elements.length, 0), 0)

  return (
    <div>
      {inspectMode ? (
        <div className="inspect-banner">
          <span className="pulse" />
          <span style={{ flex: 1 }}>Inspect mode active — click any element on the page</span>
          <button className="btn btn-ghost btn-sm" onClick={onInspectToggle}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onInspectToggle}>
            🔍 Activate Inspect
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          type="text" placeholder="Search XPaths…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex: 1 }}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => setAdding(a => !a)}>+ Project</button>
      </div>

      {adding && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input type="text" placeholder="Project name…" value={newProject}
            onChange={e => setNewProject(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddProject()}
            autoFocus style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleAddProject}>Add</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>✕</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🗂️</div>
          <p>{total === 0 ? 'No XPaths saved yet.' : 'No results.'}</p>
          {total === 0 && (
            <p style={{ marginTop: 6, fontSize: 11 }}>
              Click "Activate Inspect" then click any element on the page.
            </p>
          )}
        </div>
      ) : (
        filtered.map(proj => (
          <div key={proj.id} style={{ marginBottom: 4 }}>
            <div className="tree-project" onClick={() => toggle(proj.id)}>
              <span>{expanded[proj.id] ? '▾' : '▸'}</span>
              <span style={{ flex: 1, fontSize: 12 }}>📁 {proj.name}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                {proj.pages.reduce((a, p) => a + p.elements.length, 0)} items
              </span>
              <button className="btn-icon" style={{ fontSize: 11 }}
                onClick={e => { e.stopPropagation(); handleDeleteProject(proj.id) }}>🗑</button>
            </div>

            {expanded[proj.id] && proj.pages.map(page => (
              <div key={page.id}>
                <div className="tree-page" onClick={() => toggle(page.id)}>
                  <span>{expanded[page.id] ? '▾' : '▸'}</span>
                  <span style={{ flex: 1, fontSize: 12 }}>📄 {page.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{page.elements.length}</span>
                  <button className="btn-icon" title="Export .cs" style={{ fontSize: 11 }}
                    onClick={e => { e.stopPropagation(); exportPageClassFile(proj, page) }}>⬇</button>
                  <button className="btn-icon" style={{ fontSize: 11 }}
                    onClick={e => { e.stopPropagation(); handleDeletePage(proj.id, page.id) }}>🗑</button>
                </div>

                {expanded[page.id] && page.elements.map(el => (
                  <div key={el.id} className="tree-element">
                    <StatusDot status={el.validationStatus} />
                    <span className="el-name" title={el.xpath}>
                      {el.name}
                    </span>
                    <div className="el-actions">
                      <button className="btn-icon btn-sm" title="Copy XPath"
                        onClick={() => copyXPath(el.xpath)}>📋</button>
                      <button className="btn-icon btn-sm" title="Copy C# POM property"
                        onClick={() => copyPOM(el)}>🔷</button>
                      <button className="btn-icon btn-sm"
                        title="Revalidate against current page"
                        disabled={revalidating === el.id}
                        onClick={() => handleRevalidate(proj.id, page.id, el)}>
                        {revalidating === el.id ? '⏳' : '↻'}
                      </button>
                      <button className="btn-icon btn-sm" title="Delete"
                        onClick={() => handleDeleteEl(proj.id, page.id, el.id)}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
