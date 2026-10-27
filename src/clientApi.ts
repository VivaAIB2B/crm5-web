export type ClientScope = { targetId?: string; context?: string; signal?: AbortSignal }
export type ClientTarget = { id: string; name: string; packageVersion: string; diagnosticCode: string | null }
export type Session = { version: string; fixture: boolean; mode: string; csrf: string; expiresAt: string; ticketTtlSeconds: number }
export type Capability = { id: string; name: string; description: string; exampleQuestion: string; definitions: string; limitations: string; fixedLimit: number | null }
export type Catalog = { packageId: string; packageVersion: string; packageChecksum: string; capabilities: Capability[]; demoQuestions?:{question:string;definition:string;available:boolean;capabilityId:string|null}[] }
export type Intent = { request_id: string; status: 'executable' | 'clarification_required' | 'unsupported' | 'rejected'; reason_code: string; capability_name: string | null; capability_id: string | null; parameters: Record<string, number> | null; package_version: string; provenance: { origin: string; provider: string | null }; clarification: { question: string; missing: string[] } | null; execution_token: string | null; clarification_token: string | null; expires_at: string | null }
export type Result = { rows: Record<string, unknown>[]; rowCount: number; requestId: string; semanticPackageVersion: string; elapsedMilliseconds: number; columns?:import('./chartModel').ResultColumn[];capabilityId?:string;chart_preference?:import('./chartModel').ChartPreference;resultColumns?:string[];dictionaryOutput?:import('./dictionaryResults').DictionaryOutput }
export type Receipt = { operationId: string; kind: string; status: string; auditRequestId: string | null; rowCount: number | null; code: string | null }
export class ClientApiError extends Error {
  constructor(readonly code: string, readonly operationId?: string, readonly uncertain = false, readonly status?: number) { super(code) }
}
const prefix = '/api/client/v1'
export async function clientApi<T>(path: string, csrf?: string, body?: object, operationId?: string, method?: string, scope?: ClientScope): Promise<T> {
  const verb = method ?? (body ? 'POST' : 'GET')
  try {
    const response = await fetch(prefix + '/' + path, { method: verb, credentials: 'same-origin', cache: 'no-store',
      headers: { ...(scope?.targetId ? { 'X-CRM5-Target': scope.targetId } : {}), ...(scope?.context ? { 'X-CRM5-Context': scope.context } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CRM5-CSRF': csrf } : {}), ...(operationId ? { 'Idempotency-Key': operationId } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.any([...(scope?.signal ? [scope.signal] : []), AbortSignal.timeout(path.startsWith('scope') ? 90000 : path === 'interpretations' ? 40000 : path === 'executions' || path.endsWith('/executions') ? 25000 : 10000)]) })
    if (response.status === 204) return undefined as T
    const payload = await response.json()
    if (!response.ok) { if (response.status === 401 && payload.code === 'CRM5_IDENTITY_SESSION_REQUIRED' && !scope?.signal?.aborted) window.dispatchEvent(new Event('crm5:client-session-ended')); throw new ClientApiError(payload.code ?? 'CRM5_CLIENT_OPERATION_FAILED', operationId, false, response.status) }
    return payload as T
  } catch (error) {
    if (error instanceof ClientApiError) throw error
    throw new ClientApiError('CRM5_CLIENT_RESPONSE_UNKNOWN', operationId, Boolean(operationId))
  }
}
export function clientMessage(code: string): string {
  if (code.includes('WORKSPACE_REVISION_CONFLICT')) return 'La domanda è stata salvata da un’altra finestra. Riaprila per vedere la revisione corrente; le tue modifiche non sono state salvate.'
  if (code.includes('WORKSPACE_EXECUTION_CONFLICT')) return 'È già presente un tentativo o una conferma per questa operazione. Verifica lo stato della domanda prima di riprendere.'
  if (code.includes('WORKSPACE_RESULT_NOT_SAVED')) return 'L’interrogazione è terminata ma il nuovo risultato non è stato salvato. L’ultimo risultato valido resta disponibile. Verifica lo stato prima di una nuova esecuzione.'
  if (code.includes('WORKSPACE_RESULT_UNKNOWN')) return 'Il tentativo è stato interrotto e il suo esito è da verificare. Non viene ripetuto automaticamente.'
  if (code.includes('WORKSPACE_CAPABILITY') || code.includes('WORKSPACE_BINDING_CONFLICT')) return 'La capacità è cambiata o non è più disponibile. Il responsabile deve verificarla prima di riutilizzare la domanda.'
  if (code.includes('WORKSPACE_NOT_FOUND')) return 'Domanda o progetto non disponibile in questo spazio personale.'
  if (code.includes('WORKSPACE_NUMERIC_PRECISION')) return 'La sorgente non ha restituito un tipo numerico esatto compatibile. Il risultato precedente è conservato; occorre verificare il contratto della capacità.'
  if (code.includes('WORKSPACE_SIZE_LIMIT')) return 'Il risultato supera il limite dell’archivio. L’ultimo risultato valido è conservato.'
  if (code.includes('WORKSPACE_PROJECT_LIMIT')) return 'È stato raggiunto il limite di 200 progetti personali per questo database.'
  if (code.includes('WORKSPACE_INPUT_INVALID')) return 'Controlla il titolo, i parametri e la rappresentazione della domanda.'
  if (code.includes('CREDENTIALS')) return 'Nome utente o password non validi.'
  if (code.includes('TARGET_DENIED')) return 'Accesso a questo database revocato o non autorizzato.'
  if (code.includes('CONTEXT_CHANGED')) return 'Il contesto Client è cambiato. Scegli nuovamente il database.'
  if (code.includes('DATABASE_UNAVAILABLE')) return 'Il gestionale non è disponibile. Contatta il responsabile.'
  if (code.includes('SESSION')) return 'Sessione non disponibile o scaduta. Riapri il Client e seleziona nuovamente il contesto.'
  if (code.includes('TICKET_EXPIRED')) return 'La conferma è scaduta. Prepara una nuova esecuzione.'
  if (code.includes('TICKET_INVALID')) return 'Questa conferma non è più utilizzabile. Prepara una nuova esecuzione.'
  if (code.includes('PARAMETER')) return 'Il valore proposto non rientra nel contratto della capacità. Nessuna interrogazione è stata eseguita.'
  if (code.includes('BUDGET') || code.includes('QUOTA')) return 'Il limite di utilizzo è raggiunto. Il responsabile deve verificare il budget prima di riprendere.'
  if (code.includes('RATE_LIMIT')) return 'Il provider sta limitando le richieste. Attendi e verifica con il responsabile; non è stato avviato un nuovo tentativo.'
  if (code.includes('AUDIT') || code.includes('TENANT_DISABLED')) return 'Le interrogazioni sono sospese: il responsabile deve verificare audit e installazione.'
  if (code.includes('PERMISSION') || code.includes('NOT_AUTHORIZED') || code.includes('PRINCIPAL')) return 'I permessi non consentono questa operazione. Contatta il responsabile dell’installazione.'
  if (code.includes('CHANGED') || code.includes('STALE') || code.includes('SCHEMA')) return 'Configurazione, package o schema sono cambiati. Occorre verificarli e interpretare una nuova domanda.'
  if (code.includes('TIMEOUT') || code.includes('DEADLINE')) return 'Il tempo disponibile per la demo è terminato. Verifica lo stato della richiesta prima di riprendere.'
  if (code.includes('AUTHENTICATION') || code.includes('SECRET')) return 'L’account AI non è disponibile. Il responsabile deve verificare credenziali e autorizzazioni.'
  if (code.includes('AI')) return 'L’interprete AI non è disponibile o la risposta non è valida. Il responsabile può verificare il provider; resta disponibile la domanda certificata.'
  if (code.includes('REQUEST_ALREADY') || code.includes('REQUEST_CONFLICT')) return 'Questa richiesta è già stata ricevuta. Verifica la sua ricevuta; non viene ripetuta.'
  if (code.includes('ORIGIN') || code.includes('CSRF')) return 'La sessione browser non supera i controlli di accesso locale. Riapri il client sullo stesso indirizzo.'
  if (code.includes('RESPONSE_UNKNOWN')) return 'La risposta non è arrivata: l’esito è da verificare. Non inviare di nuovo l’esecuzione.'
  return 'L’operazione non è riuscita. Verifica la ricevuta e comunica il codice al responsabile.'
}

