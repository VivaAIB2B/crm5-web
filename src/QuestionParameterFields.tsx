import type { ParameterOptions, QuestionParameters } from './domainApi'
export const defaultParameters: QuestionParameters = { enableYear: false, minimumYear: 2000, maximumYear: 2100, year: 0, enableStatus: false, statuses: [], status: 0 }
export default function QuestionParameterFields({ value, options, disabled, onChange }: { value: QuestionParameters; options?: ParameterOptions; disabled: boolean; onChange: (p: QuestionParameters) => void }) {
  function change(p: Partial<QuestionParameters>) { onChange({ ...value, ...p }) }
  return <fieldset disabled={disabled}><legend>Parametri riutilizzabili</legend>
    <label><input type="checkbox" checked={value.enableYear} disabled={!options?.yearAvailable} onChange={e => change({ enableYear: e.target.checked })} />Anno dell’ordine</label>
    {value.enableYear && <div className="domain-param-fields"><label>Primo anno<input type="number" min={1900} max={2100} value={value.minimumYear} onChange={e => change({ minimumYear: Number(e.target.value) })} /></label>
      <label>Ultimo anno<input type="number" min={1900} max={2100} value={value.maximumYear} onChange={e => change({ maximumYear: Number(e.target.value) })} /></label>
      <label>Anno predefinito<input type="number" min={0} max={2100} value={value.year} onChange={e => change({ year: Number(e.target.value) })} /></label><small>0 = tutto lo storico. L’anno usa un intervallo dal 1° gennaio al 1° gennaio successivo; per date con fuso orario il confine è UTC.</small></div>}
    <label><input type="checkbox" checked={value.enableStatus} disabled={!options?.statuses.length} onChange={e => change({ enableStatus: e.target.checked, statuses: e.target.checked ? (options?.statuses.slice(0, 12).map(s => s.id) ?? []) : [], status: 0 })} />Stato dell’ordine</label>
    {!options?.statuses.length && <small>Conferma le decodifiche degli stati in Connessioni per abilitare questo parametro.</small>}
    {value.enableStatus && <><p>Seleziona fino a 12 stati autorizzati.</p>{options?.statuses.map(s => <label key={s.id}><input type="checkbox" checked={value.statuses.includes(s.id)} onChange={e => change({ statuses: e.target.checked ? [...value.statuses, s.id] : value.statuses.filter(n => n !== s.id), status: 0 })} />{s.label} ({s.code})</label>)}
      <label>Stato predefinito<select aria-label="Stato predefinito" value={value.status} onChange={e => change({ status: Number(e.target.value) })}><option value={0}>Tutti gli stati</option>{options?.statuses.filter(s => value.statuses.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label></>}
    <p>Il collaudo verifica tutti i limiti e gli stati, combinati con gli anni predefinito ed estremi dell’intervallo. Le altre annualità sono autorizzate dallo stesso contratto.</p>
  </fieldset>
}

