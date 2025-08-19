# Copilot Instructions for ActivityPlanner

This web application for activity management follows a two-file architecture with specific patterns for Supabase integration and UI management.

## Architecture Overview
- **Two-file structure**: Core logic split between `index.html` (UI/markup) and `script.js` (JavaScript functions)
- **Single Page Application**: Tab-based navigation with `showTab()` function hiding/showing sections
- **Supabase Backend**: Authentication and CRUD operations on 4 main tables: `attivita`, `membri`, `utenti`, `impostazioni`
- **Modal Pattern**: Detail views use fixed-position overlays with `display:flex` for centering

## Database Schema (Supabase)
- **`attivita`**: `id`, `titolo`, `obiettivi`, `data`, `raggiunti`, `tabella_oraria` (JSON)
- **`membri`**: `id`, `nome`, `cognome`, `anno`, `ruolo`, `obiettivi` (array), `admin` (boolean), `email`
- **`utenti`**: `id`, `nome`, `cognome`, `email` (admin-only functionality)
- **`impostazioni`**: `id`, `chiave`, `valore` (admin-only functionality)

## Critical Patterns

### Authentication Flow
```javascript
// Admin detection happens during login by checking membri.admin field
const { data: utenti } = await supabaseClient.from('membri').select('admin').eq('email', email);
if (utenti[0].admin === true) document.getElementById('btn-registrati').style.display = '';
```

### Data Loading Pattern
Every CRUD operation follows: `async function` → Supabase call → error handling with `alert()` → UI refresh via `caricaAttivita()`/`caricaMembri()`

### Modal Management
- Global variables track selected items: `attivitaSelezionata`, `membroSelezionato`, `membroInModifica`
- Modals use `style.display="flex"/"none"` pattern
- Close functions always reset tracking variables to `null`

### Complex Data Handling
- **Tabella Oraria**: JSON serialized array of `{orario, tipo, descrizione, gestore}` objects
- **Obiettivi**: Array of objects with `{titolo, data}` structure, managed via temporary arrays (`obiettiviMembroTemp`)
- **Event handlers**: Inline onclick assignments in dynamic HTML generation

## External Dependencies
- **Supabase**: `@supabase/supabase-js` via CDN - client configured in `script.js` line 4-5
- **FullCalendar**: v6.1.11 for calendar view with Italian locale (`locale: 'it'`)
- **FontAwesome**: v6.5.0 for icons throughout the UI

## Development Workflow
- **No build process**: Direct file editing, no compilation or bundling
- **No testing**: Manual testing through UI interactions only
- **Styling**: Inline CSS in `<style>` tag with custom color scheme (`#2c3e50`, `#3498db`, etc.)
- **Error handling**: Simple `alert(error.message)` pattern for all Supabase errors

## Key Functions to Know
- `showMain()`: Initializes app after authentication, calls all load functions
- `salvaAttivita()`: Handles both insert and update based on presence of `id-attivita` field
- `caricaCalendario()`: Recreates FullCalendar instance on every call (line 76-108)
- Session management: Automatic via `supabaseClient.auth.onAuthStateChange()` at bottom of script.js
