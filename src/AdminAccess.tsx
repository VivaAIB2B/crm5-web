import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import AdminConsole from './AdminConsole'
import './access.css'

type Access = { stage: 'database' | 'bootstrap' | 'login' | 'authenticated' | 'unavailable' | 'fixture'; csrf: string; fixture?: boolean; code?: string; user?: { id: string; username: string; displayName: string; role: string }; database?: { server: string; port: number; database: string; username: string } }
const messages: Record<string, string> = {
 CRM5_IDENTITY_CREDENTIALS_INVALID: 'Nome utente o password non corretti. Dopo più tentativi errati, attendi 15 minuti prima di riprovare.',
 CRM5_IDENTITY_USERNAME_INVALID: 'Usa da 3 a 120 caratteri: lettere, numeri, punto, trattino o un indirizzo email.',
 CRM5_IDENTITY_NAME_INVALID: 'Inserisci il nome da mostrare nella console, fino a 160 caratteri.',
 CRM5_IDENTITY_PASSWORD_INVALID: 'Scegli una password da 15 a 128 caratteri. Puoi usare una frase facile da ricordare.',
 CRM5_IDENTITY_BOOTSTRAP_CLOSED: 'Il primo amministratore è già stato creato. Aggiorna la pagina e accedi con il suo account.',
 CRM5_IDENTITY_DATABASE_ALREADY_CONFIGURED: 'Il collegamento a PostgreSQL è già configurato. Aggiorna la pagina per continuare.',
 CRM5_IDENTITY_DATABASE_CREDENTIALS_INVALID: 'PostgreSQL non accetta questo account. Controlla il nome utente e la password del database.',
 CRM5_IDENTITY_DATABASE_NOT_FOUND: 'Il database indicato non esiste. Chiedi a chi gestisce PostgreSQL il nome del database CRM5 già predisposto.',
 CRM5_IDENTITY_DATABASE_PERMISSION_DENIED: 'L’account PostgreSQL non può preparare le tabelle CRM5. Chiedi al gestore del database i permessi sullo schema crm5_management.',
 CRM5_IDENTITY_DATABASE_UNAVAILABLE: 'Non riesco a collegarmi a PostgreSQL. Verifica che il servizio sia acceso e che server e porta siano corretti, poi riprova.',
 CRM5_IDENTITY_DATABASE_INPUT_INVALID: 'Completa server, porta, database, nome utente e password di PostgreSQL.',
 CRM5_IDENTITY_DATABASE_TLS_REQUIRED: 'Per un server esterno al PC occorre una connessione TLS con certificato valido. Disattiva l’opzione per la connessione locale.',
 CRM5_IDENTITY_CONFIGURATION_UNREADABLE: 'Il collegamento salvato appartiene a un altro profilo Windows o non è leggibile. Apri CRM5 con il profilo che lo ha configurato.',
 CRM5_IDENTITY_CONSOLE_DENIED: 'Questo account non è abilitato alla console amministrativa. Rivolgiti al gestore CRM5.',
 CRM5_IDENTITY_RATE_LIMITED: 'Hai effettuato diversi tentativi in poco tempo. Attendi un minuto e riprova.',
 CRM5_IDENTITY_CSRF_DENIED: 'La schermata di accesso è stata aggiornata. Reinserisci la password e riprova.',
 CRM5_IDENTITY_ORIGIN_DENIED: 'Apri la console all’indirizzo http://127.0.0.1:5088 nello stesso browser.',
 CRM5_IDENTITY_SESSION_REQUIRED: 'La sessione è terminata. Accedi di nuovo per continuare.',
 CRM5_ADMIN_INPUT_INVALID: 'Controlla i dati inseriti e riprova.',
}
export function accessMessage(code: string) { return messages[code] || 'Non è stato possibile completare l’operazione. Riprova; se il problema continua, comunica il codice al supporto.' }

