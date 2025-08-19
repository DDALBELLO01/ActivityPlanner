// App.js - Applicazione principale con controllo autenticazione
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
        console.log('=== INIZIALIZZAZIONE APP ===');
        console.log('Controllo accesso a app.html...');
        console.log('URL attuale:', window.location.href);
        
        // Aggiungi un timeout per evitare che il controllo sia troppo veloce
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Controlla la sessione invece dell'utente
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        console.log('Risultato getSession:');
        console.log('- Errore:', error);
        console.log('- Sessione esistente:', !!session);
        console.log('- Utente nella sessione:', !!session?.user);
        console.log('- Email utente:', session?.user?.email);
        console.log('- ID utente:', session?.user?.id);
        console.log('- Access token presente:', !!session?.access_token);
        console.log('- Refresh token presente:', !!session?.refresh_token);
        
        if (error) {
            console.log('❌ ERRORE SESSIONE - Dettagli:', error);
            console.log('❌ Reindirizzamento a login.html per errore');
            window.location.replace('login.html?error=session_error');
            return;
        }
        
        if (!session) {
            console.log('❌ NESSUNA SESSIONE TROVATA');
            console.log('❌ Reindirizzamento a login.html per sessione mancante');
            window.location.replace('login.html?error=no_session');
            return;
        }
        
        if (!session.user) {
            console.log('❌ SESSIONE SENZA UTENTE');
            console.log('❌ Reindirizzamento a login.html per utente mancante');
            window.location.replace('login.html?error=no_user');
            return;
        }
        
        console.log('✅ ACCESSO AUTORIZZATO');
        console.log('✅ Utente:', session.user.email);
        console.log('✅ ID utente:', session.user.id);
        console.log('✅ ACCESSO AUTORIZZATO');
        console.log('✅ Utente:', session.user.email);
        console.log('✅ ID utente:', session.user.id);
        
        // Mostra schermata di caricamento
        console.log('📱 Mostrando schermata di caricamento...');
        showLoadingScreen();
        
        // Carica i dati dell'utente
        console.log('📊 Iniziando caricamento dati utente...');
        
        // In caso di errore, esegui debug database
        try {
            await loadUserData(session.user);
        } catch (loadError) {
            console.error('❌ Errore durante caricamento dati utente, eseguendo debug...');
            await debugDatabaseAccess(session.user);
            throw loadError; // Rilancia l'errore dopo il debug
        }
        
        console.log('✅ Dati utente caricati con successo');
        
        // Mostra l'app principale
        console.log('🚀 Mostrando app principale...');
        showMainScreen();
        
        // Setup event listeners
        console.log('🔧 Configurando event listeners...');
        setupEventListeners();
        console.log('✅ Inizializzazione completata con successo');
        console.log('=== FINE INIZIALIZZAZIONE ===');
        
    } catch (error) {
        console.error('💥 ERRORE CRITICO durante inizializzazione app:', error);
        console.error('💥 Stack trace:', error.stack);
        console.error('💥 Messaggio:', error.message);
        console.log('❌ Reindirizzamento a login.html per errore critico');
        window.location.replace('login.html?error=init_error');
    }
}

// Controllo autenticazione in tempo reale
let authListenerSetup = false;
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('=== AUTH STATE CHANGE ===');
    console.log('Evento:', event);
    console.log('Sessione presente:', !!session);
    console.log('Utente presente:', !!session?.user);
    console.log('Email utente:', session?.user?.email);
    
    // Evita loop durante l'inizializzazione
    if (!authListenerSetup) {
        authListenerSetup = true;
        console.log('Auth listener configurato, ignorando primo evento');
        return;
    }
    
    if (event === 'SIGNED_OUT' || !session) {
        // Utente ha fatto logout o sessione scaduta
        console.log('❌ Utente disconnesso o sessione scaduta');
        console.log('❌ Reindirizzamento a login.html');
        window.location.replace('login.html?event=' + event);
    } else if (event === 'SIGNED_IN' && session) {
        console.log('✅ Utente loggato, sessione valida');
    }
    console.log('=== FINE AUTH STATE CHANGE ===');
});

function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', handleTabClick);
    });

    // Admin tab navigation
    document.querySelectorAll('.admin-tab-button').forEach(button => {
        button.addEventListener('click', handleAdminTabClick);
    });

    // Unit selector
    document.getElementById('unit-selector').addEventListener('change', handleUnitChange);

    // Modal buttons
    document.getElementById('add-activity-btn').addEventListener('click', () => showModal('activity-modal'));
    document.getElementById('add-member-btn').addEventListener('click', () => showModal('member-modal'));
    document.getElementById('add-unit-btn').addEventListener('click', () => showModal('unit-modal'));

    // Form submissions
    document.getElementById('activity-form').addEventListener('submit', handleActivitySubmit);
    document.getElementById('member-form').addEventListener('submit', handleMemberSubmit);
    document.getElementById('unit-form').addEventListener('submit', handleUnitSubmit);

    // Close modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal.id);
        });
    });

    // Calendar navigation
    document.getElementById('prev-month').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => navigateMonth(1));

    // Schedule table management
    document.getElementById('add-schedule-row').addEventListener('click', addScheduleRow);
    document.getElementById('add-objective-btn').addEventListener('click', addObjectiveRow);
}

