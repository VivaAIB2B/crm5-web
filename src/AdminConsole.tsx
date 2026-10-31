import { useCallback, useEffect, useState } from 'react'
import ScopeWorkflowAdmin from './ScopeWorkflowAdmin'
import ConnectionPage from './ConnectionPage'
import ClientAccessPanel from './ClientAccessPanel'
import SettingsPanel from './SettingsPanel'
import ConsoleIcon from './ConsoleIcon'
import type { AdministrationState } from './adminTypes'
import { targetHeaders, targetMessage, type DatabaseTarget } from './databaseTargets'
import './domain-console.css'

type Page = 'Connessioni' | 'Perimetro' | 'Collaudo' | 'Preparazione' | 'Utenti' | 'Impostazioni'
const pages = [{ name: 'Connessioni', icon: 'database' }, {name:'Perimetro',icon:'questions'}, { name: 'Collaudo', icon: 'questions' }, {name:'Preparazione',icon:'settings'},
  { name: 'Utenti', icon: 'users' }, { name: 'Impostazioni', icon: 'settings' }] as const

export default function AdminConsole() {
  const [targets, setTargets] = useState<DatabaseTarget[]>([]), [selectedId, setSelectedId] = useState<string | null>(null)
  const [fixture, setFixture] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('')
  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/targets', { cache: 'no-store' })
    if (r.status === 401) window.dispatchEvent(new Event('crm5:admin-session-ended'))
    const data = await r.json(); if (!r.ok) throw Error(data.code); setTargets(data); return data as DatabaseTarget[]
  }, [])
  useEffect(() => {
    const controller = new AbortController(); let active = true
    void (async () => {
      try {
        const r = await fetch('/api/admin/targets', { signal: controller.signal, cache: 'no-store' })
        if (r.status === 401) window.dispatchEvent(new Event('crm5:admin-session-ended'))
        if (r.status === 404) {
          const session = await fetch('/api/admin/session', { signal: controller.signal }).then(r => r.json())
          if (session.fixture === true) { if (active) setFixture(true); return }
        }
        const data: DatabaseTarget[] = await r.json(); if (!r.ok) throw Error((data as unknown as { code: string }).code)
        if (!active) return
        setTargets(data); const requested = new URL(location.href).searchParams.get('target')
        setSelectedId(requested && data.some(t => t.id === requested) ? requested : requested ? null : data[0]?.id ?? null)
        if (requested && !data.some(t => t.id === requested)) setError('CRM5_TARGET_NOT_FOUND')
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'CRM5_ADMIN_OPERATION_FAILED') }
      finally { if (active) setReady(true) }
    })()
    return () => { active = false; controller.abort() }
  }, [])
  function select(id: string) {
    const url = new URL(location.href); if (id) url.searchParams.set('target', id); else url.searchParams.delete('target')
    history.replaceState(null, '', url); setSelectedId(id); setError('')
  }
  if (!ready) return <main><p role="status">Apertura della Console…</p></main>
  const target = targets.find(t => t.id === selectedId) ?? null
  return <>{error && <p className="error" role="alert">{targetMessage(error)}</p>}<Workspace key={target?.id ?? (fixture ? 'fixture' : 'empty')}
    target={target} targets={targets} fixtureMode={fixture} onSelect={select} refreshTargets={refresh}
    onCreated={async created => { await refresh(); select(created.id) }} /></>
}

