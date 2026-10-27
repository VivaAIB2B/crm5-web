import { targetHeaders } from './databaseTargets'

export type BlueprintAttribute = { key: string; label: string; type: string; required: boolean; aliases: string[] }
export type BlueprintEntity = { key: string; label: string; required: boolean; attributes: BlueprintAttribute[]; identity: string[] }
export type BusinessBlueprint = { id: string; domain: string; entities: BlueprintEntity[];
  concepts: { key: string; label: string; description: string; entities: string[]; fields: string[] }[];
  metrics: { key: string; label: string; definition: string }[];
  questions: { key: string; label: string; example: string; metric: string; limits: number[]; definition?: string; output: { field: string; label: string }[] }[] }
export type EntityBinding = { entity: string; source: string | null; attributes: Record<string, string> }
export type QuestionParameters = { enableYear: boolean; minimumYear: number; maximumYear: number; year: number; enableStatus: boolean; statuses: number[]; status: number }
export type ParameterOptions = { yearAvailable: boolean; statuses: { id: number; code: string; label: string }[] }
export type BusinessDictionary = { version: string; revision: number; blueprintId: string; domain: string;
  schemaHash: string; confirmed: boolean; at: string; bindings: EntityBinding[];
  extension?: { metrics: {key:string;label:string;definition:string;entity:string;attribute:string}[]; pendingMetrics?:string[]|null } | null; confirmedConcepts: string[]; orderStates: { code: string; label: string }[] }
export type DictionaryMetricOption = { key: string; label: string; definition: string; operation: string; entity: string; attribute: string;
  source: string | null; column: string | null; columns: string[]; currencies: string[]; currency: string | null; approved: boolean; issues: string[] }
export type DictionaryView = { blueprint: BusinessBlueprint; dictionary: BusinessDictionary | null;
  candidates: Record<string, { source: string; score: number; columns: string[]; primaryKey: string[]; suggestedAttributes: Record<string, string> }[]>;
  issues: { concept: string; message: string }[]; connectionMatches: boolean; fixture: boolean;
  metricLibrary?: { id: string; version: string; metrics: DictionaryMetricOption[] } | null }

