// App.js - Applicazione principale con controllo autenticazione PULITO
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabili globali
let currentUser = null;
let currentUnit = null;
let currentDate = new Date();

// Inizializzazione dell'app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        console.log('🚀 Inizio inizializzazione app...');
        
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        console.log('📋 Sessione ottenuta:', !!session, 'Errore:', error);
        
        if (error || !session || !session.user) {
            console.log('❌ Sessione non valida, redirect a login');
            window.location.replace('login.html?error=no_session');
            return;
        }
        
        console.log('✅ Sessione valida per utente:', session.user.email);
        showLoadingScreen();
        
        console.log('📊 Caricamento dati utente...');
        await loadUserData(session.user);
        
        console.log('🎨 Mostra schermata principale...');
        showMainScreen();
        
        console.log('🔧 Setup event listeners...');
        setupEventListeners();
        
        // Debug finale del unit-selector
        console.log('🔍 Debug finale unit-selector...');
        debugUnitSelector();
        
        console.log('🎉 Inizializzazione completata!');
        
    } catch (error) {
        console.error('💥 ERRORE INIZIALIZZAZIONE:', error);
        console.error('💥 Stack trace:', error.stack);
        console.error('💥 Message:', error.message);
        alert('Errore inizializzazione: ' + error.message);
        window.location.replace('login.html?error=init_error&msg=' + encodeURIComponent(error.message));
    }
}

// Controllo autenticazione in tempo reale
let authListenerSetup = false;
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (!authListenerSetup) {
        authListenerSetup = true;
        return;
    }
    
    if (event === 'SIGNED_OUT' || !session) {
        window.location.replace('login.html?event=' + event);
    }
});

async function loadUserData(user) {
    try {
        console.log('👤 Caricamento dati per utente:', user.email);
        
        // Carica dati utente dalla tabella utenti tramite email
        const { data: userData, error } = await supabaseClient
            .from('utenti')
            .select('*')
            .eq('email', user.email)
            .single();

        console.log('📊 Query utenti - Errore:', error, 'Dati trovati:', !!userData);

        if (error) {
            console.log('⚠️ Errore caricamento utente:', error.code, error.message);
            
            // Se l'utente non esiste nel DB, crea dati temporanei
            if (error.code === 'PGRST116') {
                console.log('🔧 Utente non trovato nel DB, creazione profilo temporaneo...');
                currentUser = {
                    id: user.id,
                    email: user.email,
                    nome: user.user_metadata?.nome || user.email.split('@')[0] || 'Nome',
                    cognome: user.user_metadata?.cognome || 'Utente',
                    admin: false,
                    unita_associate: []
                };
                
                console.log('✅ Profilo temporaneo creato:', currentUser.nome, currentUser.cognome);
                
                document.getElementById('user-name').textContent = `${currentUser.nome} ${currentUser.cognome} (Profilo incompleto)`;
                document.getElementById('admin-tab').style.display = 'none';
                document.getElementById('site-admin-tab').style.display = 'none';
                return;
            } else {
                console.error('❌ Errore database non gestito:', error);
                throw error;
            }
        }

        if (!userData) {
            console.error('❌ userData è null dopo query');
            throw new Error('Utente non trovato nel database');
        }

        console.log('✅ Utente trovato nel DB:', userData.email, 'Admin:', userData.admin);
        console.log('🔍 Unità associate:', userData.unita_associate);
        currentUser = userData;
        
        console.log('🎨 Aggiornamento UI nome utente...');
        document.getElementById('user-name').textContent = `${userData.nome} ${userData.cognome}`;

        console.log('🔐 Configurazione permessi UI...');
        // Configurazione permessi UI
        document.getElementById('admin-tab').style.display = 
            userData.admin ? 'block' : 'none';
        
        document.getElementById('site-admin-tab').style.display = 
            userData.admin ? 'block' : 'none';

        console.log('🏢 Caricamento unità disponibili...');
        // Caricamento unità disponibili
        await loadAvailableUnits();
        
        console.log('✅ Caricamento dati utente completato');

    } catch (error) {
        console.error('💥 Errore caricamento dati utente:', error);
        throw error;
    }
}

async function loadAvailableUnits() {
    try {
        console.log('🏢 Inizio caricamento unità per utente:', currentUser?.email);
        console.log('👑 Admin:', currentUser?.admin, 'Unità associate:', currentUser?.unita_associate);
        
        const unitSelector = document.getElementById('unit-selector');
        if (!unitSelector) {
            console.error('❌ Elemento unit-selector non trovato nel DOM!');
            return;
        }
        
        // Reset dropdown
        unitSelector.innerHTML = '<option value="">Caricamento unità...</option>';
        
        let query = supabaseClient.from('unita').select('*');
        let shouldLoadUnits = false;
        
        // ADMIN: può vedere tutte le unità
        if (currentUser?.admin === true) {
            console.log('👑 Utente ADMIN - carica tutte le unità');
            shouldLoadUnits = true;
            // Query senza filtri per admin
        }
        // TUTTI GLI ALTRI UTENTI: verifica unita_associate
        else {
            console.log('👤 Utente NON-ADMIN - verifica unità associate');
            console.log('🔍 currentUser.unita_associate:', currentUser?.unita_associate);
            console.log('🔍 È un array:', Array.isArray(currentUser?.unita_associate));
            
            if (currentUser?.unita_associate && Array.isArray(currentUser.unita_associate)) {
                console.log('🔍 Lunghezza array:', currentUser.unita_associate.length);
                
                if (currentUser.unita_associate.length > 0) {
                    console.log('✅ Utente ha unità associate - filtro query');
                    // Converti le stringhe in numeri per la query
                    const unitIds = currentUser.unita_associate.map(id => parseInt(id, 10));
                    console.log('🔢 IDs convertiti in numeri:', unitIds);
                    console.log('🔍 Applicando filtro .in("id", unitIds)...');
                    query = query.in('id', unitIds);
                    console.log('🔍 Query dopo filtro:', query);
                    shouldLoadUnits = true;
                } else {
                    console.log('⚠️ Array unità vuoto');
                }
            } else {
                console.log('⚠️ unita_associate non è un array valido');
            }
        }
        
        // Se non dobbiamo caricare unità, mostra messaggio e esci
        if (!shouldLoadUnits) {
            console.log('❌ Condizioni non soddisfatte - nessuna unità da caricare');
            unitSelector.innerHTML = '<option value="">Nessuna unità disponibile</option>';
            return;
        }
        
        console.log('📊 Esecuzione query unità...');
        console.log('🔍 Query finale costruita:', query);
        console.log('🔍 Parametri query - Admin:', currentUser?.admin, 'IDs da cercare:', currentUser?.unita_associate);
        
        const { data: units, error } = await query.order('nome');
        
        console.log('🔍 Risultato query - Error:', error, 'Units found:', units?.length);

        if (error) {
            console.error('❌ Errore query unità:', error);
            unitSelector.innerHTML = '<option value="">Errore caricamento unità</option>';
            throw error;
        }

        console.log('✅ Unità trovate:', units?.length || 0);
        if (units?.length > 0) {
            units.forEach(unit => console.log('  - ID:', unit.id, 'Nome:', unit.nome));
        }
        
        // Reset dropdown con opzione di default
        unitSelector.innerHTML = '<option value="">Seleziona Unità</option>';

        if (!units || units.length === 0) {
            unitSelector.innerHTML = '<option value="">Nessuna unità disponibile</option>';
            console.log('⚠️ Nessuna unità trovata per questo utente');
            return;
        }

        // Popola dropdown
        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = unit.nome;
            unitSelector.appendChild(option);
            console.log('➕ Aggiunta unità al dropdown:', unit.nome);
        });

        // Selezione automatica prima unità se è l'unica disponibile
        if (units.length === 1) {
            console.log('🎯 Selezione automatica unica unità disponibile:', units[0].nome);
            unitSelector.value = units[0].id;
            // Attendi un momento prima di chiamare handleUnitChange per assicurarsi che tutto sia inizializzato
            setTimeout(async () => {
                await handleUnitChange();
            }, 100);
        } else {
            console.log('📋 Unità multiple disponibili - attesa selezione utente');
        }
        
        console.log('✅ Caricamento unità completato');
        
    } catch (error) {
        console.error('💥 Errore caricamento unità:', error);
        const unitSelector = document.getElementById('unit-selector');
        if (unitSelector) {
            unitSelector.innerHTML = '<option value="">Errore caricamento</option>';
        }
        throw error;
    }
}

// Gestione schermata
function showLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('main-screen').style.display = 'none';
}

function showMainScreen() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
    loadActivities();
}

