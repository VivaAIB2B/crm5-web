import { useEffect, useState } from 'react'
import { domainApi, domainMessage, DomainApiError, type DictionaryView, type EntityBinding } from './domainApi'
import DictionaryExpansionDialog from './DictionaryExpansionDialog'
import DictionaryMaintenancePanel from './DictionaryMaintenancePanel'
import DictionaryMetricPanel from './DictionaryMetricPanel'

export default function DictionaryPanel({ csrf, targetId, disabled, onConfirmed, onDirtyChange, onBusyChange }: {
  csrf: string; targetId?: string; disabled: boolean; onConfirmed: () => void
  onDirtyChange: (value: boolean) => void; onBusyChange: (value: boolean) => void
}) {
  const [view, setView] = useState<DictionaryView | null>(null), [bindings, setBindings] = useState<EntityBinding[]>([])
  const [confirmed, setConfirmed] = useState<string[]>([]), [states, setStates] = useState<{ code: string; label: string }[]>([])
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [dirty, setDirty] = useState(false)
  const [maintenanceBusy, setMaintenanceBusy] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const [opened, setOpened] = useState('customer')
  const [metricsDirty, setMetricsDirty] = useState(false), [metricsBusy, setMetricsBusy] = useState(false)
  const [validationIssues, setValidationIssues] = useState<{ concept: string; message: string }[]>([])
  useEffect(() => onDirtyChange(dirty || metricsDirty), [dirty, metricsDirty, onDirtyChange])
  useEffect(() => onBusyChange(busy || metricsBusy || maintenanceBusy || expanding), [busy, metricsBusy, maintenanceBusy, expanding, onBusyChange])
  function receive(v: DictionaryView) { setView(v); setBindings(v.dictionary?.bindings ?? []); setConfirmed(v.dictionary?.confirmedConcepts ?? []); setStates(v.dictionary?.orderStates ?? []); setDirty(false) }
  useEffect(() => {
    const controller = new AbortController()
    domainApi<DictionaryView>('dictionary', csrf, targetId, undefined, controller.signal).then(receive)
      .catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [csrf, targetId])
  async function run(work: () => Promise<void>) { setBusy(true); setError(''); setValidationIssues([]); setNotice(''); try { await work() } catch (e) { setError(e instanceof Error ? e.message : 'CRM5_ADMIN_OPERATION_FAILED'); if (e instanceof DomainApiError) { setValidationIssues(e.issues); if (e.issues[0]) setOpened(e.issues[0].concept) } } finally { setBusy(false) } }
  function edit(entity: string, source?: string | null, key?: string, value?: string) {
    setBindings(old => old.map(b => b.entity !== entity ? b : source !== undefined ? {
      entity, source, attributes: view?.candidates[entity]?.find(c => c.source === source)?.suggestedAttributes ?? {},
    } : { ...b, attributes: Object.fromEntries(Object.entries({ ...b.attributes, [key!]: value! }).filter(([, v]) => v)) }))
    // A correction can change relationships across concepts. Require one fresh global review.
    setConfirmed([]); setValidationIssues([]); setDirty(true); setNotice('Associazione modificata. Ricontrolla i cinque concetti prima della conferma.')
  }
  function field(entity: string, key: string) {
    const e = view!.blueprint.entities.find(e => e.key === entity)!, a = e.attributes.find(a => a.key === key)!
    const binding = bindings.find(b => b.entity === entity), source = view!.candidates[entity]?.find(c => c.source === binding?.source)
    return <label key={entity + key}>{a.label}{a.required ? '' : ' (facoltativo)'}<select aria-label={e.label + ': ' + a.label}
      value={binding?.attributes[key] ?? ''} onChange={event => edit(entity, undefined, key, event.target.value)} disabled={!source}>
      <option value="">{a.required ? 'Scegli il campo' : 'Non disponibile / non necessario'}</option>
      {source?.columns.map(c => <option key={c}>{c}</option>)}
    </select></label>
  }
  const d = view?.dictionary, allConfirmed = view?.blueprint.concepts.every(c => confirmed.includes(c.key)) ?? false
  return <section className="dictionary-panel" aria-label="Dizionario Aziendale">
    <div className="section-heading"><div><p className="eyebrow">2 · SIGNIFICATO DEI DATI</p><h2>Dizionario Aziendale</h2></div>
      {d && <span className={'domain-badge ' + (d.confirmed && !dirty && view?.connectionMatches ? 'success' : '')}>{d.confirmed && !dirty && view?.connectionMatches ? 'Confermato' : 'Da confermare'} · revisione {d.revision}</span>}</div>
    <p>Conferma una volta i cinque concetti del modello Vendite. Le domande useranno queste definizioni.</p>
    {view?.fixture && <p className="domain-note">Ambiente di prova · metadati sintetici.</p>}
    {error && <div role="alert" className="error"><p>{domainMessage(error)}</p>{validationIssues.length > 0 && <ul>{validationIssues.map((issue, i) => <li key={i}>{issue.message}</li>)}</ul>}<small>{error}</small></div>}
    {notice && <p role="status" className="notice">{notice}</p>}
    {!view && !error && <p role="status">Apertura del Dizionario…</p>}
    <fieldset disabled={busy || disabled || metricsBusy || metricsDirty}>
      {view && <button type="button" className={d ? '' : 'primary'} onClick={() => void run(async () => {
        if (dirty && !window.confirm('Rileggere la struttura sostituirà le modifiche non salvate. Continuare?')) return
        receive(await domainApi<DictionaryView>('dictionary/load', csrf, targetId, { revision: d?.revision ?? 0, blueprintId: view.blueprint.id }))
        setNotice('Struttura letta. Controlla le associazioni proposte dai metadati; il loro significato richiede la tua conferma.')
      })}>{busy ? 'Lettura in corso…' : d ? 'Rileggi struttura del database' : 'Carica modello base Vendite'}</button>}
      {disabled && <p>Completa o salva il collegamento prima di lavorare sul Dizionario.</p>}
      {d && view && <>
        {!view.connectionMatches && <p role="alert" className="error">Il collegamento è cambiato. Rileggi la struttura prima di confermare.</p>}
        <div className="core-concepts">{view.blueprint.concepts.map((concept, index) => <details className="core-concept" key={concept.key} open={opened === concept.key} onToggle={event => { if (event.currentTarget.open) setOpened(concept.key) }}>
          <summary><span className={'concept-number ' + (confirmed.includes(concept.key) ? 'checked' : '')}>{confirmed.includes(concept.key) ? '✓' : index + 1}</span><strong>{concept.label}</strong><span>{confirmed.includes(concept.key) ? 'Confermato da te' : 'Da verificare'}</span></summary>
          <div className="concept-body"><p>{concept.description}</p>
            {concept.entities.map(entity => {
              const e = view.blueprint.entities.find(e => e.key === entity)!, binding = bindings.find(b => b.entity === entity)
              const candidates = view.candidates[entity] ?? []
              const fields = concept.fields.length ? concept.fields.filter(f => f.startsWith(entity + '.')).map(f => f.split('.')[1]) : e.attributes.map(a => a.key)
              const incomplete = e.required && (!binding?.source || fields.some(k => e.attributes.find(a => a.key === k)?.required && !binding.attributes[k]))
              return <div className="entity-mapping" key={entity}>
                <div className="mapping-proposal"><strong>{e.label}</strong><small>{binding?.source ?? (e.required ? 'Fonte da individuare' : 'Non disponibile nel database')}</small>
                  {binding?.source && <dl>{fields.map(key => <div key={key}><dt>{e.attributes.find(a => a.key === key)?.label}</dt><dd>{binding.attributes[key] ?? 'Non utilizzato'}</dd></div>)}</dl>}
                </div>
                <details className="mapping-correction" open={incomplete ? true : undefined}><summary>Controlla o correggi {e.label.toLowerCase()}</summary><label>Fonte di {e.label}{e.required ? '' : ' (facoltativa)'}<select aria-label={'Fonte ' + e.label}
                value={binding?.source ?? ''} onChange={event => edit(entity, event.target.value || null)}>
                <option value="">{e.required ? 'Nessuna proposta confermata' : 'Non presente nel database'}</option>
                {candidates.map(c => <option key={c.source}>{c.source}</option>)}</select></label>
                {binding?.source && <div className="mapping-fields">{fields.map(k => field(entity, k))}</div>}
                {!candidates.length && <p>Nessuna associazione sufficientemente chiara. Il modello richiede una revisione prima di proseguire.</p>}</details>
              </div>
            })}
            {!concept.entities.length && <div className="mapping-fields">{concept.fields.map(f => field(...f.split('.') as [string, string]))}</div>}
            {concept.key === 'status' && <details><summary>Descrizioni dei codici di stato (facoltative)</summary><p>Inserisci soltanto significati verificati sul tuo database. La classifica iniziale comprende tutti gli stati e non usa queste decodifiche come filtri.</p>
              {states.map((s, i) => <div className="lookup-row" key={i}><label>Codice<input aria-label={'Codice stato ' + (i + 1)} value={s.code} maxLength={30} onChange={e => { setStates(states.map((x, n) => n === i ? { ...x, code: e.target.value } : x)); setDirty(true); setConfirmed(confirmed.filter(k => k !== 'status')) }} /></label><label>Significato<input aria-label={'Significato stato ' + (i + 1)} value={s.label} maxLength={100} onChange={e => { setStates(states.map((x, n) => n === i ? { ...x, label: e.target.value } : x)); setDirty(true); setConfirmed(confirmed.filter(k => k !== 'status')) }} /></label><button type="button" onClick={() => { setStates(states.filter((_, n) => n !== i)); setDirty(true); setConfirmed(confirmed.filter(k => k !== 'status')) }}>Rimuovi</button></div>)}
              <button type="button" disabled={states.length >= 30} onClick={() => { setStates([...states, { code: '', label: '' }]); setDirty(true) }}>Aggiungi significato di stato</button>
            </details>}
            <label className="concept-confirm"><input type="checkbox" checked={confirmed.includes(concept.key)} onChange={e => {
              const next = e.target.checked ? [...confirmed, concept.key] : confirmed.filter(k => k !== concept.key)
              setConfirmed(next); setDirty(true)
              if (e.target.checked) setOpened(view.blueprint.concepts.find(c => !next.includes(c.key))?.key ?? concept.key)
            }} />Confermo il significato di {concept.label.toLowerCase()} e le associazioni mostrate</label>
          </div>
        </details>)}</div>
        {(view.blueprint.entities.filter(e => !view.blueprint.concepts.some(c => c.entities.includes(e.key))).length > 0 || view.blueprint.entities.some(e => e.attributes.some(a => a.key.startsWith('field_')))) && <details><summary>Campi ed entità aggiunti al Dizionario</summary>
          {view.blueprint.entities.map(e => { const extra = !view.blueprint.concepts.some(c => c.entities.includes(e.key)); const b = bindings.find(x => x.entity === e.key); return <div key={e.key}>{extra && <label>Fonte di {e.label}<select value={b?.source ?? ''} onChange={event => edit(e.key, event.target.value || null)}><option value="">Scegli…</option>{view.candidates[e.key]?.map(c => <option key={c.source}>{c.source}</option>)}</select></label>}{e.attributes.filter(a => extra || a.key.startsWith('field_')).map(a => field(e.key, a.key))}</div> })}
        </details>}
        {view.issues.length > 0 && !dirty && <div className="domain-note"><strong>Da completare</strong><ul>{view.issues.map((issue, i) => <li key={i}>{issue.message}</li>)}</ul></div>}
        <p className="domain-note">Le modifiche creano una revisione del Dizionario. La configurazione attiva nel Client rimane separata.</p>
        <div className="actions"><button type="button" disabled={!dirty || !view.connectionMatches} onClick={() => void run(async () => {
          receive(await domainApi<DictionaryView>('dictionary/save', csrf, targetId, { revision: d.revision, bindings, confirmedConcepts: confirmed, orderStates: states, confirm: false }))
          setNotice('Preparazione salvata. Puoi riprenderla più tardi; le domande non useranno questa revisione finché non sarà confermata.')
        })}>Salva preparazione</button><button className="primary" type="button" disabled={!allConfirmed || !view.connectionMatches} onClick={() => void run(async () => {
          receive(await domainApi<DictionaryView>('dictionary/save', csrf, targetId, { revision: d.revision, bindings, confirmedConcepts: confirmed, orderStates: states, confirm: true }))
          setNotice('Dizionario confermato e salvato. Puoi riaprire questa pagina e ritrovare le associazioni.'); onConfirmed()
        })}>Conferma e salva Dizionario</button></div>
      </>}
    </fieldset>
    {view && <DictionaryMaintenancePanel view={view} csrf={csrf} targetId={targetId} disabled={disabled || busy || dirty || metricsDirty || metricsBusy} onSaved={receive} onBusyChange={setMaintenanceBusy} />}
    {view?.dictionary?.confirmed && <button disabled={disabled || busy || dirty || metricsDirty || metricsBusy} onClick={() => setExpanding(true)}>Amplia Dizionario</button>}
    {expanding && <DictionaryExpansionDialog csrf={csrf} targetId={targetId} onClose={() => setExpanding(false)} onSaved={receive} />}
    {view?.dictionary && view.connectionMatches && <DictionaryMetricPanel view={view} csrf={csrf} targetId={targetId}
      disabled={disabled || busy || dirty || !view.dictionary.confirmed} onSaved={receive} onDirtyChange={setMetricsDirty} onBusyChange={setMetricsBusy} />}
  </section>
}