const messages: Record<string, string> = {
  CRM5_DICTIONARY_FIELD_TYPE_UNSUPPORTED: 'Questo tipo di campo non è ancora supportato nella risposta. Scegli testo, numero esatto, data o valore booleano.',
  CRM5_ADMIN_INPUT_TOO_LARGE: 'File troppo grande: usa un’esportazione inferiore a 1,9 MB.',
  CRM5_EXECUTION_QUOTA_EXCEEDED: 'Quota del runtime raggiunta. Le prove parziali sono conservate; riprendi il collaudo dopo il ripristino della quota.',
  CRM5_DOMAIN_RELATED_TESTS_REQUIRED: 'Altre domande Live dipendono dalla struttura modificata. Prepara e collauda le loro bozze, poi rileggi la verifica di pubblicazione per pubblicarle insieme.',
  CRM5_DICTIONARY_IMPORT_INVALID: 'File non valido o incompatibile. Importa un’esportazione CRM5 integra; le conferme saranno ripetute su questo database.',
  CRM5_DICTIONARY_SCHEMA_CHANGED: 'Il database è cambiato. In Connessioni premi Verifica cambiamenti del database, avvia la riparazione e ricontrolla i concetti segnalati. Poi riprendi la domanda dal Dizionario aggiornato.',
  CRM5_SANDBOX_APPROVAL_REQUIRED: 'Primo avvio: verifica le letture richieste nel Sandbox e approvale prima di preparare il test.',
  CRM5_DOMAIN_ROLLBACK_INCOMPATIBLE: 'La versione scelta non è compatibile con il package attuale. Prepara e collauda una nuova bozza.',
  CRM5_INSTALLATION_CHANGED: 'Il runtime è stato aggiornato. Rileggi lo stato e ripeti il controllo prima di procedere.',
  CRM5_CLIENT_ACCOUNT_DISABLED: 'L’account è disabilitato. Abilitalo in Utenti e ripeti la verifica.',
  CRM5_CLIENT_SCOPE_INCOMPLETE: 'I permessi del destinatario non coprono questa domanda. Aggiorna gli accessi al database in Utenti, poi ripeti la verifica.',
  CRM5_CLIENT_TARGET_DENIED: 'Il destinatario non ha accesso a questo database. Completa gli accessi in Utenti.',
  CRM5_DICTIONARY_EXPANSION_INVALID: 'Completa nome, campo o definizione e scegli una relazione presente nel database.',
  CRM5_DICTIONARY_FK_REQUIRED: 'La nuova entità o metrica richiede una FK verificata e una chiave primaria coerente.',
  CRM5_DICTIONARY_EXPANSION_LIMIT: 'Raggiunto il limite di espansioni di questo Dizionario. Rivedi le definizioni prima di aggiungerne altre.',
  CRM5_DICTIONARY_PARAMETERS_INVALID: 'Controlla intervallo, anno predefinito e stati confermati. I filtri richiesti nella chat devono essere mantenuti oppure chiariti nella conversazione.',
  CRM5_DOMAIN_CONTEXT_CHANGED: 'Il Dizionario o il collegamento sono cambiati. Avvia una nuova domanda dal Dizionario confermato; la versione Live resta disponibile.',
  CRM5_DOMAIN_REVISION_CONFLICT: 'Questa domanda è stata aggiornata in un’altra finestra. Riaprila prima di proseguire.',
  CRM5_DOMAIN_TEST_REQUIRED: 'La bozza richiede un nuovo test di tutti i valori ammessi prima della pubblicazione.',
  CRM5_DOMAIN_REQUIREMENTS_REQUIRED: 'Conferma tutti i requisiti e le colonne prima di preparare la capacità.',
  CRM5_DOMAIN_PREPARATION_REQUIRED: 'Prepara la bozza prima del collaudo.',
  CRM5_DOMAIN_QUESTION_UNSUPPORTED: 'La richiesta contiene requisiti fuori dal modello. Chiariscili nella conversazione.',
  CRM5_DOMAIN_PACKAGE_SCHEMA_REVIEW_REQUIRED: 'Il Dizionario e il package approvato hanno strutture diverse. Occorre una revisione del package prima di procedere.',
  CRM5_DOMAIN_REALIZATION_REVIEW_REQUIRED: 'L’associazione confermata non ha una realizzazione certificata nel runtime. Occorre una revisione tecnica del package.',
  CRM5_EXECUTION_NOT_AUTHORIZED: 'Manca un accesso autorizzato nel runtime CRM5. Apri la verifica degli accessi nella Preparazione per vedere le colonne e la procedura mirata di approvazione.',
  CRM5_RUNTIME_ACCESS_REVIEW_CHANGED: 'La domanda, il Dizionario o l’installazione sono cambiati. Ripeti la verifica degli accessi prima dell’approvazione locale.',
  CRM5_GRANTS_FAMILY_REVIEW_REQUIRED: 'Le famiglie Live hanno certificazioni legate agli accessi attuali. Occorre rivederle prima di ampliare i permessi del runtime.',
  CRM5_AI_DISABLED: 'Configura e abilita il provider AI in Impostazioni per iniziare la conversazione.',
  CRM5_AI_CALLS_NOT_AUTHORIZED: 'Le chiamate al provider AI non sono abilitate. Verifica le Impostazioni.',
  CRM5_DOMAIN_AI_PROPOSAL_INVALID: 'La proposta AI non rispetta il modello del Dizionario. Nessuna capacità è stata preparata.',
  CRM5_DICTIONARY_CONFIRMATION_REQUIRED: 'Conferma i cinque concetti del Dizionario prima di preparare domande.',
  CRM5_DICTIONARY_METRIC_INVALID: 'Controlla il campo importo, la valuta e la conferma della definizione. Questa metrica richiede importi decimali non nulli nella stessa valuta aziendale.',
  CRM5_METRIC_LIBRARY_INVALID: 'La libreria dei modelli non è valida. Occorre verificare i file dell’applicazione.',
  CRM5_METRIC_LIBRARY_UNAVAILABLE: 'La libreria delle metriche non è disponibile sul server. Verifica i file dell’applicazione.',

  CRM5_DICTIONARY_REVISION_CONFLICT: 'Il Dizionario è cambiato in un’altra finestra. Riapri Connessioni prima di salvare.',
  CRM5_DICTIONARY_MAPPING_INVALID: 'Controlla le associazioni, i collegamenti e le cinque conferme prima di salvare.',
  CRM5_DICTIONARY_TARGET_CHANGED: 'Il collegamento è cambiato. Rileggi la struttura e conferma di nuovo il Dizionario.',
  CRM5_DICTIONARY_BLUEPRINT_CHANGED: 'Il modello è stato aggiornato. Rileggi la struttura prima di confermare.',
  CRM5_DICTIONARY_REQUIRED: 'Prepara e conferma il Dizionario in Connessioni.',
  CRM5_DICTIONARY_BLUEPRINT_UNAVAILABLE: 'Il modello Vendite non è disponibile sul server. Verifica i file dell’applicazione.',
  CRM5_DATABASE_BINDING_DENIED: 'Il database raggiunto non corrisponde al collegamento selezionato.',
  CRM5_DATABASE_PERMISSION_DENIED: 'Il database ha rifiutato un accesso richiesto dal test. Verifica le autorizzazioni dell’account usato dal collegamento; poi ripeti il collaudo della stessa bozza.',
  CRM5_DATABASE_READONLY_IDENTITY_DENIED: 'L’account del collegamento non supera il controllo di identità e sola lettura. Verifica l’account SQL configurato prima di ripetere il collaudo.',
  CRM5_DATABASE_SCHEMA_STALE: 'La struttura effettiva del database non corrisponde al package approvato. Occorre verificare il package prima del collaudo.',
}
export function domainMessage(code: string) { return messages[code] ?? 'Operazione non completata. Controlla il collegamento e riprova.' }
export class DomainApiError extends Error { constructor(code: string, public issues: { concept: string; message: string }[] = []) { super(code) } }
export async function domainApi<T>(path: string, csrf: string, targetId?: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch('/api/admin/domain/' + path, { method: body === undefined ? 'GET' : 'POST', signal,
    cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-CRM5-CSRF': csrf, ...targetHeaders(targetId) },
    body: body === undefined ? undefined : JSON.stringify(body) })
  if (r.status === 401) window.dispatchEvent(new Event('crm5:admin-session-ended'))
  const data = await r.json(); if (!r.ok) throw new DomainApiError(data.code ?? 'CRM5_ADMIN_OPERATION_FAILED', data.issues ?? []); return data
}

