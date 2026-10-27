import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { clientApi, clientMessage, ClientApiError } from './clientApi'
import type { Catalog, ClientScope } from './clientApi'
import { customerResults } from './customerResults'
import { dictionaryResults } from './dictionaryResults'
import { chartRows, validParameter } from './workspaceModel'
import type { CapabilityDefinition, ParameterDefinition, PreparedQuestion, Project, QuestionDocument, QuestionPage, QuestionPresentation, QuestionSummary } from './workspaceModel'
import './workspace.css'
const ResultChart = lazy(() => import('./ResultChart'))
const CrmClient = lazy(() => import('./CrmClient'))
const date = (value: string) => new Date(value).toLocaleString('it-IT')
const states: Record<string, string> = { prepared: 'Preparata', executing: 'In esecuzione', completed: 'Completata', failed: 'Fallita', interrupted: 'Esito da verificare' }
type Props = { scope: ClientScope; csrf: string; database: string; packageReady: boolean; fixture: boolean; onReset: () => void }

function Parameters({ definitions, values, change, disabled }: { definitions: ParameterDefinition[]; values: Record<string, string>; change: (key: string, value: string) => void; disabled: boolean }) {
  return <div className="workspace-parameters">{definitions.map(p => <label key={p.name}>{p.label}
    {p.options ? <select aria-label={p.label} value={values[p.name] ?? ''} disabled={disabled} onChange={e => change(p.name, e.target.value)}>{p.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <input aria-label={p.label} type="number" step="1" min={p.minimum} max={p.maximum} value={values[p.name] ?? ''} disabled={disabled} onChange={e => change(p.name, e.target.value)} required/>}
    {p.minimumNonZero != null && <small>0 = tutti gli anni; altrimenti da {p.minimumNonZero} a {p.maximum}.</small>}
  </label>)}</div>
}
const strings = (values: Record<string, number>) => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)]))
const numbers = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)]))
function valid(definitions: ParameterDefinition[], values: Record<string, string>) {
  return definitions.every(p => values[p.name]?.trim() && validParameter(p, Number(values[p.name])))
}

