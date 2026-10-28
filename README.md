# CRM5 Web

Frontend React e TypeScript: console amministrativa (`/`) e client utente (`/client`). Il motore, le API, la persistenza e l’esecuzione SQL sono servizi backend separati e non fanno parte di questo repository.

## Avvio e build

Node.js 22 (almeno 22.12).

```sh
npm ci
npm run dev
npm run build
```

La build principale produce `dist` con console e client. È disponibile anche `npm run build:client` per produrre il solo ingresso utente in `dist-client`.

## Vercel

- Framework: Vite
- Root Directory: radice del repository (`./`)
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js: 22.x

`vercel.json` contiene queste impostazioni e gli instradamenti delle pagine client. Non sono richiesti segreti per compilare il frontend.

## Stato dell’integrazione

La pubblicazione dei file statici non rende operativa l’applicazione completa. Le API amministrative e client sono chiamate su `/api/admin` e `/api/client/v1` sullo stesso origin. In questo repository non è ancora configurato un proxy verso IIS: senza backend, l’accesso e le funzioni applicative mostreranno errori di servizio. Non inserire credenziali finché il collegamento non è stato configurato e verificato.

Il backend deve essere adattato all’hosting remoto, con HTTPS valido, autenticazione e verifiche dell’origine. Il certificato self-signed di collaudo della VM non è sufficiente per un collegamento pubblico attendibile. La variabile legacy `VITE_API_BASE_URL` riguarda solo il vecchio endpoint chat e non configura la console amministrativa.

Le chiavi AI, le password dei database e le configurazioni riservate devono restare sul backend; non vanno inserite in variabili `VITE_*`, nel codice o in questo repository pubblico. I controlli di autorizzazione devono essere applicati dalle API.

## Provenienza

Esportazione dei soli sorgenti frontend dalla revisione `54e97fdc06faf67cd22d9fedfaae3630e70947a0` del 27 ottobre 2026. Nessuna cronologia del repository sorgente è inclusa. Gli aggiornamenti successivi vanno sincronizzati esplicitamente; questa copia non segue automaticamente il repository del motore.

Non è concessa una licenza open source mediante questa pubblicazione.

## PC e VM IIS

Il frontend usa gli stessi percorsi relativi `/api` in entrambi gli ambienti.
Su Vercel, il proxy inoltra le richieste alla VM mantenendo cookie e URL sul dominio
`https://crm5-web.vercel.app`. Non aggiungere password PostgreSQL o SQL al frontend.

Quando il backend ha un nome DNS pubblico e un certificato HTTPS attendibile:

```sh
node scripts/configure-api.mjs https://NOME-DNS-BACKEND:44380
```

Verificare il `vercel.json` generato e fare commit prima del deployment. Lo script
non va eseguito come build command: Vercel legge le rotte prima della build.
Il backend deve usare la modalità `CRM5_HOST_MODE=Iis`, con
`CRM5_FRONTEND_ORIGIN=https://crm5-web.vercel.app` e
`CRM5_PUBLIC_API_ORIGIN` uguale all'origine passata allo script.
Le preview Vercel con altri domini non sono abilitate automaticamente.

Il certificato self-signed CRM5-Demo serve solo per prove locali: il proxy richiede
un certificato attendibile. Finché il DNS/TLS non è pronto, lasciare le rotte API
non configurate. La pubblicazione del frontend da sola non rende operativo il backend.
