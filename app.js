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
        
        let query = supabaseClient.from('unita').select('*');
        
        // ADMIN: può vedere tutte le unità
        if (currentUser?.admin === true) {
            console.log('👑 Utente ADMIN - carica tutte le unità');
            // Query senza filtri per admin
        }
        // TUTTI GLI ALTRI UTENTI: usa campo unita_associate
        else if (currentUser?.unita_associate && Array.isArray(currentUser.unita_associate) && currentUser.unita_associate.length > 0) {
            console.log('🔍 Filtro unità tramite unita_associate:', currentUser.unita_associate);
            query = query.in('id', currentUser.unita_associate);
        }
        // UTENTE SENZA UNITÀ ASSOCIATE
        else {
            console.log('⚠️ Utente senza unità associate (array vuoto o null)');
            const unitSelector = document.getElementById('unit-selector');
            if (unitSelector) {
                unitSelector.innerHTML = '<option value="">Nessuna unità disponibili</option>';
            }
            return;
        }
        
        console.log('📊 Esecuzione query unità...');
        const { data: units, error } = await query.order('nome');

        if (error) {
            console.error('❌ Errore query unità:', error);
            throw error;
        }

        console.log('✅ Unità trovate:', units?.length || 0);
        if (units?.length > 0) {
            units.forEach(unit => console.log('  - ID:', unit.id, 'Nome:', unit.nome));
        }

        const unitSelector = document.getElementById('unit-selector');
        if (!unitSelector) {
            console.error('❌ Elemento unit-selector non trovato nel DOM!');
            return;
        }
        
        console.log('🎨 Popolamento dropdown unità...');
        unitSelector.innerHTML = '<option value="">Seleziona Unità</option>';

        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = unit.nome;
            unitSelector.appendChild(option);
            console.log('➕ Aggiunta unità al dropdown:', unit.nome);
        });

        // Selezione automatica prima unità se disponibile
        if (units.length > 0) {
            console.log('🎯 Selezione automatica prima unità:', units[0].nome);
            unitSelector.value = units[0].id;
            await handleUnitChange();
        } else {
            console.log('⚠️ Nessuna unità disponibile per la selezione automatica');
        }
        
        console.log('✅ Caricamento unità completato');
        
    } catch (error) {
        console.error('💥 Errore caricamento unità:', error);
        throw error;
    }
}

// Le altre funzioni continuano come prima...
// (Aggiungi qui le altre funzioni dall'app.js originale funzionante)