export default function ClientWorkspace({ scope, csrf, database, packageReady, fixture, onReset }: Props) {
  const live = useRef(false), cancel = useRef(new AbortController()), lock = useRef(false), selection = useRef(0)
  const [projects, setProjects] = useState<Project[]>([]), [questions, setQuestions] = useState<QuestionSummary[]>([]), [next, setNext] = useState<QuestionPage['next']>(null)
  const [catalog, setCatalog] = useState<Catalog>(), [definition, setDefinition] = useState<CapabilityDefinition>(), [document, setDocument] = useState<QuestionDocument>()
  const [busy, setBusy] = useState(true), [error, setError] = useState<ClientApiError>(), [notice, setNotice] = useState(''), [temporary, setTemporary] = useState(false)
  const [projectTitle, setProjectTitle] = useState(''), [newTitle, setNewTitle] = useState(''), [newProject, setNewProject] = useState(''), [newValues, setNewValues] = useState<Record<string, string>>({})
  const [title, setTitle] = useState(''), [project, setProject] = useState(''), [values, setValues] = useState<Record<string, string>>({}), [presentation, setPresentation] = useState<QuestionPresentation>({ mode: 'table', chart: null })
  const [prepared, setPrepared] = useState<PreparedQuestion>(), [expired, setExpired] = useState(false)
  function api<T>(path: string, body?: object, id?: string, method?: string) { return clientApi<T>(path, body ? csrf : undefined, body, id, method, { ...scope, signal: cancel.current.signal }) }
  function apply(d: QuestionDocument) {
    setDocument(d); setTitle(d.identity.title); setProject(d.identity.projectId ?? ''); setValues(strings(d.definition?.defaults ?? {})); setPresentation(d.presentation ?? { mode: 'table', chart: null }); setPrepared(undefined)
  }
  function failed(e: unknown) {
    if (!live.current) return
    const issue = e instanceof ClientApiError ? e : new ClientApiError('CRM5_CLIENT_OPERATION_FAILED')
    setError(issue); setPrepared(undefined)
    if (issue.status === 401 || issue.status === 403 || issue.code.includes('CONTEXT_CHANGED')) { setDocument(undefined); setDefinition(undefined); setCatalog(undefined); setQuestions([]); setProjects([]) }
  }
  async function lists(more = false) {
    const cursor = more ? next : null
    const page = await api<QuestionPage>('saved-questions' + (cursor ? `?before=${encodeURIComponent(cursor.updatedAt)}&beforeId=${cursor.id}` : ''))
    if (live.current) { setQuestions(old => more ? [...old, ...page.items.filter(q => !old.some(v => v.id === q.id))] : page.items); setNext(page.next) }
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(undefined); setNotice('')
    try { await action() } catch (e) { failed(e) } finally { lock.current = false; if (live.current) setBusy(false) }
  }
  useEffect(() => {
    live.current = true; if (cancel.current.signal.aborted) cancel.current = new AbortController()
    let active = true
    setBusy(true)
    void (async () => {
      const [p, page] = await Promise.all([api<Project[]>('projects'), api<QuestionPage>('saved-questions')])
      if (!active) return
      setProjects(p); setQuestions(page.items); setNext(page.next)
      if (packageReady) { const c = await api<Catalog>('capabilities'); if (active) setCatalog(c) }
    })().catch(e => { if (active) failed(e) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false; live.current = false; cancel.current.abort() }
  }, [])
  useEffect(() => {
    setExpired(false)
    if (!prepared) return
    const timer = setTimeout(() => { setPrepared(undefined); setExpired(true) }, Math.max(0, Date.parse(prepared.expiresAt) - Date.now()))
    return () => clearTimeout(timer)
  }, [prepared])
  useEffect(() => {
    if (!document) return
    let active = true
    const recheck = () => {
      if (lock.current) return
      void api<QuestionDocument>(`saved-questions/${document.identity.id}`).then(d => { if (active && live.current && d.availability !== 'ready') apply(d) }).catch(e => { if (active) failed(e) })
    }
    window.addEventListener('focus', recheck)
    return () => { active = false; window.removeEventListener('focus', recheck) }
  }, [document?.identity.id])
  const dirty = Boolean(document?.definition && (title !== document.identity.title || project !== (document.identity.projectId ?? '') || JSON.stringify(numbers(values)) !== JSON.stringify(document.definition.defaults) || JSON.stringify(presentation) !== JSON.stringify(document.presentation)))
  const snapshot = document?.lastSuccessfulResult
  const resultView = useMemo(() => snapshot ? snapshot.result.dictionaryOutput ? dictionaryResults(snapshot.result.rows, snapshot.result.columns, snapshot.result.dictionaryOutput) : customerResults(snapshot.result.rows, snapshot.result.columns, snapshot.result.resultColumns ?? undefined) : undefined, [snapshot])
  const graphColumns = resultView?.chartColumns ?? resultView?.columns ?? []
  const graphRows = useMemo(() => resultView ? chartRows(resultView.rows, resultView.chartColumns ?? resultView.columns) : [], [resultView])
  const inProgress = document?.executions.some(e => e.status === 'executing') ?? false
  const latestAttempt = document?.executions.find(e => e.status !== 'prepared')

  async function chooseCapability(id: string) {
    const seq = ++selection.current; setDefinition(undefined)
    if (!id) return
    await run(async () => { const d = await api<CapabilityDefinition>(`capabilities/${id}/definition`); if (live.current && seq === selection.current) { setDefinition(d); setNewTitle(d.binding.name); setNewValues(strings(d.defaults)) } })
  }
  async function open(id: string) {
    await run(async () => { const d = await api<QuestionDocument>(`saved-questions/${id}`); if (live.current) apply(d) })
  }
  async function createProject() {
    await run(async () => { const p = await api<Project>('projects', { title: projectTitle.trim() }); if (live.current) { setProjects(old => [...old, p]); setProjectTitle(''); setNewProject(p.id); setNotice('Progetto personale creato.') } })
  }
  async function createQuestion() {
    if (!definition) return
    await run(async () => {
      const d = await api<QuestionDocument>('saved-questions', { capabilityId: definition.binding.capabilityId, expectedBindingHash: definition.binding.bindingHash, title: newTitle.trim(), projectId: newProject || null, defaults: numbers(newValues) })
      if (live.current) { apply(d); setDefinition(undefined); setNotice('Domanda salvata. Puoi preparare la prima esecuzione.'); await lists() }
    })
  }
  async function save() {
    if (!document) return
    await run(async () => { const d = await api<QuestionDocument>(`saved-questions/${document.identity.id}`, { expectedRevision: document.identity.revision, title: title.trim(), projectId: project || null, defaults: numbers(values), presentation }, undefined, 'PUT'); if (live.current) { apply(d); setNotice('Nuova revisione salvata.'); await lists() } })
  }
  async function prepare() {
    if (!document || dirty) return
    await run(async () => { const p = await api<PreparedQuestion>(`saved-questions/${document.identity.id}/preparations`, { expectedRevision: document.identity.revision }, crypto.randomUUID()); if (live.current) setPrepared(p) })
  }
  async function execute() {
    if (!document || !prepared || Date.parse(prepared.expiresAt) <= Date.now()) return
    const p = prepared; setPrepared(undefined)
    await run(async () => {
      try {
        const d = await api<QuestionDocument>(`saved-questions/${document.identity.id}/executions`, { preparationId: p.preparationId, expectedRevision: p.questionRevision, executionToken: p.executionToken }, crypto.randomUUID())
        if (live.current) { apply(d); setNotice('Nuovo risultato salvato.'); await lists() }
      } catch (e) {
        // Read only reconciliation: a lost response never causes a second execution.
        try { const d = await api<QuestionDocument>(`saved-questions/${document.identity.id}`); if (live.current) apply(d) } catch (readError) { failed(readError) }
        throw e
      }
    })
  }
  const projectSelect = (value: string, change: (s: string) => void, label: string) => <label>{label}<select aria-label={label} value={value} disabled={busy || Boolean(prepared)} onChange={e => change(e.target.value)}><option value="">Senza progetto</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
  if (temporary) return <><div className="crm-client"><button onClick={() => setTemporary(false)}>Torna alle domande salvate</button><p>La domanda libera resta temporanea e non modifica le domande salvate.</p></div><Suspense fallback={<p>Caricamento…</p>}><CrmClient scope={scope} onReset={onReset}/></Suspense></>
  return <div className="crm-client client-workspace"><header><div><p className="eyebrow">CRM5 · CLIENT</p><h1>Le tue domande</h1><p>Database: <strong>{database}</strong>. Ogni progetto organizza le domande per obiettivo.</p></div></header>
    {fixture && <p className="fixture-banner">DATI E AI SIMULATI · verifica del software, senza accesso al laboratorio.</p>}
    {!packageReady && <p role="status">Il catalogo di questo database deve essere preparato dal responsabile. Puoi organizzare i progetti e vedere le domande salvate.</p>}
    <div className="workspace-status" role="status" aria-live="polite">{busy ? 'Operazione in corso…' : notice}</div>
    {error && <div className="client-error" role="alert"><p>{clientMessage(error.code)}</p><details><summary>Codice per il supporto</summary>{error.code}</details><button onClick={onReset}>Ricarica il contesto database</button></div>}
    <main><aside><h2>Spazio personale</h2><p>I progetti non applicano filtri ai dati.</p><form onSubmit={e => { e.preventDefault(); void createProject() }}><label>Nome del progetto<input value={projectTitle} maxLength={160} required onChange={e => setProjectTitle(e.target.value)} disabled={busy}/></label><button disabled={busy || !projectTitle.trim()}>Crea progetto</button></form>
      {projects.length > 0 && <details><summary>Progetti ({projects.length})</summary><ul>{projects.map(p => <li key={p.id}>{p.title}</li>)}</ul></details>}
      <h2>Domande salvate</h2>{questions.length === 0 && !busy && <p>Non hai ancora domande in questo database.</p>}
      <ul className="workspace-questions">{questions.map(q => <li key={q.id}><button aria-current={document?.identity.id === q.id ? 'page' : undefined} disabled={busy} onClick={() => void open(q.id)}>{q.title}</button><small>{projects.find(p => p.id === q.projectId)?.title ?? 'Senza progetto'} · rev. {q.revision}</small></li>)}</ul>
      {next && <button disabled={busy} onClick={() => void run(() => lists(true))}>Carica altre domande</button>}
      {catalog && <><h2>Nuova domanda</h2><label>Capacità Live<select aria-label="Capacità Live" value={definition?.binding.capabilityId ?? ''} disabled={busy} onChange={e => void chooseCapability(e.target.value)}><option value="">Scegli una capacità</option>{catalog.capabilities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></>}
      {definition && <form onSubmit={e => { e.preventDefault(); void createQuestion() }}><p>{definition.definitions}</p><p>{definition.limitations}</p><label>Titolo nuova domanda<input value={newTitle} maxLength={160} onChange={e => setNewTitle(e.target.value)} disabled={busy} required/></label>{projectSelect(newProject, setNewProject, 'Progetto della nuova domanda')}<Parameters definitions={definition.parameters} values={newValues} disabled={busy} change={(k, v) => setNewValues(old => ({ ...old, [k]: v }))}/><button className="primary" disabled={busy || !newTitle.trim() || !valid(definition.parameters, newValues)}>Crea domanda</button></form>}
    </aside><section className="conversation">
      {!document ? <><h2>Una domanda da riutilizzare</h2><p>Scegli una capacità Live autorizzata, imposta i valori e salva la domanda, anche senza progetto. Ogni aggiornamento richiede una nuova conferma.</p></> : <>
        <h2>{document.identity.title}</h2><p>Revisione {document.identity.revision} · salvata il {date(document.identity.updatedAt)}</p>
        {document.availability !== 'ready' || !document.definition ? <p role="status">Capacità non disponibile con i permessi e la configurazione correnti. Criteri e risultati archiviati non sono accessibili. {document.diagnosticCode && clientMessage(document.diagnosticCode)}</p> : <>
          <form onSubmit={e => { e.preventDefault(); void save() }}><fieldset disabled={busy || Boolean(prepared) || inProgress}><legend>Definizione della domanda</legend><p>{document.definition.calculationDescription}</p><label>Titolo domanda<input value={title} maxLength={160} required onChange={e => setTitle(e.target.value)}/></label>{projectSelect(project, setProject, 'Progetto della domanda')}<Parameters definitions={document.definition.parameters} values={values} disabled={busy || Boolean(prepared) || inProgress} change={(k, v) => setValues(old => ({ ...old, [k]: v }))}/><label>Rappresentazione<select aria-label="Rappresentazione" value={presentation.mode} onChange={e => setPresentation(old => ({ ...old, mode: e.target.value as 'table' | 'chart' }))}><option value="table">Tabella</option><option value="chart">Tabella e grafico</option></select></label><button disabled={!dirty || !title.trim() || !valid(document.definition.parameters, values)}>Salva modifiche</button></fieldset></form>
          {dirty && <p role="status">Ci sono modifiche da salvare prima della preparazione.</p>}
          <button className="primary" disabled={busy || dirty || Boolean(prepared) || inProgress} onClick={() => void prepare()}>Prepara aggiornamento dati</button>
          <button disabled={busy} onClick={() => void open(document.identity.id)}>Verifica stato e riapri</button>
          {expired && <p role="status">La conferma è scaduta. Prepara un nuovo aggiornamento.</p>}
          {latestAttempt && ['failed', 'interrupted'].includes(latestAttempt.status) && <p className="client-error" role="status">L’ultimo tentativo del {date(latestAttempt.finishedAt ?? latestAttempt.preparedAt)} è {latestAttempt.status === 'failed' ? 'fallito' : 'da verificare'}. {snapshot ? 'È conservato l’ultimo risultato valido mostrato qui sotto.' : 'Non è ancora disponibile un risultato valido.'}</p>}
          {prepared && <article className="workspace-confirm"><h3>Conferma nuova esecuzione</h3><p>Revisione {prepared.questionRevision}. Nessun dato è stato ancora letto. Conferma valida fino al {date(prepared.expiresAt)}.</p><dl>{Object.entries(prepared.parameters).map(([k, v]) => <div key={k}><dt>{document.definition!.parameters.find(p => p.name === k)?.label ?? k}</dt><dd>{document.definition!.parameters.find(p => p.name === k)?.options?.find(o => o.value === v)?.label ?? v}</dd></div>)}</dl><button className="primary" disabled={busy} onClick={() => void execute()}>Conferma ed esegui</button><button disabled={busy} onClick={() => setPrepared(undefined)}>Annulla conferma</button></article>}
          {snapshot && resultView && <article className="workspace-result" aria-label="Ultimo risultato valido"><h3>Ultimo risultato valido · {snapshot.result.rowCount} righe</h3><p>Eseguito il <time dateTime={snapshot.executedAt}>{date(snapshot.executedAt)}</time> · revisione {snapshot.questionRevision}</p><p>Parametri del risultato: {Object.entries(snapshot.parameters).map(([k, v]) => `${k} = ${v}`).join(', ') || 'nessun parametro'}</p>{snapshot.questionRevision !== document.identity.revision && <p>Il risultato appartiene a una revisione precedente. Aggiorna per eseguire i criteri salvati correnti.</p>}<p>{document.definition.resultScope}</p>
            <div className="table-wrap"><table><caption>{document.identity.title}</caption><thead><tr>{resultView.columns.map(c => <th key={c.name} scope="col">{c.label}</th>)}</tr></thead><tbody>{resultView.rows.map((row, i) => <tr key={i}>{resultView.columns.map(c => <td key={c.name}>{row[c.name] == null ? '—' : String(row[c.name])}</td>)}</tr>)}</tbody></table></div>
            {presentation.mode === 'chart' && <Suspense fallback={<p>Caricamento grafico…</p>}><ResultChart data={graphRows} columns={graphColumns} horizontalCategories={resultView.details} preference={presentation.chart} onChange={(_, chart) => { if (!busy && !prepared && !inProgress) setPresentation(old => ({ ...old, chart })) }}/></Suspense>}
            <details><summary>Riferimenti del risultato</summary><p>Audit: {snapshot.result.requestId}</p><p>Package: {snapshot.result.semanticPackageVersion}</p><p>I numeri esatti sono conservati nella tabella. Il grafico è una rappresentazione delle sole righe restituite.</p></details>
          </article>}
          <details><summary>Percorso della domanda</summary><ul>{document.path.map((e, i) => <li key={`${e.id}-${i}`}>{date(e.at)} · {e.kind === 'execution' ? states[e.status] ?? e.status : e.kind === 'created' ? 'Domanda creata' : 'Revisione salvata'} · rev. {e.revision}{e.code && <> · {clientMessage(e.code)}</>}</li>)}</ul>{document.hasMoreActivity && <p>Sono mostrati gli ultimi 50 salvataggi e 50 tentativi. Lo storico completo non fa parte di questo incremento.</p>}</details>
        </>}
      </>}
    </section></main>
    {catalog && <footer><button disabled={busy} onClick={() => { setPrepared(undefined); setTemporary(true) }}>Apri domanda temporanea in linguaggio naturale</button></footer>}
  </div>
}