// Funzione di logout globale
async function handleLogout() {
    try {
        console.log('Logout utente...');
        await supabaseClient.auth.signOut();
        window.location.replace('login.html');
    } catch (error) {
        console.error('Errore logout:', error);
        // Forza il reindirizzamento anche in caso di errore
        window.location.replace('login.html');
    }
}

async function loadUserData(user) {
    try {
        console.log('📊 === INIZIO CARICAMENTO DATI UTENTE ===');
        console.log('📧 Email utente da caricare:', user.email);
        console.log('🔑 UID utente:', user.id);
        
        // STEP 1A: Tentativo query per UID (se il campo esiste)
        console.log('🔍 STEP 1A: Tentativo query database utenti tramite UID...');
        let userData = null;
        let error = null;
        
        // Prima prova con l'UID (se il campo auth_id o uid esiste nella tabella)
        try {
            const { data: userDataByUID, error: errorUID } = await supabaseClient
                .from('utenti')
                .select('*')
                .eq('auth_id', user.id)  // Assumendo che ci sia un campo auth_id
                .single();
                
            if (!errorUID && userDataByUID) {
                console.log('✅ TROVATO UTENTE TRAMITE UID:', userDataByUID.email);
                userData = userDataByUID;
            } else {
                console.log('⚠️ Utente non trovato tramite UID (campo auth_id), tentativo con email...');
                console.log('Dettaglio errore UID:', errorUID?.code, errorUID?.message);
            }
        } catch (uidError) {
            console.log('⚠️ Campo auth_id probabilmente non esiste, procedendo con email...');
            console.log('Errore:', uidError.message);
        }
        
        // STEP 1B: Se non trovato tramite UID, prova con email
        if (!userData) {
            console.log('� STEP 1B: Query database utenti tramite EMAIL...');
            const result = await supabaseClient
                .from('utenti')
                .select('*')
                .eq('email', user.email)
                .single();
                
            userData = result.data;
            error = result.error;
            
            if (!error && userData) {
                console.log('✅ TROVATO UTENTE TRAMITE EMAIL:', userData.email);
            } else if (error?.code === '42P17') {
                console.error('🔄 ERRORE LOOP INFINITO RLS - Politiche da correggere!');
                console.error('📝 Eseguire fix-rls-policies.sql in Supabase per risolvere');
                
                // Crea utente temporaneo con i dati della sessione
                console.log('🛠️ Creazione utente temporaneo per bypassare RLS...');
                userData = {
                    id: null, // Non abbiamo l'ID del database
                    email: user.email,
                    nome: user.user_metadata?.nome || user.email.split('@')[0] || 'Nome',
                    cognome: user.user_metadata?.cognome || 'Utente',
                    capo_unita: false,
                    aiuto: false,
                    admin: false,
                    unita_id: null,
                    unita_visibili: []
                };
                error = null; // Reset dell'errore
                console.log('👤 Utente temporaneo creato per bypassare RLS:', userData);
            }
        }

        console.log('�📊 Risultato query utenti:');
        console.log('- Errore:', error);
        console.log('- Dati ricevuti:', !!userData);
        console.log('- Dettaglio errore:', error?.code, error?.message);

        if (error) {
            console.error('❌ ERRORE QUERY DATABASE UTENTI:', error);
            console.error('Codice errore:', error.code);
            console.error('Messaggio:', error.message);
            
            // Se l'utente non esiste nel DB, crea dati temporanei
            if (error.code === 'PGRST116') {
                console.log('⚠️ UTENTE NON TROVATO NEL DB - Creazione dati temporanei');
                currentUser = {
                    id: user.id,
                    email: user.email,
                    nome: user.user_metadata?.nome || user.email.split('@')[0] || 'Nome',
                    cognome: user.user_metadata?.cognome || 'Utente',
                    capo_unita: false,
                    aiuto: false,
                    admin: false,
                    unita_id: null,
                    unita_visibili: []
                };
                
                console.log('👤 Dati temporanei creati:', currentUser);
                document.getElementById('user-name').textContent = `${currentUser.nome} ${currentUser.cognome} (Profilo incompleto)`;
                
                // Nascondi i tab admin
                document.getElementById('admin-tab').style.display = 'none';
                document.getElementById('site-admin-tab').style.display = 'none';
                
                console.log('✅ STEP 1 COMPLETATO con dati temporanei');
                console.log('⚠️ ATTENZIONE: Utente non presente nel database, alcune funzioni potrebbero non funzionare');
                return;
            } else {
                console.error('💥 ERRORE CRITICO nella query utenti');
                throw error;
            }
        }

        if (!userData) {
            console.error('❌ NESSUN DATO UTENTE TROVATO per email:', user.email, 'UID:', user.id);
            throw new Error('Utente non trovato nel database');
        }

        console.log('✅ STEP 1 COMPLETATO - Dati utente caricati:', userData);
        currentUser = userData;
        
        // Aggiorna l'auth_id se non è presente (per future query più veloci)
        if (!userData.auth_id && userData.id) {
            console.log('🔄 Aggiornamento auth_id nel database per future query...');
            try {
                const { error: updateError } = await supabaseClient
                    .from('utenti')
                    .update({ auth_id: user.id })
                    .eq('id', userData.id);
                    
                if (updateError) {
                    console.log('⚠️ Non è stato possibile aggiornare auth_id:', updateError.message);
                } else {
                    console.log('✅ auth_id aggiornato con successo');
                }
            } catch (updateErr) {
                console.log('⚠️ Campo auth_id probabilmente non esiste nella tabella');
            }
        }
        
        document.getElementById('user-name').textContent = `${userData.nome} ${userData.cognome}`;

        // STEP 2: Configurazione permessi UI
        console.log('🔧 STEP 2: Configurazione interfaccia utente...');
        console.log('- Capo unità:', userData.capo_unita);
        console.log('- Aiuto:', userData.aiuto);
        console.log('- Admin:', userData.admin);
        
        // Mostra/nasconde i tab in base ai permessi
        document.getElementById('admin-tab').style.display = 
            (userData.capo_unita || userData.aiuto) ? 'block' : 'none';
        
        document.getElementById('site-admin-tab').style.display = 
            userData.admin ? 'block' : 'none';

        console.log('✅ STEP 2 COMPLETATO - UI configurata');

        // STEP 3: Caricamento unità disponibili
        console.log('🏢 STEP 3: Caricamento unità disponibili...');
        await loadAvailableUnits();
        console.log('✅ STEP 3 COMPLETATO - Unità caricate');
        
        console.log('🎉 === CARICAMENTO DATI UTENTE COMPLETATO ===');

    } catch (error) {
        console.error('💥 === ERRORE CRITICO CARICAMENTO DATI UTENTE ===');
        console.error('💥 Tipo errore:', error.constructor.name);
        console.error('💥 Messaggio:', error.message);
        console.error('💥 Stack trace:', error.stack);
        console.error('💥 Errore completo:', error);
        throw error;
    }
}

