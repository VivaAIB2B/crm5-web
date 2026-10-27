import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type {ChartPreference} from './chartModel'
import { customerResults } from './customerResults'
import { dictionaryResults } from './dictionaryResults'
const ResultChart=lazy(()=>import('./ResultChart'))
import { clientApi, clientMessage, ClientApiError } from './clientApi'
import type { Catalog, Intent, Receipt, Result, Session, ClientScope } from './clientApi'
import { feedback, downloadFeedback } from './questionFeedback'
import type { FeedbackMessage, FeedbackAmbiguity } from './questionFeedback'
import './client.css'

type Phase = 'starting' | 'question' | 'interpreting' | 'clarification' | 'ready' | 'executing' | 'result' | 'unsupported' | 'rejected' | 'expired' | 'failed' | 'unknown'
const labels: Record<Phase, string> = { starting: 'Avvio sessione', question: 'Pronto per la domanda', interpreting: 'Interpretazione in corso', clarification: 'Serve un chiarimento', ready: 'Pronto per la conferma', executing: 'Interrogazione in corso', result: 'Risultato disponibile', unsupported: 'Domanda non supportata', rejected: 'Richiesta non ammessa', expired: 'Conferma scaduta', failed: 'Operazione interrotta', unknown: 'Esito da verificare' }
export default function CrmClient({scope,onReset}:{scope?:ClientScope;onReset?:()=>void}={}) {
  const live=useRef(true),cancel=useRef(new AbortController())
  useEffect(()=>{live.current=true;if(cancel.current.signal.aborted)cancel.current=new AbortController();return()=>{live.current=false;cancel.current.abort()}},[])
  function api<T>(path:string,csrf?:string,body?:object,id?:string,method?:string){return clientApi<T>(path,csrf,body,id,method,{...scope,signal:cancel.current.signal})}

  const [session, setSession] = useState<Session>(); const [catalog, setCatalog] = useState<Catalog>()
  const [question, setQuestion] = useState(''); const [answer, setAnswer] = useState(''); const [sent, setSent] = useState(''); const [clarifications, setClarifications] = useState<string[]>([])
  const [intent, setIntent] = useState<Intent>(); const [decision,setDecision]=useState<Intent>(); const [result, setResult] = useState<Result>(); const [phase, setPhase] = useState<Phase>('starting')
  const [error, setError] = useState<ClientApiError>(); const [receipt, setReceipt] = useState<Receipt>(); const [operation, setOperation] = useState<string>()
  const [history,setHistory]=useState<FeedbackMessage[]>([]),[ambiguities,setAmbiguities]=useState<FeedbackAmbiguity[]>([])
  const [chartMessage,setChartMessage]=useState('')
  const presentation = useMemo(() => result ? result.dictionaryOutput ? dictionaryResults(result.rows, result.columns, result.dictionaryOutput) : customerResults(result.rows, result.columns, result.resultColumns) : undefined, [result])
  async function saveChart(preference:ChartPreference){
    if(!session||!result?.capabilityId)return
    if(scope){setChartMessage('Preferenza applicata a questa visualizzazione.');return}
    try{await clientApi('chart-preferences',session.csrf,{capabilityId:result.capabilityId,preference,expectedPackageVersion:result.semanticPackageVersion});setChartMessage('Preferenza salvata per questa capacità.')}catch(e){setChartMessage(e instanceof ClientApiError?clientMessage(e.code):'Preferenza non salvata.')}
  }
  const busy = phase === 'starting' || phase === 'interpreting' || phase === 'executing'
  const locked = useRef(false); const bootstrap = useRef<Promise<[Session, Catalog]> | undefined>(undefined)
  async function open() { const s = await clientApi<Session>('session',undefined,undefined,undefined,undefined,scope); const c = await clientApi<Catalog>('capabilities',undefined,undefined,undefined,undefined,scope); return [s, c] as [Session, Catalog] }
  useEffect(() => {
    let active = true
    // StrictMode can mount effects twice; share one bootstrap, without AI/SQL side effects.
    bootstrap.current ??= open()
    bootstrap.current.then(([s, c]) => { if (active) { setSession(s); setCatalog(c); setPhase('question') } }).catch(e => { if (active) { setError(e); setPhase('failed') } })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!intent?.expires_at || !['ready', 'clarification'].includes(phase)) return
    const delay = Math.max(0, Date.parse(intent.expires_at) - Date.now())
    const timer = setTimeout(() => { setIntent(undefined); setPhase('expired') }, delay)
    return () => clearTimeout(timer)
  }, [intent, phase])
  function failed(e: unknown) {
    if(!live.current)return
    const issue = e instanceof ClientApiError ? e : new ClientApiError('CRM5_CLIENT_OPERATION_FAILED')
    setIntent(undefined); setError(issue); setPhase(issue.uncertain ? 'unknown' : issue.code.includes('TICKET_EXPIRED') ? 'expired' : 'failed')
  }
  async function interpret(followup = false) {
    if (!session || locked.current) return
    locked.current = true; const id = crypto.randomUUID(); setOperation(id); setReceipt(undefined); setError(undefined); setResult(undefined); setPhase('interpreting')
    const token = followup ? intent?.clarification_token : undefined
    setIntent(undefined)
    const text=followup?answer.trim():question.trim()
    if(!followup){setHistory([{role:'user',text}]);setAmbiguities([])}else{setHistory(h=>[...h,{role:'user',text}]);setAmbiguities(a=>a.map((v,i)=>i===a.length-1?{...v,status:'resolved',answer:text}:v))}
    if (!followup) { setDecision(undefined); setSent(question.trim()); setClarifications([]) } else setClarifications(values => [...values, answer.trim()])
    try {
      const e = await api<Intent>('interpretations', session.csrf, { question: followup ? answer.trim() : question.trim(), expectedPackageVersion: catalog?.packageVersion, ...(token ? { clarificationToken: token } : {}) }, id)
      if(!live.current)return
      const explanation=e.clarification?.question??(e.status==='executable'?'Proposta: '+e.capability_name+'. Conferma richiesta.':e.status==='unsupported'?'Domanda non supportata dal catalogo.':'Richiesta non ammessa.')
      setHistory(h=>[...h,{role:'assistant',text:explanation}]);if(e.clarification)setAmbiguities(a=>[...a,{question:e.clarification!.question,status:'open',answer:null}]);
      setDecision(e); setIntent(e); setAnswer(''); setPhase(e.status === 'executable' ? 'ready' : e.status === 'clarification_required' ? 'clarification' : e.status)
    } catch (e) { failed(e) } finally { locked.current = false }
  }
  async function execute() {
    if (!session || !intent?.execution_token || locked.current) return
    if (intent.expires_at && Date.parse(intent.expires_at) <= Date.now()) { setIntent(undefined); setPhase('expired'); return }
    locked.current = true; const id = crypto.randomUUID(); const token = intent.execution_token
    setOperation(id); setReceipt(undefined); setError(undefined); setIntent(undefined); setPhase('executing')
    try { const rows=await api<Result>('executions', session.csrf, { executionToken: token }, id);if(!live.current)return;setResult(rows);setPhase('result') }
    catch (e) { failed(e) } finally { locked.current = false }
  }
  async function reset() {
    if(onReset){onReset();return}
    if (locked.current) return
    locked.current = true; setPhase('starting'); setIntent(undefined); setResult(undefined); setError(undefined); setReceipt(undefined); setOperation(undefined); setSent(''); setClarifications([]); setQuestion(''); setAnswer('')
    try { if (session) { try { await clientApi<void>('session', session.csrf, undefined, undefined, 'DELETE') } catch (e) { if (!(e instanceof ClientApiError) || e.code !== 'CRM5_CLIENT_SESSION_REQUIRED') throw e } }
      const [s, c] = await open(); setSession(s); setCatalog(c); setPhase('question') }
    catch (e) { failed(e) } finally { locked.current = false }
  }
  async function checkReceipt() {
    if (!operation || locked.current) return
    locked.current = true
    try { setReceipt(await api<Receipt>('requests/' + operation)); setError(undefined) }
    catch (e) { setError(e instanceof ClientApiError ? e : new ClientApiError('CRM5_CLIENT_OPERATION_FAILED')) } finally { locked.current = false }
  }
  return <div className="crm-client"><header><div><p className="eyebrow">CRM5 · CLIENT v0.12.4</p><h1>Domande al tuo CRM</h1><p>Una domanda, una capacità approvata, un risultato verificato.</p></div></header>
    {session?.fixture && <p className="fixture-banner" role="note">DATI E AI SIMULATI · questa sessione verifica il software, non il database o un modello AI reale.</p>}
    <main>
    <section className="conversation"><div className="client-status" role="status" aria-live="polite">{labels[phase]}</div>
      {phase==='question' && catalog && catalog.capabilities.length > 0 && <details className="demo-questions"><summary>Domande disponibili</summary>{catalog.capabilities.map(c=><article key={c.id}><h3>{c.name}</h3><p>{c.definitions}</p><button onClick={()=>setQuestion(c.exampleQuestion)}>Usa questa domanda</button></article>)}</details>}
      {phase === 'question' && <form onSubmit={e => { e.preventDefault(); void interpret() }}><label htmlFor="crm-question">La tua domanda</label><textarea id="crm-question" value={question} maxLength={500} onChange={e => setQuestion(e.target.value)} placeholder="Quali sono i 10 clienti con più ordini?"/><p>Italiano o inglese · fino a 500 caratteri</p><button className="primary" disabled={!question.trim() || catalog?.capabilities.length === 0}>Interpreta domanda</button></form>}
      {sent && scope?.targetId && !busy && <button onClick={()=>downloadFeedback(feedback('client',scope.targetId!,catalog?.packageVersion??'',sent,history,ambiguities,{status:phase==='result'?'result':intent?.status??'failed',capabilityId:result?.capabilityId??decision?.capability_id??null,parameters:decision?.parameters??{}}))}>Scarica domanda e ambiguità (JSON)</button>}
      {sent && <article className="question-bubble"><h2>La tua domanda</h2><p>{sent}</p>{clarifications.length > 0 && <><h3>Le tue precisazioni</h3><ol>{clarifications.map((value, i) => <li key={i}>{value}</li>)}</ol></>}</article>}
      {phase === 'clarification' && <form onSubmit={e => { e.preventDefault(); void interpret(true) }}><h2>Chiarisci la richiesta</h2><p>{intent?.clarification?.question}</p><label htmlFor="crm-answer">La tua precisazione</label><textarea id="crm-answer" maxLength={500} value={answer} onChange={e => setAnswer(e.target.value)}/><button className="primary" disabled={!answer.trim()}>Invia chiarimento</button><p>Il chiarimento non interroga il database.</p></form>}
      {phase === 'ready' && <article><h2>{intent?.capability_name}</h2><p>È pronta l’interrogazione della capacità approvata. Conferma per leggere i risultati.</p><p>La conferma vale cinque minuti ed è utilizzabile una sola volta.</p>{intent?.parameters && <dl>{Object.entries(intent.parameters).map(([key,value]) => <div key={key}><dt>{key === 'top_n' ? 'Numero di risultati' : key === 'year' ? 'Anno degli ordini' : key}</dt><dd>{value}</dd></div>)}</dl>}<button className="primary" onClick={() => void execute()}>Esegui interrogazione</button></article>}
      {phase === 'unsupported' && <article><h2>Serve una capacità diversa</h2><p>Questa domanda contiene una misura, una quantità o un filtro non supportato. Nessuna interrogazione è stata eseguita. Comunica la richiesta all’operatore per la progettazione di una capacità.</p></article>}
      {phase === 'rejected' && <article><h2>Richiesta non ammessa</h2><p>Chiedi informazioni aziendali sulle capacità disponibili. Nessuna interrogazione è stata eseguita.</p></article>}
      {phase === 'expired' && <p>La conferma è scaduta. Apri una nuova conversazione e ripresenta la domanda.</p>}
      {error && <div role="alert" className="client-error"><p>{clientMessage(error.code)}</p><details><summary>Codice per il supporto</summary><p>{error.code}</p>{operation && <p>Richiesta: {operation}</p>}</details></div>}
      {result && presentation && <article className={presentation.details ? "customer-result" : undefined}><h2>{result.rowCount === 0 ? 'Nessun risultato' : String(result.rowCount)+' risultati'}</h2>{result.rowCount > 0 && <div className="table-wrap"><table><caption>{catalog?.capabilities.find(c=>c.id===result.capabilityId)?.name??'Risultati della capacità approvata'}</caption><thead><tr>{presentation.columns.map(c=><th key={c.name} scope="col">{c.label}</th>)}</tr></thead><tbody>{presentation.rows.map((row,i)=><tr key={i}>{presentation.columns.map(c=><td key={c.name}>{row[c.name]==null?'—':String(row[c.name])}</td>)}</tr>)}</tbody></table></div>}{presentation.details && <details><summary>Dettagli anagrafici della sorgente</summary><p>{result.resultColumns ? 'Sono presenti soltanto le colonne approvate nella Console, nell’ordine scelto. I campi senza valore sono indicati con —. I clienti senza anagrafica restano nella classifica.' : 'La ragione sociale ha precedenza sul nome della persona. I clienti senza anagrafica restano nella classifica. Nessun indirizzo, telefono o email viene caricato.'}</p><div className="table-wrap"><table><thead><tr>{result.columns?.map(c=><th key={c.name} scope="col">{c.label}</th>)}</tr></thead><tbody>{result.rows.map((row,i)=><tr key={i}>{result.columns?.map(c=><td key={c.name}>{row[c.name]==null?'—':String(row[c.name])}</td>)}</tr>)}</tbody></table></div></details>}<Suspense fallback={<p>Caricamento grafico…</p>}><ResultChart horizontalCategories={presentation.details} data={presentation.rows} columns={presentation.chartColumns ?? presentation.columns} preference={result.chart_preference} onChange={(_,preference)=>void saveChart(preference)}/></Suspense>{chartMessage&&<p role="status">{chartMessage}</p>}<details><summary>Riferimento della verifica</summary><p>Audit: {result.requestId}</p><p>Package: {result.semanticPackageVersion}</p></details></article>}
      {operation && ['unknown', 'failed'].includes(phase) && <button onClick={() => void checkReceipt()}>Verifica stato della richiesta</button>}
      {receipt && <article><h2>Ricevuta: {receipt.status}</h2><p>La verifica legge solo lo stato, senza ripetere la richiesta. I risultati non sono conservati nella ricevuta.</p>{receipt.rowCount !== null && <p>Righe prodotte: {receipt.rowCount}</p>}{receipt.code && <p>{clientMessage(receipt.code)}</p>}{receipt.status === 'processing' && <p>Attendi e verifica nuovamente lo stato.</p>}</article>}
      {!busy && phase !== 'question' && <button onClick={() => void reset()}>Nuova conversazione</button>}
    </section><aside><h2>Capacità disponibili</h2>{catalog?.capabilities.length === 0 && <p>Nessuna capacità autorizzata disponibile. Contatta l’operatore.</p>}{catalog?.capabilities.map(c => <article key={c.id}><h3>{c.name}</h3><p>{c.description}</p><p>{c.definitions}</p><p>{c.limitations}</p>{c.fixedLimit !== null && <p><strong>Limite fisso: {c.fixedLimit}</strong></p>}<button disabled={busy || phase !== 'question'} onClick={() => setQuestion(c.exampleQuestion)}>Usa domanda di esempio</button></article>)}<p>Package {catalog?.packageVersion ?? 'da verificare'}</p><p>Il catalogo mostra le capacità approvate e autorizzate. I risultati richiedono una conferma esplicita.</p></aside></main><footer>Le chiavi e l’accesso al database sono gestiti dal backend. I risultati sono dati, non istruzioni.</footer></div>
}

