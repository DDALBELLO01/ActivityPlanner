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
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error || !session || !session.user) {
            window.location.replace('login.html?error=no_session');
            return;
        }
        
        showLoadingScreen();
        await loadUserData(session.user);
        showMainScreen();
        setupEventListeners();
        
    } catch (error) {
        console.error('Errore inizializzazione app:', error);
        window.location.replace('login.html?error=init_error');
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
        // Carica dati utente dalla tabella utenti tramite email
        const { data: userData, error } = await supabaseClient
            .from('utenti')
            .select('*')
            .eq('email', user.email)
            .single();

        if (error) {
            // Se l'utente non esiste nel DB, crea dati temporanei
            if (error.code === 'PGRST116') {
                currentUser = {
                    id: user.id,
                    email: user.email,
                    nome: user.user_metadata?.nome || user.email.split('@')[0] || 'Nome',
                    cognome: user.user_metadata?.cognome || 'Utente',
                    admin: false,
                    unita_associate: []
                };
                
                document.getElementById('user-name').textContent = `${currentUser.nome} ${currentUser.cognome} (Profilo incompleto)`;
                document.getElementById('admin-tab').style.display = 'none';
                document.getElementById('site-admin-tab').style.display = 'none';
                return;
            } else {
                throw error;
            }
        }

        if (!userData) {
            throw new Error('Utente non trovato nel database');
        }

        currentUser = userData;
        document.getElementById('user-name').textContent = `${userData.nome} ${userData.cognome}`;

        // Configurazione permessi UI
        document.getElementById('admin-tab').style.display = 
            userData.admin ? 'block' : 'none';
        
        document.getElementById('site-admin-tab').style.display = 
            userData.admin ? 'block' : 'none';

        // Caricamento unità disponibili
        await loadAvailableUnits();

    } catch (error) {
        console.error('Errore caricamento dati utente:', error);
        throw error;
    }
}

async function loadAvailableUnits() {
    try {
        let query = supabaseClient.from('unita').select('*');
        
        // Se l'utente non è admin, filtra per unità associate
        if (!currentUser?.admin && currentUser?.unita_associate && Array.isArray(currentUser.unita_associate) && currentUser.unita_associate.length > 0) {
            query = query.in('id', currentUser.unita_associate);
        } else if (!currentUser?.admin && (!currentUser?.unita_associate || currentUser.unita_associate.length === 0)) {
            // Nessuna unità disponibile per utenti non admin senza unità associate
            const unitSelector = document.getElementById('unit-selector');
            if (unitSelector) {
                unitSelector.innerHTML = '<option value="">Nessuna unità disponibile</option>';
            }
            return;
        }
        
        const { data: units, error } = await query.order('nome');

        if (error) throw error;

        const unitSelector = document.getElementById('unit-selector');
        if (!unitSelector) return;
        
        unitSelector.innerHTML = '<option value="">Seleziona Unità</option>';

        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = unit.nome;
            unitSelector.appendChild(option);
        });

        // Selezione automatica prima unità se disponibile
        if (units.length > 0) {
            unitSelector.value = units[0].id;
            await handleUnitChange();
        }
        
    } catch (error) {
        console.error('Errore caricamento unità:', error);
        throw error;
    }
}

async function handleUnitChange() {
    try {
        const unitId = document.getElementById('unit-selector').value;
        
        if (!unitId) {
            currentUnit = null;
            return;
        }

        const { data: unit, error } = await supabaseClient
            .from('unita')
            .select('*')
            .eq('id', unitId)
            .single();

        if (error) throw error;

        currentUnit = unit;
        
        // Ricarica i dati del tab attivo
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab) {
            switch (activeTab.id) {
                case 'attivita':
                    loadActivities();
                    break;
                case 'membri':
                    loadMembers();
                    break;
            }
        }
        
    } catch (error) {
        console.error('Errore cambio unità:', error);
        throw error;
    }
}