async function loadAvailableUnits() {
    try {
        console.log('🏢 === INIZIO CARICAMENTO UNITÀ ===');
        console.log('👤 Utente corrente:', currentUser?.email);
        console.log('🔑 Admin:', currentUser?.admin);
        console.log('👁️ Unità visibili:', currentUser?.unita_visibili);
        
        // STEP 1: Costruzione query
        console.log('🔍 STEP 1: Costruzione query per le unità...');
        let query = supabaseClient.from('unita').select('*');
        
        // Se l'utente non è admin, filtra per unità visibili
        if (!currentUser?.admin && currentUser?.unita_visibili && Array.isArray(currentUser.unita_visibili) && currentUser.unita_visibili.length > 0) {
            console.log('🔒 Applicando filtro per unità visibili:', currentUser.unita_visibili);
            query = query.in('id', currentUser.unita_visibili);
        } else if (!currentUser?.admin && (!currentUser?.unita_visibili || currentUser.unita_visibili.length === 0)) {
            console.log('⚠️ Utente non admin senza unità visibili - Nessuna unità sarà caricata');
            // Per utenti temporanei o senza unità, restituisce array vuoto
            const units = [];
            console.log('📋 Nessuna unità disponibile per questo utente');
            
            const unitSelector = document.getElementById('unit-selector');
            if (!unitSelector) {
                console.error('❌ ELEMENTO unit-selector NON TROVATO nel DOM!');
                throw new Error('Elemento unit-selector non trovato');
            }
            
            unitSelector.innerHTML = '<option value="">Nessuna unità disponibile</option>';
            console.log('⚠️ === CARICAMENTO UNITÀ COMPLETATO (NESSUNA UNITÀ) ===');
            return;
        } else {
            console.log('🌍 Utente admin o con accesso globale - Caricando tutte le unità');
        }
        
        console.log('📊 STEP 2: Esecuzione query unità...');
        const { data: units, error } = await query.order('nome');

        console.log('📊 Risultato query unità:');
        console.log('- Errore:', error);
        console.log('- Unità trovate:', units?.length || 0);
        console.log('- Dettaglio errore:', error?.code, error?.message);

        if (error) {
            console.error('❌ ERRORE QUERY UNITÀ:', error);
            throw error;
        }

        console.log('✅ STEP 2 COMPLETATO - Query unità eseguita');
        console.log('📋 Unità caricate:', units?.map(u => u.nome) || []);

        // STEP 3: Popolazione selector
        console.log('🎛️ STEP 3: Aggiornamento selector unità...');
        const unitSelector = document.getElementById('unit-selector');
        
        if (!unitSelector) {
            console.error('❌ ELEMENTO unit-selector NON TROVATO nel DOM!');
            throw new Error('Elemento unit-selector non trovato');
        }
        
        unitSelector.innerHTML = '<option value="">Seleziona Unità</option>';

        units.forEach((unit, index) => {
            console.log(`➕ Aggiungendo unità ${index + 1}: ${unit.nome} (ID: ${unit.id})`);
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = unit.nome;
            unitSelector.appendChild(option);
        });

        console.log('✅ STEP 3 COMPLETATO - Selector popolato');

        // STEP 4: Selezione automatica prima unità
        if (units.length > 0) {
            console.log('🎯 STEP 4: Selezione automatica prima unità:', units[0].nome);
            unitSelector.value = units[0].id;
            await handleUnitChange();
            console.log('✅ STEP 4 COMPLETATO - Unità selezionata');
        } else {
            console.log('⚠️ STEP 4: Nessuna unità disponibile per l\'utente');
        }
        
        // STEP 5: Setup admin se necessario
        if (currentUser?.admin) {
            console.log('👑 STEP 5: Setup generatore URL per admin...');
            await loadRegistrationURLGenerator();
            console.log('✅ STEP 5 COMPLETATO - Admin setup completato');
        } else {
            console.log('ℹ️ STEP 5: Utente non admin, skip setup admin');
        }
        
        console.log('🎉 === CARICAMENTO UNITÀ COMPLETATO ===');
        
    } catch (error) {
        console.error('💥 === ERRORE CRITICO CARICAMENTO UNITÀ ===');
        console.error('💥 Tipo errore:', error.constructor.name);
        console.error('💥 Messaggio:', error.message);
        console.error('💥 Stack trace:', error.stack);
        console.error('💥 Errore completo:', error);
        throw error;
    }
}