// Setup event listeners
function setupEventListeners() {
    console.log('🔧 Setup event listeners...');
    
    try {
        // Tab navigation
        const tabButtons = document.querySelectorAll('.tab-button');
        console.log('📑 Tab buttons trovati:', tabButtons.length);
        tabButtons.forEach(button => {
            button.addEventListener('click', handleTabClick);
        });

        // Admin tab navigation
        const adminTabButtons = document.querySelectorAll('.admin-tab-button');
        console.log('👑 Admin tab buttons trovati:', adminTabButtons.length);
        adminTabButtons.forEach(button => {
            button.addEventListener('click', handleAdminTabClick);
        });

        // Unit selector
        const unitSelector = document.getElementById('unit-selector');
        if (unitSelector) {
            // Rimuovi event listeners esistenti per evitare duplicati
            unitSelector.removeEventListener('change', handleUnitChange);
            unitSelector.addEventListener('change', handleUnitChange);
            console.log('✅ Event listener unit-selector aggiunto');
        } else {
            console.warn('⚠️ unit-selector non trovato nel DOM');
        }

        // Forms
        const forms = [
            'activity-form', 'member-form', 'unit-form', 
            'new-user-form', 'existing-user-form'
        ];
        
        forms.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                switch(formId) {
                    case 'activity-form':
                        form.addEventListener('submit', handleActivitySubmit);
                        break;
                    case 'member-form':
                        form.addEventListener('submit', handleMemberSubmit);
                        break;
                    case 'unit-form':
                        form.addEventListener('submit', handleUnitSubmit);
                        break;
                    case 'new-user-form':
                        form.addEventListener('submit', handleNewUserSubmit);
                        break;
                    case 'existing-user-form':
                        form.addEventListener('submit', handleExistingUserSubmit);
                        break;
                }
                console.log('✅ Event listener', formId, 'aggiunto');
            } else {
                console.warn('⚠️', formId, 'non trovato');
            }
        });

        // Calendar navigation
        const prevMonth = document.getElementById('prev-month');
        const nextMonth = document.getElementById('next-month');
        
        if (prevMonth) {
            prevMonth.addEventListener('click', () => navigateMonth(-1));
            console.log('✅ Event listener prev-month aggiunto');
        } else {
            console.warn('⚠️ prev-month non trovato');
        }
        
        if (nextMonth) {
            nextMonth.addEventListener('click', () => navigateMonth(1));
            console.log('✅ Event listener next-month aggiunto');
        } else {
            console.warn('⚠️ next-month non trovato');
        }

        // Add buttons
        const addScheduleRowBtn = document.getElementById('add-schedule-row');
        const addObjectiveBtn = document.getElementById('add-objective-btn');
        
        if (addScheduleRowBtn) {
            addScheduleRowBtn.addEventListener('click', addScheduleRow);
            console.log('✅ Event listener add-schedule-row aggiunto');
        } else {
            console.warn('⚠️ add-schedule-row non trovato');
        }
        
        if (addObjectiveBtn) {
            addObjectiveBtn.addEventListener('click', addObjectiveRow);
            console.log('✅ Event listener add-objective-btn aggiunto');
        } else {
            console.warn('⚠️ add-objective-btn non trovato');
        }

        // Pulsanti principali aggiungi
        const actionButtons = [
            { id: 'add-activity-btn', handler: showAddActivityModal },
            { id: 'add-member-btn', handler: showAddMemberModal },
            { id: 'add-new-user-btn', handler: showAddUserModal },
            { id: 'add-existing-user-btn', handler: showAddExistingUserModal },
            { id: 'add-unit-btn', handler: showAddUnitModal }
        ];

        actionButtons.forEach(({ id, handler }) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', handler);
                console.log('✅ Event listener', id, 'aggiunto');
            } else {
                console.warn('⚠️', id, 'non trovato');
            }
        });

        // Pulsanti chiusura modal
        document.querySelectorAll('.close').forEach((closeBtn, index) => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
                console.log('❌ Modal chiuso via pulsante close', index);
            });
        });

        // Chiusura modal cliccando fuori
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    console.log('❌ Modal chiuso cliccando fuori');
                }
            });
        });
        
        console.log('✅ Setup event listeners completato');
        
    } catch (error) {
        console.error('💥 Errore setup event listeners:', error);
        throw error;
    }
}

// Funzione per gestire il cambio di unità
async function handleUnitChange() {
    try {
        console.log('🔄 handleUnitChange chiamata');
        const unitSelector = document.getElementById('unit-selector');
        
        if (!unitSelector) {
            console.error('❌ unit-selector non trovato nel DOM!');
            return;
        }
        
        const unitId = unitSelector.value;
        console.log('🏢 Unità selezionata ID:', unitId);
        
        if (!unitId) {
            currentUnit = null;
            console.log('⚠️ Nessuna unità selezionata - reset dati');
            
            // Reset dei contenuti quando nessuna unità è selezionata
            const activitiesList = document.getElementById('activities-list');
            const membersList = document.getElementById('members-list');
            const calendarContainer = document.getElementById('calendar-container');
            
            if (activitiesList) activitiesList.innerHTML = '<p>Seleziona un\'unità per visualizzare le attività</p>';
            if (membersList) membersList.innerHTML = '<p>Seleziona un\'unità per visualizzare i membri</p>';
            if (calendarContainer) calendarContainer.innerHTML = '<p>Seleziona un\'unità per visualizzare il calendario</p>';
            
            return;
        }

        console.log('🏢 Caricamento dati per unità ID:', unitId);
        
        const { data: unit, error } = await supabaseClient
            .from('unita')
            .select('*')
            .eq('id', unitId)
            .single();

        if (error) {
            console.error('❌ Errore caricamento unità:', error);
            alert('Errore nel caricamento dell\'unità: ' + error.message);
            return;
        }

        if (!unit) {
            console.error('❌ Unità non trovata nel database');
            alert('Unità non trovata nel database');
            return;
        }

        currentUnit = unit;
        console.log('✅ Unità corrente impostata:', unit.nome);
        
        // Ricarica i dati del tab attivo
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab) {
            const tabId = activeTab.id;
            console.log('🔄 Ricaricamento dati per tab attivo:', tabId);
            
            // Mostra indicatore di caricamento se necessario
            switch (tabId) {
                case 'attivita':
                    console.log('📊 Ricaricamento attività...');
                    await loadActivities();
                    break;
                case 'membri':
                    console.log('👥 Ricaricamento membri...');
                    await loadMembers();
                    break;
                case 'calendario':
                    console.log('📅 Ricaricamento calendario...');
                    await loadCalendar();
                    break;
                case 'amministrazione':
                    if (currentUser?.admin) {
                        console.log('👑 Ricaricamento dati admin...');
                        await loadAdminData();
                    }
                    break;
                default:
                    console.log('⚠️ Tab non riconosciuto per ricaricamento:', tabId);
            }
        } else {
            console.log('⚠️ Nessun tab attivo trovato');
        }
        
    } catch (error) {
        console.error('💥 Errore handleUnitChange:', error);
        alert('Errore imprevisto nel cambio unità: ' + error.message);
    }
}

// === UTILITY FUNCTIONS ===

// Funzione per convertire array di ID misti (stringhe/numeri) in array di numeri
function convertUnitsToNumbers(unitsArray) {
    if (!Array.isArray(unitsArray)) return [];
    return unitsArray.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
}

// Funzione per convertire array di ID misti (stringhe/numeri) in array di stringhe
function convertUnitsToStrings(unitsArray) {
    if (!Array.isArray(unitsArray)) return [];
    return unitsArray.map(id => id.toString());
}

// Funzione per verificare se un utente ha accesso a un'unità
function userHasAccessToUnit(user, unitId) {
    if (!user?.unita_associate || !Array.isArray(user.unita_associate)) return false;
    const unitIdStr = unitId.toString();
    return user.unita_associate.includes(unitIdStr);
}

