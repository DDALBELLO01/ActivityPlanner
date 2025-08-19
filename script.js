// Script principale per ActivityPlanner
// SUPABASE
const supabaseUrl = "https://ouxvlyaksbfvqmdryzpn.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eHZseWFrc2JmdnFtZHJ5enBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NDA3ODUsImV4cCI6MjA3MTExNjc4NX0.NWvgiCIhqNA6wLr6ARAJrQjItMfZZ78JZ6IwlkomZkI";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// LOGIN / REGISTRAZIONE
async function login() {
	const email = document.getElementById("email").value;
	const password = document.getElementById("password").value;
	const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
	if(error) alert(error.message);
	else {
		// Recupera info utente dalla tabella membri
		const { data: utenti, error: errM } = await supabaseClient
			.from('membri')
			.select('admin')
			.eq('email', email);
		if (!errM && utenti && utenti.length > 0 && utenti[0].admin === true) {
			document.getElementById('btn-registrati').style.display = '';
		} else {
			document.getElementById('btn-registrati').style.display = 'none';
		}
		showMain();
	}
}

async function signup() {
	const email = document.getElementById("email").value;
	const password = document.getElementById("password").value;
	const { error } = await supabaseClient.auth.signUp({ email, password });
	if(error) alert(error.message);
	else alert("Registrazione effettuata, controlla email per conferma!");
}

async function logout() {
	await supabaseClient.auth.signOut();
	document.getElementById("main-section").style.display = "none";
	document.getElementById("auth-section").style.display = "block";
}

function showMain() {
	document.getElementById("auth-section").style.display = "none";
	document.getElementById("main-section").style.display = "block";
	caricaAttivita();
	caricaMembri();
	caricaCalendario();
}

// TAB
function showTab(tabId) {
	document.querySelectorAll(".tab").forEach(t => t.style.display="none");
	document.getElementById(tabId).style.display = "block";
}

// ATTIVITÀ
let attivitaSelezionata = null; 
let attivitaInModifica = null;

async function caricaAttivita() {
	const { data, error } = await supabaseClient.from('attivita').select('*');
	if(!error){
		const lista = document.getElementById("lista-attivita");
		lista.innerHTML = "";
		data.forEach(a => {
			const li = document.createElement("li");
			li.innerHTML = `<span><i class=\"fa-solid fa-circle-check\"></i> ${a.titolo} (${a.data})</span>`;
			li.style.cursor = "pointer";
			li.addEventListener("click", ()=>mostraDettagliAttivita(a));
			lista.appendChild(li);
		});
		caricaCalendario();
	}
}

function caricaCalendario() {
	const calendarEl = document.getElementById('calendar');
	if (!calendarEl) return;
	calendarEl.innerHTML = "";
	const lista = document.getElementById("lista-attivita");
	let eventi = [];
	if (window.attivitaData) {
		eventi = window.attivitaData.map(a => ({
			title: a.titolo,
			start: a.data,
			extendedProps: a
		}));
	} else {
		eventi = Array.from(lista.children).map(li => {
			const titolo = li.innerText;
			const match = titolo.match(/\((\d{4}-\d{2}-\d{2})\)/);
			return {
				title: titolo,
				start: match ? match[1] : undefined
			};
		});
	}
	const calendar = new FullCalendar.Calendar(calendarEl, {
		initialView: 'dayGridMonth',
		locale: 'it',
		events: eventi,
		eventClick: function(info) {
			if(info.event.extendedProps) {
				mostraDettagliAttivita(info.event.extendedProps);
			}
		}
	});
	calendar.render();
}

function mostraDettagliAttivita(attivita){
	attivitaSelezionata = attivita;
	document.getElementById("modal-titolo").innerText = attivita.titolo || "-";
	document.getElementById("modal-obiettivi").innerText = attivita.obiettivi || "-";
	document.getElementById("modal-data").innerText = attivita.data || "-";
	document.getElementById("modal-raggiunti").innerText = attivita.raggiunti || "-";

	const tabellaOrariaEl = document.getElementById("modal-tabella-oraria");
	tabellaOrariaEl.innerHTML = "";
	if(attivita.tabella_oraria){
		try {
			const righe = JSON.parse(attivita.tabella_oraria);
			righe.forEach(r=>{
				const li = document.createElement("li");
				li.textContent = `${r.orario} - ${r.tipo} - ${r.descrizione} (Gestore: ${r.gestore})`;
				tabellaOrariaEl.appendChild(li);
			});
		} catch { tabellaOrariaEl.innerHTML = "<li>Errore nel leggere la tabella</li>"; }
	} else tabellaOrariaEl.innerHTML = "<li>Nessuna tabella oraria</li>";

	document.getElementById("modal-attivita").style.display="flex";
}

