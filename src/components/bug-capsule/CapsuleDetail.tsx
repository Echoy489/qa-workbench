import type { BugCapsule, ActionEvent, NetworkFailure } from '../../shared/types'

interface Props {
  capsule: BugCapsule
  onBack: () => void
  onDelete: () => void
}

const SEV_BADGE: Record<string, string> = {
  critical: 'badge-crit', high: 'badge-high', medium: 'badge-med', low: 'badge-low',
}

// ── HTML report generator ────────────────────────────────────────────────────
function generateHtmlReport(c: BugCapsule): string {
  const steps = c.steps.map((s, i) => `<li>${i + 1}. ${escHtml(s)}</li>`).join('')
  const errors = c.consoleErrors.map(e =>
    `<li style="color:#dc2626;font-family:monospace;font-size:12px">${escHtml(e)}</li>`
  ).join('')

  const netHtml = (c.networkFailures ?? []).map(f =>
    `<li style="font-family:monospace;font-size:12px">${f.status ? `[${f.status}] ` : ''}${escHtml(f.url)}</li>`
  ).join('')

  const timelineHtml = (c.actionTimeline ?? []).map((a, i) =>
    `<li>${i + 1}. ${escHtml(a.description)}</li>`
  ).join('')

  const env = c.environment
  const envHtml = env ? `
    <h2>Environment</h2>
    <div class="box">
      <strong>URL:</strong> ${escHtml(env.url)}<br>
      <strong>Browser:</strong> ${escHtml(env.browser)} / ${escHtml(env.os)}<br>
      <strong>Viewport:</strong> ${env.viewport.width}×${env.viewport.height} @ ${env.devicePixelRatio}x<br>
      <strong>Language:</strong> ${escHtml(env.language)}<br>
      <strong>Online:</strong> ${env.online ? 'Yes' : 'No'}<br>
      <strong>Captured:</strong> ${new Date(env.timestamp).toLocaleString()}
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Bug Report: ${escHtml(c.title)}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#0f172a}
  h1{font-size:22px;margin-bottom:4px}
  .meta{color:#64748b;font-size:13px;margin-bottom:20px}
  .badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:700}
  .critical{background:#fee2e2;color:#dc2626}
  .high{background:#ffedd5;color:#c2410c}
  .medium{background:#fef9c3;color:#a16207}
  .low{background:#dcfce7;color:#15803d}
  img{width:100%;border:1px solid #e2e8f0;border-radius:6px;margin:12px 0}
  h2{font-size:15px;margin:20px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  ul{padding-left:20px;font-size:13px;line-height:1.8}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:8px}
  .box.actual{border-color:#fecaca;background:#fef2f2}
</style>
</head>
<body>
  <h1>🐛 ${escHtml(c.title)}</h1>
  <div class="meta">
    <span class="badge ${c.severity}">${c.severity.toUpperCase()}</span>
    &nbsp; ${escHtml(c.url)} &nbsp;|&nbsp; ${escHtml(c.browser)} / ${escHtml(c.os)}
    &nbsp;|&nbsp; ${new Date(c.createdAt).toLocaleString()}
  </div>

  ${c.screenshotDataUrl ? `<img src="${c.screenshotDataUrl}" alt="Screenshot">` : ''}
  ${envHtml}
  ${c.preconditions ? `<h2>Preconditions</h2><div class="box">${escHtml(c.preconditions)}</div>` : ''}

  <h2>Steps to Reproduce</h2>
  <ul>${steps || '<li>No steps recorded</li>'}</ul>

  <h2>Expected</h2>
  <div class="box">${escHtml(c.expected) || '—'}</div>

  <h2>Actual</h2>
  <div class="box actual">${escHtml(c.actual) || '—'}</div>

  ${c.consoleErrors.length > 0 ? `<h2>Console Errors</h2><ul>${errors}</ul>` : ''}
  ${netHtml ? `<h2>Network Failures</h2><ul>${netHtml}</ul>` : ''}
  ${timelineHtml ? `<h2>Action Timeline (last 10)</h2><ul>${timelineHtml}</ul>` : ''}
  ${c.notes ? `<h2>Notes</h2><div class="box">${escHtml(c.notes)}</div>` : ''}
</body>
</html>`
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Plain text generator ─────────────────────────────────────────────────────
function generatePlainText(c: BugCapsule): string {
  const env = c.environment
  const lines = [
    `BUG: ${c.title}`,
    `Severity: ${c.severity.toUpperCase()}`,
    `URL: ${c.url}`,
    `Browser: ${c.browser} / ${c.os}`,
    env ? `Viewport: ${env.viewport.width}×${env.viewport.height}` : '',
    `Date: ${new Date(c.createdAt).toLocaleString()}`,
    c.preconditions ? `\nPRECONDITIONS:\n${c.preconditions}` : '',
    c.steps.length > 0
      ? `\nSTEPS TO REPRODUCE:\n${c.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : '',
    c.expected ? `\nEXPECTED:\n${c.expected}` : '',
    c.actual ? `\nACTUAL:\n${c.actual}` : '',
    c.notes ? `\nNOTES:\n${c.notes}` : '',
    c.consoleErrors.length > 0
      ? `\nCONSOLE ERRORS:\n${c.consoleErrors.join('\n')}`
      : '',
    (c.networkFailures ?? []).length > 0
      ? `\nNETWORK FAILURES:\n${(c.networkFailures as NetworkFailure[]).map(f => `${f.status ? `[${f.status}] ` : ''}${f.url}`).join('\n')}`
      : '',
    (c.actionTimeline ?? []).length > 0
      ? `\nACTION TIMELINE:\n${(c.actionTimeline as ActionEvent[]).map((a, i) => `${i + 1}. ${a.description}`).join('\n')}`
      : '',
  ]
  return lines.filter(Boolean).join('\n')
}

// ── Component ────────────────────────────────────────────────────────────────
export default function CapsuleDetail({ capsule: c, onBack, onDelete }: Props) {
  const fmtDate = (iso: string) => new Date(iso).toLocaleString()

  const exportHtml = () => {
    const html = generateHtmlReport(c)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bug-${c.title.slice(0, 30).replace(/\s+/g, '-').toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyAll = async () => {
    const html = generateHtmlReport(c)
    const plain = generatePlainText(c)
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        })
      ])
    } catch {
      await navigator.clipboard.writeText(plain)
    }
  }

  const timeline = c.actionTimeline ?? []
  const netFails = c.networkFailures ?? []
  const env = c.environment

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={copyAll}
          title="Copy everything incl. screenshot">📋 Copy all</button>
        <button className="btn btn-primary btn-sm" onClick={exportHtml}>⬇ HTML</button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>🗑</button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className={`badge ${SEV_BADGE[c.severity]}`}>{c.severity.toUpperCase()}</span>
          <strong style={{ fontSize: 13 }}>{c.title}</strong>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>🌐 {c.url}</span>
          <span>🖥 {c.browser}</span>
          <span>💻 {c.os}</span>
          <span>🕐 {fmtDate(c.createdAt)}</span>
          {env && <span>📐 {env.viewport.width}×{env.viewport.height}</span>}
        </div>
      </div>

      {c.screenshotDataUrl && (
        <img src={c.screenshotDataUrl} className="screenshot" alt="Screenshot" />
      )}

      {c.preconditions && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Preconditions</label>
          <div className="card" style={{ fontSize: 12, background: '#fffbeb', borderColor: '#fde68a' }}>
            {c.preconditions}
          </div>
        </div>
      )}

      {c.steps.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Steps to Reproduce</label>
          <ol style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.8 }}>
            {c.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}

      {c.expected && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>EXPECTED</div>
          <div style={{ fontSize: 12 }}>{c.expected}</div>
        </div>
      )}

      {c.actual && (
        <div className="card" style={{ marginBottom: 8, borderColor: '#fecaca', background: '#fef2f2' }}>
          <div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 3 }}>ACTUAL</div>
          <div style={{ fontSize: 12 }}>{c.actual}</div>
        </div>
      )}

      {c.consoleErrors.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Console Errors ({c.consoleErrors.length})</label>
          <div className="console-errors">
            {c.consoleErrors.map((e, i) => <div key={i} className="console-err-item">{e}</div>)}
          </div>
        </div>
      )}

      {netFails.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Network Failures ({netFails.length})</label>
          <div className="console-errors">
            {netFails.map((f, i) => (
              <div key={i} className="console-err-item network-fail">
                {f.status ? <strong>[{f.status}]</strong> : null} {f.url}
              </div>
            ))}
          </div>
        </div>
      )}

      {timeline.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Action Timeline ({timeline.length} events)</label>
          <div className="console-errors" style={{ maxHeight: 120 }}>
            {timeline.map((a, i) => (
              <div key={i} className="console-err-item timeline-item">
                <span className="timeline-type">{a.type}</span> {a.description}
              </div>
            ))}
          </div>
        </div>
      )}

      {c.notes && (
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>NOTES</div>
          <div style={{ fontSize: 12 }}>{c.notes}</div>
        </div>
      )}
    </div>
  )
}