// Funzione per generare URL di registrazione (solo per admin)
async function loadRegistrationURLGenerator() {
    try {
        const { data: units, error } = await supabaseClient
            .from('unita')
            .select('id, nome')
            .order('nome');

        if (error) throw error;

        // Aggiungi l'interfaccia per generare URL di registrazione nel pannello amministrazione
        const adminContainer = document.getElementById('impostazioni');
        const registrationSection = document.createElement('div');
        registrationSection.className = 'admin-section';
        registrationSection.innerHTML = `
            <h4>Genera URL di Registrazione</h4>
            <div class="form-group">
                <label for="url-unit-selector">Seleziona Unità:</label>
                <select id="url-unit-selector" class="form-control">
                    <option value="">URL generico (tutte le unità)</option>
                </select>
            </div>
            <button type="button" id="generate-url-btn" class="btn-primary">Genera URL</button>
            <div id="generated-url" style="margin-top: 15px; display: none;">
                <label>URL di Registrazione:</label>
                <input type="text" id="registration-url-input" readonly style="width: 100%; margin-top: 5px;">
                <button type="button" id="copy-url-btn" class="btn-secondary" style="margin-top: 5px;">Copia URL</button>
            </div>
        `;
        
        adminContainer.appendChild(registrationSection);
        
        // Popola il selector delle unità
        const urlUnitSelector = document.getElementById('url-unit-selector');
        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = unit.nome;
            urlUnitSelector.appendChild(option);
        });
        
        // Event listener per generare URL
        document.getElementById('generate-url-btn').addEventListener('click', () => {
            const selectedUnit = document.getElementById('url-unit-selector').value;
            const registrationURL = generateRegistrationURL(selectedUnit || null);
            
            document.getElementById('registration-url-input').value = registrationURL;
            document.getElementById('generated-url').style.display = 'block';
        });
        
        // Event listener per copiare URL
        document.getElementById('copy-url-btn').addEventListener('click', () => {
            const urlInput = document.getElementById('registration-url-input');
            urlInput.select();
            urlInput.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(urlInput.value);
            alert('URL copiato negli appunti!');
        });
        
    } catch (error) {
        console.error('Errore caricamento generatore URL:', error);
    }
}

// Genera URL di registrazione personalizzato
function generateRegistrationURL(unitId = null, baseURL = window.location.origin + window.location.pathname.replace('app.html', '')) {
    const token = btoa(JSON.stringify({ unitId: unitId }));
    return `${baseURL}register.html?register=${token}`;
}

// Gestione schermata
function showLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('main-screen').style.display = 'none';
}

function showMainScreen() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
    
    // Carica i dati della prima tab attiva
    loadActivities();
}

// Gestione tab
function handleTabClick(e) {
    const tabName = e.target.dataset.tab;

    if (tabName === 'logout') {
        handleLogout();
        return;
    }

    // Rimuovi classe active da tutti i tab
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Attiva il tab selezionato
    e.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');

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
    }
}