function chiudiModal(){
	document.getElementById("modal-attivita").style.display="none";
	attivitaSelezionata = null;
}

async function eliminaAttivita(){
	if(!attivitaSelezionata) return;
	if(!confirm("Vuoi davvero eliminare questa attività?")) return;

	const { error } = await supabaseClient
		.from('attivita')
		.delete()
		.eq('id', attivitaSelezionata.id);

	if(error) alert(error.message);
	else {
		chiudiModal();
		caricaAttivita();
	}
}

function modificaAttivita(){
	if(!attivitaSelezionata) return;
	document.getElementById("id-attivita").value = attivitaSelezionata.id || "";
	document.getElementById("titolo").value = attivitaSelezionata.titolo || "";
	document.getElementById("obiettivi").value = attivitaSelezionata.obiettivi || "";
	document.getElementById("data").value = attivitaSelezionata.data || "";
	document.getElementById("raggiunti").value = attivitaSelezionata.raggiunti || "";

	document.getElementById("tabella-oraria").innerHTML="";
	if(attivitaSelezionata.tabella_oraria){
		try {
			const righe = JSON.parse(attivitaSelezionata.tabella_oraria);
			righe.forEach(r=>{
				const div = document.createElement("div");
				div.style.margin="0.5rem 0";
				div.innerHTML = `
					<input type="time" value="${r.orario}">
					<input type="text" value="${r.tipo}">
					<input type="text" value="${r.descrizione}">
					<input type="text" value="${r.gestore}">
				`;
				document.getElementById("tabella-oraria").appendChild(div);
			});
		} catch {}
	}

	chiudiModal();
}

async function salvaAttivita(){
	const titolo = document.getElementById("titolo").value;
	const obiettivi = document.getElementById("obiettivi").value;
	const data = document.getElementById("data").value;
	const raggiunti = document.getElementById("raggiunti").value;
	const id = document.getElementById("id-attivita").value;

	const righe = [];
	document.querySelectorAll("#tabella-oraria div").forEach(div=>{
		const inputs = div.querySelectorAll("input");
		righe.push({
			orario: inputs[0].value,
			tipo: inputs[1].value,
			descrizione: inputs[2].value,
			gestore: inputs[3].value
		});
	});
	const tabella_oraria = JSON.stringify(righe);

	let error;
	if(id){
		({error} = await supabaseClient
			.from('attivita')
			.update({ titolo, obiettivi, data, raggiunti, tabella_oraria })
			.eq('id', id));
	} else {
		({error} = await supabaseClient
			.from('attivita')
			.insert([{ titolo, obiettivi, data, raggiunti, tabella_oraria }]));
	}

	if(error) alert("Errore: "+error.message);
	else {
		document.getElementById("titolo").value="";
		document.getElementById("obiettivi").value="";
		document.getElementById("data").value="";
		document.getElementById("raggiunti").value="";
		document.getElementById("id-attivita").value="";
		document.getElementById("tabella-oraria").innerHTML="";
		caricaAttivita();
	}
}

function aggiungiRigaOraria(){
	const div = document.createElement("div");
	div.style.margin="0.5rem 0";
	div.innerHTML = `
		<input type="time" value="">
		<input type="text" placeholder="Tipo">
		<input type="text" placeholder="Descrizione">
		<input type="text" placeholder="Gestore">
	`;
	document.getElementById("tabella-oraria").appendChild(div);
}

