export type SetupConnection = {dialect?:string;endpoint:{server:string;port:number;database:string;login:string;requireTls:boolean;allowDevelopmentCertificateTrust:boolean};secretReference:string}
export type AccessCheck = {at:string;result:string;metadata:string|null;code:string|null}
export type DatabaseTarget = {id:string;name:string;connection:SetupConnection;legacy:boolean;packageVersion:string;capabilities:number;lastCheck:AccessCheck|null;diagnosticCode?:string|null}
export const targetHeaders=(id?:string):Record<string,string>=>id?{'X-CRM5-Target':id}:{}
export const targetMessages:Record<string,string>={
 CRM5_TARGET_NAME_INVALID:'Assegna un nome riconoscibile al collegamento.',
 CRM5_TARGET_ALREADY_EXISTS:'Questo database è già presente. Seleziona il collegamento esistente.',
 CRM5_ADMIN_CONNECTION_INVALID:'Controlla server, database, account e porta. Per SQLite scegli il percorso completo di un file esistente.',
 CRM5_TARGET_CREDENTIAL_REQUIRED:'Inserisci la password del database oppure un riferimento alle credenziali già configurate.',
 CRM5_CREDENTIAL_REFERENCE_UNAVAILABLE:'Le credenziali salvate non sono disponibili per questo profilo Windows. Verifica la password o il riferimento configurato.',
 CRM5_SOURCE_NOT_CONFIGURED:'Il riferimento alle credenziali non è configurato. Inserisci la password nella pagina Connessione.',
 CRM5_DATABASE_BINDING_DENIED:'Le credenziali non corrispondono al database scelto. Controlla server, database e account.',
 CRM5_TARGET_DATABASE_CHANGE_DENIED:'Per lavorare su un altro database usa Nuovo database target. Il lavoro di questo collegamento sarà conservato.',
 CRM5_TARGET_CONNECTION_FAILED:'Non riesco a collegarmi. Controlla che il server sia disponibile, la porta sia corretta e l’account possa accedere al database.',
 CRM5_TARGET_REQUIRED:'Scegli un database target per continuare.',
 CRM5_TARGET_NOT_FOUND:'Il database richiesto non è disponibile. Scegli un collegamento dall’elenco.',
 CRM5_TARGET_WORKSPACE_UNAVAILABLE:'I dati di lavoro di questo target non sono disponibili sul PC. Verifica la posizione dei dati senza creare un nuovo workspace.',
 CRM5_CONFIGURATION_INVALID:'I dati salvati di questo target non sono leggibili. Recupera lo stato originale per conservare il lavoro.',
 CRM5_TARGET_AUDIT_KEY_UNAVAILABLE:'La protezione dello storico di questo target non è disponibile. È necessario recuperare la configurazione originale.',
 CRM5_TARGET_PACKAGE_NOT_READY:'Questo database non ha ancora un package approvato. Parti dall’analisi del database e dalla preparazione delle capacità.',
 CRM5_TARGET_EXECUTION_NOT_APPROVED:'L’esecuzione su questo nuovo database deve ancora essere autorizzata.',
 CRM5_ADMIN_REVISION_CONFLICT:'La configurazione è cambiata in un’altra scheda. Ricarica la pagina prima di salvare.'
}
export const targetMessage=(code:string)=>targetMessages[code]||'L’operazione non è riuscita. Apri i dettagli per il codice di supporto.'
export const databaseLabel=(dialect?:string)=>({sqlserver:'SQL Server',postgresql:'PostgreSQL',sqlite:'SQLite'}[dialect||'sqlserver']||dialect)
export function blankConnection():SetupConnection{return {dialect:'sqlserver',endpoint:{server:'localhost',port:1433,database:'',login:'',requireTls:true,allowDevelopmentCertificateTrust:false},secretReference:''}}

