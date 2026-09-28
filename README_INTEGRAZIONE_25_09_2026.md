# Wedding Management V8 – integrazione cumulativa 25/09/2026

Questa versione parte da `WEDDING_MANAGEMENT_V8_FINAL_RELEASE` e integra le correzioni precedenti.

## Integrazioni incluse
- correzione collegamenti Attività e Messaggi;
- pagina Modifica coppia;
- apertura sicura dei documenti con autorizzazione admin/coppia;
- correzione dei caratteri speciali nelle aree operative del Preventivo e ChurchPlanner attivo;
- generazione del Contratto d'opera in PDF dal Progetto Floreale;
- contratto costruito con dati della coppia, matrimonio, lavorazioni del progetto, fiori, strutture e dati economici dell'ultimo preventivo disponibile;
- salvataggio automatico del PDF in Supabase Storage `client-documents`;
- registrazione del contratto in `client_documents` con categoria `contratto` e collegamento al preventivo;
- apertura dei documenti dalla sezione Documenti;
- il contratto viene creato come documento privato (`visible_to_couple = false`) fino a verifica e sottoscrizione.

## Nessuna modifica richiesta al database
La funzione usa le tabelle già presenti: `couples`, `weddings`, `floral_projects`, `floral_project_items`, `quotes`, `quote_items`, `quote_payments`, `client_documents`.

## Test locale
Il controllo TypeScript/build non è stato eseguito in questa sessione perché l'installazione completa delle dipendenze npm del pacchetto non è risultata disponibile nel runtime. Il codice è stato controllato staticamente e il pacchetto non introduce nuove dipendenze npm.
