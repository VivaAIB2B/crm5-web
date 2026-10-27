import { targetHeaders } from './databaseTargets'
import type { PreparationReport } from './preparationApi'
import type { QuestionConversation, RequirementsEnvelope } from './requirementsApi'

export type ArchiveDetail = {
  contractVersion: 'crm5.conversation/v1'; id: string; title: string; revision: number; createdAt: string; updatedAt: string
  sourceCapabilityId: string | null; messages: { id: string; role: 'user' | 'assistant'; text: string; at: string; kind: string; data?: unknown }[]
  response: RequirementsEnvelope | null; preparation: PreparationReport | null; contextChanged: boolean
  requestState: 'pending' | 'interrupted' | 'completed' | null; requestError: string | null
}
export type ArchiveSummary = { id: string; title: string; revision: number; updatedAt: string; status: string }
export type ArchiveCursor = { updatedAt: string; id: string }
export type ArchivePage = { contractVersion: 'crm5.conversations/v1'; items: ArchiveSummary[]; next: ArchiveCursor | null }
async function read<T>(path: string, targetId: string | undefined, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/admin/questions/conversations' + path, { headers: targetHeaders(targetId), signal })
  if (response.status === 401) window.dispatchEvent(new Event('crm5:admin-session-ended'))
  const data = await response.json()
  if (!response.ok) throw Error(data.code || 'CRM5_ARCHIVE_UNAVAILABLE')
  return data
}
export async function listConversations(targetId: string | undefined, signal: AbortSignal, cursor?: ArchiveCursor): Promise<ArchivePage> {
  const query = new URLSearchParams({ limit: '40', ...(cursor ? { before: cursor.updatedAt, beforeId: cursor.id } : {}) })
  const data = await read<ArchivePage>('?' + query, targetId, signal)
  if (data.contractVersion !== 'crm5.conversations/v1' || !Array.isArray(data.items)) throw Error('CRM5_ARCHIVE_RESPONSE_INVALID')
  return data
}
export async function readConversation(id: string, targetId: string | undefined, signal: AbortSignal): Promise<ArchiveDetail> {
  const data = await read<ArchiveDetail>('/' + encodeURIComponent(id), targetId, signal)
  if (data.contractVersion !== 'crm5.conversation/v1' || data.id !== id || !Number.isInteger(data.revision) || data.revision < 1 ||
    !Array.isArray(data.messages)) throw Error('CRM5_ARCHIVE_RESPONSE_INVALID')
  return data
}
export function fromArchive(a: ArchiveDetail, draft = ''): QuestionConversation {
  return { id: a.id, title: a.title, sourceId: a.sourceCapabilityId ?? undefined, revision: a.revision, saved: true,
    messages: a.messages, turn: a.response?.turn ?? 0, draft, busy: false, response: a.response ?? undefined,
    preparation: a.preparation ?? undefined, preparationStarted: !!a.preparation, preparationInvalidated: a.contextChanged,
    contextChanged: a.contextChanged, requestState: a.requestState, requestError: a.requestError ?? undefined }
}

