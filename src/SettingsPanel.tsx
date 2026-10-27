import { useEffect, useState } from 'react'
import { targetHeaders } from './databaseTargets'

type Profile = { provider: string; modelOrDeployment: string; endpoint: string | null; apiMode: string;
  apiVersion: string | null; secretReference: string; enabled: boolean; realCallsEnabled: boolean;
  timeoutSeconds: number; maxInputBytes: number; maxOutputTokens: number; maxCallsPerMinute: number;
  maxCallsPerDay: number; maxDailyReservedTokens: number; maxDailyCostUsd: number | null;
  inputPricePerMillion: number | null; outputPricePerMillion: number | null }
type Configuration = { version: string; revision: number; activeProvider: string; profiles: Profile[] }
const limits = { timeoutSeconds: 'Timeout in secondi', maxCallsPerMinute: 'Chiamate al minuto', maxInputBytes: 'Byte massimi in ingresso', maxOutputTokens: 'Token massimi di risposta', maxDailyCostUsd: 'Tetto giornaliero USD (facoltativo)', inputPricePerMillion: 'USD per milione di token input', outputPricePerMillion: 'USD per milione di token output' } as const
export default function SettingsPanel({ csrf, targetId }: { csrf: string; targetId?: string }) {
  const [configuration, setConfiguration] = useState<Configuration | null>(null), [error, setError] = useState('')
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  async function api(body?: unknown) {
    const r = await fetch('/api/admin/ai/configuration', { method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CRM5-CSRF': csrf, ...targetHeaders(targetId) }, body: body ? JSON.stringify(body) : undefined })
    if (r.status === 401) window.dispatchEvent(new Event('crm5:admin-session-ended'))
    const data = await r.json(); if (!r.ok) throw Error(data.code); return data.configuration as Configuration
  }
  useEffect(() => { let active = true; api().then(c => { if (active) setConfiguration(c) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [csrf, targetId])
  function edit(key: keyof Profile, value: string | number | boolean | null) {
    if (configuration) setConfiguration({ ...configuration, profiles: configuration.profiles.map(p => p.provider === configuration.activeProvider ? { ...p, [key]: value } : p) }); setNotice('')
  }
  const p = configuration?.profiles.find(p => p.provider === configuration.activeProvider)
  return <section><p className="eyebrow">COMPRENSIONE DELLE DOMANDE</p><h2>Assistente AI</h2><p>Configura il provider e i limiti per il database selezionato. Le chiavi restano sul server.</p>
    {error && <p className="error" role="alert">Configurazione non disponibile o non valida. {error}</p>}{notice && <p role="status" className="notice">{notice}</p>}
    {!configuration && !error && <p role="status">Caricamento…</p>}
    {configuration && p && <form onSubmit={e => { e.preventDefault(); setBusy(true); setError(''); void api({ revision: configuration.revision, activeProvider: configuration.activeProvider, profiles: configuration.profiles })
      .then(c => { setConfiguration(c); setNotice('Configurazione AI salvata.') }).catch(e => setError(e.message)).finally(() => setBusy(false)) }}>
      <fieldset disabled={busy}><div className="form-grid">
        <label>Provider<select value={configuration.activeProvider} onChange={e => setConfiguration({ ...configuration, activeProvider: e.target.value })}><option value="openai">OpenAI</option><option value="azure_openai">Azure OpenAI</option></select></label>
        <label>{p.provider === 'openai' ? 'Modello' : 'Deployment'}<input required value={p.modelOrDeployment} onChange={e => edit('modelOrDeployment', e.target.value)} /></label>
        {p.provider === 'azure_openai' && <label>Endpoint Azure<input value={p.endpoint ?? ''} onChange={e => edit('endpoint', e.target.value || null)} /></label>}
        <label>Riferimento alla chiave API<input required value={p.secretReference} onChange={e => edit('secretReference', e.target.value)} /><small>Il nome della variabile o del riferimento protetto, senza inserire la chiave.</small></label>
        <label>Chiamate massime al giorno<input type="number" min="0" max="1000" value={p.maxCallsPerDay} onChange={e => edit('maxCallsPerDay', Number(e.target.value))} /></label>
        <label>Token prenotabili al giorno<input type="number" min="0" max="10000000" value={p.maxDailyReservedTokens} onChange={e => edit('maxDailyReservedTokens', Number(e.target.value))} /></label>
      </div><label className="concept-confirm"><input type="checkbox" checked={p.enabled} onChange={e => edit('enabled', e.target.checked)} />Abilita questo provider</label>
        <label className="concept-confirm"><input type="checkbox" checked={p.realCallsEnabled} onChange={e => edit('realCallsEnabled', e.target.checked)} />Autorizzo le chiamate API entro i limiti configurati</label>
        <details><summary>Limiti di esecuzione e costo</summary><div className="form-grid">{(Object.keys(limits) as (keyof typeof limits)[]).map(key => <label key={key}>{limits[key]}<input type="number" min="0" step={key.includes('Usd') || key.includes('Price') ? '0.001' : '1'} value={p[key] ?? ''} onChange={e => edit(key, e.target.value ? Number(e.target.value) : null)} /></label>)}</div></details>
        <button className="primary" disabled={busy}>Salva impostazioni</button>
      </fieldset>
    </form>}
  </section>
}