// Funzione di debug per verificare lo stato del unit-selector
function debugUnitSelector() {
    const unitSelector = document.getElementById('unit-selector');
    console.log('🔍 DEBUG unit-selector:');
    console.log('  - Elemento trovato:', !!unitSelector);
    if (unitSelector) {
        console.log('  - Valore corrente:', unitSelector.value, '(tipo:', typeof unitSelector.value, ')');
        console.log('  - Numero opzioni:', unitSelector.options.length);
        console.log('  - Opzioni disponibili:');
        for (let i = 0; i < unitSelector.options.length; i++) {
            const option = unitSelector.options[i];
            console.log(`    ${i}: value="${option.value}" (tipo: ${typeof option.value}), text="${option.textContent}"`);
        }
        console.log('  - Event listeners:', unitSelector.cloneNode().outerHTML);
    }
    console.log('  - currentUnit:', currentUnit);
    console.log('  - currentUser:', currentUser);
    console.log('  - currentUser admin:', currentUser?.admin);
    console.log('  - currentUser unità associate:', currentUser?.unita_associate, '(tipo:', Array.isArray(currentUser?.unita_associate) ? 'array' : typeof currentUser?.unita_associate, ')');
    if (Array.isArray(currentUser?.unita_associate)) {
        console.log('  - Array length:', currentUser.unita_associate.length);
        currentUser.unita_associate.forEach((unit, index) => {
            console.log(`    ${index}: "${unit}" (tipo: ${typeof unit})`);
        });
    }
    
    // Test delle condizioni logiche
    console.log('  - Test condizioni logiche:');
    console.log('    - currentUser?.admin === true:', currentUser?.admin === true);
    console.log('    - currentUser?.unita_associate exists:', !!currentUser?.unita_associate);
    console.log('    - Array.isArray(currentUser?.unita_associate):', Array.isArray(currentUser?.unita_associate));
    console.log('    - currentUser.unita_associate.length > 0:', currentUser?.unita_associate?.length > 0);
    
    const condition1 = currentUser?.admin === true;
    const condition2 = currentUser?.unita_associate && Array.isArray(currentUser.unita_associate) && currentUser.unita_associate.length > 0;
    console.log('    - ADMIN condition result:', condition1);
    console.log('    - USER condition result:', condition2);
    console.log('    - Should load units:', condition1 || condition2);
}

// Funzione globale per testare il unit-selector dalla console del browser
window.testUnitSelector = function() {
    console.log('🧪 TEST unit-selector manuale');
    debugUnitSelector();
    
    console.log('🧪 Test cambio unità programmativo...');
    const unitSelector = document.getElementById('unit-selector');
    if (unitSelector && unitSelector.options.length > 1) {
        const testValue = unitSelector.options[1].value;
        console.log('🧪 Cambio a unità ID:', testValue);
        unitSelector.value = testValue;
        
        // Simula l'evento change
        const event = new Event('change', { bubbles: true });
        unitSelector.dispatchEvent(event);
    }
};

// Funzione globale per ricaricare le unità
window.reloadUnits = async function() {
    console.log('🔄 Ricaricamento unità manuale...');
    try {
        await loadAvailableUnits();
        debugUnitSelector();
    } catch (error) {
        console.error('❌ Errore ricaricamento:', error);
    }
};

// Funzione globale per testare direttamente la query delle unità
window.testUnitQuery = async function() {
    console.log('🧪 TEST QUERY UNITÀ DIRETTA');
    
    if (!currentUser) {
        console.log('❌ currentUser non disponibile');
        return;
    }
    
    console.log('👤 Utente corrente:', currentUser.email);
    console.log('🏢 Unità associate:', currentUser.unita_associate);
    
    try {
        // Test 1: Query senza filtri (tutte le unità)
        console.log('🧪 Test 1: Tutte le unità nel database');
        const { data: allUnits, error: allError } = await supabaseClient
            .from('unita')
            .select('*')
            .order('nome');
            
        if (allError) {
            console.error('❌ Errore query tutte le unità:', allError);
        } else {
            console.log('✅ Tutte le unità trovate:', allUnits?.length || 0);
            if (allUnits) {
                allUnits.forEach(unit => {
                    console.log(`  - ID: ${unit.id} (tipo: ${typeof unit.id}), Nome: ${unit.nome}`);
                });
            }
        }
        
        // Test 2: Query con filtro numerico
        const unitIds = currentUser.unita_associate.map(id => parseInt(id, 10));
        console.log('🧪 Test 2: Query con filtro numerico:', unitIds);
        const { data: numericUnits, error: numericError } = await supabaseClient
            .from('unita')
            .select('*')
            .in('id', unitIds)
            .order('nome');
            
        if (numericError) {
            console.error('❌ Errore query numerica:', numericError);
        } else {
            console.log('✅ Unità con filtro numerico:', numericUnits?.length || 0);
            if (numericUnits) {
                numericUnits.forEach(unit => {
                    console.log(`  - ID: ${unit.id} (tipo: ${typeof unit.id}), Nome: ${unit.nome}`);
                });
            }
        }
        
        // Test 3: Query con filtro stringhe
        console.log('🧪 Test 3: Query con filtro stringhe:', currentUser.unita_associate);
        const { data: stringUnits, error: stringError } = await supabaseClient
            .from('unita')
            .select('*')
            .in('id', currentUser.unita_associate)
            .order('nome');
            
        if (stringError) {
            console.error('❌ Errore query stringhe:', stringError);
        } else {
            console.log('✅ Unità con filtro stringhe:', stringUnits?.length || 0);
            if (stringUnits) {
                stringUnits.forEach(unit => {
                    console.log(`  - ID: ${unit.id} (tipo: ${typeof unit.id}), Nome: ${unit.nome}`);
                });
            }
        }
        
    } catch (error) {
        console.error('💥 Errore test query:', error);
    }
};

// Funzione globale per forzare il caricamento anche senza permessi
window.forceLoadUnits = async function() {
    console.log('🔄 FORZATURA caricamento tutte le unità...');
    try {
        const unitSelector = document.getElementById('unit-selector');
        if (!unitSelector) {
            console.error('❌ unit-selector non trovato');
            return;
        }
        
        unitSelector.innerHTML = '<option value="">Caricamento forzato...</option>';
        
        const { data: units, error } = await supabaseClient
            .from('unita')
            .select('*')
            .order('nome');
            
        if (error) {
            console.error('❌ Errore query forzata:', error);
            return;
        }
        
        console.log('✅ Unità trovate (FORZATO):', units?.length || 0);
        
        unitSelector.innerHTML = '<option value="">Seleziona Unità</option>';
        
        if (units && units.length > 0) {
            units.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.id;
                option.textContent = unit.nome;
                unitSelector.appendChild(option);
                console.log('➕ Aggiunta unità (FORZATO):', unit.nome);
            });
        }
        
        debugUnitSelector();
        
    } catch (error) {
        console.error('❌ Errore forzatura:', error);
    }
};

// === MODAL FUNCTIONS ===
function showAddActivityModal() {
    console.log('🎯 Apertura modal aggiungi attività');
    document.getElementById('activity-modal').style.display = 'flex';
    clearActivityForm();
}

function showAddMemberModal() {
    console.log('👥 Apertura modal aggiungi membro');
    document.getElementById('member-modal').style.display = 'flex';
    clearMemberForm();
}

function showAddUserModal() {
    console.log('👤 Apertura modal aggiungi utente');
    document.getElementById('new-user-modal').style.display = 'flex';
    clearUserForm();
}

function showAddUnitModal() {
    console.log('🏢 Apertura modal aggiungi unità');
    document.getElementById('unit-modal').style.display = 'flex';
    clearUnitForm();
}

function showAddExistingUserModal() {
    console.log('👤 Apertura modal aggiungi utente esistente');
    document.getElementById('existing-user-modal').style.display = 'flex';
    loadAvailableUsersForUnit();
}

