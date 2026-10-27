import type { ArchiveDetail } from './conversationsApi'
import { targetHeaders } from './databaseTargets'
import type { ChatMessage, PipelineStep, QuestionGroup } from './questionModel'
import type { PreparationReport } from './preparationApi'

export type Requirement = { key: string; label: string; value: string; basis: string; evidence: string; state: string }
export type RequirementsRequest = { conversationId: string; requestId: string; turn: number; action: 'message' | 'confirm' | 'revise'; message?: string; sourceCapabilityId?: string; revision?: number }
export type RequirementsEnvelope = {
  contractVersion: string; conversationId: string; turn: number
  status: 'clarification_required' | 'review_required' | 'requirements_confirmed' | 'unsupported'
  understanding: string; requirements: Requirement[]; clarification: { key: string; question: string; options: string[] } | null
  openIssues: string[]; sourceName: string | null; sourceRevision: number | null; expiresAt: string
  archive?: ArchiveDetail
  provenance: { origin: string; provider: string; modelOrDeployment: string } | null
}
export type QuestionConversation = {
  revision?: number; saved?: boolean; contextChanged?: boolean; requestState?: 'pending' | 'interrupted' | 'completed' | null; requestError?: string
  id: string; title: string; sourceId?: string; messages: ChatMessage[]; turn: number; draft: string
  response?: RequirementsEnvelope; busy: boolean; error?: string; retry?: RequirementsRequest
  preparation?: PreparationReport; preparationBusy?: boolean; preparationStarted?: boolean; preparationError?: string; preparationInvalidated?: boolean
}
export function startConversation(sourceId?: string, title = ''): QuestionConversation {
  return { id: crypto.randomUUID(), title: title || 'Nuova domanda', sourceId, turn: 0, draft: title, busy: false,
    messages: [{ role: 'assistant', text: sourceId ? 'Partiamo da questa domanda del catalogo. Puoi precisarla nel messaggio prima di inviarla. La voce originale del catalogo resta invariata.'
      : 'Quale domanda aziendale vuoi configurare? Scrivila qui: raccoglieremo i requisiti e chiariremo soltanto ciò che serve.' }] }
}
export const conversationGroup = (p: QuestionConversation): QuestionGroup => p.turn === 0 ? 'Bozze' : 'In corso'
export function requirementsPipeline(p: QuestionConversation): { current: number; steps: PipelineStep[] } {
  const preparing = p.response?.status === 'requirements_confirmed' && p.preparationStarted && !p.preparationInvalidated
  const current = preparing ? 2 : p.turn === 0 ? 0 : 1
  return { current, steps: ['Domanda', 'Requisiti', 'Preparazione', 'Collaudo', 'Pubblicazione'].map((label, i) => ({ label,
    state: i === 2 && preparing ? 'in-progress' : i === current ? 'current' : i < current ? 'available' : 'waiting', detail: i > 2 ? 'Da collegare' : i === 2
      ? preparing ? p.preparationBusy ? 'Valutazione in corso' : p.preparationError ? 'Da riprovare' : 'Anteprima da valutare' : 'In attesa di valutazione' : i === 0
      ? p.turn ? 'Domanda raccolta' : 'Scrivi la domanda' : p.response?.status === 'requirements_confirmed'
        ? 'Requisiti confermati' : p.response?.status === 'review_required' ? 'Riepilogo da confermare' : 'Da chiarire' })) }
}
export async function requestRequirements(request: RequirementsRequest, csrf: string, targetId: string | undefined, signal: AbortSignal): Promise<RequirementsEnvelope> {
  const r = await fetch('/api/admin/questions/requirements', { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'X-CRM5-CSRF': csrf, ...targetHeaders(targetId) }, body: JSON.stringify(request) })
  if (r.status === 401) window.dispatchEvent(new Event('crm5:admin-session-ended'))
  const text = await r.text()
  let data: RequirementsEnvelope & { code?: string }
  try { data = JSON.parse(text) } catch { throw Error('CRM5_REQUIREMENTS_RESPONSE_INVALID') }
  if (!r.ok) throw Error(data.code || 'CRM5_ADMIN_OPERATION_FAILED')
  if (data.contractVersion !== 'crm5.requirements/v1' || data.conversationId !== request.conversationId || data.turn !== request.turn + 1 ||
    !['clarification_required', 'review_required', 'requirements_confirmed', 'unsupported'].includes(data.status) ||
    !Array.isArray(data.requirements) || !Array.isArray(data.openIssues)) throw Error('CRM5_REQUIREMENTS_RESPONSE_INVALID')
  return data
}
const errors: Record<string, string> = {
  CRM5_ARCHIVE_REVISION_CONFLICT: 'La conversazione è stata modificata da un’altra finestra o browser. Ricarica la conversazione prima di continuare; il testo non inviato resta qui.',
  CRM5_ARCHIVE_REQUEST_PENDING_CONFLICT: 'Una risposta è già in corso sul server. Ricarica la conversazione per leggerne lo stato; nessuna nuova chiamata AI viene avviata.',
  CRM5_ARCHIVE_REQUEST_INTERRUPTED_CONFLICT: 'La risposta precedente è stata interrotta. Ricarica la conversazione e invia un nuovo messaggio per proseguire.',
  CRM5_ARCHIVE_NOT_FOUND: 'La conversazione non è disponibile per questo utente e questo database.',
  CRM5_ARCHIVE_UNAVAILABLE: 'L’archivio non è disponibile. Il salvataggio non è confermato; riprova a caricare la conversazione.',
  CRM5_IDENTITY_DATABASE_UNAVAILABLE: 'Il database gestionale non è disponibile. Il salvataggio non è confermato; ricarica la conversazione quando torna disponibile.',
  CRM5_ARCHIVE_RESPONSE_INVALID: 'La conversazione ricevuta non è utilizzabile. Riprova a caricarla.',

  CRM5_AI_DISABLED: 'Il provider AI è disattivato. Puoi configurarlo in Avanzate → Impostazioni AI e poi riprovare.',
  CRM5_AI_REAL_CALLS_NOT_AUTHORIZED: 'Le chiamate AI non sono autorizzate. Verifica la configurazione in Avanzate → Impostazioni AI.',
  CRM5_AI_SECRET_UNAVAILABLE: 'La chiave del provider non è disponibile sul server. Verifica la configurazione AI e riprova.',
  CRM5_AI_CONFIGURATION_INVALID: 'La configurazione AI richiede una verifica in Avanzate → Impostazioni AI.',
  CRM5_AI_CONFIGURATION_CHANGED: 'La configurazione AI è cambiata durante la risposta. Puoi riprovare con la configurazione attuale.',
  CRM5_AI_BUDGET_EXCEEDED: 'È stato raggiunto un limite AI. I requisiti raccolti restano disponibili; verifica i limiti prima di riprovare.',
  CRM5_AI_AUTHENTICATION_FAILED: 'Il provider ha rifiutato le credenziali configurate. Verifica le impostazioni AI.',
  CRM5_AI_RATE_LIMITED: 'Il provider ha raggiunto un limite di richieste. Puoi riprovare più tardi.',
  CRM5_AI_TIMEOUT: 'Il provider non ha risposto in tempo. I requisiti precedenti restano disponibili; puoi riprovare.',
  CRM5_AI_INPUT_LIMIT: 'La conversazione supera la dimensione consentita dal profilo AI. I requisiti raccolti restano visibili.',
  CRM5_REQUIREMENTS_EXPIRED: 'La conversazione temporanea è scaduta. Puoi ripartire dalla domanda, conservando qui il riepilogo precedente.',
  CRM5_REQUIREMENTS_CONTEXT_CONFLICT: 'I dati amministrativi sono cambiati. Riparti dalla domanda per usare il contesto aggiornato.',
  CRM5_REQUIREMENTS_SOURCE_CONFLICT: 'Il riferimento della domanda è cambiato. Riparti dalla domanda.',
  CRM5_REQUIREMENTS_TURN_CONFLICT: 'Questa risposta non è allineata alla conversazione. Prova Riprova invio per recuperare l’ultima risposta.',
  CRM5_REQUIREMENTS_BUSY_CONFLICT: 'Una risposta è già in corso per questa conversazione. Attendi e riprova.',
  CRM5_REQUIREMENTS_PACKAGE_REQUIRED: 'Package iniziale assente. La preparazione del primo package richiede un incremento dedicato.',
  CRM5_REQUIREMENTS_QUESTION_DENIED: 'Questa chat raccoglie requisiti aziendali. Riformula la richiesta descrivendo il risultato che vuoi ottenere.',
  CRM5_REQUIREMENTS_LIMIT: 'È stato raggiunto un limite della conversazione. Puoi ripartire dalla domanda.',
  CRM5_PREPARATION_REQUIREMENTS_REQUIRED: 'Conferma il riepilogo dei requisiti prima di valutare la preparazione.',
  CRM5_PREPARATION_TURN_CONFLICT: 'I requisiti sono cambiati. Conferma il riepilogo aggiornato e valuta nuovamente la preparazione.',
  CRM5_PREPARATION_RESPONSE_INVALID: 'Il rapporto ricevuto non è utilizzabile. I requisiti restano disponibili; puoi riprovare la valutazione.',
}
export function requirementsError(code: string) {
  return errors[code] || (code.startsWith('CRM5_PREPARATION_') ? 'Non riesco a completare la valutazione. I requisiti restano disponibili; puoi riprovare.' : code.startsWith('CRM5_REQUIREMENTS_') || code.startsWith('CRM5_AI_')
    ? 'La risposta AI non è utilizzabile. I requisiti precedenti restano disponibili; puoi riprovare.'
    : 'Non riesco a completare l’invio. Puoi riprovare per recuperare la risposta senza perdere la conversazione.')
}

