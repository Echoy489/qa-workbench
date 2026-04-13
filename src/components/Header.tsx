interface Props {
  onCaptureBug: () => void
  capturing: boolean
  recording?: boolean
}

export default function Header({ onCaptureBug, capturing, recording }: Props) {
  return (
    <header className="header">
      <span className="header-logo">🧪</span>
      <span className="header-title">
        QA Workbench <span>v1.1</span>
      </span>
      {recording && <span className="rec-pill">⏺ REC</span>}
      <button className="btn btn-danger btn-sm" onClick={onCaptureBug} disabled={capturing}>
        {capturing ? '⏳ Capturing…' : '🐛 Capture Bug'}
      </button>
    </header>
  )
}