async function loadAvailableUsersForUnit() {
    console.log('📊 Caricamento utenti disponibili per l\'unità');
    
    if (!currentUnit) {
        console.log('⚠️ Nessuna unità selezionata');
        return;
    }
    
    try {
        // Carica tutti gli utenti che NON sono già associati a questa unità
        const { data: users, error } = await supabaseClient
            .from('utenti')
            .select('*')
            .not('unita_associate', 'cs', `{"${currentUnit.id}"}`);  // ID come stringa
            
        if (error) {
            console.error('❌ Errore caricamento utenti disponibili:', error);
            return;
        }
        
        const userSelect = document.getElementById('existing-user-select');
        if (!userSelect) {
            console.error('❌ existing-user-select non trovato');
            return;
        }
        
        userSelect.innerHTML = '<option value="">Seleziona utente...</option>';
        
        if (users && users.length > 0) {
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.nome} ${user.cognome} (${user.email})`;
                userSelect.appendChild(option);
            });
            console.log('✅ Caricati', users.length, 'utenti disponibili');
        } else {
            userSelect.innerHTML = '<option value="">Nessun utente disponibile</option>';
            console.log('⚠️ Nessun utente disponibile per questa unità');
        }
        
    } catch (error) {
        console.error('💥 Errore loadAvailableUsersForUnit:', error);
    }
}

function clearActivityForm() {
    document.getElementById('activity-title').value = '';
    document.getElementById('activity-objectives').value = '';
    document.getElementById('activity-date').value = '';
    document.getElementById('activity-achieved').value = '';
    
    // Pulisci le righe della tabella oraria
    const scheduleRows = document.getElementById('schedule-rows');
    if (scheduleRows) {
        scheduleRows.innerHTML = '';
    }
    
    // Reset modalità modifica
    const form = document.getElementById('activity-form');
    const modalTitle = document.getElementById('activity-modal-title');
    if (form) {
        delete form.dataset.editId;
    }
    if (modalTitle) {
        modalTitle.textContent = 'Aggiungi Attività';
    }
}

function clearMemberForm() {
    document.getElementById('member-name').value = '';
    document.getElementById('member-surname').value = '';
    document.getElementById('member-year').value = '';
    document.getElementById('member-role').value = '';
    
    // Pulisci la lista degli obiettivi
    const objectivesList = document.getElementById('objectives-list');
    if (objectivesList) {
        objectivesList.innerHTML = '';
    }
    
    // Reset modalità modifica
    const form = document.getElementById('member-form');
    const modalTitle = document.getElementById('member-modal-title');
    if (form) {
        delete form.dataset.editId;
    }
    if (modalTitle) {
        modalTitle.textContent = 'Aggiungi Membro';
    }
}

function clearUserForm() {
    document.getElementById('user-name').value = '';
    document.getElementById('user-surname').value = '';
    document.getElementById('user-email').value = '';
    document.getElementById('user-units').innerHTML = '';
}

function clearUnitForm() {
    document.getElementById('unit-name').value = '';
    document.getElementById('unit-description').value = '';
}

function handleTabClick(e) {
    const tabName = e.target.dataset.tab;
    console.log('📑 handleTabClick chiamata per tab:', tabName);

    if (tabName === 'logout') {
        handleLogout();
        return;
    }

    // Rimuovi classe active da tutti i tab
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Attiva il tab selezionato
    e.target.classList.add('active');
    const tabContent = document.getElementById(tabName);
    if (tabContent) {
        tabContent.classList.add('active');
    }

    // Carica i dati del tab
    switch (tabName) {
        case 'attivita':
            loadActivities();
            break;
        case 'calendario':
            loadCalendar();
            break;
        case 'membri':
            loadMembers();
            break;
        case 'amministrazione':
            loadAdminData();
            break;
        case 'gestione-sito':
            loadSiteAdmin();
            break;
        default:
            console.log('Tab non riconosciuto:', tabName);
    }
}

// Gestione logout
async function handleLogout() {
    console.log('🔓 Logout richiesto');
    
    if (confirm('Sei sicuro di voler uscire?')) {
        try {
            console.log('🔓 Effettuando logout...');
            await supabaseClient.auth.signOut();
            console.log('✅ Logout completato');
        } catch (error) {
            console.error('❌ Errore durante logout:', error);
        }
        // Forza sempre il redirect dopo il logout
        console.log('🔄 Redirect a login...');
        window.location.replace('login.html?event=manual_logout');
    }
}

function handleAdminTabClick(e) {
    console.log('👑 handleAdminTabClick chiamata');
    const tabName = e.target.dataset.adminTab;
    console.log('📑 Admin tab selezionato:', tabName);
    
    // Rimuovi classe active da tutti gli admin tab
    document.querySelectorAll('.admin-tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));
    
    // Attiva il tab selezionato
    e.target.classList.add('active');
    const tabContent = document.getElementById(tabName);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Carica i dati del sub-tab
    switch (tabName) {
        case 'impostazioni':
            loadUnitSettings();
            break;
        case 'utenti':
            loadUnitUsers();
            break;
        default:
            console.log('Admin tab non riconosciuto:', tabName);
    }
}

async function loadActivities() {
    console.log('🎯 loadActivities chiamata');
    if (!currentUnit) {
        console.log('⚠️ Nessuna unità selezionata');
        const activitiesList = document.getElementById('activities-list');
        if (activitiesList) {
            activitiesList.innerHTML = '<p>Seleziona un\'unità per visualizzare le attività</p>';
        }
        return;
    }
    
    try {
        console.log('📊 Caricamento attività per unità:', currentUnit.id);
        
        const { data: activities, error } = await supabaseClient
            .from('attivita')
            .select('*')
            .eq('unita_id', currentUnit.id)
            .order('data', { ascending: false });
            
        if (error) {
            console.error('❌ Errore caricamento attività:', error);
            throw error;
        }
        
        console.log('✅ Attività caricate:', activities?.length || 0);
        
        const activitiesList = document.getElementById('activities-list');
        if (!activitiesList) {
            console.error('❌ activities-list non trovato nel DOM');
            return;
        }
        
        if (!activities || activities.length === 0) {
            activitiesList.innerHTML = '<p>Nessuna attività trovata per questa unità</p>';
            return;
        }
        
        // Genera HTML per le attività
        const activitiesHtml = activities.map(activity => {
            const dataFormattata = new Date(activity.data).toLocaleDateString('it-IT');
            
            return `
                <div class="activity-card">
                    <div class="activity-header">
                        <h3>${activity.titolo}</h3>
                        <span class="activity-date">${dataFormattata}</span>
                    </div>
                    <div class="activity-content">
                        ${activity.obiettivi ? `<p><strong>Obiettivi:</strong> ${activity.obiettivi}</p>` : ''}
                        ${activity.raggiunti ? `<p><strong>Raggiunti:</strong> ${activity.raggiunti}</p>` : ''}
                    </div>
                    <div class="activity-actions">
                        <button class="btn-primary" onclick="viewActivity(${activity.id})">Visualizza</button>
                        <button class="btn-secondary" onclick="editActivity(${activity.id})">Modifica</button>
                        <button class="btn-danger" onclick="deleteActivity(${activity.id})">Elimina</button>
                    </div>
                </div>
            `;
        }).join('');
        
        activitiesList.innerHTML = activitiesHtml;
        
    } catch (error) {
        console.error('💥 Errore loadActivities:', error);
        const activitiesList = document.getElementById('activities-list');
        if (activitiesList) {
            activitiesList.innerHTML = '<p>Errore nel caricamento delle attività</p>';
        }
    }
}

async function loadCalendar() {
    console.log('📅 loadCalendar chiamata');
    if (!currentUnit) {
        console.log('⚠️ Nessuna unità selezionata');
        const calendarContainer = document.getElementById('calendar-container');
        if (calendarContainer) {
            calendarContainer.innerHTML = '<p>Seleziona un\'unità per visualizzare il calendario</p>';
        }
        return;
    }
    
    try {
        // Aggiorna il mese corrente nel header
        const currentMonthSpan = document.getElementById('current-month');
        if (currentMonthSpan) {
            const monthNames = [
                'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
            ];
            currentMonthSpan.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        }
        
        // Carica attività del mese corrente
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        const { data: activities, error } = await supabaseClient
            .from('attivita')
            .select('*')
            .eq('unita_id', currentUnit.id)
            .gte('data', startOfMonth.toISOString().split('T')[0])
            .lte('data', endOfMonth.toISOString().split('T')[0])
            .order('data');
            
        if (error) {
            console.error('❌ Errore caricamento attività calendario:', error);
            throw error;
        }
        
        console.log('✅ Attività calendario caricate:', activities?.length || 0);
        
        // Genera calendario HTML semplice
        const calendarContainer = document.getElementById('calendar-container');
        if (!calendarContainer) {
            console.error('❌ calendar-container non trovato nel DOM');
            return;
        }
        
        // Crea una mappa delle attività per data
        const activitiesByDate = {};
        if (activities) {
            activities.forEach(activity => {
                const dateKey = activity.data;
                if (!activitiesByDate[dateKey]) {
                    activitiesByDate[dateKey] = [];
                }
                activitiesByDate[dateKey].push(activity);
            });
        }
        
        // Genera HTML calendario
        let calendarHtml = '<div class="calendar-grid">';
        
        // Header giorni della settimana
        const weekDays = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
        weekDays.forEach(day => {
            calendarHtml += `<div class="calendar-header-day">${day}</div>`;
        });
        
        // Calcola primo giorno del mese e numero di giorni
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const startingDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        
        // Aggiungi celle vuote per allineamento
        for (let i = 0; i < startingDayOfWeek; i++) {
            calendarHtml += '<div class="calendar-day empty"></div>';
        }
        
        // Aggiungi giorni del mese
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayActivities = activitiesByDate[dateKey] || [];
            
            calendarHtml += `<div class="calendar-day ${dayActivities.length > 0 ? 'has-activities' : ''}">`;
            calendarHtml += `<div class="day-number">${day}</div>`;
            
            if (dayActivities.length > 0) {
                calendarHtml += '<div class="day-activities">';
                dayActivities.forEach(activity => {
                    calendarHtml += `<div class="activity-preview clickable" 
                        onclick="viewActivity(${activity.id})" 
                        title="Clicca per visualizzare: ${activity.titolo}">
                        ${activity.titolo}
                    </div>`;
                });
                calendarHtml += '</div>';
            }
            
            calendarHtml += '</div>';
        }
        
        calendarHtml += '</div>';
        
        calendarContainer.innerHTML = calendarHtml;
        
    } catch (error) {
        console.error('💥 Errore loadCalendar:', error);
        const calendarContainer = document.getElementById('calendar-container');
        if (calendarContainer) {
            calendarContainer.innerHTML = '<p>Errore nel caricamento del calendario</p>';
        }
    }
}

async function loadMembers() {
    console.log('👥 loadMembers chiamata');
    if (!currentUnit) {
        console.log('⚠️ Nessuna unità selezionata');
        const membersList = document.getElementById('members-list');
        if (membersList) {
            membersList.innerHTML = '<p>Seleziona un\'unità per visualizzare i membri</p>';
        }
        return;
    }
    
    try {
        console.log('📊 Caricamento membri per unità:', currentUnit.id);
        
        const { data: members, error } = await supabaseClient
            .from('membri')
            .select('*')
            .eq('unita_id', currentUnit.id)
            .order('cognome', { ascending: true });
            
        if (error) {
            console.error('❌ Errore caricamento membri:', error);
            throw error;
        }
        
        console.log('✅ Membri caricati:', members?.length || 0);
        
        const membersList = document.getElementById('members-list');
        if (!membersList) {
            console.error('❌ members-list non trovato nel DOM');
            return;
        }
        
        if (!members || members.length === 0) {
            membersList.innerHTML = '<p>Nessun membro trovato per questa unità</p>';
            return;
        }
        
        // Genera HTML per i membri
        const membersHtml = members.map(member => {
            // Gestisci obiettivi che potrebbe essere stringa JSON o array
            let obiettivi = [];
            try {
                if (member.obiettivi) {
                    if (typeof member.obiettivi === 'string') {
                        obiettivi = JSON.parse(member.obiettivi);
                    } else if (Array.isArray(member.obiettivi)) {
                        obiettivi = member.obiettivi;
                    }
                }
            } catch (error) {
                console.warn('⚠️ Errore parsing obiettivi per membro', member.id, ':', error);
                obiettivi = [];
            }
            
            return `
                <div class="member-card">
                    <div class="member-header">
                        <h3>${member.nome} ${member.cognome}</h3>
                        <span class="member-role"><strong>Ruolo:</strong> ${member.ruolo || 'Membro'}</span>
                    </div>
                    <div class="member-content">
                        <p><strong>Anno:</strong> ${member.anno}</p>
                        ${Array.isArray(obiettivi) && obiettivi.length > 0 ? `
                            <div class="objectives-preview">
                                <strong>Obiettivi:</strong>
                                <ul>
                                    ${obiettivi.map(obj => `
                                        <li>${obj.titolo} ${obj.data ? `(${new Date(obj.data).toLocaleDateString('it-IT')})` : ''}</li>
                                    `).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                    <div class="member-actions">
                        <button class="btn-secondary btn-equal" onclick="editMember(${member.id})">Modifica</button>
                        <button class="btn-danger btn-equal" onclick="deleteMember(${member.id})">Elimina</button>
                    </div>
                </div>
            `;
        }).join('');
        
        membersList.innerHTML = membersHtml;
        
    } catch (error) {
        console.error('💥 Errore loadMembers:', error);
        const membersList = document.getElementById('members-list');
        if (membersList) {
            membersList.innerHTML = '<p>Errore nel caricamento dei membri</p>';
        }
    }
}