function handleAdminTabClick(e) {
    const tabName = e.target.dataset.adminTab;

    // Rimuovi classe active da tutti i tab admin
    document.querySelectorAll('.admin-tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));

    // Attiva il tab selezionato
    e.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

async function handleUnitChange() {
    try {
        console.log('🔄 === INIZIO CAMBIO UNITÀ ===');
        const unitId = document.getElementById('unit-selector').value;
        console.log('🏢 ID unità selezionata:', unitId);
        
        if (!unitId) {
            console.log('❌ Nessuna unità selezionata');
            currentUnit = null;
            return;
        }

        console.log('📊 Query per dati unità...');
        const { data: unit, error } = await supabaseClient
            .from('unita')
            .select('*')
            .eq('id', unitId)
            .single();

        console.log('📊 Risultato query unità:');
        console.log('- Errore:', error);
        console.log('- Unità trovata:', !!unit);
        console.log('- Nome unità:', unit?.nome);

        if (error) {
            console.error('❌ ERRORE QUERY UNITÀ SINGOLA:', error);
            throw error;
        }

        currentUnit = unit;
        console.log('✅ Unità corrente impostata:', unit.nome);
        
        // Ricarica i dati del tab attivo
        console.log('🔄 Ricaricamento dati tab attivo...');
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab) {
            const tabId = activeTab.id;
            console.log('📑 Tab attivo:', tabId);
            switch (tabId) {
                case 'attivita':
                    console.log('🎯 Ricaricando attività...');
                    loadActivities();
                    break;
                case 'membri':
                    console.log('👥 Ricaricando membri...');
                    loadMembers();
                    break;
                default:
                    console.log('ℹ️ Tab non richiede ricaricamento dati');
            }
        }
        
        console.log('🎉 === CAMBIO UNITÀ COMPLETATO ===');
        
    } catch (error) {
        console.error('💥 === ERRORE CAMBIO UNITÀ ===');
        console.error('💥 Tipo errore:', error.constructor.name);
        console.error('💥 Messaggio:', error.message);
        console.error('💥 Stack trace:', error.stack);
        throw error;
    }
}

// Gestione Attività
async function loadActivities() {
    try {
        console.log('🎯 === INIZIO CARICAMENTO ATTIVITÀ ===');
        console.log('🏢 Unità corrente:', currentUnit?.nome || 'Nessuna');
        
        if (!currentUnit) {
            console.log('⚠️ Nessuna unità selezionata - Skip caricamento attività');
            return;
        }

        const container = document.getElementById('activities-list');
        if (!container) {
            console.error('❌ ELEMENTO activities-list NON TROVATO!');
            throw new Error('Elemento activities-list non trovato nel DOM');
        }
        
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        console.log('⏳ Mostrando indicatore di caricamento');

        console.log('📊 Esecuzione query attività per unità ID:', currentUnit.id);
        const { data: activities, error } = await supabaseClient
            .from('attivita')
            .select('*')
            .eq('unita_id', currentUnit.id)
            .order('data', { ascending: false });

        console.log('📊 Risultato query attività:');
        console.log('- Errore:', error);
        console.log('- Attività trovate:', activities?.length || 0);
        console.log('- Dettaglio errore:', error?.code, error?.message);

        if (error) {
            console.error('❌ ERRORE QUERY ATTIVITÀ:', error);
            throw error;
        }

        container.innerHTML = '';

        if (activities.length === 0) {
            console.log('ℹ️ Nessuna attività trovata per questa unità');
            container.innerHTML = '<p>Nessuna attività trovata per questa unità.</p>';
            return;
        }

        console.log('🎨 Creazione card attività...');
        activities.forEach((activity, index) => {
            console.log(`➕ Creando card ${index + 1}: ${activity.titolo}`);
            const card = createActivityCard(activity);
            container.appendChild(card);
        });
        
        console.log('✅ === CARICAMENTO ATTIVITÀ COMPLETATO ===');
        
    } catch (error) {
        console.error('💥 === ERRORE CARICAMENTO ATTIVITÀ ===');
        console.error('💥 Tipo errore:', error.constructor.name);
        console.error('💥 Messaggio:', error.message);
        console.error('💥 Stack trace:', error.stack);
        
        const container = document.getElementById('activities-list');
        if (container) {
            container.innerHTML = '<p>Errore nel caricamento delle attività.</p>';
        }
        
        throw error;
    }
}

function createActivityCard(activity) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    
    const date = new Date(activity.data).toLocaleDateString('it-IT');
    
    card.innerHTML = `
        <h3>${activity.titolo}</h3>
        <p><strong>Data:</strong> <span class="activity-date">${date}</span></p>
        <p><strong>Obiettivi:</strong> ${activity.obiettivi || 'Non specificati'}</p>
        <p><strong>Raggiunti:</strong> ${activity.raggiunti || 'Non specificati'}</p>
        <div class="activity-actions">
            <button class="btn-view" onclick="viewActivity(${activity.id})">Visualizza</button>
            <button class="btn-edit" onclick="editActivity(${activity.id})">Modifica</button>
            <button class="btn-danger" onclick="deleteActivity(${activity.id})">Elimina</button>
        </div>
    `;
    
    return card;
}

async function handleActivitySubmit(e) {
    e.preventDefault();
    
    if (!currentUnit) {
        alert('Seleziona un\'unità prima di procedere');
        return;
    }

    const formData = new FormData(e.target);
    const activityData = {
        titolo: formData.get('titolo'),
        obiettivi: formData.get('obiettivi'),
        data: formData.get('data'),
        raggiunti: formData.get('raggiunti'),
        unita_id: currentUnit.id,
        tabella_oraria: JSON.stringify(getScheduleData())
    };

    try {
        const { data, error } = await supabaseClient
            .from('attivita')
            .insert([activityData]);

        if (error) throw error;

        closeModal('activity-modal');
        loadActivities();
        alert('Attività salvata con successo!');
    } catch (error) {
        console.error('Errore salvataggio attività:', error);
        alert('Errore nel salvataggio dell\'attività');
    }
}

function getScheduleData() {
    const scheduleRows = document.querySelectorAll('.schedule-row');
    const scheduleData = [];

    scheduleRows.forEach(row => {
        const inputs = row.querySelectorAll('input, select');
        if (inputs.length >= 4) {
            scheduleData.push({
                ora: inputs[0].value,
                titolo: inputs[1].value,
                descrizione: inputs[2].value,
                gestore: inputs[3].value
            });
        }
    });

    return scheduleData;
}