// MEMBRI
async function caricaMembri(){
	const { data, error } = await supabaseClient.from('membri').select('*');
	if(!error){
		// Popola tabella membri
		const tbody = document.querySelector('#tabella-membri tbody');
		tbody.innerHTML = '';
		data.forEach(membro => {
			let obiettiviHtml = '';
			if (Array.isArray(membro.obiettivi)) {
				obiettiviHtml = '<ul style="margin:0; padding-left:1em;">' + membro.obiettivi.map(obj => `<li>${obj.data ? obj.data + ' - ' : ''}${obj.titolo || obj}</li>`).join('') + '</ul>';
			} else if (typeof membro.obiettivi === 'string' && membro.obiettivi.length > 0) {
				obiettiviHtml = membro.obiettivi;
			} else {
				obiettiviHtml = '-';
			}
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td>${membro.nome || ''}</td>
				<td>${membro.cognome || ''}</td>
				<td>${membro.anno || ''}</td>
				<td>${membro.ruolo || ''}</td>
				<td>${obiettiviHtml}</td>
				<td>
					<button class="btn-visualizza-membro" data-id="${membro.id}" style="background:#3498db; color:white; margin-right:0.3rem;">Visualizza</button>
					<button class="btn-modifica-membro" data-id="${membro.id}" style="background:#f1c40f; color:white; margin-right:0.3rem;">Modifica</button>
					<button class="btn-elimina-membro" data-id="${membro.id}" style="background:#e74c3c; color:white;">Elimina</button>
				</td>
			`;
			tbody.appendChild(tr);
		});
		// Associa gli handler ai bottoni
		document.querySelectorAll('.btn-visualizza-membro').forEach(btn => {
			btn.onclick = function() { mostraDettagliMembroTabella(btn.getAttribute('data-id')); };
		});
		document.querySelectorAll('.btn-modifica-membro').forEach(btn => {
			btn.onclick = function() { modificaMembroTabella(btn.getAttribute('data-id')); };
		});
		document.querySelectorAll('.btn-elimina-membro').forEach(btn => {
			btn.onclick = function() { eliminaMembroTabella(btn.getAttribute('data-id')); };
		});
	}
// Funzione per aggiungere membro con obiettivi
let obiettiviMembroTemp = [];

function aggiornaListaObiettiviMembro() {
	const container = document.getElementById('container-obiettivi-membro');
	container.innerHTML = '';
	if (obiettiviMembroTemp.length === 0) {
		container.innerHTML = '<span style="color:#888;">Nessun obiettivo inserito</span>';
		return;
	}
	const ul = document.createElement('ul');
	ul.style.paddingLeft = '1em';
	obiettiviMembroTemp.forEach((obj, idx) => {
		const li = document.createElement('li');
		li.textContent = `${obj.data ? obj.data + ' - ' : ''}${obj.titolo}`;
		const btn = document.createElement('button');
		btn.textContent = 'Rimuovi';
		btn.style.background = '#e74c3c';
		btn.style.color = 'white';
		btn.style.border = 'none';
		btn.style.borderRadius = '4px';
		btn.style.padding = '0.2rem 0.6rem';
		btn.style.marginLeft = '0.5rem';
		btn.style.cursor = 'pointer';
		btn.onclick = function() {
			obiettiviMembroTemp.splice(idx, 1);
			aggiornaListaObiettiviMembro();
		};
		li.appendChild(btn);
		ul.appendChild(li);
	});
	container.appendChild(ul);
}

document.getElementById('btn-aggiungi-obiettivo-membro').onclick = function() {
	const titolo = document.getElementById('titolo-obiettivo-membro').value.trim();
	const data = document.getElementById('data-obiettivo-membro').value;
	if (!titolo) return alert('Inserisci il titolo dell\'obiettivo');
	obiettiviMembroTemp.push({ titolo, data });
	document.getElementById('titolo-obiettivo-membro').value = '';
	document.getElementById('data-obiettivo-membro').value = '';
	aggiornaListaObiettiviMembro();
};

document.getElementById('btn-aggiungi-membro').onclick = async function() {
	const nome = document.getElementById('nome-membro').value;
	const cognome = document.getElementById('cognome-membro').value;
	const anno = document.getElementById('anno-membro').value;
	const ruolo = document.getElementById('ruolo-membro').value;
	const obiettivi = obiettiviMembroTemp;
	const { error } = await supabaseClient.from('membri').insert([{ nome, cognome, anno, ruolo, obiettivi }]);
	if (error) alert(error.message);
	else {
		document.getElementById('nome-membro').value = '';
		document.getElementById('cognome-membro').value = '';
		document.getElementById('anno-membro').value = '';
		document.getElementById('ruolo-membro').value = '';
		obiettiviMembroTemp = [];
		aggiornaListaObiettiviMembro();
		caricaMembri();
	}
};

// Inizializza la lista obiettivi all'avvio
document.addEventListener('DOMContentLoaded', aggiornaListaObiettiviMembro);
// Visualizza popup dettaglio membro dalla tabella
function mostraDettagliMembroTabella(membroId) {
	supabaseClient
		.from('membri')
		.select('*')
		.eq('id', membroId)
		.single()
		.then(({ data: membro, error }) => {
			if (error || !membro) return alert('Errore nel recupero membro');
			mostraDettagliMembro(membro);
		});
}

function modificaMembroTabella(membroId) {
	// Recupera dati membro e mostra modale di modifica
	supabaseClient
		.from('membri')
		.select('*')
		.eq('id', membroId)
		.single()
		.then(({ data: membro, error }) => {
			if (error || !membro) return alert('Errore nel recupero membro');
			window.membroInModifica = membro;
			document.getElementById('mod-nome-membro').value = membro.nome || '';
			document.getElementById('mod-cognome-membro').value = membro.cognome || '';
			document.getElementById('mod-anno-membro').value = membro.anno || '';
			document.getElementById('mod-ruolo-membro').value = membro.ruolo || '';
			window.membroInModifica = membro;
			window.obiettiviModifica = Array.isArray(membro.obiettivi) ? [...membro.obiettivi] : (typeof membro.obiettivi === 'string' && membro.obiettivi.length > 0 ? [membro.obiettivi] : []);
			document.getElementById('mod-nome-membro').value = membro.nome || '';
			document.getElementById('mod-cognome-membro').value = membro.cognome || '';
			document.getElementById('mod-anno-membro').value = membro.anno || '';
			document.getElementById('mod-ruolo-membro').value = membro.ruolo || '';
			aggiornaListaObiettiviModale();
			document.getElementById('modal-modifica-membro').style.display = 'flex';
// Aggiorna la lista obiettivi nel modale
function aggiornaListaObiettiviModale() {
	const ul = document.getElementById('mod-lista-obiettivi');
	ul.innerHTML = '';
	if (window.obiettiviModifica && window.obiettiviModifica.length > 0) {
		window.obiettiviModifica.forEach((obj, idx) => {
			const li = document.createElement('li');
			li.textContent = obj;
			li.style.display = 'flex';
			li.style.justifyContent = 'space-between';
			li.style.alignItems = 'center';
			const btn = document.createElement('button');
			btn.textContent = 'Rimuovi';
			btn.style.background = '#e74c3c';
			btn.style.color = 'white';
			btn.style.border = 'none';
			btn.style.borderRadius = '4px';
			btn.style.padding = '0.2rem 0.6rem';
			btn.style.cursor = 'pointer';
			btn.onclick = function() { rimuoviObiettivoModale(idx); };
			li.appendChild(btn);
			ul.appendChild(li);
		});
	} else {
		ul.innerHTML = '<li style="color:#888;">Nessun obiettivo</li>';
	}
}

function aggiungiObiettivoModale() {
	const input = document.getElementById('mod-nuovo-obiettivo');
	const val = input.value.trim();
	if (val.length > 0) {
		window.obiettiviModifica.push(val);
		aggiornaListaObiettiviModale();
		input.value = '';
	}
}

function rimuoviObiettivoModale(idx) {
	window.obiettiviModifica.splice(idx, 1);
	aggiornaListaObiettiviModale();
}
		});
// Salva le modifiche al membro
async function salvaModificaMembro() {
	const membro = window.membroInModifica;
	if (!membro) return;
	const nome = document.getElementById('mod-nome-membro').value;
	const cognome = document.getElementById('mod-cognome-membro').value;
	const anno = document.getElementById('mod-anno-membro').value;
	const ruolo = document.getElementById('mod-ruolo-membro').value;
	const obiettivi = window.obiettiviModifica || [];
	const { error } = await supabaseClient.from('membri').update({ nome, cognome, anno, ruolo, obiettivi }).eq('id', membro.id);
	if (error) alert(error.message);
	else {
		chiudiModalModificaMembro();
		caricaMembri();
	}
}

function chiudiModalModificaMembro() {
	document.getElementById('modal-modifica-membro').style.display = 'none';
	window.membroInModifica = null;
}
}

async function eliminaMembroTabella(membroId) {
	if(!confirm('Vuoi davvero eliminare questo membro?')) return;
	const { error } = await supabaseClient
		.from('membri')
		.delete()
		.eq('id', membroId);
	if(error) alert(error.message);
	else caricaMembri();
}
}

// Visualizza tabella obiettivi per ogni membro
function mostraTabellaObiettiviMembri(membri) {
	const container = document.getElementById('tabella-obiettivi-membri');
	container.innerHTML = '';
	membri.forEach(membro => {
		const obiettivi = membro.obiettivi || [];
		let html = `<h4>${membro.nome} ${membro.cognome}</h4>`;
		html += `<table style='width:100%; border-collapse:collapse; margin-bottom:1rem;'>`;
		html += `<thead><tr><th>Titolo</th><th>Completato</th><th>Data</th><th>Azioni</th></tr></thead><tbody>`;
		obiettivi.forEach((obj, idx) => {
			html += `<tr>
				<td>${obj.titolo || ''}</td>
				<td><input type='checkbox' ${obj.completato ? 'checked' : ''} disabled></td>
				<td>${obj.data || ''}</td>
				<td><button onclick='rimuoviObiettivoMembro("${membro.id}",${idx})' style='color:#e74c3c;'>Rimuovi</button></td>
			</tr>`;
		});
		html += `<tr>
			<td><input type='text' id='titolo-obj-${membro.id}' placeholder='Titolo'></td>
			<td><input type='checkbox' id='completato-obj-${membro.id}'></td>
			<td><input type='date' id='data-obj-${membro.id}'></td>
			<td><button onclick='aggiungiObiettivoMembroTabella("${membro.id}")' style='background:#27ae60; color:white;'>Aggiungi</button></td>
		</tr>`;
		html += `</tbody></table>`;
		container.innerHTML += html;
	});
}

function aggiungiObiettivoMembroTabella(membroId) {
	const titolo = document.getElementById('titolo-obj-' + membroId).value;
	const completato = document.getElementById('completato-obj-' + membroId).checked;
	const data = document.getElementById('data-obj-' + membroId).value;
	if (!titolo) return alert('Inserisci il titolo dell\'obiettivo');
	supabaseClient
		.from('membri')
		.select('*')
		.eq('id', membroId)
		.single()
		.then(({ data: membro, error }) => {
			if (error || !membro) return alert('Errore nel recupero membro');
			const obiettivi = membro.obiettivi || [];
			obiettivi.push({ titolo, completato, data });
			supabaseClient
				.from('membri')
				.update({ obiettivi })
				.eq('id', membroId)
				.then(({ error }) => {
					if (error) alert(error.message);
					else caricaMembri();
				});
		});
}

function rimuoviObiettivoMembro(membroId, idx) {
	supabaseClient
		.from('membri')
		.select('*')
		.eq('id', membroId)
		.single()
		.then(({ data: membro, error }) => {
			if (error || !membro) return alert('Errore nel recupero membro');
			const obiettivi = membro.obiettivi || [];
			obiettivi.splice(idx, 1);
			supabaseClient
				.from('membri')
				.update({ obiettivi })
				.eq('id', membroId)
				.then(({ error }) => {
					if (error) alert(error.message);
					else caricaMembri();
				});
		});
}

// MODALE MEMBRO
let membroSelezionato = null;
function mostraDettagliMembro(membro) {
	membroSelezionato = membro;
	document.getElementById("modal-membro-nome").innerText = membro.nome || "-";
	document.getElementById("modal-membro-cognome").innerText = membro.cognome || "-";
	document.getElementById("modal-membro-email").innerText = membro.email || "-";
	const ul = document.getElementById("modal-membro-obiettivi");
	ul.innerHTML = "";
	// Visualizza sia obiettivi che obiettivi_raggiunti
	let obiettivi = [];
	if (Array.isArray(membro.obiettivi)) {
		obiettivi = membro.obiettivi;
	} else if (typeof membro.obiettivi === "string" && membro.obiettivi.length > 0) {
		obiettivi = [membro.obiettivi];
	}
	if (obiettivi.length > 0) {
		obiettivi.forEach(obj => {
			if (typeof obj === "object") {
				ul.innerHTML += `<li>${obj.data ? obj.data + ' - ' : ''}${obj.titolo || obj.obiettivo || obj}</li>`;
			} else {
				ul.innerHTML += `<li>${obj}</li>`;
			}
		});
	}
	if (membro.obiettivi_raggiunti && Array.isArray(membro.obiettivi_raggiunti) && membro.obiettivi_raggiunti.length > 0) {
		ul.innerHTML += '<li style="font-weight:bold; margin-top:0.5em;">Obiettivi raggiunti:</li>';
		membro.obiettivi_raggiunti.forEach(obj => {
			ul.innerHTML += `<li>${obj.data ? obj.data + ': ' : ''}${obj.obiettivo}</li>`;
		});
	}
	if (ul.innerHTML === "") {
		ul.innerHTML = "<li>Nessun obiettivo</li>";
	}
	document.getElementById("modal-membro").style.display = "flex";
}

function annullaModaleMembro() {
	document.getElementById("modal-membro").style.display = "none";
	membroSelezionato = null;
}

function chiudiModalMembro(){
	document.getElementById("modal-membro").style.display = "none";
	membroSelezionato = null;
}

function modificaMembro(){
	if(!membroSelezionato) return;
	alert("Funzione di modifica membro da implementare");
}

async function eliminaMembro(){
	if(!membroSelezionato) return;
	if(!confirm("Vuoi davvero eliminare questo membro?")) return;
	const { error } = await supabaseClient
		.from('membri')
		.delete()
		.eq('id', membroSelezionato.id);
	if(error) alert(error.message);
	else {
		chiudiModalMembro();
		caricaMembri();
	}
}

// UTENTI (solo admin)
async function caricaUtenti() {
	const { data, error } = await supabaseClient.from('utenti').select('*');
	if (!error) {
		const lista = document.getElementById("lista-utenti");
		lista.innerHTML = "";
		data.forEach(u => {
			const li = document.createElement("li");
			li.innerHTML = `<span><i class=\"fa-solid fa-circle-check\"></i> ${u.nome} ${u.cognome} (${u.email})</span>`;
			li.style.cursor = "pointer";
			li.addEventListener("click", () => mostraDettagliUtente(u));
			lista.appendChild(li);
		});
	}
}