async function loadAdminData() {
    console.log('👑 loadAdminData chiamata');
    if (!currentUser?.admin) {
        console.log('⚠️ Utente non admin');
        return;
    }
    // Carica di default il tab impostazioni
    loadUnitSettings();
}

async function loadUnitSettings() {
    console.log('⚙️ loadUnitSettings chiamata');
    if (!currentUnit) {
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) {
            settingsForm.innerHTML = '<p>Seleziona un\'unità per visualizzare le impostazioni</p>';
        }
        return;
    }
    
    try {
        console.log('📊 Caricamento impostazioni per unità:', currentUnit.id);
        
        const { data: settings, error } = await supabaseClient
            .from('impostazioni')
            .select('*')
            .eq('unita_id', currentUnit.id);
            
        if (error) {
            console.error('❌ Errore caricamento impostazioni:', error);
            throw error;
        }
        
        const settingsForm = document.getElementById('settings-form');
        if (!settingsForm) {
            console.error('❌ settings-form non trovato nel DOM');
            return;
        }
        
        // Genera form per le impostazioni
        let settingsHtml = `
            <div class="settings-section">
                <h4>Impostazioni Unità: ${currentUnit.nome}</h4>
                <div class="unit-info">
                    <p><strong>Capo Unità:</strong> ${currentUnit.capo_unita || 'Non assegnato'}</p>
                    <p><strong>Numero Membri:</strong> ${currentUnit.nr_membri || 0}</p>
                    <p><strong>Aiuti:</strong> ${currentUnit.aiuti ? currentUnit.aiuti.join(', ') : 'Nessuno'}</p>
                </div>
            </div>
        `;
        
        if (settings && settings.length > 0) {
            settingsHtml += '<div class="custom-settings">';
            settings.forEach(setting => {
                settingsHtml += `
                    <div class="setting-item">
                        <label>${setting.chiave}:</label>
                        <input type="text" value="${setting.valore}" data-key="${setting.chiave}" data-id="${setting.id}">
                        <button class="btn-secondary" onclick="updateSetting(${setting.id}, '${setting.chiave}')">Aggiorna</button>
                    </div>
                `;
            });
            settingsHtml += '</div>';
        } else {
            settingsHtml += '<p>Nessuna impostazione personalizzata configurata</p>';
        }
        
        settingsForm.innerHTML = settingsHtml;
        
    } catch (error) {
        console.error('💥 Errore loadUnitSettings:', error);
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) {
            settingsForm.innerHTML = '<p>Errore nel caricamento delle impostazioni</p>';
        }
    }
}

async function loadUnitUsers() {
    console.log('👥 loadUnitUsers chiamata');
    if (!currentUnit) {
        const usersList = document.getElementById('users-list');
        if (usersList) {
            usersList.innerHTML = '<p>Seleziona un\'unità per visualizzare gli utenti</p>';
        }
        return;
    }
    
    try {
        console.log('📊 Caricamento utenti per unità:', currentUnit.id);
        
        // Carica tutti gli utenti che hanno questa unità nelle loro unita_associate
        const { data: users, error } = await supabaseClient
            .from('utenti')
            .select('*')
            .contains('unita_associate', [currentUnit.id.toString()]);  // ID come stringa
            
        if (error) {
            console.error('❌ Errore caricamento utenti unità:', error);
            throw error;
        }
        
        console.log('✅ Utenti unità caricati:', users?.length || 0);
        
        const usersList = document.getElementById('users-list');
        if (!usersList) {
            console.error('❌ users-list non trovato nel DOM');
            return;
        }
        
        if (!users || users.length === 0) {
            usersList.innerHTML = '<p>Nessun utente associato a questa unità</p>';
            return;
        }
        
        // Genera HTML per gli utenti
        const usersHtml = users.map(user => `
            <div class="user-card">
                <div class="user-info">
                    <h4>${user.nome} ${user.cognome}</h4>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Admin:</strong> ${user.admin ? 'Sì' : 'No'}</p>
                    <p><strong>Unità Associate:</strong> ${user.unita_associate?.length || 0}</p>
                </div>
                <div class="user-actions">
                    <button class="btn-secondary" onclick="editUser(${user.id})">Modifica</button>
                    <button class="btn-danger" onclick="removeUserFromUnit(${user.id})">Rimuovi da Unità</button>
                </div>
            </div>
        `).join('');
        
        usersList.innerHTML = usersHtml;
        
    } catch (error) {
        console.error('💥 Errore loadUnitUsers:', error);
        const usersList = document.getElementById('users-list');
        if (usersList) {
            usersList.innerHTML = '<p>Errore nel caricamento degli utenti</p>';
        }
    }
}

async function loadSiteAdmin() {
    console.log('⚙️ loadSiteAdmin chiamata');
    if (!currentUser?.admin) {
        console.log('⚠️ Utente non admin');
        return;
    }
    
    try {
        // Carica tutte le unità
        await loadAllUnits();
        // Carica tutti gli utenti
        await loadAllUsers();
        
    } catch (error) {
        console.error('💥 Errore loadSiteAdmin:', error);
    }
}

