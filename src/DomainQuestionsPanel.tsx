import { useEffect, useState } from 'react'
import { domainApi, domainMessage, type DomainQuestion, type QuestionWorkspace, type DictionaryView, type RuntimeAccessReview } from './domainApi'
import QuestionPublicationTools from './QuestionPublicationTools'
import QuestionParameterFields, { defaultParameters } from './QuestionParameterFields'
import type { QuestionParameters } from './domainApi'
import DictionaryExpansionDialog from './DictionaryExpansionDialog'
import MetricSetupDialog from './MetricSetupDialog'
import type { Result } from './clientApi'
import { dictionaryResults } from './dictionaryResults'

type Step = 'chat' | 'requirements' | 'preparation' | 'test' | 'publication'
const steps: { key: Step; label: string }[] = [{ key: 'chat', label: 'Chat' }, { key: 'requirements', label: 'Requisiti' },
  { key: 'preparation', label: 'Preparazione' }, { key: 'test', label: 'Test' }, { key: 'publication', label: 'Pubblicazione' }]
const eventNames: Record<string, string> = { chat: 'Conversazione aggiornata', 'dictionary-expanded': 'Definizione del Dizionario aggiornata', 'requirements-confirmed': 'Requisiti confermati', prepared: 'Bozza preparata', tested: 'Test controllato', published: 'Pubblicazione' }
const permissionStages: Record<string, string> = { connection: 'apertura del collegamento', checks: 'controlli del database prima della query', columns: 'verifica SELECT sulle colonne richieste', query: 'esecuzione della query certificata' }
function nextStep(q: DomainQuestion): Step {
  if (q.candidate?.testResult === 'PASS') return 'publication'
  if (q.candidate) return 'test'
  if (q.requirementsConfirmed) return 'preparation'
  return q.proposal?.status === 'ready' ? 'requirements' : 'chat'
}
export default function DomainQuestionsPanel({ csrf, targetId, onConnections, onUsers, onBusyChange, onDirtyChange }: {
  csrf: string; targetId?: string; onConnections: () => void; onUsers: () => void; onBusyChange: (v: boolean) => void; onDirtyChange: (v: boolean) => void
}) {
  const [workspace, setWorkspace] = useState<QuestionWorkspace>(), [active, setActive] = useState<DomainQuestion>()
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [step, setStep] = useState<Step>('chat'), [outputs, setOutputs] = useState<string[]>([]), [topN, setTopN] = useState(10), [preview, setPreview] = useState<Result>()
  const [metricSetup, setMetricSetup] = useState<{ view: DictionaryView; key: string }>(), [metricBusy, setMetricBusy] = useState(false), [metricDirty, setMetricDirty] = useState(false)
  const [publicationBusy, setPublicationBusy] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const [parameters, setParameters] = useState<QuestionParameters>(defaultParameters)
  const [publicationReview, setPublicationReview] = useState<{ related: { id: string; name: string; ready: boolean }[] }>()
  const [sandbox, setSandbox] = useState<{ firstPublication: boolean; approved: boolean; contextHash: string; required: { objects: string[]; columns: string[]; relations: string[] } }>()
  const [runtimeAccess, setRuntimeAccess] = useState<RuntimeAccessReview>()
  const api = <T,>(path: string, body?: unknown, signal?: AbortSignal) => domainApi<T>(path, csrf, targetId, body, signal)
  useEffect(() => { const controller = new AbortController(); void api<QuestionWorkspace>('questions', undefined, controller.signal).then(setWorkspace).catch(e => { if (!controller.signal.aborted) setError(e.message) }); return () => controller.abort() }, [])
  useEffect(() => { onBusyChange(busy || metricBusy || publicationBusy || expanding); return () => onBusyChange(false) }, [busy, metricBusy, publicationBusy, expanding, onBusyChange])
  const edited = Boolean(active && JSON.stringify(parameters) !== JSON.stringify(active.parameters ?? defaultParameters)) || metricDirty || message.length > 0 || Boolean(active && (outputs.join('|') !== active.outputs.join('|') || active.topN !== null && topN !== active.topN))
  useEffect(() => { onDirtyChange(edited); return () => onDirtyChange(false) }, [edited, onDirtyChange])
  function show(q?: DomainQuestion) { setParameters(q?.parameters ?? defaultParameters); setActive(q); setOutputs(q?.outputs ?? []); setTopN(q?.topN ?? 10); setStep(q ? nextStep(q) : 'chat'); setPreview(undefined); setRuntimeAccess(undefined); setSandbox(undefined); setPublicationReview(undefined); setMessage(''); setError(''); setNotice('') }
  function select(q?: DomainQuestion) { if (!edited || window.confirm('Ci sono modifiche non salvate. Continuare?')) show(q) }
  function received(q: DomainQuestion) { setParameters(q.parameters ?? defaultParameters); setActive(q); setOutputs(q.outputs); setTopN(q.topN ?? 10); setWorkspace(w => w ? { ...w, questions: [q, ...w.questions.filter(x => x.id !== q.id)] } : w) }
  async function run(work: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); setNotice(''); try { await work() } catch (e) { setError(e instanceof Error ? e.message : 'CRM5_ADMIN_OPERATION_FAILED') } finally { setBusy(false) } }
  async function chat(text = message.trim()) { if (!text) return; await run(async () => {
    const q = await api<DomainQuestion>('questions/chat', { id: active?.id ?? crypto.randomUUID(), revision: active?.revision ?? 0, requestId: crypto.randomUUID(), message: text })
    received(q); setMessage(''); setPreview(undefined); setStep(nextStep(q))
  }) }
  async function action(name: 'confirm' | 'prepare' | 'test' | 'publish') { if (!active) return; await run(async () => {
    if(name === 'publish' && !publicationReview){ const review = await api<{related: {id:string;name:string;ready:boolean}[]}>(`questions/${active.id}/publication-review`,{revision:active.revision}); setPublicationReview(review); if(review.related.length)return }
    const body = name === 'confirm' ? { revision: active.revision, outputs, topN, parameters: parameters.enableYear || parameters.enableStatus ? parameters : null } : { revision: active.revision, reviewedRelated: name === 'publish' ? publicationReview?.related.map(x=>x.id) ?? [] : undefined }
    if (name === 'test') {
      let q=active
      for(let batch=0;batch<100;batch++) {
        const result=await api<{question: DomainQuestion; preview: Result|null; continue: boolean; retryAfterSeconds:number}>(`questions/${q.id}/test`,{revision:q.revision})
        q=result.question; received(q); setPreview(result.preview??undefined)
        if(!result.continue){setNotice(q.candidate?.testResult==='PASS'?`Collaudo completato: ${q.candidate.testedValues.length} combinazioni.`:'');setStep(q.candidate?.testResult==='PASS'?'publication':'test');if(q.candidate?.testResult!=='PASS')setError(q.candidate?.diagnosticCode??'CRM5_DOMAIN_TEST_REQUIRED');break}
        setNotice(`Collaudo ${q.candidate?.completedTests??0}/${q.candidate?.totalTests??0}. ${result.retryAfterSeconds?'Pausa per rispettare la quota del runtime; ripresa automatica.':'Proseguo con le combinazioni successive.'}`)
        if(result.retryAfterSeconds)await new Promise(resolve=>setTimeout(resolve,Math.min(result.retryAfterSeconds,30)*1000))
      }
    } else { let q: DomainQuestion
      try { for(let attempt=0;;attempt++){try{q=await api<DomainQuestion>(`questions/${active.id}/${name}`,body);break}catch(e){if(name!=='publish'||attempt>=12||!(e instanceof Error)||e.message!=='CRM5_EXECUTION_QUOTA_EXCEEDED')throw e;setNotice('Verifica delle capacità conservate in pausa per la quota del runtime. Le prove già completate sono conservate; ripresa automatica.');await new Promise(resolve=>setTimeout(resolve,15000))}} }
      catch (e) { if (name === 'prepare' && e instanceof Error && e.message === 'CRM5_SANDBOX_APPROVAL_REQUIRED') setSandbox(await api(`questions/${active.id}/sandbox`, { revision: active.revision })); if (name === 'prepare' && e instanceof Error && e.message === 'CRM5_EXECUTION_NOT_AUTHORIZED') {
        setRuntimeAccess(await api<RuntimeAccessReview>(`questions/${active.id}/runtime-access`, { revision: active.revision }))
      } throw e }
      setRuntimeAccess(undefined); received(q); setStep(nextStep(q));
      if (name === 'publish') setNotice('Pubblicazione completata. Verifica gli accessi del destinatario in Utenti e collauda la domanda nel Client.') }
  }) }
  const model = workspace?.models.find(m => m.key === active?.proposal?.questionKey)
  const current = active ? nextStep(active) : 'chat'
  const published = Boolean(active?.live && active.candidate && active.live.revision === active.candidate.revision)
  const result = preview?.dictionaryOutput ? dictionaryResults(preview.rows, preview.columns, preview.dictionaryOutput) : undefined
  return <div className="questions-workspace">
    {!workspace && !error && <p role="status">Apertura delle domande…</p>}
    {error && <div role="alert" className="domain-error"><p>{domainMessage(error)}</p><small>{error}</small><button onClick={() => location.reload()}>Riapri le domande</button></div>}
    {workspace && <>
      {!workspace.dictionaryReady && <div className="domain-callout"><h2>Le domande partono dal Dizionario</h2><p>Conferma i cinque concetti in Connessioni per preparare una nuova domanda. Le versioni già pubblicate restano separate.</p><button onClick={onConnections}>Apri Connessioni</button></div>}
      <div className="question-workbench">
        <aside className="question-list"><button className="primary" disabled={busy || !workspace.dictionaryReady} onClick={() => select()}>Nuova domanda</button>
          <h2>Le tue domande</h2>{workspace.questions.length === 0 && <p>La prima conversazione comparirà qui.</p>}
          {workspace.questions.map(q => <button key={q.id} data-question-id={q.id} disabled={busy || publicationBusy} aria-pressed={q.id === active?.id} onClick={() => select(q)}><strong>{q.candidate?.name ?? q.proposal?.understanding.slice(0, 65) ?? 'Conversazione'}</strong><small>{q.live ? 'Live · revisione ' + q.live.revision : 'Bozza'}{q.candidate && q.live?.revision !== q.candidate.revision ? ' · preparazione in corso' : ''}</small></button>)}
        </aside>
        <section className="question-pipeline" aria-label="Pipeline della domanda">
          <header className="question-heading"><p className="eyebrow">DIZIONARIO → CAPACITÀ</p><h2>{active?.candidate?.name ?? 'Dalla tua domanda alla risposta'}</h2>
            <p>{active?.live ? `Live: revisione ${active.live.revision}. La preparazione della bozza è separata.` : 'Una sola conversazione, con requisiti, collaudo e pubblicazione.'}</p>
            {active && workspace.dictionaryHash !== active.dictionaryHash && <button disabled={busy || edited || !workspace.dictionaryReady} onClick={() => { if(window.confirm('Riprendere la conversazione con il Dizionario attuale? La bozza e i suoi test saranno azzerati; il Live resta separato.'))void run(async()=>{received(await api<DomainQuestion>(`questions/${active.id}/rebase-dictionary`,{revision:active.revision}));setStep('chat');setPreview(undefined);setNotice('Dizionario aggiornato. Chiedi di rileggere la richiesta nella chat.')}) }}>Riprendi dal Dizionario aggiornato</button>}
            {workspace.fixture && <p className="domain-callout">Ambiente di prova: provider e dati sintetici. Nessuna verifica del laboratorio proprietario.</p>}</header>
          <ol className="question-steps">{steps.map((s, i) => <li key={s.key} aria-current={step === s.key ? 'step' : undefined}><button aria-label={s.label} disabled={busy || i > steps.findIndex(s => s.key === current)} onClick={() => { if (!edited || window.confirm("Ci sono modifiche non salvate. Continuare?")) { setMessage(''); setOutputs(active?.outputs ?? []); setTopN(active?.topN ?? 10); setParameters(active?.parameters ?? defaultParameters); setStep(s.key) } }}><span>{i + 1}</span>{s.label}</button></li>)}</ol>
          {notice && <p role="status" className="domain-callout">{notice}</p>}
          {step === 'chat' && <div className="question-chat"><h3>Che cosa vuoi sapere?</h3><button disabled={busy || !workspace.dictionaryReady || Boolean(active?.candidate || active?.requirementsConfirmed)} onClick={() => setExpanding(true)}>Serve un nuovo campo o significato?</button>
            {active?.turns.map((t, i) => <article key={i} className={'question-turn ' + t.role}><strong>{t.role === 'user' ? 'Tu' : 'Assistente'}</strong><p>{t.text}</p>{t.provenance && <small>{t.provenance.origin === 'provider-double' ? 'Provider di prova' : `${t.provenance.provider} · ${t.provenance.modelOrDeployment}`}</small>}</article>)}
            {active?.proposal?.uncovered.map((x, i) => <p key={i} className="domain-error">Da risolvere: {x}</p>)}
            {active && active.proposal?.status !== 'ready' && !active.candidate && !active.requirementsConfirmed && workspace.modelCatalog?.some(m => !m.available) && <details className="question-models"><summary>Modelli che richiedono una definizione nel Dizionario</summary><p>Puoi preparare una metrica qui. Gli altri requisiti non supportati devono comunque essere chiariti nella conversazione.</p>
              {workspace.modelCatalog.filter(m => !m.available).map(m => <article key={m.key}><h4>{m.label}</h4><p>{m.definition}</p><button type="button" disabled={busy} onClick={() => void run(async () => { const view = await api<DictionaryView>('dictionary'); setMetricSetup({ view, key: m.metric }) })}>Prepara metrica per {m.label}</button></article>)}
            </details>}
            {active?.events.at(-1)?.action === 'dictionary-expanded' && <button type="button" className="primary" disabled={busy} onClick={() => void chat('Rivaluta la mia richiesta con il Dizionario aggiornato.')}>Rileggi la richiesta</button>}
            {!active && <div className="question-models"><h3>Parti da un modello del Dizionario</h3><p>Usa una scorciatoia oppure descrivi la tua richiesta nella chat. Ogni modello riusa metriche e colonne già definite.</p>
              <div className="question-model-grid">{(workspace.modelCatalog ?? workspace.models.map(m => ({ ...m, available: true, issues: [], definition: m.definition ?? '' }))).map(m => <article className="question-model" key={m.key}>
                <h4>{m.label}</h4><p>{m.definition}</p><small>Numero di risultati: {m.limits.join(', ')}.</small>
                {m.available ? <button type="button" disabled={busy} onClick={() => setMessage(m.example)}>Usa modello {m.label}</button> : <><p>Da preparare: {m.issues.join(' ')}</p><button type="button" disabled={busy} onClick={() => void run(async () => {
                  const view = await api<DictionaryView>('dictionary'); setMetricSetup({ view, key: m.metric })
                })}>Prepara metrica per {m.label}</button></>}
              </article>)}</div>
            </div>}
            <form onSubmit={e => { e.preventDefault(); void chat() }}><label htmlFor="domain-question-message">La tua richiesta</label><textarea id="domain-question-message" rows={3} value={message} maxLength={1000} disabled={busy || !workspace.dictionaryReady} onChange={e => setMessage(e.target.value)} placeholder="Descrivi il risultato che ti serve…" />
              <button className="primary" disabled={busy || !workspace.dictionaryReady || !message.trim()}>Invia all’assistente</button></form><p className="muted">L’assistente usa il Dizionario confermato. Una proposta richiede sempre la tua revisione.</p>
          </div>}
          {step === 'requirements' && active && <div className="question-stage"><h3>Conferma il significato e la risposta</h3><p>{active.proposal?.understanding}</p>
            <p className="domain-callout">{workspace.dictionaryRevision ? `Dizionario confermato · revisione ${workspace.dictionaryRevision}. ` : ''}{model?.definition} I pareggi usano l’identificativo cliente, senza accorpare gli omonimi.</p>
            <label>Numero di risultati<select aria-label="Numero di risultati" value={topN} disabled={busy} onChange={e => setTopN(Number(e.target.value))}>{model?.limits.map(n => <option key={n} value={n}>{n}</option>)}</select></label>
            <QuestionParameterFields value={parameters} options={active.proposal?.questionKey ? workspace.parameterOptions?.[active.proposal.questionKey] : undefined} disabled={busy} onChange={setParameters} />
            <fieldset><legend>Colonne della risposta</legend>{model?.output.map(o => <label key={o.field} className="question-output"><input type="checkbox" disabled={busy || o.field === model.metric} checked={outputs.includes(o.field)} onChange={e => setOutputs(v => e.target.checked ? [...v, o.field] : v.filter(key => key !== o.field))} />{o.label}</label>)}</fieldset>
            <p>Il Client mostrerà queste colonne e l’identificativo, conservando distinti i clienti con lo stesso nome.</p>
            <button className="primary" disabled={busy || outputs.length === 0} onClick={() => void action('confirm')}>Conferma requisiti</button> <button disabled={busy} onClick={() => setStep('chat')}>Chiarisci nella chat</button>
          </div>}
          {step === 'preparation' && active && <div className="question-stage"><h3>Prepara la bozza dal Dizionario</h3><p>Verifichiamo le associazioni confermate, le relazioni, le colonne scelte e i permessi già concessi. Questa operazione non cambia la versione Live.</p><div className="actions"><button className="primary" disabled={busy || edited} onClick={() => void action('prepare')}>Prepara capacità</button>
            <button disabled={busy || edited} onClick={() => void run(async () => setRuntimeAccess(await api<RuntimeAccessReview>(`questions/${active.id}/runtime-access`, { revision: active.revision })))}>Verifica accessi runtime</button></div>
            {runtimeAccess && <section className="domain-callout" aria-label="Accessi runtime della domanda"><h4>{runtimeAccess.allowed ? 'Accessi runtime già autorizzati' : 'Accessi runtime da autorizzare'}</h4>
              {runtimeAccess.allowed ? <p>Puoi premere Prepara capacità nella stessa domanda.</p> : <><p>Questi accessi mancano nella lista autorizzata di CRM5:</p><ul>{[...runtimeAccess.missingNames.objects, ...runtimeAccess.missingNames.columns, ...runtimeAccess.missingNames.relations].map((name, i) => <li key={i}><code>{name}</code></li>)}</ul>
                <p>Questa verifica non esegue SQL sui dati e non modifica permessi. Le autorizzazioni SQL dell’account del collegamento sono un controllo separato.</p>
                {runtimeAccess.blockingCode ? <p>{domainMessage(runtimeAccess.blockingCode)}</p> : runtimeAccess.approvalCommand && <>
                  <p>Per l’approvazione locale: arresta la Console con Ctrl+C nel suo terminale. Dalla cartella del repository esegui il comando seguente: mostra gli stessi accessi e chiede di scrivere ABILITA. Conserva un backup e una ricevuta; aggiorna solo gli accessi runtime della domanda.</p>
                  <pre className="runtime-access-command"><code>{runtimeAccess.approvalCommand}</code></pre>
                  <button type="button" onClick={() => void navigator.clipboard.writeText(runtimeAccess.approvalCommand!).then(() => setNotice('Comando copiato.')).catch(() => setNotice('Seleziona e copia il comando mostrato.'))}>Copia comando di approvazione</button>
                  <p>Riavvia la Console con il launcher abituale, riapri questa domanda e premi Prepara capacità. Non occorre ripetere il Dizionario o la conversazione. La capacità Live resta conservata.</p>
                </>}
              </>}
            </section>}
            <button disabled={busy || edited} onClick={() => void run(async () => setSandbox(await api(`questions/${active.id}/sandbox`, { revision: active.revision })))}>Verifica Sandbox della domanda</button>
            {sandbox && <section className="domain-callout" aria-label="Sandbox isolato"><h4>{sandbox.firstPublication ? 'Primo avvio · Sandbox amministrativo' : 'Sandbox della bozza'}</h4><p>Questa prova non pubblica capacità nel Client. Le letture useranno queste fonti, colonne e relazioni:</p><ul>{[...sandbox.required.objects, ...sandbox.required.columns, ...sandbox.required.relations].map((x, i) => <li key={i}>{x}</li>)}</ul>
              {sandbox.firstPublication && !sandbox.approved && <button className="primary" disabled={busy} onClick={() => void run(async () => { received(await api<DomainQuestion>(`questions/${active.id}/approve-sandbox`, { revision: active.revision, contextHash: sandbox.contextHash })); setSandbox({ ...sandbox, approved: true }); setNotice('Sandbox approvato per questi requisiti. Ora prepara e collauda la capacità.') })}>Approva queste letture nel Sandbox</button>}
              {sandbox.approved && <p>Scope verificato. La pubblicazione richiede comunque un test superato e il pulsante Pubblica.</p>}
            </section>}
          </div>}
          {step === 'test' && active && <div className="question-stage"><h3>Collaudo controllato</h3><p>{active.candidate?.definitions}</p><p>Il test verifica tutti i limiti e gli stati autorizzati, combinati con gli anni predefinito ed estremi dell’intervallo, con gli stessi controlli del runtime Client. I dati di anteprima non vengono salvati nella conversazione.</p>
            <button className="primary" disabled={busy || edited} onClick={() => void action('test')}>Collauda {parameters.enableYear || parameters.enableStatus ? 'le combinazioni autorizzate' : model?.limits.join(', ') ?? 'i valori ammessi'}</button>{active.candidate?.testResult === 'FAIL' && <div role="alert" className="domain-error"><p>Test non superato. La versione Live resta attiva.</p>
              {active.candidate.diagnosticCode && error !== active.candidate.diagnosticCode && <p>{domainMessage(active.candidate.diagnosticCode)}</p>}
              {active.candidate.diagnosticCode === 'CRM5_DATABASE_PERMISSION_DENIED' && <>
                <p>Le autorizzazioni SQL dell’account del collegamento sono distinte dai permessi gestiti in Utenti. Non occorre ricreare la domanda o il Dizionario.</p>
                {active.databasePermission && <details open><summary>Dettagli per l’amministratore del database</summary><p>Fase: {permissionStages[active.databasePermission.stage] ?? 'verifica degli accessi'}.</p>
                  {active.databasePermission.columns.length > 0 ? <><p>Accesso SELECT non confermato sulle colonne richieste:</p><ul>{active.databasePermission.columns.map((c, i) => <li key={i}><code>{c.schema}.{c.table}.{c.column}</code> · {c.status === 'denied' ? 'negato' : 'non verificabile'}</li>)}</ul><p>Verifica solo questi accessi per l’account SQL configurato. La Console non modifica i permessi del database.</p></> : <p>Il database non ha fornito un dettaglio verificabile sulle singole colonne. Occorre controllare il rifiuto SQL nella fase indicata.</p>}
                </details>}
                <p>Dopo la verifica dei permessi, premi di nuovo Collauda 5, 10, 20.</p>
              </>}
            </div>}</div>}
          {step === 'publication' && active && <div className="question-stage"><h3>{published ? 'Versione pubblicata' : 'Bozza collaudata, pronta da pubblicare'}</h3><p>{active.candidate?.definitions}</p>
            {(active.candidate?.testedValues.length ?? 0) > 6 ? <><p>{active.candidate?.testedValues.length} combinazioni collaudate. Test superato.</p><details><summary>Mostra combinazioni collaudate</summary><ul className="tested-combinations">{active.candidate?.testedValues.map((value,i)=><li key={i}>{value}</li>)}</ul></details></> : <p>Valori collaudati: {active.candidate?.testedValues.join(', ') || '—'}. {active.candidate?.testResult === 'PASS' ? 'Test superato.' : 'Test richiesto.'}</p>}
            {publicationReview && publicationReview.related.length > 0 && <div className="domain-callout"><p>La riparazione coinvolge queste domande. La pubblicazione avverrà insieme soltanto quando tutte saranno collaudate.</p><ul>{publicationReview.related.map(x=><li key={x.id}>{x.name} · {x.ready?'collaudata':'test da completare'}</li>)}</ul><button disabled={busy} onClick={()=>setPublicationReview(undefined)}>Rileggi stato dei collaudi</button></div>}
            {published ? <><p>Live · revisione {active.live?.revision}</p><button className="primary" onClick={onUsers}>Verifica accessi in Utenti</button><p>La disponibilità dipende dai permessi del destinatario. Apri il Client con quell’account per il collaudo conclusivo.</p></> : <button className="primary" disabled={busy || active.candidate?.testResult !== 'PASS' || edited || Boolean(publicationReview?.related.some(x=>!x.ready))} onClick={() => void action('publish')}>Pubblica questa versione</button>}
            {active.candidate?.testResult === 'PASS' && <button disabled={busy} onClick={() => { setStep('test'); void action('test') }}>Ripeti test per anteprima</button>}
          </div>}
          {busy && <p role="status">Operazione in corso…</p>}
          {preview && result && <section className="question-preview"><h3>Anteprima del test · {preview.rowCount} risultati</h3><div className="table-wrap"><table><thead><tr>{result.columns.map(c => <th key={c.name}>{c.label}</th>)}</tr></thead><tbody>{result.rows.map((row, i) => <tr key={i}>{result.columns.map(c => <td key={c.name}>{row[c.name] == null ? '—' : String(row[c.name])}</td>)}</tr>)}</tbody></table></div><small>Riferimento verifica: {preview.requestId}</small></section>}
          {active?.live && <QuestionPublicationTools key={active.id + '-' + active.revision} question={active} csrf={csrf} targetId={targetId} disabled={busy || edited} onChanged={received} onUsers={onUsers} onBusyChange={setPublicationBusy} />}
          {active?.candidate && <button disabled={busy || edited} onClick={() => { if(window.confirm('Abbandonare la bozza e i suoi test? La versione Live resta attiva.'))void run(async () => { received(await api<DomainQuestion>(`questions/${active.id}/discard-sandbox`, { revision: active.revision })); setStep('requirements'); setPreview(undefined); setSandbox(undefined) }) }}>Abbandona bozza Sandbox</button>}
          {active && <details className="question-history"><summary>Attività di questa domanda</summary><ol>{active.events.slice().reverse().map((e, i) => <li key={i}><time>{new Date(e.at).toLocaleString('it-IT')}</time> · {eventNames[e.action] ?? e.action}{e.action === 'tested' && ` · ${e.code === 'CRM5_EXECUTED' ? 'Superato' : 'Non superato'}`}</li>)}</ol></details>}
        </section>
      </div>
      {expanding && <DictionaryExpansionDialog csrf={csrf} targetId={targetId} onClose={() => setExpanding(false)} onSaved={async view => {
        if (active && !active.candidate && !active.requirementsConfirmed && view.dictionary) {
          received(await api<DomainQuestion>(`questions/${active.id}/refresh-dictionary`, { revision: active.revision, dictionaryRevision: view.dictionary.revision })); setStep('chat'); setNotice('Definizione salvata. Premi Rileggi la richiesta.')
        } setWorkspace(await api<QuestionWorkspace>('questions'))
      }} />}
      {metricSetup && <MetricSetupDialog view={metricSetup.view} metricKey={metricSetup.key} csrf={csrf} targetId={targetId} blocked={busy} onClose={() => setMetricSetup(undefined)}
        onBusyChange={setMetricBusy} onDirtyChange={setMetricDirty} onSaved={view => {
          setMetricSetup(current => current ? { ...current, view } : undefined)
          void run(async () => {
            if (active && !active.candidate && !active.requirementsConfirmed && view.dictionary) {
              const q = await api<DomainQuestion>(`questions/${active.id}/refresh-dictionary`, { revision: active.revision, dictionaryRevision: view.dictionary.revision })
              received(q); setStep('chat'); setNotice('Definizione confermata. Premi Rileggi la richiesta per continuare nella stessa conversazione.')
            }
            setWorkspace(await api<QuestionWorkspace>('questions'))
          })
        }} />}
    </>}
  </div>
}