// Gestione Attività
async function loadActivities() {
    try {
        if (!currentUnit) return;

        const container = document.getElementById('activities-list');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        const { data: activities, error } = await supabaseClient
            .from('attivita')
            .select('*')
            .eq('unita_id', currentUnit.id)
            .order('data', { ascending: false });

        if (error) throw error;

        container.innerHTML = '';

        if (activities.length === 0) {
            container.innerHTML = '<p>Nessuna attività trovata per questa unità.</p>';
            return;
        }

        activities.forEach(activity => {
            const card = createActivityCard(activity);
            container.appendChild(card);
        });
        
    } catch (error) {
        console.error('Errore caricamento attività:', error);
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

// Gestione eventi
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

    // Forms
    document.getElementById('activity-form').addEventListener('submit', handleActivitySubmit);
    document.getElementById('member-form').addEventListener('submit', handleMemberSubmit);
    document.getElementById('unit-form').addEventListener('submit', handleUnitSubmit);
    document.getElementById('new-user-form').addEventListener('submit', handleNewUserSubmit);
    document.getElementById('existing-user-form').addEventListener('submit', handleExistingUserSubmit);

    // Calendar navigation
    document.getElementById('prev-month').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => navigateMonth(1));

    // Add buttons
    document.getElementById('add-schedule-row').addEventListener('click', addScheduleRow);
    document.getElementById('add-objective').addEventListener('click', addObjectiveRow);
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

// Gestione tab
function handleTabClick(e) {
    const tabName = e.target.dataset.tab;

    if (tabName === 'logout') {
        handleLogout();
        return;
    }

    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    e.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');

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

    document.querySelectorAll('.admin-tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));

    e.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
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
    
    let objectives = [];
    try {
        if (member.obiettivi) {
            objectives = typeof member.obiettivi === 'string' 
                ? JSON.parse(member.obiettivi) 
                : member.obiettivi;
        }
    } catch (e) {
        objectives = [];
    }
    
    const objectivesList = objectives.map(obj => `<li>${obj.titolo} (${obj.data})</li>`).join('');
    
    card.innerHTML = `
        <h3>${member.nome} ${member.cognome}</h3>
        <p><strong>Ruolo:</strong> ${member.ruolo || 'Non specificato'}</p>
        <p><strong>Anno:</strong> ${member.anno || 'Non specificato'}</p>
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

// Gestione form attività
async function handleActivitySubmit(e) {
    e.preventDefault();
    
    if (!currentUnit) {
        alert('Seleziona un\'unità prima di procedere');
        return;
    }

    const formData = new FormData(e.target);
    const activityId = formData.get('activity_id');
    
    const activityData = {
        titolo: formData.get('titolo'),
        obiettivi: formData.get('obiettivi'),
        data: formData.get('data'),
        raggiunti: formData.get('raggiunti'),
        unita_id: currentUnit.id,
        tabella_oraria: JSON.stringify(getScheduleData())
    };

    try {
        let result;
        if (activityId) {
            result = await supabaseClient
                .from('attivita')
                .update(activityData)
                .eq('id', activityId);
        } else {
            result = await supabaseClient
                .from('attivita')
                .insert([activityData]);
        }

        if (result.error) throw result.error;

        closeModal('activity-modal');
        loadActivities();
        alert(activityId ? 'Attività aggiornata con successo!' : 'Attività salvata con successo!');
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
    const row = createScheduleRow();
    container.appendChild(row);
}

function createScheduleRow(data = {}) {
    const row = document.createElement('div');
    row.className = 'schedule-row';
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.style.marginBottom = '10px';
    
    row.innerHTML = `
        <input type="time" value="${data.ora || ''}" placeholder="Ora" style="flex: 1;">
        <input type="text" value="${data.titolo || ''}" placeholder="Titolo" style="flex: 2;">
        <input type="text" value="${data.descrizione || ''}" placeholder="Descrizione" style="flex: 3;">
        <input type="text" value="${data.gestore || ''}" placeholder="Gestore" style="flex: 2;">
        <button type="button" class="btn-danger" onclick="this.parentElement.remove()">Rimuovi</button>
    `;
    
    return row;
}

// Gestione form membri
async function handleMemberSubmit(e) {
    e.preventDefault();
    
    if (!currentUnit) {
        alert('Seleziona un\'unità prima di procedere');
        return;
    }

    const formData = new FormData(e.target);
    const memberId = formData.get('member_id');
    
    const memberData = {
        nome: formData.get('nome'),
        cognome: formData.get('cognome'),
        anno: parseInt(formData.get('anno')),
        ruolo: formData.get('ruolo'),
        email: formData.get('email'),
        unita_id: currentUnit.id,
        obiettivi: JSON.stringify(getObjectivesData())
    };

    try {
        let result;
        if (memberId) {
            result = await supabaseClient
                .from('membri')
                .update(memberData)
                .eq('id', memberId);
        } else {
            result = await supabaseClient
                .from('membri')
                .insert([memberData]);
        }

        if (result.error) throw result.error;

        closeModal('member-modal');
        loadMembers();
        alert(memberId ? 'Membro aggiornato con successo!' : 'Membro salvato con successo!');
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
    const row = createObjectiveRow();
    container.appendChild(row);
}

function createObjectiveRow(data = {}) {
    const row = document.createElement('div');
    row.className = 'objective-row';
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.style.marginBottom = '10px';
    
    row.innerHTML = `
        <input type="date" value="${data.data || ''}" placeholder="Data" style="flex: 1;">
        <input type="text" value="${data.titolo || ''}" placeholder="Titolo Obiettivo" style="flex: 2;">
        <button type="button" class="btn-danger" onclick="this.parentElement.remove()">Rimuovi</button>
    `;
    
    return row;
}

// CRUD Operations
async function viewActivity(id) {
    try {
        const { data: activity, error } = await supabaseClient
            .from('attivita')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        document.getElementById('activity-title').value = activity.titolo;
        document.getElementById('activity-objectives').value = activity.obiettivi || '';
        document.getElementById('activity-date').value = activity.data;
        document.getElementById('activity-achieved').value = activity.raggiunti || '';
        document.getElementById('activity-modal-title').textContent = 'Visualizza Attività';

        const scheduleContainer = document.getElementById('schedule-rows');
        scheduleContainer.innerHTML = '';
        
        if (activity.tabella_oraria) {
            const schedule = JSON.parse(activity.tabella_oraria);
            schedule.forEach(item => {
                const row = createScheduleRow(item);
                scheduleContainer.appendChild(row);
            });
        }

        const form = document.getElementById('activity-form');
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => input.disabled = true);

        form.querySelector('button[type="submit"]').style.display = 'none';
        form.querySelector('.btn-secondary').textContent = 'Chiudi';

        showModal('activity-modal');
    } catch (error) {
        console.error('Errore visualizzazione attività:', error);
        alert('Errore nella visualizzazione dell\'attività');
    }
}

async function editActivity(id) {
    try {
        const { data: activity, error } = await supabaseClient
            .from('attivita')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        document.getElementById('activity-title').value = activity.titolo;
        document.getElementById('activity-objectives').value = activity.obiettivi || '';
        document.getElementById('activity-date').value = activity.data;
        document.getElementById('activity-achieved').value = activity.raggiunti || '';
        document.getElementById('activity-modal-title').textContent = 'Modifica Attività';

        const scheduleContainer = document.getElementById('schedule-rows');
        scheduleContainer.innerHTML = '';
        
        if (activity.tabella_oraria) {
            const schedule = JSON.parse(activity.tabella_oraria);
            schedule.forEach(item => {
                const row = createScheduleRow(item);
                scheduleContainer.appendChild(row);
            });
        } else {
            addScheduleRow();
        }

        const form = document.getElementById('activity-form');
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => input.disabled = false);

        form.querySelector('button[type="submit"]').style.display = 'inline-block';
        form.querySelector('.btn-secondary').textContent = 'Annulla';

        let idInput = form.querySelector('input[name="activity_id"]');
        if (!idInput) {
            idInput = document.createElement('input');
            idInput.type = 'hidden';
            idInput.name = 'activity_id';
            form.appendChild(idInput);
        }
        idInput.value = id;

        showModal('activity-modal');
    } catch (error) {
        console.error('Errore modifica attività:', error);
        alert('Errore nella modifica dell\'attività');
    }
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
    try {
        const { data: member, error } = await supabaseClient
            .from('membri')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        document.getElementById('member-name').value = member.nome;
        document.getElementById('member-surname').value = member.cognome;
        document.getElementById('member-year').value = member.anno;
        document.getElementById('member-role').value = member.ruolo || '';
        document.getElementById('member-email').value = member.email || '';
        document.getElementById('member-modal-title').textContent = 'Modifica Membro';

        const objectivesContainer = document.getElementById('objectives-list');
        objectivesContainer.innerHTML = '';
        
        if (member.obiettivi) {
            let objectives = [];
            try {
                objectives = typeof member.obiettivi === 'string' 
                    ? JSON.parse(member.obiettivi) 
                    : member.obiettivi;
                if (Array.isArray(objectives)) {
                    objectives.forEach(objective => {
                        const row = createObjectiveRow(objective);
                        objectivesContainer.appendChild(row);
                    });
                }
            } catch (e) {
                addObjectiveRow();
            }
        } else {
            addObjectiveRow();
        }

        const form = document.getElementById('member-form');
        let idInput = form.querySelector('input[name="member_id"]');
        if (!idInput) {
            idInput = document.createElement('input');
            idInput.type = 'hidden';
            idInput.name = 'member_id';
            form.appendChild(idInput);
        }
        idInput.value = id;

        showModal('member-modal');
    } catch (error) {
        console.error('Errore modifica membro:', error);
        alert('Errore nella modifica del membro');
    }
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

// Gestione Modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'block';
    
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
        
        if (modalId === 'activity-modal') {
            document.getElementById('schedule-rows').innerHTML = '';
            addScheduleRow();
            
            const inputs = form.querySelectorAll('input, textarea, select');
            inputs.forEach(input => input.disabled = false);
            form.querySelector('button[type="submit"]').style.display = 'inline-block';
            form.querySelector('.btn-secondary').textContent = 'Annulla';
            document.getElementById('activity-modal-title').textContent = 'Aggiungi Attività';
            
            const idInput = form.querySelector('input[name="activity_id"]');
            if (idInput) idInput.remove();
        }
        
        if (modalId === 'member-modal') {
            document.getElementById('objectives-list').innerHTML = '';
            addObjectiveRow();
            
            document.getElementById('member-modal-title').textContent = 'Aggiungi Membro';
            const idInput = form.querySelector('input[name="member_id"]');
            if (idInput) idInput.remove();
        }
        
        if (modalId === 'existing-user-modal') {
            loadAvailableUsersForUnit();
        }
        
        if (modalId === 'unit-modal') {
            loadUsersForUnitForm();
            const idInput = form.querySelector('input[name="unit_id"]');
            if (idInput) idInput.remove();
        }
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Gestione Calendario
async function loadCalendar() {
    if (!currentUnit) return;
    await generateCalendar();
    await loadCalendarActivities();
}

async function generateCalendar() {
    const container = document.getElementById('calendar-container');
    
    document.getElementById('current-month').textContent = 
        currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

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
        </div>
    `;
    
    container.innerHTML = calendarHTML;

    const grid = document.getElementById('calendar-grid');
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const today = new Date();

    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    for (let i = startDay - 1; i >= 0; i--) {
        const prevDate = new Date(firstDay);
        prevDate.setDate(firstDay.getDate() - i - 1);
        const dayElement = createCalendarDay(prevDate, true);
        grid.appendChild(dayElement);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const isToday = date.toDateString() === today.toDateString();
        const dayElement = createCalendarDay(date, false, isToday);
        grid.appendChild(dayElement);
    }

    const totalCells = grid.children.length;
    const cellsNeeded = 42 - totalCells;
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
    
    if (otherMonth) dayElement.classList.add('other-month');
    if (isToday) dayElement.classList.add('today');

    dayElement.innerHTML = `
        <div class="day-number">${date.getDate()}</div>
        <div class="day-activities" data-date="${date.toISOString().split('T')[0]}">
        </div>
    `;

    return dayElement;
}

async function loadCalendarActivities() {
    if (!currentUnit) return;

    try {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const { data: activities, error } = await supabaseClient
            .from('attivita')
            .select('*')
            .eq('unita_id', currentUnit.id)
            .gte('data', startOfMonth.toISOString().split('T')[0])
            .lte('data', endOfMonth.toISOString().split('T')[0]);

        if (error) throw error;

        activities.forEach(activity => {
            const activityDate = activity.data;
            const dayContainer = document.querySelector(`[data-date="${activityDate}"]`);
            
            if (dayContainer) {
                const activityElement = document.createElement('div');
                activityElement.className = 'calendar-activity';
                activityElement.textContent = activity.titolo;
                activityElement.title = activity.obiettivi || activity.titolo;
                activityElement.style.cursor = 'pointer';
                activityElement.onclick = () => viewActivity(activity.id);
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
    console.log('Caricamento dati amministrazione');
}

async function loadSiteAdmin() {
    if (!currentUser.admin) return;
    
    await loadAllUnits();
    await loadAllUsers();
    await loadGenerateRegistrationURL();
}

async function loadAllUnits() {
    try {
        const { data: units, error } = await supabaseClient
            .from('unita')
            .select(`
                *,
                membri_count:membri(count)
            `)
            .order('nome');

        if (error) throw error;

        const container = document.getElementById('units-list');
        container.innerHTML = '';

        for (const unit of units) {
            await supabaseClient
                .from('unita')
                .update({ nr_membri: unit.membri_count[0].count })
                .eq('id', unit.id);
            
            const unitCard = document.createElement('div');
            unitCard.className = 'admin-section';
            unitCard.innerHTML = `
                <h4>${unit.nome}</h4>
                <p><strong>Capo Unità:</strong> ${unit.capo_unita || 'Non assegnato'}</p>
                <p><strong>Membri:</strong> ${unit.membri_count[0].count}</p>
                <div class="activity-actions">
                    <button class="btn-edit" onclick="editUnit(${unit.id})">Modifica</button>
                    <button class="btn-danger" onclick="deleteUnit(${unit.id})">Elimina</button>
                </div>
            `;
            container.appendChild(unitCard);
        }
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

async function loadGenerateRegistrationURL() {
    try {
        const { data: units, error } = await supabaseClient
            .from('unita')
            .select('id, nome')
            .order('nome');

        if (error) throw error;

        const urlUnitSelector = document.getElementById('url-unit-selector');
        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = unit.nome;
            urlUnitSelector.appendChild(option);
        });
        
        document.getElementById('generate-url-btn').addEventListener('click', () => {
            const selectedUnit = document.getElementById('url-unit-selector').value;
            const registrationURL = generateRegistrationURL(selectedUnit || null);
            
            document.getElementById('registration-url-input').value = registrationURL;
            document.getElementById('generated-url').style.display = 'block';
        });
        
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

function generateRegistrationURL(unitId = null, baseURL = window.location.origin + window.location.pathname.replace('app.html', '')) {
    const token = btoa(JSON.stringify({ unitId: unitId }));
    return `${baseURL}register.html?register=${token}`;
}

// Gestione form unità
async function handleUnitSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const unitId = formData.get('unit_id');
    
    const unitData = {
        nome: formData.get('nome'),
        capo_unita: formData.get('capo_unita') || null,
        nr_membri: parseInt(formData.get('nr_membri')) || 0,
        aiuti: Array.from(document.getElementById('unit-helpers').selectedOptions).map(option => option.value)
    };

    try {
        let result;
        if (unitId) {
            result = await supabaseClient
                .from('unita')
                .update(unitData)
                .eq('id', unitId);
        } else {
            result = await supabaseClient
                .from('unita')
                .insert([unitData]);
        }

        if (result.error) throw result.error;

        closeModal('unit-modal');
        loadAllUnits();
        alert(unitId ? 'Unità aggiornata con successo!' : 'Unità salvata con successo!');
    } catch (error) {
        console.error('Errore salvataggio unità:', error);
        alert('Errore nel salvataggio dell\'unità');
    }
}

async function editUnit(id) {
    try {
        const { data: unit, error } = await supabaseClient
            .from('unita')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        document.getElementById('unit-name').value = unit.nome;
        document.getElementById('unit-members').value = unit.nr_membri || 0;

        await loadUsersForUnitForm();
        
        if (unit.capo_unita) {
            document.getElementById('unit-leader').value = unit.capo_unita;
        }

        const form = document.getElementById('unit-form');
        let idInput = form.querySelector('input[name="unit_id"]');
        if (!idInput) {
            idInput = document.createElement('input');
            idInput.type = 'hidden';
            idInput.name = 'unit_id';
            form.appendChild(idInput);
        }
        idInput.value = id;

        showModal('unit-modal');
    } catch (error) {
        console.error('Errore modifica unità:', error);
        alert('Errore nella modifica dell\'unità');
    }
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

// Gestione utenti
async function handleNewUserSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        email: formData.get('email'),
        password: formData.get('password')
    };
    
    const memberData = {
        nome: formData.get('nome'),
        cognome: formData.get('cognome'),
        email: formData.get('email'),
        unita_id: currentUnit?.id,
        admin: false
    };

    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signUp(userData);
        
        if (authError) throw authError;

        const { error: memberError } = await supabaseClient
            .from('membri')
            .insert([memberData]);

        if (memberError) throw memberError;

        closeModal('new-user-modal');
        loadAdminData();
        alert('Nuovo utente creato con successo!');
    } catch (error) {
        console.error('Errore creazione utente:', error);
        alert('Errore nella creazione dell\'utente: ' + error.message);
    }
}

async function handleExistingUserSubmit(e) {
    e.preventDefault();
    
    if (!currentUnit) {
        alert('Nessuna unità selezionata');
        return;
    }
    
    const formData = new FormData(e.target);
    const userId = formData.get('user_id');
    
    try {
        const { data: existingUser, error: fetchError } = await supabaseClient
            .from('membri')
            .select('unita_visibili')
            .eq('id', userId)
            .single();
            
        if (fetchError) throw fetchError;
        
        let unitaVisibili = existingUser.unita_visibili || [];
        if (!unitaVisibili.includes(currentUnit.id)) {
            unitaVisibili.push(currentUnit.id);
        }
        
        const { error: updateError } = await supabaseClient
            .from('membri')
            .update({ unita_visibili: unitaVisibili, unita_id: currentUnit.id })
            .eq('id', userId);

        if (updateError) throw updateError;

        closeModal('existing-user-modal');
        loadAdminData();
        alert('Utente aggiunto all\'unità con successo!');
    } catch (error) {
        console.error('Errore aggiunta utente:', error);
        alert('Errore nell\'aggiunta dell\'utente: ' + error.message);
    }
}

async function loadAvailableUsersForUnit() {
    try {
        if (!currentUnit) return;
        
        const { data: users, error } = await supabaseClient
            .from('membri')
            .select('id, nome, cognome, email')
            .neq('email', currentUnit.capo_unita)
            .not('email', 'in', `(${(currentUnit.aiuti || []).map(email => `"${email}"`).join(',')})`);

        if (error) throw error;

        const select = document.getElementById('existing-user-select');
        select.innerHTML = '<option value="">Seleziona utente</option>';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.nome} ${user.cognome} (${user.email})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Errore caricamento utenti disponibili:', error);
    }
}

async function loadUsersForUnitForm() {
    try {
        const { data: users, error } = await supabaseClient
            .from('membri')
            .select('email, nome, cognome')
            .order('cognome');

        if (error) throw error;

        const leaderSelect = document.getElementById('unit-leader');
        const helpersSelect = document.getElementById('unit-helpers');
        
        leaderSelect.innerHTML = '<option value="">Seleziona Capo Unità</option>';
        helpersSelect.innerHTML = '';
        
        users.forEach(user => {
            const leaderOption = document.createElement('option');
            leaderOption.value = user.email;
            leaderOption.textContent = `${user.nome} ${user.cognome} (${user.email})`;
            leaderSelect.appendChild(leaderOption);
            
            const helperOption = document.createElement('option');
            helperOption.value = user.email;
            helperOption.textContent = `${user.nome} ${user.cognome} (${user.email})`;
            helpersSelect.appendChild(helperOption);
        });
    } catch (error) {
        console.error('Errore caricamento utenti per form unità:', error);
    }
}

function editUser(id) {
    console.log('Modifica utente:', id);
}

// Logout
async function handleLogout() {
    if (confirm('Sei sicuro di voler uscire?')) {
        try {
            await supabaseClient.auth.signOut();
        } catch (error) {
            console.error('Errore logout:', error);
        }
    }
}