function Workspace({ target, targets, fixtureMode, onSelect, refreshTargets, onCreated }: {
  target: DatabaseTarget | null; targets: DatabaseTarget[]; fixtureMode: boolean; onSelect: (id: string) => void
  refreshTargets: () => Promise<DatabaseTarget[]>; onCreated: (target: DatabaseTarget) => Promise<void>
}) {
  const [page, setPage] = useState<Page>('Connessioni'), [state, setState] = useState<AdministrationState | null>(null)
  const [role,setRole]=useState('')
  const [csrf, setCsrf] = useState(''), [connectionBusy, setConnectionBusy] = useState(false), [error, setError] = useState('')
  const [dictionaryBusy, setDictionaryBusy] = useState(false)
  const busy = connectionBusy || dictionaryBusy
  const [dirty, setDirty] = useState(false), [creating, setCreating] = useState(!target && !fixtureMode)
  const [dictionaryDirty, setDictionaryDirty] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const context = Boolean(target || fixtureMode)
  async function api<T>(path: string, body?: unknown): Promise<T> {
    const r = await fetch('/api/admin/' + path, { method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CRM5-CSRF': csrf, ...targetHeaders(target?.id) }, body: body === undefined ? undefined : JSON.stringify(body) })
    if (r.status === 401) window.dispatchEvent(new Event('crm5:admin-session-ended'))
    const data = await r.json(); if (!r.ok) throw Error(data.code); return data
  }
  useEffect(() => {
    let active = true
    void (async () => { try {
      const session = await api<{ csrf: string; user?:{role:string} }>('session'); if (!active) return; setCsrf(session.csrf);setRole(session.user?.role??'');if(session.user?.role==='client_admin')setPage('Perimetro')
      if (context) { const value = await api<AdministrationState>('state'); if (active) {setState(value);if(value.snapshot)setPage('Perimetro')} }
    } catch (e) { if (active) setError(e instanceof Error ? e.message : 'CRM5_ADMIN_OPERATION_FAILED') }
    finally { if (active) setLoaded(true) } })()
    return () => { active = false }
  }, [])
  useEffect(() => {
    function protect(event: BeforeUnloadEvent) { if (dirty || dictionaryDirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect)
  }, [dirty, dictionaryDirty])
  function leave(action: () => void) { if (!(dirty || dictionaryDirty) || window.confirm('Ci sono modifiche non salvate. Continuare?')) { setDirty(false); setDictionaryDirty(false); action() } }
  return <div className="domain-console">
    <aside className="domain-navigation"><div className="domain-brand"><span>5</span><div><strong>CRM5</strong><small>Console amministrativa</small></div></div>
      <nav aria-label="Navigazione principale">{pages.filter(p=>role!=='client_admin'||p.name==='Perimetro').map(p => <button type="button" key={p.name} aria-current={page === p.name ? 'page' : undefined}
        disabled={busy} onClick={() => leave(() => setPage(p.name))}><ConsoleIcon name={p.icon} /><span>{p.name}</span></button>)}</nav>
      <p className="domain-navigation-note">Dai significati aziendali<br />alle domande del cliente.</p>
    </aside>
    <main className={"domain-main"+(["Perimetro","Collaudo","Preparazione"].includes(page)?" scope-wide":"")}><header className="domain-header"><div><p className="eyebrow">IL TUO SPAZIO DI LAVORO</p><h1>{page}</h1></div>
      {!fixtureMode && <label className="domain-target-picker">Database<select aria-label="Database target" value={target?.id ?? ''} disabled={busy} onChange={e => leave(() => onSelect(e.target.value))}>
        <option value="">Nuovo collegamento</option>{targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
    </header>
    {error && <div className="error" role="alert"><p>{targetMessage(error)}</p><small>{error}</small><button onClick={() => location.reload()}>Riprova</button></div>}
    {!loaded && <p role="status">Caricamento del collegamento…</p>}
    {loaded && <div className="domain-content">
      {page === 'Connessioni' && <>
        <details className="connection-details" open><summary><span>1 · Collegamento al database</span><strong>{target?.name ?? state?.setup?.endpoint.database ?? 'Da configurare'}</strong></summary>
          <ConnectionPage target={target} initial={state?.setup ?? null} revision={state?.revision ?? 0} fixture={fixtureMode} busy={busy} onBusy={setConnectionBusy} onDirty={setDirty} onModeChange={setCreating}
            onCreate={async (name, connection, password) => { await onCreated(await api<DatabaseTarget>('targets', { name, connection, password: password || null })) }}
            onSave={async (connection, password) => { setState(await api<AdministrationState>('connection', { revision: state?.revision ?? 0, connection, password: password || null })); if (!fixtureMode) await refreshTargets() }}
            onCheck={async () => { const r = await api('check', {}); if (!fixtureMode) await refreshTargets(); return r }} onContinue={() => setPage('Perimetro')} />
        </details>
      </>}
      {(page === 'Perimetro' || page === 'Collaudo' || page === 'Preparazione') && context && <ScopeWorkflowAdmin csrf={csrf} targetId={target?.id} mode={page==='Perimetro'?'setup':page==='Preparazione'?'technical':'test'} onModeChange={m=>setPage(m==='setup'?'Perimetro':m==='technical'?'Preparazione':'Collaudo')} onDirtyChange={setDictionaryDirty} onBusyChange={setDictionaryBusy}/>}
      {(page === 'Perimetro' || page === 'Collaudo' || page === 'Preparazione') && !context && <p>Configura prima un collegamento nella pagina Connessioni.</p>}
      {page === 'Utenti' && <ClientAccessPanel csrf={csrf} targetId={target?.id} packageReady={Boolean(state?.activeVersion)} />}
      {page === 'Impostazioni' && (context ? <SettingsPanel csrf={csrf} targetId={target?.id} /> : <section><h2>Scegli un collegamento</h2><p>Le impostazioni AI sono specifiche del database.</p></section>)}
    </div>}
    </main>
  </div>
}

