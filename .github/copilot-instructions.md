# Copilot Instructions for ActivityPlanner

Queste linee guida aiutano gli agenti AI a lavorare in modo efficace su questo progetto web per la gestione attività, basato su un singolo file `index.html`.

## Architettura e Componenti
- **Single Page Application**: Tutta la logica e la UI sono gestite in `index.html` tramite HTML, CSS e JavaScript vanilla.
- **Autenticazione e Dati**: Si utilizza Supabase per autenticazione e CRUD su due tabelle principali: `attivita` e `membri`.
- **Calendario**: L'integrazione con FullCalendar visualizza le attività in formato calendario.
- **Modale Dettaglio**: La visualizzazione dettagliata di una attività avviene tramite un modale HTML/CSS.

## Flussi di lavoro
- **Login/Logout/Signup**: Funzioni JS (`login`, `logout`, `signup`) gestiscono l'autenticazione utente tramite Supabase.
- **Gestione Attività**: Le funzioni `salvaAttivita`, `caricaAttivita`, `mostraDettagliAttivita`, `chiudiModal` gestiscono inserimento, visualizzazione e dettaglio delle attività.
- **Gestione Membri**: Funzioni analoghe (`aggiungiMembro`, `caricaMembri`) per la tabella membri.
- **Calendario**: `caricaCalendario` aggiorna la vista FullCalendar con le attività.

## Convenzioni e Pattern
- **Tutto il JS è inline**: Non ci sono moduli o separazione tra logica e presentazione.
- **Stili CSS custom**: Nessun framework CSS, solo regole custom nel tag `<style>`.
- **Pattern di inserimento dati**: I dati vengono inseriti tramite form HTML e salvati su Supabase.
- **Aggiornamento UI**: Dopo ogni operazione di inserimento, la UI viene aggiornata richiamando le funzioni di caricamento.
- **Gestione errori**: Gli errori di Supabase sono gestiti con `alert(error.message)`.

## Dipendenze Esterne
- **Supabase**: Per autenticazione e database (vedi chiavi e URL nel JS).
- **FullCalendar**: Per la visualizzazione delle attività.
- **FontAwesome**: Per le icone.

## Esempi di pattern
- Per aggiungere una nuova attività:
  - Compila i campi nel form "Inserisci Attività" e premi "Salva Attività".
  - La funzione `salvaAttivita` salva su Supabase e aggiorna la lista e il calendario.
- Per visualizzare dettagli:
  - Clicca su una attività nella lista, viene aperto il modale con i dettagli.

## Note operative
- Non esistono test automatici, build o workflow CI/CD.
- Tutto il codice è in `index.html`.
- Per modifiche strutturali, agire direttamente su questo file.

---
Sezione da aggiornare: integrare nuove convenzioni o pattern solo se effettivamente usati nel progetto.