export type QuestionModel = BusinessBlueprint['questions'][number]
export type QuestionProposal = { status: 'ready' | 'clarification_required' | 'unsupported'; understanding: string; questionKey: string | null; topN: number | null; outputs: string[]; clarification: string | null; uncovered: string[] }
export type DomainQuestion = { id: string; revision: number; dictionaryHash: string;
  turns: { role: string; text: string; at: string; provenance?: { origin: string; provider: string; modelOrDeployment: string } }[];
  parameters?: QuestionParameters | null; proposal: QuestionProposal | null; requirementsConfirmed: boolean; outputs: string[]; topN: number | null;
  candidate: { revision: number; name: string; definitions: string; topN: number; state: string; testResult: string | null; diagnosticCode: string | null; testedValues: string[]; completedTests?: number; totalTests?: number } | null;
  live: { revision: number; packageVersion: string; name: string; columns: string[] } | null;
  events: { at: string; action: string; code: string | null; revision: number }[]; fixture: boolean;
  databasePermission?: { stage: string; columns: { schema: string; table: string; column: string; status: 'denied' | 'unverified' }[] } | null }
export type DomainQuestionModel = { key: string; label: string; example: string; metric: string; definition: string; limits: number[]; available: boolean; issues: string[] }
export type QuestionWorkspace = { dictionaryHash?: string | null; dictionaryReady: boolean; dictionaryRevision: number | null; models: QuestionModel[]; questions: DomainQuestion[]; fixture: boolean;
  parameterOptions?: Record<string, ParameterOptions> | null; modelCatalog?: DomainQuestionModel[] | null }
export type RuntimeAccessReview = { questionId: string; questionRevision: number; name: string; reviewHash: string; allowed: boolean;
  missingNames: { objects: string[]; columns: string[]; relations: string[] }; blockingCode: string | null; approvalCommand: string | null }

