import { useEffect, useState } from 'react'
import { domainApi, domainMessage, type DomainQuestion } from './domainApi'
type Versions = { installationRevision: string; versions: { id: string; revision: number; name: string; definition: string; at: string; active: boolean }[] }
type Availability = { published: boolean; revision: number | null; packageVersion: string | null; recipients: { id: string; name: string; available: boolean; code: string; missing: { objects: string[]; columns: string[]; relations: string[] } }[] }
export default function QuestionPublicationTools({ question, csrf, targetId, disabled, onChanged, onUsers, onBusyChange }: { question: DomainQuestion; csrf: string; targetId?: string; disabled: boolean; onChanged: (q: DomainQuestion) => void; onUsers: () => void; onBusyChange: (busy: boolean) => void }) {
  const [versions, setVersions] = useState<Versions>(), [availability, setAvailability] = useState<Availability>(), [recipient, setRecipient] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false)},[busy,onBusyChange])
  async function run(work: () => Promise<void>) { setBusy(true); setError(''); try { await work() } catch (e) { setError(e instanceof Error ? e.message : 'CRM5_ADMIN_OPERATION_FAILED') } finally { setBusy(false) } }
  const selected = availability?.recipients.find(r => r.id === recipient)
  return <section aria-label="Versioni e disponibilità Client"><h3>Versioni e disponibilità Client</h3>{error && <p role="alert">{domainMessage(error)}</p>}
    <button disabled={disabled || busy} onClick={() => void run(async () => { setVersions(await domainApi<Versions>(`questions/${question.id}/versions`, csrf, targetId)) })}>Versioni di questa domanda</button>
    {versions && <div>{!versions.versions.length && <p>Nessuna versione pubblicata.</p>}{versions.versions.map(v => <article key={v.id}><strong>Revisione {v.revision}{v.active ? ' · Live' : ''}</strong><p>{v.definition}</p><small>{new Date(v.at).toLocaleString('it-IT')}</small>{!v.active && <button disabled={disabled || busy} onClick={() => { if (window.confirm(`Ripristinare la revisione ${v.revision} nel Client? La bozza resta separata. I permessi attuali saranno ricontrollati.`)) void run(async () => {
      onChanged(await domainApi<DomainQuestion>(`questions/${question.id}/rollback`, csrf, targetId, { revision: question.revision, versionId: v.id, expectedInstallationRevision: versions.installationRevision })); setVersions(undefined); setAvailability(undefined)
    }) }}>Ripristina questa versione</button>}</article>)}</div>}
    <button disabled={disabled || busy} onClick={() => void run(async () => { setAvailability(await domainApi<Availability>(`questions/${question.id}/availability`, csrf, targetId)); setRecipient('') })}>Verifica disponibilità per destinatario</button>
    {availability && <div><p>{availability.published ? `Pubblicata · revisione ${availability.revision}. Seleziona chi deve usarla.` : 'Questa domanda non è pubblicata.'}</p>
      {availability.published && <><label>Destinatario Client<select value={recipient} onChange={e => setRecipient(e.target.value)}><option value="">Scegli destinatario…</option>{availability.recipients.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        {!selected && <p className="domain-callout">Accesso del destinatario da verificare.</p>}
        {selected && <div className={'domain-callout ' + (selected.available ? 'success' : '')}><strong>{selected.available ? 'Scope Client verificato' : 'Accesso da completare'} · {selected.name}</strong><p>{selected.available ? 'Account attivo e autorizzazioni coerenti con questa versione pubblicata. Il collaudo con questo account verifica anche collegamento e permessi SQL.' : domainMessage(selected.code)}</p>{!selected.available && <><ul>{[...selected.missing.objects, ...selected.missing.columns, ...selected.missing.relations].map((x, i) => <li key={i}>{x}</li>)}</ul><button onClick={onUsers}>Completa accessi in Utenti</button></>}</div>}
        {!availability.recipients.length && <p>Nessun destinatario disponibile. Crea o abilita l’account in Utenti.</p>}</>}
    </div>}
  </section>
}