function addScheduleRow() {
    const container = document.getElementById('schedule-rows');
    const row = document.createElement('div');
    row.className = 'schedule-row';
    
    row.innerHTML = `
        <input type="time" placeholder="Ora">
        <input type="text" placeholder="Titolo">
        <input type="text" placeholder="Descrizione">
        <input type="text" placeholder="Gestore">
        <button type="button" class="btn-danger" onclick="this.parentElement.remove()">Rimuovi</button>
    `;
    
    container.appendChild(row);
}

// Gestione Membri
async function loadMembers() {
    if (!currentUnit) return;

    const container = document.getElementById('members-list');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const { data: members, error } = await supabaseClient
            .from('membri')
            .select('*')
            .eq('unita_id', currentUnit.id)
            .order('cognome', { ascending: true });

        if (error) throw error;

        container.innerHTML = '';

        if (members.length === 0) {
            container.innerHTML = '<p>Nessun membro trovato per questa unità.</p>';
            return;
        }

        members.forEach(member => {
            const card = createMemberCard(member);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Errore caricamento membri:', error);
        container.innerHTML = '<p>Errore nel caricamento dei membri.</p>';
    }
}

function createMemberCard(member) {
    const card = document.createElement('div');
    card.className = 'member-card';
    
    const objectives = member.obiettivi ? JSON.parse(member.obiettivi) : [];
    const objectivesList = objectives.map(obj => `<li>${obj.titolo} (${obj.data})</li>`).join('');
    
    card.innerHTML = `
        <h3>${member.nome} ${member.cognome}</h3>
        <p><strong>Ruolo:</strong> ${member.ruolo}</p>
        <p><strong>Anno:</strong> ${member.anno}</p>
        <div>
            <strong>Obiettivi Raggiunti:</strong>
            <ul>${objectivesList || '<li>Nessun obiettivo registrato</li>'}</ul>
        </div>
        <div class="activity-actions">
            <button class="btn-edit" onclick="editMember(${member.id})">Modifica</button>
            <button class="btn-danger" onclick="deleteMember(${member.id})">Elimina</button>
        </div>
    `;
    
    return card;
}

async function handleMemberSubmit(e) {
    e.preventDefault();
    
    if (!currentUnit) {
        alert('Seleziona un\'unità prima di procedere');
        return;
    }

    const formData = new FormData(e.target);
    const memberData = {
        nome: formData.get('nome'),
        cognome: formData.get('cognome'),
        anno: parseInt(formData.get('anno')),
        ruolo: formData.get('ruolo'),
        unita_id: currentUnit.id,
        obiettivi: JSON.stringify(getObjectivesData())
    };

    try {
        const { data, error } = await supabaseClient
            .from('membri')
            .insert([memberData]);

        if (error) throw error;

        closeModal('member-modal');
        loadMembers();
        alert('Membro salvato con successo!');
    } catch (error) {
        console.error('Errore salvataggio membro:', error);
        alert('Errore nel salvataggio del membro');
    }
}

function getObjectivesData() {
    const objectiveRows = document.querySelectorAll('.objective-row');
    const objectives = [];

    objectiveRows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        if (inputs.length >= 2 && inputs[0].value && inputs[1].value) {
            objectives.push({
                data: inputs[0].value,
                titolo: inputs[1].value
            });
        }
    });

    return objectives;
}

function addObjectiveRow() {
    const container = document.getElementById('objectives-list');
    const row = document.createElement('div');
    row.className = 'objective-row';
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.style.marginBottom = '10px';
    
    row.innerHTML = `
        <input type="date" placeholder="Data" style="flex: 1;">
        <input type="text" placeholder="Titolo Obiettivo" style="flex: 2;">
        <button type="button" class="btn-danger" onclick="this.parentElement.remove()">Rimuovi</button>
    `;
    
    container.appendChild(row);
}

// Gestione Calendario
async function loadCalendar() {
    if (!currentUnit) return;

    await generateCalendar();
    await loadCalendarActivities();
}

async function generateCalendar() {
    const container = document.getElementById('calendar-container');
    
    // Aggiorna il titolo del mese
    document.getElementById('current-month').textContent = 
        currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    // Genera header del calendario
    const calendarHTML = `
        <div class="calendar-header">
            <div class="calendar-header-day">Lun</div>
            <div class="calendar-header-day">Mar</div>
            <div class="calendar-header-day">Mer</div>
            <div class="calendar-header-day">Gio</div>
            <div class="calendar-header-day">Ven</div>
            <div class="calendar-header-day">Sab</div>
            <div class="calendar-header-day">Dom</div>
        </div>
        <div class="calendar-grid" id="calendar-grid">
            <!-- I giorni saranno generati qui -->
        </div>
    `;
    
    container.innerHTML = calendarHTML;

    // Genera i giorni del calendario
    const grid = document.getElementById('calendar-grid');
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const today = new Date();

    // Calcola il primo giorno della settimana (lunedì = 1)
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    // Aggiungi giorni del mese precedente
    for (let i = startDay - 1; i >= 0; i--) {
        const prevDate = new Date(firstDay);
        prevDate.setDate(firstDay.getDate() - i - 1);
        const dayElement = createCalendarDay(prevDate, true);
        grid.appendChild(dayElement);
    }

    // Aggiungi giorni del mese corrente
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const isToday = date.toDateString() === today.toDateString();
        const dayElement = createCalendarDay(date, false, isToday);
        grid.appendChild(dayElement);
    }

    // Aggiungi giorni del mese successivo per completare la griglia
    const totalCells = grid.children.length;
    const cellsNeeded = 42 - totalCells; // 6 righe × 7 giorni
    for (let day = 1; day <= cellsNeeded; day++) {
        const nextDate = new Date(lastDay);
        nextDate.setDate(lastDay.getDate() + day);
        const dayElement = createCalendarDay(nextDate, true);
        grid.appendChild(dayElement);
    }
}

