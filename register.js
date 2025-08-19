// Register.js - Gestione registrazione per register.html
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Inizializzazione della registrazione
document.addEventListener('DOMContentLoaded', function() {
    checkExistingAuth();
    setupRegistrationListeners();
    handleRegistrationFromURL();
    loadUnitsForRegistration();
});

// Controllo rimosso - permettiamo l'accesso alla pagina di registrazione
// anche se l'utente è già autenticato (per permettere registrazioni multiple)
async function checkExistingAuth() {
    // Controllo rimosso intenzionalmente
    console.log('Accesso alla pagina di registrazione consentito');
}

// Setup event listeners
function setupRegistrationListeners() {
    document.getElementById('registration-form').addEventListener('submit', handleRegistration);
}

// Gestisce URL di registrazione con token
async function handleRegistrationFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const registrationToken = urlParams.get('register');
    
    if (registrationToken) {
        try {
            // Decodifica il token di registrazione
            const registrationData = JSON.parse(atob(registrationToken));
            
            if (registrationData.unitId) {
                // Attende il caricamento delle unità e poi pre-seleziona
                setTimeout(() => {
                    const unitSelector = document.getElementById('reg-unit');
                    if (unitSelector) {
                        unitSelector.value = registrationData.unitId;
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Token di registrazione non valido:', error);
        }
    }
}

// Carica le unità disponibili per la registrazione
async function loadUnitsForRegistration() {
    try {
        // Carica tutte le unità disponibili per la registrazione
        const { data: units, error } = await supabaseClient
            .from('unita')
            .select('id, nome')
            .order('nome');

        if (error) throw error;

        const unitSelector = document.getElementById('reg-unit');
        unitSelector.innerHTML = '<option value="">Seleziona Unità</option>';

        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = unit.nome;
            unitSelector.appendChild(option);
        });
    } catch (error) {
        console.error('Errore caricamento unità per registrazione:', error);
    }
}

// Gestisce la registrazione
async function handleRegistration(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const nome = formData.get('nome');
    const cognome = formData.get('cognome');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirm_password');
    const unitaId = formData.get('unita_id');
    
    const errorElement = document.getElementById('registration-error');
    const successElement = document.getElementById('registration-success');
    
    // Reset messaggi
    errorElement.textContent = '';
    errorElement.classList.remove('show');
    successElement.style.display = 'none';
    
    // Validazione
    if (password !== confirmPassword) {
        errorElement.textContent = 'Le password non corrispondono';
        errorElement.classList.add('show');
        return;
    }
    
    if (!unitaId) {
        errorElement.textContent = 'Seleziona un\'unità';
        errorElement.classList.add('show');
        return;
    }

    try {
        // Registra l'utente con Supabase Auth
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    nome: nome,
                    cognome: cognome,
                    unita_id: unitaId
                }
            }
        });

        if (error) throw error;

        successElement.textContent = 'Registrazione completata! Controlla la tua email per verificare l\'account prima di effettuare il login.';
        successElement.style.display = 'block';
        
        // Reset del form
        document.getElementById('registration-form').reset();
        
        // Redirect al login dopo 4 secondi con messaggio
        setTimeout(() => {
            window.location.href = 'login.html?message=confirm-email';
        }, 4000);

    } catch (error) {
        errorElement.textContent = 'Errore durante la registrazione: ' + error.message;
        errorElement.classList.add('show');
    }
}

// Utility per generare URL di registrazione (utilizzabile da altre pagine)
function generateRegistrationURL(unitId = null, baseURL = window.location.origin + window.location.pathname.replace('register.html', '')) {
    const token = btoa(JSON.stringify({ unitId: unitId }));
    return `${baseURL}register.html?register=${token}`;
}

// Esporta funzione per uso da altre pagine
window.generateRegistrationURL = generateRegistrationURL;
