import { useEffect, useRef, useState } from 'react'
import type { DictionaryView } from './domainApi'
import DictionaryMetricPanel from './DictionaryMetricPanel'

export default function MetricSetupDialog({ view, metricKey, csrf, targetId, blocked, onSaved, onClose, onBusyChange, onDirtyChange }: {
  view: DictionaryView; metricKey: string; csrf: string; targetId?: string; blocked: boolean; onSaved: (v: DictionaryView) => void;
  onClose: () => void; onBusyChange: (v: boolean) => void; onDirtyChange: (v: boolean) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false)
  useEffect(() => { const node = dialog.current!; node.showModal(); return () => node.close() }, [])
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false) }, [busy, onBusyChange])
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])
  function close() { if (!busy && !blocked && (!dirty || window.confirm('Ci sono modifiche alla metrica non salvate. Chiudere?'))) onClose() }
  return <dialog ref={dialog} className="metric-setup-dialog" aria-label="Prepara la metrica del modello" onCancel={e => { e.preventDefault(); close() }}>
    <h2>Prepara la metrica del modello</h2><p>Completa questo significato nel Dizionario senza lasciare la domanda. Le cinque conferme di base sono conservate.</p>
    <DictionaryMetricPanel view={view} onlyMetric={metricKey} csrf={csrf} targetId={targetId} disabled={blocked || !view.dictionary?.confirmed || !view.connectionMatches}
      onSaved={onSaved} onDirtyChange={setDirty} onBusyChange={setBusy} />
    <button type="button" disabled={busy || blocked} onClick={close}>Torna alla domanda</button>
  </dialog>
}

