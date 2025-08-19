// Register.js - Gestione registrazione per register.html
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Inizializzazione della registrazione
document.addEventListener('DOMContentLoaded', function() {
    checkExistingAuth();
    setupRegistrationListeners();
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

// Gestisce la registrazione
async function handleRegistration(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const nome = formData.get('nome');
    const cognome = formData.get('cognome');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirm_password');
    
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

    try {
        // Registra l'utente con Supabase Auth usando la formula semplificata
        const { data, error } = await supabaseClient.auth.signUp({ 
            email: email, 
            password: password 
        });
        
        if (error) {
            errorElement.textContent = 'Errore durante la registrazione: ' + error.message;
            errorElement.classList.add('show');
            return;
        }

        // Crea una riga nella tabella utenti con nome, cognome ed email
        const { error: insertError } = await supabaseClient
            .from('utenti')
            .insert([{
                nome: nome,
                cognome: cognome,
                email: email
            }]);

        if (insertError) {
            console.error('Errore inserimento nella tabella utenti:', insertError);
            // Non blocchiamo il processo se l'inserimento fallisce
        }

        successElement.textContent = 'Registrazione completata con successo! Controlla la tua email per verificare l\'account. Verrai reindirizzato alla pagina di login tra pochi secondi...';
        successElement.style.display = 'block';
        
        // Reset del form
        document.getElementById('registration-form').reset();
        
        // Redirect al login dopo 3 secondi
        setTimeout(() => {
            window.location.href = 'login.html?message=registration-success';
        }, 3000);

    } catch (error) {
        errorElement.textContent = 'Errore durante la registrazione: ' + error.message;
        errorElement.classList.add('show');
    }
}