async function loadAllUnits() {
    console.log('🏢 loadAllUnits chiamata');
    
    try {
        const { data: units, error } = await supabaseClient
            .from('unita')
            .select('*')
            .order('nome');
            
        if (error) {
            console.error('❌ Errore caricamento tutte le unità:', error);
            throw error;
        }
        
        console.log('✅ Tutte le unità caricate:', units?.length || 0);
        
        const unitsList = document.getElementById('units-list');
        if (!unitsList) {
            console.error('❌ units-list non trovato nel DOM');
            return;
        }
        
        if (!units || units.length === 0) {
            unitsList.innerHTML = '<p>Nessuna unità trovata</p>';
            return;
        }
        
        // Genera HTML per le unità
        const unitsHtml = units.map(unit => `
            <div class="unit-card">
                <div class="unit-info">
                    <h4>${unit.nome}</h4>
                    <p><strong>ID:</strong> ${unit.id}</p>
                    <p><strong>Capo Unità:</strong> ${unit.capo_unita || 'Non assegnato'}</p>
                    <p><strong>Membri:</strong> ${unit.nr_membri || 0}</p>
                    <p><strong>Aiuti:</strong> ${unit.aiuti ? unit.aiuti.length : 0}</p>
                </div>
                <div class="unit-actions">
                    <button class="btn-secondary" onclick="editUnit(${unit.id})">Modifica</button>
                    <button class="btn-danger" onclick="deleteUnit(${unit.id})">Elimina</button>
                </div>
            </div>
        `).join('');
        
        unitsList.innerHTML = unitsHtml;
        
    } catch (error) {
        console.error('💥 Errore loadAllUnits:', error);
        const unitsList = document.getElementById('units-list');
        if (unitsList) {
            unitsList.innerHTML = '<p>Errore nel caricamento delle unità</p>';
        }
    }
}

async function loadAllUsers() {
    console.log('👤 loadAllUsers chiamata');
    
    try {
        const { data: users, error } = await supabaseClient
            .from('utenti')
            .select('*')
            .order('cognome');
            
        if (error) {
            console.error('❌ Errore caricamento tutti gli utenti:', error);
            throw error;
        }
        
        console.log('✅ Tutti gli utenti caricati:', users?.length || 0);
        
        const allUsersList = document.getElementById('all-users-list');
        if (!allUsersList) {
            console.error('❌ all-users-list non trovato nel DOM');
            return;
        }
        
        if (!users || users.length === 0) {
            allUsersList.innerHTML = '<p>Nessun utente trovato</p>';
            return;
        }
        
        // Genera HTML per tutti gli utenti
        const usersHtml = users.map(user => `
            <div class="user-card">
                <div class="user-info">
                    <h4>${user.nome} ${user.cognome}</h4>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Admin:</strong> ${user.admin ? 'Sì' : 'No'}</p>
                    <p><strong>Unità Associate:</strong> ${user.unita_associate?.length || 0}</p>
                    ${user.unita_associate && user.unita_associate.length > 0 ? 
                        `<p><strong>IDs Unità:</strong> ${user.unita_associate.join(', ')}</p>` : ''
                    }
                </div>
                <div class="user-actions">
                    <button class="btn-secondary" onclick="editUserUnits(${user.id})">Modifica Unità</button>
                    <button class="btn-secondary" onclick="toggleAdminStatus(${user.id}, ${!user.admin})">
                        ${user.admin ? 'Rimuovi Admin' : 'Rendi Admin'}
                    </button>
                </div>
            </div>
        `).join('');
        
        allUsersList.innerHTML = usersHtml;
        
    } catch (error) {
        console.error('💥 Errore loadAllUsers:', error);
        const allUsersList = document.getElementById('all-users-list');
        if (allUsersList) {
            allUsersList.innerHTML = '<p>Errore nel caricamento degli utenti</p>';
        }
    }
}