function createCalendarDay(date, otherMonth = false, isToday = false) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    if (otherMonth) {
        dayElement.classList.add('other-month');
    }
    
    if (isToday) {
        dayElement.classList.add('today');
    }

    dayElement.innerHTML = `
        <div class="day-number">${date.getDate()}</div>
        <div class="day-activities" data-date="${date.toISOString().split('T')[0]}">
            <!-- Le attività saranno caricate qui -->
        </div>
    `;

    return dayElement;
}

async function loadCalendarActivities() {
    if (!currentUnit) return;

    try {
        // Carica le attività del mese corrente
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const { data: activities, error } = await supabaseClient
            .from('attivita')
            .select('*')
            .eq('unita_id', currentUnit.id)
            .gte('data', startOfMonth.toISOString().split('T')[0])
            .lte('data', endOfMonth.toISOString().split('T')[0]);

        if (error) throw error;

        // Aggiungi le attività ai giorni corrispondenti
        activities.forEach(activity => {
            const activityDate = activity.data;
            const dayContainer = document.querySelector(`[data-date="${activityDate}"]`);
            
            if (dayContainer) {
                const activityElement = document.createElement('div');
                activityElement.className = 'calendar-activity';
                activityElement.textContent = activity.titolo;
                activityElement.title = activity.obiettivi || activity.titolo;
                dayContainer.appendChild(activityElement);
            }
        });
    } catch (error) {
        console.error('Errore caricamento attività calendario:', error);
    }
}

function navigateMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    loadCalendar();
}

// Gestione Admin
async function loadAdminData() {
    // Carica dati amministrazione se necessario
    console.log('Caricamento dati amministrazione');
}

async function loadSiteAdmin() {
    if (!currentUser.admin) return;
    
    // Carica tutte le unità per la gestione sito
    await loadAllUnits();
    await loadAllUsers();
}

async function loadAllUnits() {
    try {
        const { data: units, error } = await supabaseClient
            .from('unita')
            .select('*, capo_unita!inner(nome, cognome)')
            .order('nome');

        if (error) throw error;

        const container = document.getElementById('units-list');
        container.innerHTML = '';

        units.forEach(unit => {
            const unitCard = document.createElement('div');
            unitCard.className = 'admin-section';
            unitCard.innerHTML = `
                <h4>${unit.nome}</h4>
                <p><strong>Capo Unità:</strong> ${unit.capo_unita?.nome} ${unit.capo_unita?.cognome}</p>
                <p><strong>Membri:</strong> ${unit.nr_membri}</p>
                <div class="activity-actions">
                    <button class="btn-edit" onclick="editUnit(${unit.id})">Modifica</button>
                    <button class="btn-danger" onclick="deleteUnit(${unit.id})">Elimina</button>
                </div>
            `;
            container.appendChild(unitCard);
        });
    } catch (error) {
        console.error('Errore caricamento unità:', error);
    }
}

async function loadAllUsers() {
    try {
        const { data: users, error } = await supabaseClient
            .from('utenti')
            .select('*')
            .order('cognome');

        if (error) throw error;

        const container = document.getElementById('all-users-list');
        container.innerHTML = '';

        users.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'member-card';
            userCard.innerHTML = `
                <h4>${user.nome} ${user.cognome}</h4>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Admin:</strong> ${user.admin ? 'Sì' : 'No'}</p>
                <p><strong>Capo Unità:</strong> ${user.capo_unita ? 'Sì' : 'No'}</p>
                <p><strong>Aiuto:</strong> ${user.aiuto ? 'Sì' : 'No'}</p>
                <div class="activity-actions">
                    <button class="btn-edit" onclick="editUser(${user.id})">Modifica</button>
                </div>
            `;
            container.appendChild(userCard);
        });
    } catch (error) {
        console.error('Errore caricamento utenti:', error);
    }
}

// Gestione Unit
async function handleUnitSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const unitData = {
        nome: formData.get('nome'),
        capo_unita: formData.get('capo_unita') || null,
        nr_membri: parseInt(formData.get('nr_membri')) || 0,
        aiuti: [] // Per ora array vuoto, da implementare la selezione multipla
    };

    try {
        const { data, error } = await supabaseClient
            .from('unita')
            .insert([unitData]);

        if (error) throw error;

        closeModal('unit-modal');
        loadAllUnits();
        alert('Unità salvata con successo!');
    } catch (error) {
        console.error('Errore salvataggio unità:', error);
        alert('Errore nel salvataggio dell\'unità');
    }
}

// Gestione Modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'block';
    
    // Reset form se presente
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
        
        // Reset campi dinamici
        if (modalId === 'activity-modal') {
            document.getElementById('schedule-rows').innerHTML = '';
            addScheduleRow(); // Aggiungi una riga iniziale
        }
        
        if (modalId === 'member-modal') {
            document.getElementById('objectives-list').innerHTML = '';
        }
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Funzioni di utility per CRUD operations (da implementare)
async function viewActivity(id) {
    // Implementa visualizzazione attività
    console.log('Visualizza attività:', id);
}

