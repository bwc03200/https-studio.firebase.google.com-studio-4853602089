/* =============================================
   EHPAD-STAFF - app.js
   Logique partagée & gestion des données (localStorage)
   ============================================= */

'use strict';

// ---- Constantes métier ----
const SITES = [
  'AB1','AB2','AB3','CC1','CC2','BAT1','BATC2','BAT3',
  'MRF','PASA','ACCUEIL DE JOUR','AA1','AA2','AA3',
  'SERVICE CUISINE','SERVICE ADMINISTRATIF','SERVICE TECHNIQUE','SERVICE LINGERIE'
];

const PROFILES = [
  'ASHQ','AS','IDE','ERGOTHÉRAPEUTE','VEILLEUSE DE NUIT',
  'AIDE HÔTELIÈRE','AGENT CUISINE','AGENT TECHNIQUE',
  'AGENT MÉNAGE','AGENT ADMINISTRATIF','MAGASINIER'
];

const STATUS_LABELS = {
  open:      { label: 'Ouvert',    class: 'badge-open'     },
  pending:   { label: 'En attente',class: 'badge-pending'  },
  assigned:  { label: 'Pourvu',    class: 'badge-assigned' },
  cancelled: { label: 'Annulé',    class: 'badge-cancelled'}
};

// ---- Génération d'ID ----
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---- Helpers localStorage ----
function store(key, val) {
  try { localStorage.setItem('ehpad_' + key, JSON.stringify(val)); } catch(e) {}
}
function retrieve(key, fallback = null) {
  try {
    const v = localStorage.getItem('ehpad_' + key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch(e) { return fallback; }
}

// ---- Initialisation des données par défaut ----
function initData() {
  if (!retrieve('initialized')) {
    // Comptes admin par défaut (mot de passe : Admin123!)
    const defaultAdmins = [
      { id: genId(), firstName: 'Jean', lastName: 'MARTIN', role: 'admin', password: btoa('Admin123!'), createdAt: new Date().toISOString() },
      { id: genId(), firstName: 'Sophie', lastName: 'BERNARD', role: 'admin', password: btoa('Admin123!'), createdAt: new Date().toISOString() }
    ];
    // Agents de démonstration
    const defaultAgents = [
      { id: genId(), firstName: 'Marie',   lastName: 'DUPONT',   role: 'agent', profile: 'AS',            sites: ['AB1','AB2','CC1'],               password: btoa('Agent123!'), available: true, phone: '06 12 34 56 78', createdAt: new Date().toISOString() },
      { id: genId(), firstName: 'Pierre',  lastName: 'LEROY',    role: 'agent', profile: 'ASHQ',           sites: ['BAT1','BAT3','MRF'],             password: btoa('Agent123!'), available: true, phone: '06 23 45 67 89', createdAt: new Date().toISOString() },
      { id: genId(), firstName: 'Isabelle',lastName: 'MOREAU',   role: 'agent', profile: 'IDE',            sites: ['PASA','ACCUEIL DE JOUR','AA1'],  password: btoa('Agent123!'), available: false,phone: '06 34 56 78 90', createdAt: new Date().toISOString() },
      { id: genId(), firstName: 'Fatima',  lastName: 'OUALI',    role: 'agent', profile: 'AIDE HÔTELIÈRE', sites: ['SERVICE CUISINE','AA2'],         password: btoa('Agent123!'), available: true, phone: '06 45 67 89 01', createdAt: new Date().toISOString() },
      { id: genId(), firstName: 'Thomas',  lastName: 'GIRARD',   role: 'agent', profile: 'AGENT TECHNIQUE',sites: ['SERVICE TECHNIQUE','BAT1'],      password: btoa('Agent123!'), available: true, phone: '06 56 78 90 12', createdAt: new Date().toISOString() },
      { id: genId(), firstName: 'Nathalie',lastName: 'PETIT',    role: 'agent', profile: 'VEILLEUSE DE NUIT',sites: ['CC1','CC2','AB3'],              password: btoa('Agent123!'), available: true, phone: '06 67 89 01 23', createdAt: new Date().toISOString() },
      { id: genId(), firstName: 'Ahmed',   lastName: 'BENALI',   role: 'agent', profile: 'AGENT CUISINE',  sites: ['SERVICE CUISINE'],              password: btoa('Agent123!'), available: false,phone: '06 78 90 12 34', createdAt: new Date().toISOString() },
      { id: genId(), firstName: 'Lucie',   lastName: 'ROBERT',   role: 'agent', profile: 'AS',            sites: ['AA1','AA2','AA3'],               password: btoa('Agent123!'), available: true, phone: '06 89 01 23 45', createdAt: new Date().toISOString() }
    ];

    store('users', [...defaultAdmins, ...defaultAgents]);
    store('replacements', []);
    store('applications', []);
    store('initialized', true);
  }
}

// ---- Auth ----
function getUsers()         { return retrieve('users', []); }
function getUser(id)        { return getUsers().find(u => u.id === id) || null; }
function getCurrentUser()   { return retrieve('currentUser', null); }
function setCurrentUser(u)  { store('currentUser', u); }
function logout()           { localStorage.removeItem('ehpad_currentUser'); window.location.href = 'login.html'; }

function login(firstName, lastName, password, role) {
  const users = getUsers();
  const fn = firstName.trim().toLowerCase();
  const ln = lastName.trim().toLowerCase();
  const user = users.find(u =>
    u.firstName.toLowerCase() === fn &&
    u.lastName.toLowerCase() === ln &&
    u.role === role &&
    u.password === btoa(password)
  );
  if (user) { setCurrentUser(user); return { ok: true, user }; }
  return { ok: false, error: 'Identifiants incorrects. Vérifiez votre prénom, nom et mot de passe.' };
}

function requireAuth(role) {
  const u = getCurrentUser();
  if (!u) { window.location.href = 'login.html'; return null; }
  if (role && u.role !== role) { window.location.href = 'login.html'; return null; }
  return u;
}

// ---- Etablissement ----
function getEtablissement() { return retrieve('etablissement', null); }
function saveEtablissement(data) { store('etablissement', data); }
function hasEtablissement() { return !!retrieve('etablissement', null); }

// ---- Remplacements CRUD ----
function getReplacements()     { return retrieve('replacements', []); }
function getReplacement(id)    { return getReplacements().find(r => r.id === id) || null; }

function createReplacement(data) {
  const rep = {
    id: genId(),
    site: data.site,
    profile: data.profile,
    startDate: data.startDate,
    endDate: data.endDate,
    notes: data.notes || '',
    status: 'open',
    agentId: null,
    createdBy: data.createdBy,
    createdAt: new Date().toISOString()
  };
  const list = getReplacements();
  list.push(rep);
  store('replacements', list);
  return rep;
}

function updateReplacement(id, changes) {
  const list = getReplacements().map(r => r.id === id ? { ...r, ...changes } : r);
  store('replacements', list);
}

function deleteReplacement(id) {
  store('replacements', getReplacements().filter(r => r.id !== id));
  store('applications', getApplications().filter(a => a.replacementId !== id));
}

// ---- Candidatures (Applications) ----
function getApplications()    { return retrieve('applications', []); }
function getApplication(id)   { return getApplications().find(a => a.id === id) || null; }

function applyForReplacement(replacementId, agentId) {
  const existing = getApplications().find(a => a.replacementId === replacementId && a.agentId === agentId);
  if (existing) return { ok: false, error: 'Vous avez déjà postulé pour ce remplacement.' };
  const rep = getReplacement(replacementId);
  if (!rep || rep.status !== 'open') return { ok: false, error: 'Ce remplacement n\'est plus disponible.' };
  const app = { id: genId(), replacementId, agentId, status: 'pending', createdAt: new Date().toISOString() };
  const list = getApplications();
  list.push(app);
  store('applications', list);
  updateReplacement(replacementId, { status: 'pending' });
  return { ok: true, app };
}

function acceptApplication(appId) {
  const app = getApplication(appId);
  if (!app) return;
  const list = getApplications().map(a => {
    if (a.id === appId) return { ...a, status: 'accepted' };
    if (a.replacementId === app.replacementId && a.id !== appId) return { ...a, status: 'rejected' };
    return a;
  });
  store('applications', list);
  updateReplacement(app.replacementId, { status: 'assigned', agentId: app.agentId });
}

function rejectApplication(appId) {
  const app = getApplication(appId);
  if (!app) return;
  const apps = getApplications();
  const updated = apps.map(a => a.id === appId ? { ...a, status: 'rejected' } : a);
  store('applications', updated);
  const stillPending = updated.some(a => a.replacementId === app.replacementId && a.status === 'pending');
  if (!stillPending) updateReplacement(app.replacementId, { status: 'open', agentId: null });
}

// ---- Agents CRUD ----
function getAgents() { return getUsers().filter(u => u.role === 'agent'); }
function getAdmins() { return getUsers().filter(u => u.role === 'admin'); }

function createAgent(data) {
  const users = getUsers();
  const exists = users.some(u =>
    u.firstName.toLowerCase() === data.firstName.toLowerCase() &&
    u.lastName.toLowerCase() === data.lastName.toLowerCase() &&
    u.role === 'agent'
  );
  if (exists) return { ok: false, error: 'Un agent avec ce nom et prénom existe déjà.' };
  const agent = {
    id: genId(),
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim().toUpperCase(),
    role: 'agent',
    profile: data.profile,
    sites: data.sites || [],
    phone: data.phone || '',
    password: btoa(data.password),
    available: true,
    createdAt: new Date().toISOString()
  };
  users.push(agent);
  store('users', users);
  return { ok: true, agent };
}

function updateAgent(id, changes) {
  const users = getUsers().map(u => u.id === id ? { ...u, ...changes } : u);
  store('users', users);
  const cu = getCurrentUser();
  if (cu && cu.id === id) setCurrentUser({ ...cu, ...changes });
}

function deleteAgent(id) {
  store('users', getUsers().filter(u => u.id !== id));
}

// ---- Formatters ----
function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function formatDateShort(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
function durationLabel(start, end) {
  if (!start || !end) return '';
  const ms = new Date(end) - new Date(start);
  const h = Math.round(ms / 36e5);
  if (h < 24) return h + 'h';
  const d = Math.floor(h / 24);
  const rem = h % 24;
  return rem ? d + 'j ' + rem + 'h' : d + ' jour' + (d > 1 ? 's' : '');
}
function initials(firstName, lastName) {
  return ((firstName || '')[0] || '') + ((lastName || '')[0] || '');
}
function fullName(user) {
  if (!user) return '—';
  return user.firstName + ' ' + user.lastName;
}

// ---- DOM Helpers ----
function $(selector, parent = document) { return parent.querySelector(selector); }
function $$(selector, parent = document) { return [...parent.querySelectorAll(selector)]; }

function qs(id) { return document.getElementById(id); }

function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = {
    success: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
    error:   '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
    info:    '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>'
  };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = (icons[type] || '') + `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all .3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Password toggle widget
function initPasswordToggle(inputId, btnId) {
  const input = qs(inputId);
  const btn = qs(btnId);
  if (!input || !btn) return;
  btn.addEventListener('click', () => {
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.querySelector('.eye-open').classList.toggle('hidden', !isPass);
    btn.querySelector('.eye-closed').classList.toggle('hidden', isPass);
  });
}

// Populate a <select> with options
function populateSelect(selectEl, options, placeholder = '-- Sélectionner --') {
  if (!selectEl) return;
  selectEl.innerHTML = `<option value="">${placeholder}</option>` +
    options.map(o => typeof o === 'string'
      ? `<option value="${o}">${o}</option>`
      : `<option value="${o.value}">${o.label}</option>`
    ).join('');
}

// Eye icon SVG helper (reusable)
const EYE_OPEN_SVG  = `<svg class="eye-open"  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_CLOSE_SVG = `<svg class="eye-closed hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

// Modal open/close
function openModal(id) {
  const m = qs(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = qs(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}
function initModalClose() {
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
  $$('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = btn.closest('.modal-overlay');
      if (m) closeModal(m.id);
    });
  });
}

// Init on every page
document.addEventListener('DOMContentLoaded', () => {
  initData();
  initModalClose();
});
