import { lazy, Suspense, useEffect, useRef, useState } from 'react'
const CrmClient = lazy(() => import('./CrmClient'))
import ClientWorkspace from './ClientWorkspace'
import ScopeClient from './ScopeClient'
import { clientApi, clientMessage, ClientApiError } from './clientApi'
import type { ClientScope, ClientTarget, Session } from './clientApi'
import './client.css'

type Access = Partial<Session> & { stage: string; user?: { displayName: string; username: string }; code?: string }
type Context = { context: string; target: ClientTarget; packageReady: boolean; scopeReady?:boolean }
export default function ClientAccess() {
  const [legacy,setLegacy]=useState(false)
  const [access,setAccess]=useState<Access>(),[targets,setTargets]=useState<ClientTarget[]>([]),[context,setContext]=useState<Context>()
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const bootstrap=useRef<Promise<Access>|undefined>(undefined), selection=useRef(0), request=useRef<AbortController|undefined>(undefined)
  async function refresh(){const value=await clientApi<Access>('auth/status');setAccess(value)}
  useEffect(()=>{let live=true;bootstrap.current??=clientApi<Access>('auth/status');bootstrap.current.then(a=>{if(live)setAccess(a)}).catch(()=>{if(live)setError('Accesso Client non disponibile.')});return()=>{live=false}},[])
  useEffect(()=>{if(access?.stage!=='authenticated')return;let live=true;clientApi<ClientTarget[]>('targets').then(t=>{if(live)setTargets(t)}).catch(e=>{if(live)setError(clientMessage(e.code))});return()=>{live=false}},[access?.stage])
  useEffect(()=>{const ended=()=>{selection.current++;request.current?.abort();setContext(undefined);setTargets([]);void refresh()};window.addEventListener('crm5:client-session-ended',ended);return()=>window.removeEventListener('crm5:client-session-ended',ended)},[])
  async function login(){setBusy(true);setError('');try{setAccess(await clientApi<Access>('auth/login',access?.csrf,{username,password}));setPassword('')}catch(e){setPassword('');setError(clientMessage(e instanceof ClientApiError?e.code:'CRM5_CLIENT_OPERATION_FAILED'))}finally{setBusy(false)}}
  async function choose(id:string){const seq=++selection.current;request.current?.abort();request.current=new AbortController();setContext(undefined);setError('');if(!id){setBusy(false);return}setBusy(true)
    try{const c=await clientApi<Context>('context',access?.csrf,{targetId:id},undefined,undefined,{signal:request.current.signal});if(seq===selection.current){setContext(c);setLegacy(!c.scopeReady)}}catch(e){if(seq===selection.current)setError(clientMessage(e instanceof ClientApiError?e.code:'CRM5_CLIENT_OPERATION_FAILED'))}finally{if(seq===selection.current)setBusy(false)}}
  async function logout(){selection.current++;request.current?.abort();setContext(undefined);setTargets([]);setBusy(true);try{await clientApi('auth/logout',access?.csrf,{});await refresh()}catch(e){setError(clientMessage(e instanceof ClientApiError?e.code:'CRM5_CLIENT_OPERATION_FAILED'));await refresh().catch(()=>setAccess({stage:'unavailable'}))}finally{setBusy(false)}}
  if(access?.stage==='legacy-local')return <Suspense fallback={<p>Caricamento…</p>}><CrmClient/></Suspense>
  if(access?.stage!=='authenticated')return <div className="crm-client client-access"><h1>Accedi al Client CRM5</h1>{!access?<p role="status">Caricamento accesso…</p>:access.stage==='login'?<form onSubmit={e=>{e.preventDefault();void login()}}><label htmlFor="client-username">Nome utente</label><input id="client-username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/><label htmlFor="client-password">Password</label><input id="client-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="primary" disabled={busy}>Accedi</button></form>:<><p>Il responsabile deve completare la configurazione del gestionale nella Console.</p><button onClick={()=>void refresh()}>Riprova</button></>}{error&&<p role="alert">{error}</p>}</div>
  const scope:ClientScope|undefined=context?{targetId:context.target.id,context:context.context}:undefined
  return <><div className="client-account"><strong>{access.user?.displayName}</strong><label>Database autorizzato <select aria-label="Database autorizzato" value={context?.target.id??''} disabled={busy} onChange={e=>void choose(e.target.value)}><option value="">Scegli un database</option>{targets.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button onClick={()=>void logout()} disabled={busy}>Esci</button></div>{error&&<p className="client-access-error" role="alert">{error}</p>}{busy&&<p role="status">Caricamento…</p>}{targets.length===0&&!busy&&<p className="client-access-error">Nessun database autorizzato. Contatta il responsabile.</p>}{context&&scope&&<><div className="scope-actions"><button onClick={()=>setLegacy(false)} disabled={!legacy||!context.scopeReady}>Chat sui dati</button><button onClick={()=>setLegacy(true)} disabled={legacy}>Domande salvate precedenti</button></div>{!legacy?<ScopeClient key={context.context} scope={scope} csrf={access.csrf!} database={context.target.name}/>:<ClientWorkspace key={context.context} scope={scope} csrf={access.csrf!} database={context.target.name} packageReady={context.packageReady} fixture={Boolean(access.fixture)} onReset={()=>void choose(context.target.id)}/>}</>}</>
}

