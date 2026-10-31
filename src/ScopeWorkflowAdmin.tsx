import {useEffect,useRef,useState} from 'react'
import {targetHeaders} from './databaseTargets'
import {scopeError,type Answer} from './scopeTypes'
import {scenarioStates,type WorkflowMode,type WorkflowView} from './workflowTypes'
import WorkflowTechnical from './WorkflowTechnical'
import './scopeWorkflow.css'
type Props={csrf:string;targetId?:string;mode:WorkflowMode;onModeChange:(mode:WorkflowMode)=>void;onDirtyChange?:(v:boolean)=>void;onBusyChange?:(v:boolean)=>void}
export function WorkflowResult({answer}:{answer:Answer}){return <><p>{answer.message}</p>{!!answer.rows?.length&&<div className="workflow-results"><table><thead><tr>{Object.keys(answer.rows[0]).map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{answer.rows.map((row,i)=><tr key={i}>{Object.entries(row).map(([key,value])=><td key={key}>{value==null?'—':String(value)}</td>)}</tr>)}</tbody></table></div>}</>}
export default function ScopeWorkflowAdmin({csrf,targetId,mode,onModeChange,onDirtyChange,onBusyChange}:Props){
 const key='crm5-workflow-'+(targetId??'fixture')
 const[id,setId]=useState(()=>sessionStorage.getItem(key)||'commerciale'),[catalog,setCatalog]=useState<{id:string;name:string}[]>([])
 const[view,setView]=useState<WorkflowView>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[input,setInput]=useState(''),[discovery,setDiscovery]=useState(false)
 const[scenarioId,setScenarioId]=useState(''),[liveAnswers,setLiveAnswers]=useState<Record<string,Answer>>({})
 const[reload,setReload]=useState(0),generation=useRef(0),scroll=useRef<HTMLDivElement>(null)
 useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false)},[busy,onBusyChange])
 useEffect(()=>{onDirtyChange?.(!!input.trim());return()=>onDirtyChange?.(false)},[input,onDirtyChange])
 async function api<T>(path:string,body?:unknown):Promise<T>{const response=await fetch('/api/admin/'+path+(path.startsWith('scope')?'?scopeId='+encodeURIComponent(id):''),{method:body===undefined?'GET':'POST',cache:'no-store',headers:{...targetHeaders(targetId),'Content-Type':'application/json','X-CRM5-CSRF':csrf},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401)window.dispatchEvent(new Event('crm5:admin-session-ended'));const data=await response.json();if(!response.ok)throw Error(data.code??'CRM5_SCOPE_SERVICE_FAILED');return data}
 async function refresh(n=generation.current){const v=await api<WorkflowView>('scope/workflow');if(n===generation.current)setView(v);return v}
 async function act(fn:()=>Promise<void>){const n=generation.current;setBusy(true);setError('');try{await fn()}catch(e){if(n===generation.current){setError(scopeError(e instanceof Error?e.message:'CRM5_SCOPE_SERVICE_FAILED'));try{await refresh(n)}catch{/* preserve original error */}}}finally{if(n===generation.current)setBusy(false)}}
 useEffect(()=>{const n=++generation.current;setView(undefined);setError('');setInput('');setDiscovery(false);setScenarioId(sessionStorage.getItem(key+'-'+id+'-scenario')||'');setLiveAnswers({});setBusy(true);sessionStorage.setItem(key,id)
  void Promise.all([api<WorkflowView>('scope/workflow'),api<typeof catalog>('scope/catalog')]).then(([v,c])=>{if(n===generation.current){setView(v);setCatalog(c)}}).catch(e=>{if(n===generation.current){setDiscovery(e.message==='CRM5_SCOPE_DISCOVERY_REQUIRED');setError(scopeError(e.message))}}).finally(()=>{if(n===generation.current)setBusy(false)})
  return()=>{generation.current++}
 },[id,targetId,reload])
 useEffect(()=>{scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'})},[view?.workflow.dialogue.messages.length,view?.workflow.testMessages?.length,mode])
 const w=view?.workflow,current=w?.versions.at(-1),analysisOpen=!current||w?.reopened,scenario=w?.scenarios.find(s=>s.id===scenarioId)
 async function action(action:string){const n=generation.current,v=await api<WorkflowView>('scope/workflow/action',{revision:view!.revision,action});if(n===generation.current){setView(v);setInput('')}}
 async function send(){if(!view)return;const message=input.trim(),n=generation.current,normalized=message.toLocaleLowerCase('it').replace(/[.!]$/,'')
  if(mode==='setup'){
   if(w?.dialogue.summaryOffered&&['confermo analisi','confermo','sì','si','confermo il riepilogo'].includes(normalized)){await action('confirm');return}
   if(!analysisOpen){setError('L’analisi è confermata. Puoi aprire la seconda fase oppure riaprire il colloquio.');return}
   const v=await api<WorkflowView>('scope/workflow/chat',{revision:view.revision,requestId:crypto.randomUUID(),message});if(n===generation.current){setView(v);setInput('')}
  }else if(mode==='test'){
   const requestId=crypto.randomUUID()
   if(/^confermo collaudo\s*:/i.test(message)){
    const evidence=message.slice(message.indexOf(':')+1).trim(),v=await api<WorkflowView>('scope/workflow/scenarios/'+scenarioId+'/review',{revision:view.revision,passed:true,evidence});if(n===generation.current){setView(v);setInput('')}return
   }
   const result=await api<{answer?:Answer;code?:string;kind?:string;message?:string;scenarioId?:string;suggestedAction?:string}>('scope/workflow/converse',{revision:view.revision,requestId,message,scenarioId:scenarioId||null});await refresh(n);if(n===generation.current){setInput('');if(result.scenarioId){setScenarioId(result.scenarioId);sessionStorage.setItem(key+'-'+id+'-scenario',result.scenarioId)}if(result.answer)setLiveAnswers(a=>({...a,[requestId]:result.answer!}));if(result.code)setError(scopeError(result.code))}

  }
 }
 return <section className="scope-workflow">
  <header className="workflow-heading"><label>Perimetro<select aria-label="Perimetro" disabled={busy} value={id} onChange={e=>{if(!input||window.confirm('Lasciare il messaggio non inviato?'))setId(e.target.value)}}>{catalog.length?catalog.map(c=><option key={c.id} value={c.id}>{c.name}</option>):<option value={id}>{id}</option>}</select></label><span>{mode==='technical'?'Seconda fase · preparazione tecnica':mode==='test'?'Collaudo · dialogo come cliente':analysisOpen?'Colloquio aziendale':'Analisi confermata'}</span></header>
  {error&&<div className="error" role="alert">{error}<button disabled={busy} onClick={()=>setReload(x=>x+1)}>Ricarica stato salvato</button></div>}
  {discovery&&<article className="workflow-bubble"><p>Prima leggiamo la struttura del database, poi iniziamo il colloquio.</p><button disabled={busy} onClick={()=>void act(async()=>{const s=await api<{revision:number}>('state');await api('discovery',{revision:s.revision});setReload(x=>x+1)})}>Leggi struttura</button></article>}
  {busy&&<p role="status">CRM5 sta elaborando…</p>}
  {view&&mode!=='technical'&&<>
   <div className="workflow-chat" ref={scroll} role="log" aria-label={mode==='setup'?'Colloquio aziendale':'Dialogo di collaudo'}>
    {mode==='setup'?<>{view.legacy&&<article className="workflow-bubble"><p>La configurazione precedente è conservata. Riprendiamo il colloquio con il nuovo percorso; nessun accesso sarà modificato prima della pubblicazione.</p></article>}{w!.dialogue.messages.map(m=><article key={m.id} className={'workflow-bubble '+m.role}><strong>{m.role==='user'?'Voi':'CRM5'}</strong><p>{m.text}</p>{m.error&&<><p className="error">{scopeError(m.error)}</p><button disabled={busy} onClick={()=>void act(async()=>{setView(await api<WorkflowView>('scope/workflow/delete',{revision:view.revision,messageId:m.id}))})}>Elimina domanda senza risposta</button></>}</article>)}
     {w!.dialogue.summaryOffered&&<button disabled={busy} onClick={()=>void act(()=>action('confirm'))}>Confermo analisi</button>}
     {!analysisOpen&&<article className="workflow-bubble"><p>Il riepilogo è confermato. Le operazioni tecniche si completano nella seconda fase, fuori da questo colloquio.</p><button disabled={busy} onClick={()=>onModeChange('technical')}>Apri seconda fase</button><button disabled={busy} onClick={()=>void act(()=>action('reopen'))}>Riapri il colloquio</button></article>}
    </>:<><article className="workflow-bubble"><strong>CRM5</strong><p>{w!.scenarios.length?'Quale esperienza vuoi provare? Scrivi, per esempio: «Proviamo come commerciale».':'Prima confermiamo un perimetro e prepariamo almeno uno scenario.'}</p>{w!.scenarios.map(s=><p key={s.id}>{s.name}: {scenarioStates[s.status]??s.status}.</p>)}{scenario&&<p>Stai provando come {scenario.name}. Puoi fare domande libere e chiedere chiarimenti. Per segnalare un problema scrivi «Segnalo…». Per concludere: «Confermo collaudo: …» e descrivi le verifiche indipendenti svolte sui risultati e sulla visibilità.</p>}</article>{(w!.testMessages??[]).map(m=><article className={'workflow-bubble '+m.role} key={m.id}><strong>{m.role==='user'?'Tu':'CRM5'}</strong><p>{m.text}</p>{m.error&&<><p className="error">{scopeError(m.error)}</p><button disabled={busy} onClick={()=>void act(async()=>{setView(await api<WorkflowView>('scope/workflow/delete',{revision:view.revision,messageId:m.id}))})}>Elimina domanda senza risposta</button></>}{liveAnswers[m.id]&&<WorkflowResult answer={liveAnswers[m.id]}/>}</article>)}{!Object.keys(liveAnswers).length&&!!w!.testMessages?.length&&<p>I valori restituiti non vengono conservati nello storico. Ripeti la domanda per rileggerli.</p>}</>}
   </div>
   <form className="workflow-composer" onSubmit={e=>{e.preventDefault();void act(send)}}><label htmlFor="workflow-message">{mode==='setup'?'Parliamone':'Chiedi ai dati'}</label><div><textarea id="workflow-message" value={input} maxLength={mode==='setup'?8000:2000} onChange={e=>setInput(e.target.value)} placeholder={mode==='setup'?'Descrivi come lavorate…':'Scrivi una domanda o un chiarimento…'}/><button className="primary" disabled={busy||!input.trim()}>Invia</button></div></form>
  </>}
  {view&&mode==='technical'&&<WorkflowTechnical key={id} view={view} busy={busy} api={api} act={act} onView={setView} onTest={sid=>{setScenarioId(sid);onModeChange('test')}}/>}
 </section>
}
