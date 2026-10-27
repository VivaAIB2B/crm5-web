import type { ChartPreference, ResultColumn } from './chartModel'
import type { DictionaryOutput } from './dictionaryResults'

export type ParameterDefinition = { name: string; label: string; type: 'integer'; required: boolean; default: number; minimum: number; maximum: number; options: { value: number; label: string }[] | null; minimumNonZero: number | null; allowsZero: boolean }
export type QuestionPresentation = { mode: 'table' | 'chart'; chart: ChartPreference | null }
export type CapabilityBinding = { targetId: string; capabilityId: string; name: string; packageId: string; packageVersion: string; packageChecksum: string; manifestChecksum: string; contractChecksum: string; bindingHash: string; dialect: string }
export type CapabilityDefinition = { binding: CapabilityBinding; description: string; definitions: string; limitations: string; parameters: ParameterDefinition[]; defaults: Record<string, number>; columns: ResultColumn[]; chartColumns: ResultColumn[]; dictionaryOutput: DictionaryOutput | null; chartPreference: ChartPreference | null }
export type Project = { id: string; title: string; revision: number; createdAt: string }
export type QuestionSummary = { id: string; title: string; projectId: string | null; revision: number; updatedAt: string; lastSucceededAt: string | null }
export type QuestionPage = { items: QuestionSummary[]; next: { updatedAt: string; id: string } | null }
export type Execution = { id: string; revision: number; status: string; preparedAt: string; startedAt: string | null; finishedAt: string | null; expiresAt: string; parameters: Record<string, number>; auditRequestId: string | null; rowCount: number | null; code: string | null; operationId: string | null }
export type ExactResult = { schemaVersion: string; rows: Record<string, unknown>[]; columns: ResultColumn[]; rowCount: number; requestId: string; capabilityId: string; semanticPackageVersion: string; elapsedMilliseconds: number; dictionaryOutput: DictionaryOutput | null; resultColumns: string[] | null; rowsHash: string; numericEncoding: string }
export type Snapshot = { executionId: string; questionRevision: number; executedAt: string; savedAt: string; parameters: Record<string, number>; result: ExactResult }
export type QuestionDocument = { schemaVersion: string; identity: { id: string; title: string; projectId: string | null; revision: number; createdAt: string; updatedAt: string }; binding: CapabilityBinding | null; definition: { kind: string; calculationDescription: string; parameters: ParameterDefinition[]; defaults: Record<string, number>; resultScope: string } | null; presentation: QuestionPresentation | null; defaultSql: { dialect: string; language: string; parametersHash: string } | null; path: { id: string; at: string; kind: string; status: string; revision: number; executionId: string | null; code: string | null }[]; executions: Execution[]; lastSuccessfulResult: Snapshot | null; availability: string; diagnosticCode: string | null; hasMoreActivity: boolean }
export type PreparedQuestion = { preparationId: string; questionRevision: number; parameters: Record<string, number>; expiresAt: string; executionToken: string }

export function validParameter(p: ParameterDefinition, value: number) {
  return Number.isInteger(value) && value >= p.minimum && value <= p.maximum &&
    (!p.options || p.options.some(o => o.value === value)) &&
    (p.minimumNonZero == null || value >= p.minimumNonZero || (p.allowsZero && value === 0))
}

// Compare decimal spellings without passing either side through Number. The graph
// receives a separate approximate copy only if its decimal round-trip is unchanged.
export function normalizedDecimal(value: string): string | undefined {
  const m = /^(-?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(value)
  if (!m) return
  const exponent = Number(m[4] ?? 0)
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 400) return
  let digits = m[2] + (m[3] ?? '')
  const point = m[2].length + exponent
  if (point <= 0) digits = '0.' + '0'.repeat(-point) + digits
  else if (point >= digits.length) digits += '0'.repeat(point - digits.length)
  else digits = digits.slice(0, point) + '.' + digits.slice(point)
  let [whole, fraction = ''] = digits.split('.')
  whole = whole.replace(/^0+(?=\d)/, ''); fraction = fraction.replace(/0+$/, '')
  const result = whole + (fraction ? '.' + fraction : '')
  return result === '0' ? '0' : m[1] + result
}
export function chartRows(rows: Record<string, unknown>[], columns: ResultColumn[]) {
  return rows.map(row => {
    const copy = { ...row }
    for (const c of columns) {
      const v = row[c.name]
      if (typeof v !== 'string' || !['Integer', 'Decimal'].includes(c.typeFamily)) continue
      const n = Number(v)
      if (c.typeFamily === 'Integer') {
        if (/^-?\d+$/.test(v) && Number.isSafeInteger(n) && BigInt(v) === BigInt(n)) copy[c.name] = n
      } else if (Number.isFinite(n) && normalizedDecimal(v) !== undefined && normalizedDecimal(v) === normalizedDecimal(String(n))) copy[c.name] = n
    }
    return copy
  })
}

