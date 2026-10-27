import type { ArchiveDetail } from './conversationsApi'
import { targetHeaders } from './databaseTargets'
import type { QuestionConversation } from './requirementsApi'

export type PreparationReport = {
  contractVersion: 'crm5.preparation/v1'; conversationId: string; requirementsTurn: number; requirementsHash: string
  catalogRevision: number; catalogHash: string; at: string; expiresAt: string
  candidate: { id: string; revision: number; name: string; state: string; compatibility: string } | null
  coverage: { key: string; label: string; value: string; status: 'covered' | 'parameterized' | 'uncovered'; explanation: string
    parameter: { name: string; value: number; minimum: number; maximum: number; allowedValues: number[] | null } | null }[]
  archive?: ArchiveDetail
  warnings: string[]
}
export function currentPreparation(p: QuestionConversation, revision: number) {
  const report = p.preparation
  return p.response?.status === 'requirements_confirmed' && report?.requirementsTurn === p.turn && report.catalogRevision === revision
    && !p.preparationInvalidated ? report : undefined
}
export async function requestPreparation(p: QuestionConversation, csrf: string, targetId: string | undefined, signal: AbortSignal): Promise<PreparationReport> {
  const r = await fetch('/api/admin/questions/preparation', { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'X-CRM5-CSRF': csrf, ...targetHeaders(targetId) },
    body: JSON.stringify({ conversationId: p.id, turn: p.turn, revision: p.revision ?? 0, requestId: crypto.randomUUID(), ...(p.sourceId ? { sourceCapabilityId: p.sourceId } : {}) }) })
  if (r.status === 401) window.dispatchEvent(new Event('crm5:admin-session-ended'))
  let data: PreparationReport & { code?: string }
  try { data = await r.json() } catch { throw Error('CRM5_PREPARATION_RESPONSE_INVALID') }
  if (!r.ok) throw Error(data.code || 'CRM5_ADMIN_OPERATION_FAILED')
  const requirements = p.response?.requirements ?? []
  if (data.contractVersion !== 'crm5.preparation/v1' || data.conversationId !== p.id || data.requirementsTurn !== p.turn ||
    !Array.isArray(data.coverage) || !Array.isArray(data.warnings) || data.coverage.length !== requirements.length ||
    data.coverage.some((row, i) => row.key !== requirements[i].key || row.label !== requirements[i].label || row.value !== requirements[i].value ||
      !['covered', 'parameterized', 'uncovered'].includes(row.status) || typeof row.explanation !== 'string' ||
      row.status === 'parameterized' && (!row.parameter || !Number.isInteger(row.parameter.value)))) throw Error('CRM5_PREPARATION_RESPONSE_INVALID')
  return data
}