async function editActivity(id) {
    // Implementa modifica attività
    console.log('Modifica attività:', id);
}

async function deleteActivity(id) {
    if (confirm('Sei sicuro di voler eliminare questa attività?')) {
        try {
            const { error } = await supabaseClient
                .from('attivita')
                .delete()
                .eq('id', id);

            if (error) throw error;

            loadActivities();
            alert('Attività eliminata con successo!');
        } catch (error) {
            console.error('Errore eliminazione attività:', error);
            alert('Errore nell\'eliminazione dell\'attività');
        }
    }
}

async function editMember(id) {
    // Implementa modifica membro
    console.log('Modifica membro:', id);
}

async function deleteMember(id) {
    if (confirm('Sei sicuro di voler eliminare questo membro?')) {
        try {
            const { error } = await supabaseClient
                .from('membri')
                .delete()
                .eq('id', id);

            if (error) throw error;

            loadMembers();
            alert('Membro eliminato con successo!');
        } catch (error) {
            console.error('Errore eliminazione membro:', error);
            alert('Errore nell\'eliminazione del membro');
        }
    }
}

async function editUnit(id) {
    // Implementa modifica unità
    console.log('Modifica unità:', id);
}

async function deleteUnit(id) {
    if (confirm('Sei sicuro di voler eliminare questa unità? Questa azione eliminerà anche tutti i dati associati.')) {
        try {
            const { error } = await supabaseClient
                .from('unita')
                .delete()
                .eq('id', id);

            if (error) throw error;

            loadAllUnits();
            alert('Unità eliminata con successo!');
        } catch (error) {
            console.error('Errore eliminazione unità:', error);
            alert('Errore nell\'eliminazione dell\'unità');
        }
    }
}

async function editUser(id) {
    // Implementa modifica utente
    console.log('Modifica utente:', id);
}

// Utility Functions per gestione registrazione
function createInvitationLink(unitId = null) {
    const baseURL = window.location.origin + window.location.pathname.replace('app.html', '');
    return generateRegistrationURL(unitId, baseURL);
}

// Funzione di debug per testare l'accesso al database
async function debugDatabaseAccess(user) {
    console.log('🔍 === DEBUG ACCESSO DATABASE ===');
    
    try {
        // Test 1: Connessione base
        console.log('Test 1: Connessione base al database...');
        const { data: testConnection, error: connError } = await supabaseClient
            .from('utenti')
            .select('count', { count: 'exact', head: true });
            
        if (connError) {
            console.error('❌ Test connessione fallito:', connError);
        } else {
            console.log('✅ Connessione al database OK');
        }
        
        // Test 2: Struttura tabella utenti
        console.log('Test 2: Verifica struttura tabella utenti...');
        const { data: sampleUser, error: structError } = await supabaseClient
            .from('utenti')
            .select('*')
            .limit(1);
            
        if (!structError && sampleUser && sampleUser.length > 0) {
            console.log('✅ Struttura tabella utenti:', Object.keys(sampleUser[0]));
        } else {
            console.log('⚠️ Non è stato possibile ottenere la struttura della tabella:', structError?.message);
        }
        
        // Test 3: Ricerca per email
        console.log('Test 3: Ricerca utente per email:', user.email);
        const { data: userByEmail, error: emailError } = await supabaseClient
            .from('utenti')
            .select('*')
            .eq('email', user.email);
            
        console.log('Risultato ricerca email:', {
            trovati: userByEmail?.length || 0,
            errore: emailError?.message
        });
        
        // Test 4: Verifica se esiste campo auth_id
        console.log('Test 4: Verifica campo auth_id...');
        try {
            const { data: userByAuth, error: authError } = await supabaseClient
                .from('utenti')
                .select('auth_id')
                .limit(1);
                
            if (!authError) {
                console.log('✅ Campo auth_id esiste nella tabella');
            }
        } catch (authErr) {
            console.log('⚠️ Campo auth_id non esiste nella tabella');
        }
        
        // Test 5: Lista tutti gli utenti (solo primi 3 per debug)
        console.log('Test 5: Lista primi utenti nel database...');
        const { data: allUsers, error: listError } = await supabaseClient
            .from('utenti')
            .select('email, nome, cognome, admin')
            .limit(3);
            
        if (!listError && allUsers) {
            console.log('✅ Utenti nel database:', allUsers);
        } else {
            console.log('⚠️ Errore lista utenti:', listError?.message);
        }
        
    } catch (debugError) {
        console.error('💥 Errore durante debug database:', debugError);
    }
    
    console.log('=== FINE DEBUG DATABASE ===');
}

// Funzione per admin per inviare inviti via email (estendibile)
async function sendInvitationEmail(email, unitId, unitName) {
    const invitationURL = createInvitationLink(unitId);
    
    // Qui si potrebbe integrare un servizio di email
    // Per ora, mostra un alert con l'URL
    alert(`Invita ${email} all'unità ${unitName}\nURL di registrazione: ${invitationURL}`);
    
    return invitationURL;
}
