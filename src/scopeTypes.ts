export type Column={id:string;name:string;typeFamily:string}
export type Entity={id:string;schema:string;name:string;columns:Column[]}
export type RowRule={objectId:string;columnId:string;type:string;value:string|number|boolean}
export type Grant={userId:string;objects:string[];rows:RowRule[]}
export type QueryScope={revision:number;version:string;schema:{objects:Entity[]};labels:Record<string,string>;rules:string;grants:Grant[];maxRows:number;status:string}
export type Answer={status:string;message:string;conversationId:string;version:string;rows?:Record<string,unknown>[];sql?:string;requestId?:string}
export type Extension={id:string;owner:string;question:string;reason:string;status:string;revision:number;decision?:string;publishedVersion?:string}
export const statusLabel:Record<string,string>={submitted:'Inviata',reviewing:'In valutazione',approved:'Approvata, da pubblicare',rejected:'Non approvata',published:'Disponibile'}
export function scopeError(code:string){
 const text=scopeErrorText(code)
 const diagnostic=/^CRM5_[A-Z0-9_]+$/.test(code)?code:''
 return diagnostic&&!text.includes(diagnostic)?text+' (Codice: '+diagnostic+')':text
}
function scopeErrorText(code:string){
 if(code==='CRM5_SCOPE_ROLE_MIGRATION_REQUIRED')return 'Gli accessi precedenti contengono restrizioni individuali. Il tecnico deve trasferirle esplicitamente nei grant del ruolo prima della conferma: non vengono eliminate automaticamente.'
 if(code==='CRM5_SCOPE_SIMULATED_FAILURE')return 'Simulazione dichiarata: il servizio di ricerca non è disponibile. Nessuna chiamata AI o query è stata eseguita. Questa prova verifica la presentazione dell’errore, non un guasto reale.'
 if(code==='CRM5_AI_BUDGET_EXCEEDED')return 'È stato raggiunto un limite CRM5 di chiamate, token riservati o costo. Controlla utilizzo e budget nelle Impostazioni AI; il limite può essere al minuto o giornaliero.'
 if(code==='CRM5_AI_RESPONSE_INCOMPLETE')return 'Il provider ha interrotto la risposta prima di completarla. Nessuna proposta è stata salvata. Il tecnico deve verificare il limite dei token in uscita nelle Impostazioni AI.'
 if(code==='CRM5_AI_RESPONSE_INVALID')return 'La risposta AI non rispetta il formato o gli identificativi attesi da CRM5. Nessuna proposta valida è stata ottenuta. Segnala questo codice al tecnico.'
 if(code==='CRM5_AI_RATE_LIMITED')return 'Il provider AI ha limitato le richieste. Verifica la quota del servizio o attendi prima di riprovare.'
 if(code==='CRM5_AI_AUTHENTICATION_FAILED'||code==='CRM5_AI_SECRET_UNAVAILABLE')return 'CRM5 non riesce ad autenticarsi al provider AI. Il tecnico deve verificare le credenziali configurate.'
 if(code==='CRM5_AI_TIMEOUT')return 'Il provider AI non ha risposto entro il tempo previsto. Puoi riprovare; non è stato ottenuto un risultato valido.'
 if(code==='CRM5_AI_SERVICE_FAILED')return 'Il provider AI ha restituito un errore. Verifica la disponibilità del servizio e la configurazione del modello.'
 if(code==='CRM5_AI_DISABLED'||code==='CRM5_AI_REAL_CALLS_NOT_AUTHORIZED'||code==='CRM5_AI_CALLS_NOT_AUTHORIZED')return 'Le chiamate AI sono disabilitate. Il tecnico deve abilitarle nelle Impostazioni.'
 if(code==='CRM5_AI_REFUSED'||code==='CRM5_AI_CONTENT_FILTERED')return 'Il provider ha rifiutato la richiesta. Il tecnico deve verificare la richiesta e le regole del servizio.'

 if(code.includes('ALREADY_PUBLISHED'))return 'Questa versione del perimetro è già pubblicata.'
 if(code.includes('SETUP_CONTEXT_LIMIT'))return 'CRM5 non riesce a preparare il contesto di configurazione entro il limite AI impostato. Nessuna modifica è stata salvata. Il tecnico deve verificare il limite di input nelle Impostazioni.'
 if(code.includes('AI_INPUT_LIMIT'))return 'La richiesta completa supera il limite di input configurato per il servizio AI. Il tecnico deve verificare questo limite nelle Impostazioni; non indica crediti o token esauriti.'
 if(code.includes('DISCOVERY_REQUIRED'))return 'Leggi prima la struttura del database con il pulsante Leggi struttura.'
 if(code.includes('NOT_PUBLISHED'))return 'Il referente deve pubblicare il perimetro prima delle interrogazioni.'
 if(code.includes('TEST_REQUIRED'))return 'La pubblicazione richiede configurazione senza punti bloccanti e regressione rappresentativa superata con revisione registrata.'
 if(code.includes('SAVE_REQUIRED'))return 'Conferma la proposta nella pagina Perimetro prima di proseguire.'
 if(code.includes('PREPARATION_REQUIRED'))return 'Prepara la domanda prima di eseguire il test.'
 if(code.includes('REVIEW_RESULT_MISMATCH'))return 'Il risultato non corrisponde al comportamento atteso. Correggi la domanda o la configurazione e ripeti il test.'
 if(code.includes('REVIEW_EVIDENCE_REQUIRED'))return 'Descrivi la verifica effettuata prima di registrare l’esito.'
 if(code.includes('ROLE_REQUIRED'))return 'Scegli un ruolo autorizzato per iniziare la prova.'
 if(code.includes('ROLE_INVALID'))return 'Verifica nomi dei ruoli e appartenenze: ogni utente può appartenere a un solo ruolo in questo perimetro.'
 if(code.includes('TRIAL_OBSOLETE'))return 'La prova appartiene a una revisione precedente. Apri una nuova sessione: lo storico resta conservato.'
 if(code.includes('REQUEST_INTERRUPTED'))return 'Il tentativo non ha una risposta confermata. La domanda è salvata: puoi riprovare esplicitamente.'
 if(code.includes('CONFLICT')||code.includes('CHANGED'))return 'La configurazione è cambiata. Aggiorna la pagina e riprendi con una nuova conversazione.'
 if(code.includes('SQL_UNSUPPORTED')||code.includes('QUERY_INVALID'))return 'La query proposta non supera i controlli. Prova a precisare la domanda; nessun risultato è stato restituito.'
 if(code.includes('FANOUT')||code.includes('AGGREGATION_AMBIGUOUS'))return 'Il calcolo potrebbe duplicare i dati. Serve chiarire la misura e il collegamento prima di eseguirlo.'
 if(code.includes('DENIED'))return 'L’accesso o la query non sono consentiti dal perimetro. Puoi richiedere una revisione al referente.'
 if(code.startsWith('CRM5_AI_'))return 'Il servizio AI non è disponibile o ha prodotto una risposta non valida. Verifica provider, credenziali e budget nelle Impostazioni.'
 if(code.includes('DATABASE'))return 'Non è stato possibile completare la query sul database. Non interpretare questo errore come assenza di dati.'
 return 'Operazione non completata. '+code
}