export default function AdminAccess() {
 const [access, setAccess] = useState<Access>(), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
 const [username, setUsername] = useState(''), [name, setName] = useState(''), [password, setPassword] = useState(''), [repeat, setRepeat] = useState('')
 const [database, setDatabase] = useState({ server: '127.0.0.1', port: 5432, database: 'crm5', username: 'postgres', password: '', localWithoutTls: true })
 const sequence = useRef(0), working = useRef(false), statusRequest = useRef<AbortController | null>(null)
 const previousStage = useRef<string | undefined>(undefined)
 useEffect(() => { if(access?.stage === 'login' && previousStage.current === 'authenticated') setNotice('La sessione è terminata. Accedi di nuovo per continuare.'); previousStage.current = access?.stage }, [access?.stage])
 const refresh = useCallback(async () => {
  const current = ++sequence.current
  statusRequest.current?.abort(); const controller = new AbortController(); statusRequest.current = controller
  try {
   const r = await fetch('/api/admin/auth/status', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
   let value: Access
   if (r.status === 404 || !r.headers.get('Content-Type')?.includes('application/json')) {
    // Only the explicit synthetic fixture host retains its older no-login interface.
    const legacy = await fetch('/api/admin/session', { cache: 'no-store' }); const fixture = await legacy.json()
    if (!legacy.ok || fixture.fixture !== true) throw Error('CRM5_ADMIN_BACKEND_UNAVAILABLE')
    value = { stage: 'fixture', csrf: fixture.csrf, fixture: true }
   } else { if (!r.ok) throw Error('CRM5_ADMIN_BACKEND_UNAVAILABLE'); value = await r.json() }
   if (current === sequence.current) setAccess(value)
  } catch { if (current === sequence.current) setError('CRM5_ADMIN_BACKEND_UNAVAILABLE') }
 }, [])
 useEffect(() => { void refresh(); return () => { sequence.current++; statusRequest.current?.abort() } }, [refresh])
 useEffect(() => {
  const ended = () => { setPassword(''); setRepeat(''); setNotice('La sessione è terminata. Accedi di nuovo per continuare.'); void refresh() }
  window.addEventListener('crm5:admin-session-ended', ended)
  const timer = setInterval(() => { if (!working.current && access?.stage === 'authenticated') void refresh() }, 30_000)
  return () => { window.removeEventListener('crm5:admin-session-ended', ended); clearInterval(timer) }
 }, [access?.stage, refresh])
 async function submit(event: FormEvent) {
  event.preventDefault(); if (!access || working.current) return
  if (access.stage === 'bootstrap' && password !== repeat) { setError('PASSWORD_CONFIRMATION'); return }
  working.current = true; setBusy(true); setError(''); setNotice(''); sequence.current++
  const stage = access.stage
  try {
   const body = stage === 'database' ? database : stage === 'bootstrap' ? { username, displayName: name, password } : { username, password }
   const r = await fetch('/api/admin/auth/' + (stage === 'database' ? 'database' : stage === 'bootstrap' ? 'bootstrap' : 'login'), { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-CRM5-CSRF': access.csrf }, body: JSON.stringify(body) })
   const result = await r.json(); if (!r.ok) throw Error(result.code || 'CRM5_ADMIN_INPUT_INVALID')
   setPassword(''); setRepeat(''); setDatabase(d => ({ ...d, password: '' })); setAccess(result)
   if (stage === 'database') setNotice('Collegamento riuscito. Ora crea il primo amministratore CRM5.')
  } catch (e) { setError(e instanceof Error ? e.message : 'CRM5_ADMIN_BACKEND_UNAVAILABLE'); setPassword(''); setRepeat(''); if(e instanceof Error && e.message === 'CRM5_IDENTITY_CSRF_DENIED') await refresh() }
  finally { working.current = false; setBusy(false) }
 }
 async function logout() {
  if (!access || working.current) return
  working.current = true; setBusy(true); setError(''); sequence.current++
  try {
   const r = await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-CRM5-CSRF': access.csrf } })
   if (!r.ok && r.status !== 401) { const result = await r.json(); throw Error(result.code) }
   setAccess(undefined); setPassword(''); setRepeat(''); setNotice('Sei uscito dalla console. Per continuare, accedi di nuovo.'); await refresh()
  } catch (e) { setError(e instanceof Error ? e.message : 'CRM5_ADMIN_BACKEND_UNAVAILABLE'); await refresh() }
  finally { working.current = false; setBusy(false) }
 }
 const errorText = error === 'PASSWORD_CONFIRMATION' ? 'Le due password non coincidono. Inseriscile di nuovo.' : error === 'CRM5_ADMIN_BACKEND_UNAVAILABLE' ? 'La console non risponde. Verifica che l’app sia aperta e premi Riprova.' : accessMessage(error)
 const errorView = error && <div className="error" role="alert"><p>{errorText}</p>{!['PASSWORD_CONFIRMATION', 'CRM5_ADMIN_BACKEND_UNAVAILABLE'].includes(error) && <details><summary>Codice per il supporto</summary>{error}</details>}</div>
 if (access?.stage === 'fixture') return <AdminConsole />
 if (access?.stage === 'authenticated') return <>
  <div className="identity-bar"><div><strong>{access.user?.displayName}</strong><span> · {access.user?.username} · Gestore CRM5</span></div><button disabled={busy} onClick={logout}>{busy ? 'Uscita…' : 'Esci'}</button></div>
  {errorView}<AdminConsole key={access.user!.id + access.csrf} />
 </>
 const stage = access?.stage
 return <main className="access-shell"><div className="access-brand">CRM<span>5</span><p>Console amministrativa</p></div><section className="access-card">
  {stage === 'database' || stage === 'bootstrap' ? <ol className="access-steps" aria-label="Primo avvio"><li aria-current={stage === 'database' ? 'step' : undefined}>1. PostgreSQL</li><li aria-current={stage === 'bootstrap' ? 'step' : undefined}>2. Primo amministratore</li><li>3. Console</li></ol> : null}
  <p className="eyebrow">{stage === 'login' ? 'ACCESSO ALLA CONSOLE' : 'PRIMO AVVIO CRM5'}</p>
  <h1>{stage === 'database' ? 'Collega il gestore CRM5' : stage === 'bootstrap' ? 'Crea il primo amministratore' : stage === 'login' ? 'Accedi a CRM5' : stage === 'unavailable' ? 'Collegamento da verificare' : 'Apertura console…'}</h1>
  {notice && <p className="notice" role="status">{notice}</p>}{errorView}
  {stage === 'unavailable' ? <><p role="alert">{accessMessage(access?.code || 'CRM5_IDENTITY_DATABASE_UNAVAILABLE')}</p>{access?.database && <p>Database: <strong>{access.database.database}</strong> · Server: {access.database.server}:{access.database.port}</p>}<button onClick={() => { setError(''); void refresh() }}>Riprova collegamento</button><details><summary>Codice per il supporto</summary>{access?.code}</details></> : null}
  {['database', 'bootstrap', 'login'].includes(stage || '') && <form onSubmit={submit}><fieldset disabled={busy}>
   {stage === 'database' ? <><p>PostgreSQL conserva gli utenti e le sessioni di CRM5. Inserisci i dati di un database già disponibile. L’account qui sotto serve a collegare il gestore; il tuo account CRM5 verrà creato nel passaggio successivo.</p>
    <div className="form-grid"><label>Server PostgreSQL<input required value={database.server} onChange={e => setDatabase({ ...database, server: e.target.value, localWithoutTls: ['localhost', '127.0.0.1', '::1'].includes(e.target.value) && database.localWithoutTls })} autoComplete="off" /></label><label>Porta<input required type="number" min="1" max="65535" value={database.port} onChange={e => setDatabase({ ...database, port: Number(e.target.value) })} /></label></div>
    <label>Database CRM5<input required maxLength={63} value={database.database} onChange={e => setDatabase({ ...database, database: e.target.value })} autoComplete="off" /></label>
    <label>Nome utente PostgreSQL<input required maxLength={128} value={database.username} onChange={e => setDatabase({ ...database, username: e.target.value })} autoComplete="off" /></label>
    <label>Password PostgreSQL<input required type="password" value={database.password} onChange={e => setDatabase({ ...database, password: e.target.value })} autoComplete="off" /></label>
    <label className="access-checkbox"><input type="checkbox" checked={database.localWithoutTls} onChange={e => setDatabase({ ...database, localWithoutTls: e.target.checked })} />PostgreSQL è sul mio PC: connessione locale senza TLS.</label><p className="access-help">La connessione salvata è protetta dal profilo Windows. Il database aziendale SQL Server si configura nella console.</p>
   </> : <>
    {stage === 'bootstrap' ? <><p>Questo account governa la console CRM5. Sarà creato una sola volta, senza utenti o password predefiniti.</p><label>Nome da mostrare<input required maxLength={160} value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label></> : <p>Usa il tuo account CRM5 per entrare nella console amministrativa.</p>}
    <label>Nome utente<input required minLength={3} maxLength={120} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} /></label>
    <label>Password<input required type="password" minLength={stage === 'bootstrap' ? 15 : undefined} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} autoComplete={stage === 'bootstrap' ? 'new-password' : 'current-password'} aria-describedby={stage === 'bootstrap' ? 'password-help' : undefined} /></label>
    {stage === 'bootstrap' && <><p className="access-help" id="password-help">Da 15 a 128 caratteri: puoi usare una frase. Conserva la password per gli accessi successivi.</p><label>Ripeti password<input required type="password" minLength={15} maxLength={128} value={repeat} onChange={e => setRepeat(e.target.value)} autoComplete="new-password" /></label></>}
   </>}
   <button className="access-primary" type="submit">{busy ? 'Attendere…' : stage === 'database' ? 'Verifica e continua' : stage === 'bootstrap' ? 'Crea amministratore ed entra' : 'Accedi'}</button>
  </fieldset></form>}
  {!access && error && <button onClick={() => { setError(''); void refresh() }}>Riprova</button>}
 </section><p className="access-footer">CRM5 · Accesso amministrativo locale · PostgreSQL gestisce l’identità.</p></main>
}