function mostraDettagliUtente(utente) {
	alert(`Dettagli utente:\nNome: ${utente.nome}\nCognome: ${utente.cognome}\nEmail: ${utente.email}`);
}

async function aggiungiUtente() {
	const nome = document.getElementById("nome-utente").value;
	const cognome = document.getElementById("cognome-utente").value;
	const email = document.getElementById("email-utente").value;
	const { error } = await supabaseClient.from('utenti').insert([{ nome, cognome, email }]);
	if (error) alert(error.message);
	else {
		document.getElementById("nome-utente").value = "";
		document.getElementById("cognome-utente").value = "";
		document.getElementById("email-utente").value = "";
		caricaUtenti();
	}
}

// IMPOSTAZIONI (solo admin)
async function caricaImpostazioni() {
	const { data, error } = await supabaseClient.from('impostazioni').select('*');
	if (!error) {
		const lista = document.getElementById("impostazioni-list");
		lista.innerHTML = "";
		data.forEach(i => {
			const div = document.createElement("div");
			div.innerHTML = `<strong>${i.chiave}:</strong> ${i.valore}`;
			lista.appendChild(div);
		});
	}
}

async function aggiungiImpostazione() {
	const chiave = document.getElementById("chiave-impostazione").value;
	const valore = document.getElementById("valore-impostazione").value;
	const { error } = await supabaseClient.from('impostazioni').insert([{ chiave, valore }]);
	if (error) alert(error.message);
	else {
		document.getElementById("chiave-impostazione").value = "";
		document.getElementById("valore-impostazione").value = "";
		caricaImpostazioni();
	}
}

// Inizializza la pagina caricando le attività, membri, utenti e impostazioni
document.addEventListener("DOMContentLoaded", () => {
	// Controllo sessione Supabase
	supabaseClient.auth.getSession().then(({ data, error }) => {
		if (data && data.session) {
			showMain();
		} else {
			document.getElementById("main-section").style.display = "none";
			document.getElementById("auth-section").style.display = "block";
		}
	});
	// ...le altre funzioni di caricamento vengono chiamate da showMain()
});
// Gestione automatica scadenza sessione e logout
supabaseClient.auth.onAuthStateChange((event, session) => {
	if (event === "SIGNED_OUT" || !session) {
		document.getElementById("main-section").style.display = "none";
		document.getElementById("auth-section").style.display = "block";
	}
	if (event === "SIGNED_IN" && session) {
		showMain();
	}
});
