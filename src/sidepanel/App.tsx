import { useState, useEffect, useCallback, useRef } from 'react'
import Header from '../components/Header'
import XPathVault from '../components/xpath-vault/XPathVault'
import BugCapsule from '../components/bug-capsule/BugCapsule'
import StepRecorder from '../components/step-recorder/StepRecorder'
import SaveDialog from '../components/xpath-vault/SaveDialog'
import CaptureForm from '../components/bug-capsule/CaptureForm'
import type { CapturedXPathData, CapturedBugData, RecordedStep } from '../shared/types'

type Tab = 'xpath' | 'bugs' | 'recorder'

export default function App() {
  const [tab, setTab] = useState<Tab>('xpath')
  const [inspectMode, setInspectMode] = useState(false)
  const [capturedXPath, setCapturedXPath] = useState<CapturedXPathData | null>(null)
  const [capturedBug, setCapturedBug] = useState<CapturedBugData | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [xpathRefresh, setXpathRefresh] = useState(0)
  const [bugRefresh, setBugRefresh] = useState(0)
  const [recorderRefresh, setRecorderRefresh] = useState(0)

  // Recording state
  const [recording, setRecording] = useState(false)
  const [liveSteps, setLiveSteps] = useState<RecordedStep[]>([])
  const stepCounterRef = useRef(0)

  // Steps to pre-fill from a recording into the next bug capture
  const [pendingSteps, setPendingSteps] = useState<string[] | null>(null)

  useEffect(() => {
    const handler = (msg: { type: string; payload?: unknown }) => {
      if (msg.type === 'XPATH_CAPTURED') {
        setCapturedXPath(msg.payload as CapturedXPathData)
        setInspectMode(false)
        setTab('xpath')
      } else if (msg.type === 'INSPECT_CANCELLED') {
        setInspectMode(false)
      } else if (msg.type === 'RECORDING_STEP') {
        const step = msg.payload as RecordedStep
        stepCounterRef.current += 1
        setLiveSteps(prev => [...prev, { ...step, stepNumber: stepCounterRef.current }])
      } else if (msg.type === 'RECORDING_STOPPED') {
        setRecording(false)
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  const handleInspect = useCallback(async () => {
    if (inspectMode) {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (t?.id) chrome.tabs.sendMessage(t.id, { type: 'DEACTIVATE_INSPECT_MODE' }).catch(() => {})
      setInspectMode(false)
    } else {
      chrome.runtime.sendMessage({ type: 'ACTIVATE_INSPECT_MODE' })
      setInspectMode(true)
    }
  }, [inspectMode])

  const handleCaptureBug = useCallback(async () => {
    setCapturing(true)
    try {
      const res = await chrome.runtime.sendMessage({ type: 'CAPTURE_BUG' })
      if (res?.ok && res.data) {
        setCapturedBug(res.data as CapturedBugData)
        setTab('bugs')
      }
    } finally {
      setCapturing(false)
    }
  }, [])

  const handleStartRecording = useCallback(async () => {
    const res = await chrome.runtime.sendMessage({ type: 'START_RECORDING' })
    if (res?.ok !== false) {
      setLiveSteps([])
      stepCounterRef.current = 0
      setRecording(true)
    }
  }, [])

  const handleStopRecording = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' })
    setRecording(false)
  }, [])

  const handleUseInBug = useCallback(async (steps: string[]) => {
    // Store steps and trigger a bug capture, then CaptureForm will receive them
    setPendingSteps(steps)
    await handleCaptureBug()
  }, [handleCaptureBug])

  return (
    <div className="app">
      <Header onCaptureBug={handleCaptureBug} capturing={capturing} recording={recording} />
      <nav className="tab-nav">
        <button className={`tab-btn${tab === 'xpath' ? ' active' : ''}`} onClick={() => setTab('xpath')}>
          🔬 XPath Vault
        </button>
        <button className={`tab-btn${tab === 'bugs' ? ' active' : ''}`} onClick={() => setTab('bugs')}>
          🐛 Evidence
        </button>
        <button className={`tab-btn${tab === 'recorder' ? ' active' : ''}`} onClick={() => setTab('recorder')}>
          🎬 Recorder
        </button>
      </nav>
      <div className="tab-content">
        {tab === 'xpath' && (
          <XPathVault
            inspectMode={inspectMode}
            onInspectToggle={handleInspect}
            refreshKey={xpathRefresh}
          />
        )}
        {tab === 'bugs' && <BugCapsule refreshKey={bugRefresh} />}
        {tab === 'recorder' && (
          <StepRecorder
            recording={recording}
            liveSteps={liveSteps}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onUseInBug={handleUseInBug}
            refreshKey={recorderRefresh}
          />
        )}
      </div>

      {capturedXPath && (
        <SaveDialog
          captured={capturedXPath}
          onClose={() => setCapturedXPath(null)}
          onSaved={() => {
            setCapturedXPath(null)
            setXpathRefresh(k => k + 1)
          }}
        />
      )}
      {capturedBug && (
        <CaptureForm
          captured={capturedBug}
          onClose={() => { setCapturedBug(null); setPendingSteps(null) }}
          onSaved={() => {
            setCapturedBug(null)
            setPendingSteps(null)
            setBugRefresh(k => k + 1)
          }}
          initialSteps={pendingSteps ?? undefined}
        />
      )}
    </div>
  )
}