// Funzioni form 
async function handleActivitySubmit(e) {
    console.log('📝 handleActivitySubmit chiamata');
    e.preventDefault();
    
    if (!currentUnit) {
        alert('Seleziona un\'unità prima di salvare l\'attività');
        return;
    }
    
    try {
        const form = e.target;
        const formData = new FormData(form);
        const isEdit = form.dataset.editId; // Verifica se siamo in modalità modifica
        
        // Raccogli dati dalla tabella oraria
        const scheduleRows = document.querySelectorAll('#schedule-rows .schedule-row');
        const tabellaOraria = [];
        
        scheduleRows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            if (inputs.length >= 4) {
                tabellaOraria.push({
                    orario: inputs[0].value,
                    tipo: inputs[1].value,
                    descrizione: inputs[2].value,
                    gestore: inputs[3].value
                });
            }
        });
        
        const activityData = {
            titolo: formData.get('titolo'),
            obiettivi: formData.get('obiettivi'),
            data: formData.get('data'),
            raggiunti: formData.get('raggiunti'),
            tabella_oraria: tabellaOraria,
            unita_id: currentUnit.id
        };
        
        console.log(isEdit ? '✏️ Modifica attività:' : '💾 Salvataggio attività:', activityData);
        
        let result;
        if (isEdit) {
            // Modalità modifica
            result = await supabaseClient
                .from('attivita')
                .update(activityData)
                .eq('id', isEdit)
                .select();
        } else {
            // Modalità creazione
            result = await supabaseClient
                .from('attivita')
                .insert([activityData])
                .select();
        }
        
        const { data, error } = result;
        
        if (error) {
            console.error('❌ Errore salvataggio attività:', error);
            alert('Errore nel salvataggio: ' + error.message);
            return;
        }
        
        console.log('✅ Attività salvata:', data);
        alert(isEdit ? 'Attività modificata con successo!' : 'Attività salvata con successo!');
        
        // Chiudi modal e aggiorna lista
        closeModal('activity-modal');
        clearActivityForm();
        await loadActivities();
        await loadCalendar(); // Aggiorna anche il calendario
        
    } catch (error) {
        console.error('💥 Errore handleActivitySubmit:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

async function handleMemberSubmit(e) {
    console.log('👤 handleMemberSubmit chiamata');
    e.preventDefault();
    
    if (!currentUnit) {
        alert('Seleziona un\'unità prima di salvare il membro');
        return;
    }
    
    try {
        const form = e.target;
        const formData = new FormData(form);
        const isEdit = form.dataset.editId; // Verifica se siamo in modalità modifica
        
        // Raccogli obiettivi
        const objectiveRows = document.querySelectorAll('#objectives-list .objective-row');
        const obiettivi = [];
        
        objectiveRows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            if (inputs.length >= 2 && inputs[0].value && inputs[1].value) {
                obiettivi.push({
                    titolo: inputs[0].value,
                    data: inputs[1].value
                });
            }
        });
        
        const memberData = {
            nome: formData.get('nome'),
            cognome: formData.get('cognome'),
            anno: parseInt(formData.get('anno')),
            ruolo: formData.get('ruolo'),
            obiettivi: obiettivi,
            unita_id: currentUnit.id
        };
        
        console.log(isEdit ? '✏️ Modifica membro:' : '💾 Salvataggio membro:', memberData);
        
        let result;
        if (isEdit) {
            // Modalità modifica
            result = await supabaseClient
                .from('membri')
                .update(memberData)
                .eq('id', isEdit)
                .select();
        } else {
            // Modalità creazione
            result = await supabaseClient
                .from('membri')
                .insert([memberData])
                .select();
        }
        
        const { data, error } = result;
        
        if (error) {
            console.error('❌ Errore salvataggio membro:', error);
            alert('Errore nel salvataggio: ' + error.message);
            return;
        }
        
        console.log('✅ Membro salvato:', data);
        alert(isEdit ? 'Membro modificato con successo!' : 'Membro salvato con successo!');
        
        // Chiudi modal e aggiorna lista
        closeModal('member-modal');
        clearMemberForm();
        await loadMembers();
        
        // Aggiorna contatore membri nell'unità (solo per nuovi membri)
        if (!isEdit) {
            await updateUnitMemberCount();
        }
        
    } catch (error) {
        console.error('💥 Errore handleMemberSubmit:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

async function updateUnitMemberCount() {
    if (!currentUnit) return;
    
    try {
        const { count, error } = await supabaseClient
            .from('membri')
            .select('*', { count: 'exact' })
            .eq('unita_id', currentUnit.id);
            
        if (error) {
            console.error('❌ Errore conteggio membri:', error);
            return;
        }
        
        await supabaseClient
            .from('unita')
            .update({ nr_membri: count })
            .eq('id', currentUnit.id);
            
    } catch (error) {
        console.error('💥 Errore aggiornamento contatore membri:', error);
    }
}

async function handleUnitSubmit(e) {
    console.log('🏢 handleUnitSubmit chiamata');
    e.preventDefault();
    
    try {
        const form = e.target;
        const formData = new FormData(form);
        
        const unitData = {
            nome: formData.get('nome'),
            capo_unita: formData.get('capo_unita') || null,
            aiuti: [], // TODO: gestire selezione multipla aiuti
            nr_membri: parseInt(formData.get('nr_membri')) || 0
        };
        
        console.log('💾 Salvataggio unità:', unitData);
        
        const { data, error } = await supabaseClient
            .from('unita')
            .insert([unitData])
            .select();
            
        if (error) {
            console.error('❌ Errore salvataggio unità:', error);
            alert('Errore nel salvataggio: ' + error.message);
            return;
        }
        
        console.log('✅ Unità salvata:', data);
        alert('Unità salvata con successo!');
        
        // Chiudi modal e aggiorna lista
        closeModal('unit-modal');
        clearUnitForm();
        await loadAllUnits();
        await loadAvailableUnits(); // Ricarica anche il dropdown
        
    } catch (error) {
        console.error('💥 Errore handleUnitSubmit:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

async function handleNewUserSubmit(e) {
    console.log('👤 handleNewUserSubmit chiamata');
    e.preventDefault();
    
    try {
        const form = e.target;
        const formData = new FormData(form);
        
        const userData = {
            nome: formData.get('nome'),
            cognome: formData.get('cognome'),
            email: formData.get('email'),
            admin: false,
            unita_associate: currentUnit ? [currentUnit.id.toString()] : []  // ID come stringa
        };
        
        // TODO: gestire creazione account Supabase Auth
        console.log('💾 Creazione nuovo utente:', userData);
        
        const { data, error } = await supabaseClient
            .from('utenti')
            .insert([userData])
            .select();
            
        if (error) {
            console.error('❌ Errore creazione utente:', error);
            alert('Errore nella creazione: ' + error.message);
            return;
        }
        
        console.log('✅ Utente creato:', data);
        alert('Utente creato con successo! (Nota: l\'account di autenticazione deve essere creato separatamente)');
        
        // Chiudi modal e aggiorna lista
        closeModal('new-user-modal');
        clearUserForm();
        await loadUnitUsers();
        
    } catch (error) {
        console.error('💥 Errore handleNewUserSubmit:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

async function handleExistingUserSubmit(e) {
    console.log('👤 handleExistingUserSubmit chiamata');
    e.preventDefault();
    
    if (!currentUnit) {
        alert('Seleziona un\'unità prima di aggiungere un utente');
        return;
    }
    
    try {
        const form = e.target;
        const formData = new FormData(form);
        const userId = parseInt(formData.get('user_id'));
        
        if (!userId) {
            alert('Seleziona un utente valido');
            return;
        }
        
        // Carica l'utente corrente
        const { data: user, error: fetchError } = await supabaseClient
            .from('utenti')
            .select('unita_associate')
            .eq('id', userId)
            .single();
            
        if (fetchError) {
            console.error('❌ Errore caricamento utente:', fetchError);
            alert('Errore nel caricamento utente: ' + fetchError.message);
            return;
        }
        
        // Aggiungi l'unità se non già presente
        const currentUnits = user.unita_associate || [];
        const unitIdStr = currentUnit.id.toString();  // Converte ID in stringa
        if (!currentUnits.includes(unitIdStr)) {
            currentUnits.push(unitIdStr);  // Aggiunge come stringa
            
            const { error } = await supabaseClient
                .from('utenti')
                .update({ unita_associate: currentUnits })
                .eq('id', userId);
                
            if (error) {
                console.error('❌ Errore aggiunta utente a unità:', error);
                alert('Errore nell\'aggiunta: ' + error.message);
                return;
            }
            
            console.log('✅ Utente aggiunto all\'unità');
            alert('Utente aggiunto all\'unità con successo!');
        } else {
            alert('L\'utente è già associato a questa unità');
        }
        
        // Chiudi modal e aggiorna lista
        closeModal('existing-user-modal');
        await loadUnitUsers();
        
    } catch (error) {
        console.error('💥 Errore handleExistingUserSubmit:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

// Funzioni utility
function navigateMonth(direction) {
    console.log('📅 navigateMonth chiamata:', direction);
    currentDate.setMonth(currentDate.getMonth() + direction);
    loadCalendar();
}

function addScheduleRow(orario = '', tipo = '', descrizione = '', gestore = '') {
    console.log('➕ addScheduleRow chiamata con valori:', { orario, tipo, descrizione, gestore });
    const scheduleRows = document.getElementById('schedule-rows');
    if (!scheduleRows) {
        console.error('❌ schedule-rows non trovato');
        return;
    }
    
    const rowId = Date.now(); // ID univoco per la riga
    const rowDiv = document.createElement('div');
    rowDiv.className = 'schedule-row';
    rowDiv.dataset.rowId = rowId;
    
    rowDiv.innerHTML = `
        <input type="time" name="orario" placeholder="HH:MM" value="${orario}" required>
        <input type="text" name="tipo" placeholder="Titolo" value="${tipo}" required>
        <input type="text" name="descrizione" placeholder="Descrizione" value="${descrizione}">
        <input type="text" name="gestore" placeholder="Gestore" value="${gestore}">
        <button type="button" class="btn-danger btn-small" onclick="removeScheduleRow(${rowId})">Rimuovi</button>
    `;
    
    scheduleRows.appendChild(rowDiv);
    console.log('✅ Riga oraria aggiunta con ID:', rowId);
}

function removeScheduleRow(rowId) {
    const row = document.querySelector(`[data-row-id="${rowId}"]`);
    if (row) {
        row.remove();
        console.log('🗑️ Riga oraria rimossa:', rowId);
    }
}

function addObjectiveRow() {
    console.log('➕ addObjectiveRow chiamata');
    addObjective('', '');
}

function addObjective(titolo = '', data = '') {
    console.log('➕ addObjective chiamata con valori:', { titolo, data });
    const objectivesList = document.getElementById('objectives-list');
    if (!objectivesList) {
        console.error('❌ objectives-list non trovato');
        return;
    }
    
    const rowId = Date.now(); // ID univoco per l'obiettivo
    const objectiveDiv = document.createElement('div');
    objectiveDiv.className = 'objective-row';
    objectiveDiv.dataset.objectiveId = rowId;
    
    objectiveDiv.innerHTML = `
        <div class="objective-inputs">
            <input type="text" name="titolo" placeholder="Titolo obiettivo" value="${titolo}" required>
            <input type="date" name="data" value="${data}" required>
            <button type="button" class="btn-danger btn-small" onclick="removeObjectiveRow(${rowId})">Rimuovi</button>
        </div>
    `;
    
    objectivesList.appendChild(objectiveDiv);
    console.log('✅ Obiettivo aggiunto con ID:', rowId);
}

function removeObjectiveRow(objectiveId) {
    const objective = document.querySelector(`[data-objective-id="${objectiveId}"]`);
    if (objective) {
        objective.remove();
        console.log('🗑️ Obiettivo rimosso:', objectiveId);
    }
}

// Funzione per chiudere modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        console.log('❌ Modal chiuso:', modalId);
    }
}

// Funzioni CRUD per attività
async function editActivity(activityId) {
    console.log('✏️ Modifica attività:', activityId);
    
    try {
        // Carica i dati dell'attività dal database
        const { data: activity, error } = await supabaseClient
            .from('attivita')
            .select('*')
            .eq('id', activityId)
            .single();
            
        if (error) {
            console.error('❌ Errore caricamento attività:', error);
            alert('Errore nel caricamento dell\'attività: ' + error.message);
            return;
        }
        
        if (!activity) {
            alert('Attività non trovata');
            return;
        }
        
        // Popola il form con i dati esistenti
        document.getElementById('activity-title').value = activity.titolo || '';
        document.getElementById('activity-objectives').value = activity.obiettivi || '';
        document.getElementById('activity-date').value = activity.data || '';
        document.getElementById('activity-achieved').value = activity.raggiunti || '';
        
        // Gestisci tabella oraria
        let tabellaOraria = [];
        try {
            if (activity.tabella_oraria) {
                if (typeof activity.tabella_oraria === 'string') {
                    tabellaOraria = JSON.parse(activity.tabella_oraria);
                } else if (Array.isArray(activity.tabella_oraria)) {
                    tabellaOraria = activity.tabella_oraria;
                }
            }
        } catch (error) {
            console.warn('⚠️ Errore parsing tabella_oraria:', error);
            tabellaOraria = [];
        }
        
        // Pulisci e popola la tabella oraria
        const scheduleRows = document.getElementById('schedule-rows');
        scheduleRows.innerHTML = '';
        
        if (tabellaOraria.length > 0) {
            tabellaOraria.forEach(slot => {
                addScheduleRow(slot.orario || '', slot.tipo || '', slot.descrizione || '', slot.gestore || '');
            });
        }
        
        // Imposta il form in modalità modifica
        const modal = document.getElementById('activity-modal');
        const modalTitle = document.getElementById('activity-modal-title');
        const form = document.getElementById('activity-form');
        
        modalTitle.textContent = 'Modifica Attività';
        form.dataset.editId = activityId;
        
        // Mostra il modal
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('💥 Errore editActivity:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

async function viewActivity(activityId) {
    console.log('👁️ Visualizza attività:', activityId);
    
    try {
        // Carica i dati dell'attività dal database
        const { data: activity, error } = await supabaseClient
            .from('attivita')
            .select('*')
            .eq('id', activityId)
            .single();
            
        if (error) {
            console.error('❌ Errore caricamento attività:', error);
            alert('Errore nel caricamento dell\'attività: ' + error.message);
            return;
        }
        
        if (!activity) {
            alert('Attività non trovata');
            return;
        }
        
        // Gestisci tabella oraria
        let tabellaOraria = [];
        try {
            if (activity.tabella_oraria) {
                if (typeof activity.tabella_oraria === 'string') {
                    tabellaOraria = JSON.parse(activity.tabella_oraria);
                } else if (Array.isArray(activity.tabella_oraria)) {
                    tabellaOraria = activity.tabella_oraria;
                }
            }
        } catch (error) {
            console.warn('⚠️ Errore parsing tabella_oraria:', error);
            tabellaOraria = [];
        }
        
        const dataFormattata = new Date(activity.data).toLocaleDateString('it-IT');
        
        // Crea il popup di visualizzazione
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content modal-content-large">
                <div class="modal-header">
                    <h3>Dettagli Attività</h3>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="activity-details">
                    <div class="detail-group">
                        <label><strong>Titolo:</strong></label>
                        <p>${activity.titolo}</p>
                    </div>
                    <div class="detail-group">
                        <label><strong>Data:</strong></label>
                        <p>${dataFormattata}</p>
                    </div>
                    ${activity.obiettivi ? `
                        <div class="detail-group">
                            <label><strong>Obiettivi:</strong></label>
                            <p>${activity.obiettivi}</p>
                        </div>
                    ` : ''}
                    ${activity.raggiunti ? `
                        <div class="detail-group">
                            <label><strong>Obiettivi Raggiunti:</strong></label>
                            <p>${activity.raggiunti}</p>
                        </div>
                    ` : ''}
                    ${tabellaOraria.length > 0 ? `
                        <div class="detail-group">
                            <label><strong>Programma della Giornata:</strong></label>
                            <div class="schedule-view">
                                ${tabellaOraria.map(slot => `
                                    <div class="schedule-item">
                                        <span class="schedule-time">${slot.orario}</span>
                                        <span class="schedule-type">${slot.tipo}</span>
                                        ${slot.descrizione ? `<span class="schedule-desc">${slot.descrizione}</span>` : ''}
                                        ${slot.gestore ? `<span class="schedule-manager">- ${slot.gestore}</span>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('💥 Errore viewActivity:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

async function deleteActivity(activityId) {
    if (!confirm('Sei sicuro di voler eliminare questa attività?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('attivita')
            .delete()
            .eq('id', activityId);
            
        if (error) {
            console.error('❌ Errore eliminazione attività:', error);
            alert('Errore nell\'eliminazione: ' + error.message);
            return;
        }
        
        console.log('✅ Attività eliminata:', activityId);
        await loadActivities();
        
    } catch (error) {
        console.error('💥 Errore deleteActivity:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

// Funzioni CRUD per membri
async function editMember(memberId) {
    console.log('✏️ Modifica membro:', memberId);
    
    try {
        // Carica i dati del membro dal database
        const { data: member, error } = await supabaseClient
            .from('membri')
            .select('*')
            .eq('id', memberId)
            .single();
            
        if (error) {
            console.error('❌ Errore caricamento membro:', error);
            alert('Errore nel caricamento del membro: ' + error.message);
            return;
        }
        
        if (!member) {
            alert('Membro non trovato');
            return;
        }
        
        // Popola il form con i dati esistenti
        document.getElementById('member-name').value = member.nome || '';
        document.getElementById('member-surname').value = member.cognome || '';
        document.getElementById('member-year').value = member.anno || '';
        document.getElementById('member-role').value = member.ruolo || '';
        
        // Gestisci obiettivi
        let obiettivi = [];
        try {
            if (member.obiettivi) {
                if (typeof member.obiettivi === 'string') {
                    obiettivi = JSON.parse(member.obiettivi);
                } else if (Array.isArray(member.obiettivi)) {
                    obiettivi = member.obiettivi;
                }
            }
        } catch (error) {
            console.warn('⚠️ Errore parsing obiettivi:', error);
            obiettivi = [];
        }
        
        // Pulisci e popola la lista degli obiettivi
        const objectivesList = document.getElementById('objectives-list');
        objectivesList.innerHTML = '';
        
        if (obiettivi.length > 0) {
            obiettivi.forEach(obiettivo => {
                addObjective(obiettivo.titolo || '', obiettivo.data || '');
            });
        }
        
        // Imposta il form in modalità modifica
        const modal = document.getElementById('member-modal');
        const modalTitle = document.getElementById('member-modal-title');
        const form = document.getElementById('member-form');
        
        modalTitle.textContent = 'Modifica Membro';
        form.dataset.editId = memberId;
        
        // Mostra il modal
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('💥 Errore editMember:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

async function deleteMember(memberId) {
    if (!confirm('Sei sicuro di voler eliminare questo membro?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('membri')
            .delete()
            .eq('id', memberId);
            
        if (error) {
            console.error('❌ Errore eliminazione membro:', error);
            alert('Errore nell\'eliminazione: ' + error.message);
            return;
        }
        
        console.log('✅ Membro eliminato:', memberId);
        await loadMembers();
        await updateUnitMemberCount();
        
    } catch (error) {
        console.error('💥 Errore deleteMember:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

// Funzioni per amministrazione utenti
async function editUser(userId) {
    console.log('✏️ Modifica utente:', userId);
    // TODO: implementare modifica utente
    alert('Funzione in sviluppo');
}

async function removeUserFromUnit(userId) {
    if (!confirm('Sei sicuro di voler rimuovere questo utente dall\'unità?')) return;
    if (!currentUnit) return;
    
    try {
        // Carica l'utente corrente
        const { data: user, error: fetchError } = await supabaseClient
            .from('utenti')
            .select('unita_associate')
            .eq('id', userId)
            .single();
            
        if (fetchError) {
            console.error('❌ Errore caricamento utente:', fetchError);
            return;
        }
        
        // Rimuovi l'unità dall'array
        const newUnits = (user.unita_associate || []).filter(id => id !== currentUnit.id);
        
        const { error } = await supabaseClient
            .from('utenti')
            .update({ unita_associate: newUnits })
            .eq('id', userId);
            
        if (error) {
            console.error('❌ Errore rimozione utente da unità:', error);
            alert('Errore nella rimozione: ' + error.message);
            return;
        }
        
        console.log('✅ Utente rimosso dall\'unità');
        await loadUnitUsers();
        
    } catch (error) {
        console.error('💥 Errore removeUserFromUnit:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

// Funzioni per gestione sito
async function editUnit(unitId) {
    console.log('✏️ Modifica unità:', unitId);
    // TODO: implementare modifica unità
    alert('Funzione in sviluppo');
}

async function deleteUnit(unitId) {
    if (!confirm('Sei sicuro di voler eliminare questa unità? Questa azione eliminerà anche tutti i dati associati.')) return;
    
    try {
        const { error } = await supabaseClient
            .from('unita')
            .delete()
            .eq('id', unitId);
            
        if (error) {
            console.error('❌ Errore eliminazione unità:', error);
            alert('Errore nell\'eliminazione: ' + error.message);
            return;
        }
        
        console.log('✅ Unità eliminata:', unitId);
        await loadAllUnits();
        
    } catch (error) {
        console.error('💥 Errore deleteUnit:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

async function editUserUnits(userId) {
    console.log('✏️ Modifica unità utente:', userId);
    // TODO: implementare modifica unità utente
    alert('Funzione in sviluppo');
}

async function toggleAdminStatus(userId, newStatus) {
    if (!confirm(`Sei sicuro di voler ${newStatus ? 'rendere admin' : 'rimuovere i privilegi admin a'} questo utente?`)) return;
    
    try {
        const { error } = await supabaseClient
            .from('utenti')
            .update({ admin: newStatus })
            .eq('id', userId);
            
        if (error) {
            console.error('❌ Errore cambio status admin:', error);
            alert('Errore nel cambio status: ' + error.message);
            return;
        }
        
        console.log('✅ Status admin cambiato:', userId, newStatus);
        await loadAllUsers();
        
    } catch (error) {
        console.error('💥 Errore toggleAdminStatus:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}

async function updateSetting(settingId, key) {
    const input = document.querySelector(`[data-id="${settingId}"]`);
    if (!input) return;
    
    const newValue = input.value;
    
    try {
        const { error } = await supabaseClient
            .from('impostazioni')
            .update({ valore: newValue })
            .eq('id', settingId);
            
        if (error) {
            console.error('❌ Errore aggiornamento impostazione:', error);
            alert('Errore nell\'aggiornamento: ' + error.message);
            return;
        }
        
        console.log('✅ Impostazione aggiornata:', key, newValue);
        alert('Impostazione aggiornata con successo!');
        
    } catch (error) {
        console.error('💥 Errore updateSetting:', error);
        alert('Errore imprevisto: ' + error.message);
    }
}
