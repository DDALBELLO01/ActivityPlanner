// Auth.js - Gestione autenticazione per login.html
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabile per evitare loop di reindirizzamenti (rimossa)

// Inizializzazione del login
document.addEventListener('DOMContentLoaded', function() {
    checkExistingAuth();
    setupLoginListeners();
    handleRegistrationParameters();
    handleURLMessages();
});

// Controlla se l'utente è già autenticato
async function checkExistingAuth() {
    try {
        // Controlla se c'è un parametro per forzare l'accesso alla pagina di login
        const urlParams = new URLSearchParams(window.location.search);
        const forceLogin = urlParams.get('force');
        
        if (forceLogin === 'true') {
            console.log('🔒 Accesso forzato alla pagina di login');
            return;
        }
        
        console.log('=== CONTROLLO AUTH IN LOGIN.HTML ===');
        console.log('🔍 Controllo autenticazione...');
        console.log('URL attuale:', window.location.href);
        
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        console.log('Risultato getSession:');
        console.log('- Errore:', error);
        console.log('- Sessione esistente:', !!session);
        console.log('- Utente nella sessione:', !!session?.user);
        console.log('- Email utente:', session?.user?.email);
        console.log('- ID utente:', session?.user?.id);
        
        if (error) {
            console.log('❌ Errore sessione, resto in login:', error.message);
            return;
        }
        
        if (session && session.user) {
            console.log('✅ Sessione valida trovata');
            console.log('🚀 Reindirizzamento a app.html');
            window.location.replace('app.html');
            return;
        } else {
            console.log('ℹ️ Nessuna sessione valida, resto in login');
        }
        console.log('=== FINE CONTROLLO AUTH ===');
    } catch (error) {
        console.error('💥 Errore controllo autenticazione:', error);
        // In caso di errore, resta sulla pagina di login
    }
}

// Gestisce i parametri URL per registrazione
function handleRegistrationParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const registrationToken = urlParams.get('register');
    
    if (registrationToken) {
        // Reindirizza alla pagina di registrazione con il token
        window.location.href = `register.html?register=${registrationToken}`;
        return;
    }
}

// Setup event listeners
function setupLoginListeners() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

// Gestisce il login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');

    // Reset errori precedenti
    errorElement.textContent = '';
    errorElement.classList.remove('show', 'info-message');
    errorElement.classList.add('error-message');

    try {
        console.log('=== PROCESSO DI LOGIN ===');
        console.log('🔐 Tentativo di login per:', email);
        console.log('URL corrente:', window.location.href);
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.log('❌ Errore durante login:', error);
            throw error;
        }

        console.log('✅ Login riuscito!');
        console.log('Dati ricevuti:', data);
        console.log('Sessione:', !!data?.session);
        console.log('Utente:', !!data?.user);
        console.log('Email utente:', data?.user?.email);
        console.log('Access token presente:', !!data?.session?.access_token);
        
        // Breve attesa per assicurarsi che la sessione sia salvata
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log('🚀 Reindirizzamento a app.html');
        console.log('=== FINE PROCESSO LOGIN ===');
        
        // Login riuscito, reindirizza alla app principale
        window.location.replace('app.html');

    } catch (error) {
        console.error('💥 Errore login:', error);
        console.error('Messaggio completo:', error.message);
        console.error('Codice errore:', error.status);
        errorElement.textContent = 'Errore di autenticazione: ' + error.message;
        errorElement.classList.add('show');
    }
}

// Utility per gestire logout da altre pagine
window.handleLogout = async function() {
    try {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Errore logout:', error);
        window.location.href = 'login.html';
    }
};

// Gestisce i messaggi dall'URL (ad esempio quando si arriva dalla registrazione)
function handleURLMessages() {
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');
    const error = urlParams.get('error');
    const event = urlParams.get('event');
    
    const errorElement = document.getElementById('login-error');
    if (!errorElement) return;
    
    if (message === 'confirm-email') {
        errorElement.textContent = 'Registrazione completata! Controlla la tua email per confermare l\'account, poi effettua il login.';
        errorElement.classList.remove('error-message');
        errorElement.classList.add('info-message');
        errorElement.classList.add('show');
    } else if (message === 'registration-success') {
        errorElement.textContent = '✅ Registrazione completata con successo! Controlla la tua email per verificare l\'account, poi effettua il login.';
        errorElement.classList.remove('error-message');
        errorElement.classList.add('success-message');
        errorElement.classList.add('show');
    } else if (error) {
        let errorMessage = 'Si è verificato un errore. ';
        switch (error) {
            case 'session_error':
                errorMessage += 'Problema con la sessione di autenticazione.';
                break;
            case 'no_session':
                errorMessage += 'Sessione non trovata, effettua il login.';
                break;
            case 'no_user':
                errorMessage += 'Dati utente non validi.';
                break;
            case 'init_error':
                errorMessage += 'Errore durante l\'inizializzazione dell\'app.';
                break;
            default:
                errorMessage += 'Codice errore: ' + error;
        }
        if (event) {
            errorMessage += ' (Evento: ' + event + ')';
        }
        
        errorElement.textContent = errorMessage;
        errorElement.classList.remove('info-message');
        errorElement.classList.add('error-message');
        errorElement.classList.add('show');
    }
    
    // Rimuove i parametri dall'URL senza ricaricare la pagina
    if (message || error || event) {
        const newURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.pushState({path: newURL}, '', newURL);
    }
}
