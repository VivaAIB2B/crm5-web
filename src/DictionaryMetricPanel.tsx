import { useEffect, useState } from 'react'
import { domainApi, domainMessage, type DictionaryView } from './domainApi'

type Selection = { key: string; column: string; currency: string; approved: boolean }
export default function DictionaryMetricPanel({ view, csrf, targetId, disabled, onlyMetric, onSaved, onDirtyChange, onBusyChange }: {
  view: DictionaryView; csrf: string; targetId?: string; disabled: boolean; onlyMetric?: string;
  onSaved: (v: DictionaryView) => void; onDirtyChange: (v: boolean) => void; onBusyChange: (v: boolean) => void
}) {
  const choices = () => view.metricLibrary?.metrics.filter(m => m.operation !== 'count').map(m => ({ key: m.key, column: m.column ?? '', currency: m.currency ?? '', approved: m.approved })) ?? []
  const [selections, setSelections] = useState<Selection[]>(choices), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false)
  useEffect(() => { setSelections(choices()); setError('') }, [view])
  const dirty = JSON.stringify(selections) !== JSON.stringify(choices())
  const needsConfirmation = selections.some(s => { const before = choices().find(x => x.key === s.key); return !s.approved && (s.column !== before?.column || s.currency !== before?.currency) })
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false) }, [busy, onBusyChange])
  function edit(key: string, values: Partial<Selection>) {
    setSelections(all => all.map(s => s.key !== key ? s : { ...s, ...values, ...(values.approved === undefined ? { approved: false } : {}) })); setError(''); setSaved(false)
  }
  async function save() {
    if (busy || !view.dictionary) return
    setBusy(true); setError(''); setSaved(false)
    try {
      const next = await domainApi<DictionaryView>('dictionary/metrics', csrf, targetId, { revision: view.dictionary.revision,
        metrics: selections.filter(s => s.approved).map(({ key, column, currency }) => ({ key, column, currency })) })
      onSaved(next); setSelections(next.metricLibrary?.metrics.filter(m => m.operation !== 'count').map(m => ({ key: m.key, column: m.column ?? '', currency: m.currency ?? '', approved: m.approved })) ?? []); setSaved(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'CRM5_ADMIN_OPERATION_FAILED') } finally { setBusy(false) }
  }
  if (!view.metricLibrary) return null
  return <div className="dictionary-metrics" aria-label="Metriche riutilizzabili">
    <h3>Metriche e modelli riutilizzabili</h3><p>Definisci la misura una volta. Le domande useranno gli stessi campi, calcoli e significati confermati.</p>
    {error && <div role="alert" className="domain-error"><p>{domainMessage(error)}</p><small>{error}</small></div>}
    {saved && <p role="status" className="notice">Metriche salvate nel Dizionario. Il modello è disponibile in Domande; la versione Live rimane separata.</p>}
    <fieldset disabled={busy || disabled}>
      {view.metricLibrary.metrics.filter(m => !onlyMetric || m.key === onlyMetric).map(m => {
        const selected = selections.find(s => s.key === m.key)
        const confirmed = m.approved && (m.operation === 'count' || selected?.approved && selected.column === m.column && selected.currency === m.currency)
        return <article className="dictionary-metric" key={m.key}><div className="section-heading"><h4>{m.label}</h4><span className={'domain-badge ' + (confirmed ? 'success' : '')}>{confirmed ? 'Confermata' : selected?.approved ? 'Da salvare' : 'Da preparare'}</span></div>
          <p>{m.definition}</p>
          {m.operation === 'count' ? <p>Conteggio degli ordini usando l’identità già confermata nel Core 5.</p> : selected && <>
            <p className="domain-note">Valore netto degli ordini, distinto dal fatturato contabile. Sono inclusi tutti gli stati e tutto lo storico. Gli importi devono essere espressi nella stessa valuta; il sistema non esegue conversioni.</p>
            <p>Fonte dell’ordine già confermata: <strong>{m.source ?? 'da confermare'}</strong></p>
            {m.issues.length > 0 && <ul>{m.issues.map(x => <li key={x}>{x}</li>)}</ul>}
            <div className="mapping-fields"><label>Campo importo netto<select aria-label="Campo importo netto" value={selected.column} onChange={e => edit(m.key, { column: e.target.value })}>
              <option value="">Scegli il campo importo</option>{m.columns.map(c => <option key={c}>{c}</option>)}</select></label>
              <label>Valuta aziendale degli importi<select aria-label="Valuta aziendale degli importi" value={selected.currency} onChange={e => edit(m.key, { currency: e.target.value })}>
                <option value="">Scegli la valuta verificata</option>{m.currencies.map(c => <option key={c}>{c}</option>)}</select></label></div>
            <small>Sono proposti solo campi decimali non nulli. Il nome di un campo non certifica il suo significato: conferma la fonte con le informazioni aziendali.</small>
            <label className="concept-confirm"><input type="checkbox" checked={selected.approved} disabled={!m.columns.includes(selected.column) || !m.currencies.includes(selected.currency) || m.issues.length > 0}
              onChange={e => edit(m.key, { approved: e.target.checked })} />Confermo il campo importo netto, tutti gli ordini e la stessa valuta aziendale per gli importi</label>
          </>}
        </article>
      })}
      {needsConfirmation && <p>Conferma il significato e la valuta prima di salvare i nuovi campi della metrica.</p>}
      {selections.length > 0 && <div className="actions"><button className="primary" type="button" disabled={!dirty || needsConfirmation} onClick={() => void save()}>Salva metriche nel Dizionario</button>
        {dirty && <button type="button" onClick={() => { setSelections(choices()); setError(''); setSaved(false) }}>Annulla modifiche alle metriche</button>}</div>}
    </fieldset>
    {disabled && <p>Conferma prima il Dizionario e salva le eventuali modifiche alle associazioni.</p>}
    {busy && <p role="status">Verifica e salvataggio delle metriche…</p>}
  </div>
}

