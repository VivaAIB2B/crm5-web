import type { ResultColumn } from './chartModel'
export type DictionaryOutput = { identityAlias: string; metricAlias: string; displayFields: { key: string; label: string; alternatives: string[][] }[] }
// Display formatting uses only the approved, pinned aliases. Rows are never joined,
// grouped or fetched again here; identity is retained even for duplicate names.
export function dictionaryResults(rows: Record<string, unknown>[], supplied: ResultColumn[] | undefined, output: DictionaryOutput) {
  const text = (v: unknown) => v == null ? '' : String(v).trim()
  const columns: ResultColumn[] = output.displayFields.map(f => ({ name: f.key, label: f.label,
    kind: f.alternatives.length === 1 && f.alternatives[0][0] === output.metricAlias ? 'numeric' : 'categorical',
    typeFamily: f.alternatives[0][0] === output.metricAlias ? supplied?.find(c => c.name === output.metricAlias)?.typeFamily ?? 'Unknown' : 'Text' }))
  const presented = rows.map(row => {
    const view: Record<string, unknown> = { ...row, dictionaryIdentity: row[output.identityAlias] }
    for (const f of output.displayFields) view[f.key] = f.alternatives[0][0] === output.metricAlias ? row[output.metricAlias] :
      f.alternatives.map(group => group.map(k => text(row[k])).filter(Boolean).join(' ')).find(Boolean) ?? null
    view.dictionaryLabel = columns.filter(c => c.kind !== 'numeric').map(c => text(view[c.name])).filter(Boolean).concat('ID ' + text(row[output.identityAlias])).join(' · ')
    return view
  })
  const id: ResultColumn = { name: 'dictionaryIdentity', label: 'ID', kind: 'categorical', typeFamily: supplied?.find(c => c.name === output.identityAlias)?.typeFamily ?? 'Unknown' }
  return { rows: presented, columns: [...columns, id], chartColumns: [{ name: 'dictionaryLabel', label: 'Elemento', kind: 'categorical' as const, typeFamily: 'Text' }, ...columns.filter(c => c.kind === 'numeric'), id], details: true }
}

