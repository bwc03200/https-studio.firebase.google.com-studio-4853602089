/* =============================================
   EHPAD-STAFF - admin.js
   Logique du tableau de bord administrateur
   ============================================= */

'use strict';

let currentUser = null;

// ---- Navigation ----
const SECTION_TITLES = {
  dashboard:    { title: 'Tableau de bord',          subtitle: 'Vue d\'ensemble des remplacements' },
  replacements: { title: 'Gestion des remplacements', subtitle: 'Créez et suivez tous les besoins de remplacement' },
  agents:       { title: 'Gestion des agents',        subtitle: 'Annuaire du personnel disponible' },
  applications: { title: 'Candidatures reçues',       subtitle: 'Gérez les réponses des agents' },
  profile:      { title: 'Mon profil',                subtitle: 'Informations de votre compte' }
};

function showSection(name, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-admin'));
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active-admin');
  const info = SECTION_TITLES[name] || {};
  document.getElementById('topbar-title').textContent    = info.title || '';
  document.getElementById('topbar-subtitle').textContent = info.subtitle || '';
  renderSection(name);
}

function renderSection(name) {
  if (name === 'dashboard')    { renderDashboard(); }
  if (name === 'replacements') { renderReplacementsTable(); }
  if (name === 'agents')       { renderAgentsList(); }
  if (name === 'applications') { renderApplicationsTable(); }
  if (name === 'profile')      { renderAdminProfile(); }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  currentUser = requireAuth('admin');
  if (!currentUser) return;

  // Etab name
  const etab = getEtablissement();
  if (etab) {
    document.getElementById('sidebar-etab-name').textContent = etab.name;
  }

  // Sidebar user
  document.getElementById('sidebar-user-name').textContent = fullName(currentUser);
  document.getElementById('sidebar-avatar').textContent    = initials(currentUser.firstName, currentUser.lastName);

  // Date
  document.getElementById('current-date-display').textContent =
    new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  // Populate selects
  populateSelect(qs('rep-site'),           SITES,    '— Sélectionner le site —');
  populateSelect(qs('rep-profile'),        PROFILES, '— Sélectionner le profil —');
  populateSelect(qs('filter-rep-site'),    SITES,    'Tous les sites');
  populateSelect(qs('filter-rep-profile'), PROFILES, 'Tous les profils');
  populateSelect(qs('filter-agent-profile'),PROFILES,'Tous les profils');
  populateSelect(qs('filter-agent-site'),  SITES,    'Tous les sites');
  populateSelect(qs('filter-app-site'),    SITES,    'Tous les sites');
  populateSelect(qs('na-profile'),         PROFILES, '— Sélectionner —');

  // Sites grid pour nouveau agent
  buildSiteGrid('na-sites-grid', [], 'checked-admin');

  // Password toggle
  initPasswordToggle('na-pwd', 'toggle-na-pwd');

  // Duration preview
  qs('rep-start').addEventListener('change', updateDurationPreview);
  qs('rep-end').addEventListener('change',   updateDurationPreview);

  // Render initial section
  renderDashboard();
});

// ---- Duration preview ----
function updateDurationPreview() {
  const start = qs('rep-start').value;
  const end   = qs('rep-end').value;
  const prev  = qs('duration-preview');
  if (start && end) {
    const dur = durationLabel(start, end);
    if (dur) {
      qs('duration-text').textContent = 'Durée du remplacement : ' + dur +
        ' (' + formatDateTime(start) + ' → ' + formatDateTime(end) + ')';
      prev.classList.remove('hidden');
      prev.style.display = 'flex';
    }
  } else {
    prev.classList.add('hidden');
  }
}

// ---- Site grid builder ----
function buildSiteGrid(containerId, selectedSites, activeClass = 'checked') {
  const container = qs(containerId);
  if (!container) return;
  container.innerHTML = SITES.map(site => {
    const isChecked = selectedSites.includes(site);
    return `<label class="site-checkbox-item ${isChecked ? activeClass : ''}" data-site="${site}" onclick="toggleSiteCheck(this, '${activeClass}')">
      <svg class="site-check-icon" viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
      ${site}
    </label>`;
  }).join('');
}

function toggleSiteCheck(el, activeClass) {
  el.classList.toggle(activeClass);
}

function getSelectedSites(containerId, activeClass = 'checked') {
  return $$('.' + activeClass, qs(containerId)).map(el => el.dataset.site);
}

// ---- DASHBOARD ----
function renderDashboard() {
  const reps = getReplacements();
  const apps = getApplications();
  const agents = getAgents();

  const open      = reps.filter(r => r.status === 'open').length;
  const pending   = reps.filter(r => r.status === 'pending').length;
  const assigned  = reps.filter(r => r.status === 'assigned').length;
  const available = agents.filter(a => a.available).length;

  const statsGrid = qs('stats-grid');
  statsGrid.innerHTML = `
    ${statCard('Remplacements ouverts', open, '#3B82F6', '#EFF6FF', calendarIcon())}
    ${statCard('En attente', pending, '#F59E0B', '#FFFBEB', clockIcon())}
    ${statCard('Postes pourvus', assigned, '#10B981', '#ECFDF5', checkIcon())}
    ${statCard('Agents disponibles', available, '#7C3AED', '#F5F3FF', usersIcon())}
  `;

  // Open replacements list
  const openReps = reps.filter(r => r.status === 'open' || r.status === 'pending').slice(0, 5);
  const dashRepList = qs('dash-replacements-list');
  if (openReps.length === 0) {
    dashRepList.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><h3>Aucun remplacement ouvert</h3><p>Créez un besoin pour commencer.</p></div>`;
  } else {
    dashRepList.innerHTML = openReps.map(r => repMiniCard(r)).join('');
  }

  // Pending applications
  const pendingApps = apps.filter(a => a.status === 'pending').slice(0, 5);
  const dashAppList = qs('dash-applications-list');
  if (pendingApps.length === 0) {
    dashAppList.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/></svg><h3>Aucune candidature en attente</h3><p>Les réponses des agents apparaîtront ici.</p></div>`;
  } else {
    dashAppList.innerHTML = pendingApps.map(a => appMiniCard(a)).join('');
  }
}

function statCard(label, value, color, bg, iconSvg) {
  return `<div class="stat-card animate-fadeIn">
    <div class="stat-card-icon" style="background:${bg};color:${color};">${iconSvg}</div>
    <div class="stat-card-value" style="color:${color};">${value}</div>
    <div class="stat-card-label">${label}</div>
  </div>`;
}

function repMiniCard(r) {
  const st = STATUS_LABELS[r.status] || {};
  return `<div class="agent-list-item" style="cursor:pointer;" onclick="openRepDetail('${r.id}')">
    <div style="width:8px;height:8px;border-radius:50%;background:${statusColor(r.status)};flex-shrink:0;"></div>
    <div style="flex:1;">
      <div style="font-weight:700;font-size:.875rem;">${r.profile} — <span style="color:var(--primary-dark);">${r.site}</span></div>
      <div style="font-size:.8rem;color:var(--text-light);">${formatDateTime(r.startDate)} → ${formatDateTime(r.endDate)}</div>
    </div>
    <span class="badge ${st.class || ''}">${st.label || r.status}</span>
  </div>`;
}

function appMiniCard(a) {
  const rep   = getReplacement(a.replacementId);
  const agent = getUser(a.agentId);
  if (!rep || !agent) return '';
  return `<div class="agent-list-item" style="cursor:pointer;" onclick="handleApp('${a.id}')">
    <div class="agent-avatar" style="width:32px;height:32px;font-size:.75rem;">${initials(agent.firstName, agent.lastName)}</div>
    <div style="flex:1;">
      <div style="font-weight:700;font-size:.875rem;">${fullName(agent)}</div>
      <div style="font-size:.8rem;color:var(--text-light);">${rep.profile} — ${rep.site}</div>
    </div>
    <div style="display:flex;gap:.4rem;">
      <button class="btn btn-agent btn-sm" onclick="event.stopPropagation();acceptApp('${a.id}')">✓</button>
      <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();rejectApp('${a.id}')">✗</button>
    </div>
  </div>`;
}

function statusColor(status) {
  const map = { open:'#3B82F6', pending:'#F59E0B', assigned:'#10B981', cancelled:'#EF4444' };
  return map[status] || '#94A3B8';
}

// Icons helpers
function calendarIcon() { return `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>`; }
function clockIcon()    { return `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>`; }
function checkIcon()    { return `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`; }
function usersIcon()    { return `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>`; }

// ---- REPLACEMENTS TABLE ----
function renderReplacementsTable() {
  let reps = getReplacements();
  const statusF  = qs('filter-rep-status')?.value;
  const siteF    = qs('filter-rep-site')?.value;
  const profileF = qs('filter-rep-profile')?.value;
  const dateF    = qs('filter-rep-date')?.value;

  if (statusF)  reps = reps.filter(r => r.status === statusF);
  if (siteF)    reps = reps.filter(r => r.site === siteF);
  if (profileF) reps = reps.filter(r => r.profile === profileF);
  if (dateF)    reps = reps.filter(r => r.startDate && r.startDate.startsWith(dateF));

  reps = reps.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const wrapper = qs('replacements-table-wrapper');
  if (!reps.length) {
    wrapper.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><h3>Aucun remplacement trouvé</h3><p>Modifiez vos filtres ou créez un nouveau besoin.</p></div>`;
    return;
  }

  const apps = getApplications();
  wrapper.innerHTML = `<table>
    <thead><tr>
      <th>Site</th><th>Profil</th><th>Début</th><th>Fin</th><th>Durée</th><th>Candidatures</th><th>Statut</th><th>Actions</th>
    </tr></thead>
    <tbody>
      ${reps.map(r => {
        const st = STATUS_LABELS[r.status] || {};
        const appCount = apps.filter(a => a.replacementId === r.id && a.status === 'pending').length;
        const assignedAgent = r.agentId ? getUser(r.agentId) : null;
        return `<tr>
          <td><span class="replacement-card-site">${r.site}</span></td>
          <td><span class="badge badge-profile">${r.profile}</span></td>
          <td style="white-space:nowrap;">${formatDateTime(r.startDate)}</td>
          <td style="white-space:nowrap;">${formatDateTime(r.endDate)}</td>
          <td>${durationLabel(r.startDate, r.endDate)}</td>
          <td>
            ${assignedAgent
              ? `<span style="font-size:.8rem;color:var(--success);font-weight:600;">✓ ${fullName(assignedAgent)}</span>`
              : appCount > 0
                ? `<button class="btn btn-outline-admin btn-sm" onclick="showSection('applications', document.querySelector('[data-section=applications]'))">${appCount} en attente</button>`
                : '<span style="color:var(--text-light);font-size:.8rem;">—</span>'
            }
          </td>
          <td><span class="badge ${st.class || ''}">${st.label || r.status}</span></td>
          <td>
            <div style="display:flex;gap:.35rem;">
              <button class="btn btn-outline btn-sm" onclick="openRepDetail('${r.id}')" title="Détails">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>
              </button>
              ${r.status !== 'cancelled' && r.status !== 'assigned' ? `
              <button class="btn btn-danger btn-sm" onclick="cancelRep('${r.id}')" title="Annuler">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
              </button>` : ''}
            </div>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function clearRepFilters() {
  if(qs('filter-rep-status'))  qs('filter-rep-status').value  = '';
  if(qs('filter-rep-site'))    qs('filter-rep-site').value    = '';
  if(qs('filter-rep-profile')) qs('filter-rep-profile').value = '';
  if(qs('filter-rep-date'))    qs('filter-rep-date').value    = '';
  renderReplacementsTable();
}

function cancelRep(id) {
  if (!confirm('Annuler ce remplacement ? Cette action est irréversible.')) return;
  updateReplacement(id, { status: 'cancelled' });
  showToast('Remplacement annulé.', 'info');
  renderSection('replacements');
}

// ---- REPLACEMENT DETAIL MODAL ----
function openRepDetail(id) {
  const r = getReplacement(id);
  if (!r) return;
  const st = STATUS_LABELS[r.status] || {};
  const assignedAgent = r.agentId ? getUser(r.agentId) : null;
  const apps = getApplications().filter(a => a.replacementId === id);

  qs('rep-detail-title').innerHTML = `${r.profile} — ${r.site} <span class="badge ${st.class || ''}" style="margin-left:.5rem;">${st.label}</span>`;
  qs('rep-detail-body').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.25rem;">
      <div class="grid-2" style="gap:1rem;">
        <div class="card card-sm" style="background:var(--bg-muted);">
          <div style="font-size:.75rem;color:var(--text-light);text-transform:uppercase;font-weight:700;margin-bottom:.25rem;">Site</div>
          <div style="font-weight:700;">${r.site}</div>
        </div>
        <div class="card card-sm" style="background:var(--bg-muted);">
          <div style="font-size:.75rem;color:var(--text-light);text-transform:uppercase;font-weight:700;margin-bottom:.25rem;">Profil recherché</div>
          <div><span class="badge badge-profile">${r.profile}</span></div>
        </div>
        <div class="card card-sm" style="background:var(--bg-muted);">
          <div style="font-size:.75rem;color:var(--text-light);text-transform:uppercase;font-weight:700;margin-bottom:.25rem;">Début</div>
          <div style="font-weight:600;">${formatDateTime(r.startDate)}</div>
        </div>
        <div class="card card-sm" style="background:var(--bg-muted);">
          <div style="font-size:.75rem;color:var(--text-light);text-transform:uppercase;font-weight:700;margin-bottom:.25rem;">Fin</div>
          <div style="font-weight:600;">${formatDateTime(r.endDate)}</div>
        </div>
      </div>
      <div>
        <div style="font-size:.75rem;color:var(--text-light);text-transform:uppercase;font-weight:700;margin-bottom:.35rem;">Durée</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--primary);">${durationLabel(r.startDate, r.endDate)}</div>
      </div>
      ${r.notes ? `<div><div style="font-size:.75rem;color:var(--text-light);text-transform:uppercase;font-weight:700;margin-bottom:.35rem;">Notes</div><div style="font-size:.9rem;">${r.notes}</div></div>` : ''}
      ${assignedAgent ? `
        <div class="alert alert-success"><span class="alert-icon">${checkIcon()}</span><span>Poste pourvu par <strong>${fullName(assignedAgent)}</strong></span></div>
      ` : ''}
      ${apps.length > 0 ? `
        <div>
          <div style="font-size:.75rem;color:var(--text-light);text-transform:uppercase;font-weight:700;margin-bottom:.75rem;">Candidatures (${apps.length})</div>
          <div style="display:flex;flex-direction:column;gap:.5rem;">
            ${apps.map(a => {
              const ag = getUser(a.agentId);
              if (!ag) return '';
              const appStatusMap = { pending:'badge-pending', accepted:'badge-assigned', rejected:'badge-cancelled' };
              const appLabelMap  = { pending:'En attente', accepted:'Acceptée', rejected:'Refusée' };
              return `<div class="agent-list-item">
                <div class="agent-avatar" style="width:36px;height:36px;font-size:.8rem;">${initials(ag.firstName, ag.lastName)}</div>
                <div style="flex:1;">
                  <div style="font-weight:700;font-size:.875rem;">${fullName(ag)}</div>
                  <div style="font-size:.8rem;color:var(--text-light);">${ag.profile} — ${ag.phone || 'Sans tél.'}</div>
                </div>
                <span class="badge ${appStatusMap[a.status] || ''}">${appLabelMap[a.status] || a.status}</span>
                ${a.status === 'pending' ? `
                  <div style="display:flex;gap:.35rem;margin-left:.5rem;">
                    <button class="btn btn-agent btn-sm" onclick="acceptApp('${a.id}');closeModal('modal-rep-detail');renderDashboard();renderReplacementsTable();" title="Accepter">✓ Accepter</button>
                    <button class="btn btn-danger btn-sm" onclick="rejectApp('${a.id}');openRepDetail('${id}');" title="Refuser">✗</button>
                  </div>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>
      ` : `<div class="empty-state" style="padding:1rem;"><p>Aucune candidature pour ce remplacement.</p></div>`}
    </div>
  `;
  qs('rep-detail-footer').innerHTML = `
    <button class="btn btn-outline" onclick="closeModal('modal-rep-detail')">Fermer</button>
    ${r.status !== 'cancelled' && r.status !== 'assigned' ? `<button class="btn btn-danger" onclick="cancelRep('${r.id}');closeModal('modal-rep-detail');">Annuler le remplacement</button>` : ''}
  `;
  openModal('modal-rep-detail');
}

// ---- NEW REPLACEMENT ----
function submitNewReplacement() {
  const site    = qs('rep-site').value;
  const profile = qs('rep-profile').value;
  const start   = qs('rep-start').value;
  const end     = qs('rep-end').value;
  const notes   = qs('rep-notes').value;
  const errEl   = qs('new-rep-error');

  if (!site || !profile || !start || !end) {
    errEl.textContent = 'Veuillez remplir tous les champs obligatoires.';
    errEl.classList.remove('hidden'); return;
  }
  if (new Date(end) <= new Date(start)) {
    errEl.textContent = 'La date de fin doit être postérieure à la date de début.';
    errEl.classList.remove('hidden'); return;
  }
  errEl.classList.add('hidden');

  createReplacement({ site, profile, startDate: start, endDate: end, notes, createdBy: currentUser.id });
  closeModal('modal-new-replacement');
  // Reset form
  qs('form-new-replacement').reset();
  qs('duration-preview').classList.add('hidden');
  showToast('Remplacement publié avec succès !', 'success');
  showSection('replacements', document.querySelector('[data-section=replacements]'));
}

// ---- AGENTS LIST ----
function renderAgentsList() {
  let agents = getAgents();
  const nameF    = qs('filter-agent-name')?.value.toLowerCase() || '';
  const profileF = qs('filter-agent-profile')?.value;
  const siteF    = qs('filter-agent-site')?.value;
  const availF   = qs('filter-agent-avail')?.value;

  if (nameF)    agents = agents.filter(a => fullName(a).toLowerCase().includes(nameF));
  if (profileF) agents = agents.filter(a => a.profile === profileF);
  if (siteF)    agents = agents.filter(a => a.sites && a.sites.includes(siteF));
  if (availF !== '') agents = agents.filter(a => String(a.available) === availF);

  const container = qs('agents-list-container');
  if (!agents.length) {
    container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><h3>Aucun agent trouvé</h3><p>Modifiez vos filtres ou ajoutez un agent.</p></div>`;
    return;
  }

  // Group by profile
  const byProfile = {};
  agents.forEach(a => {
    if (!byProfile[a.profile]) byProfile[a.profile] = [];
    byProfile[a.profile].push(a);
  });

  container.innerHTML = Object.entries(byProfile).map(([profile, list]) => `
    <div style="margin-bottom:1.5rem;">
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;">
        <span class="badge badge-profile" style="font-size:.8rem;">${profile}</span>
        <span style="font-size:.8rem;color:var(--text-light);">${list.length} agent${list.length > 1 ? 's' : ''}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:.5rem;">
        ${list.map(a => agentCard(a)).join('')}
      </div>
    </div>
  `).join('');
}

function agentCard(a) {
  return `<div class="agent-list-item" style="cursor:pointer;" onclick="openAgentDetail('${a.id}')">
    <div class="agent-avatar">${initials(a.firstName, a.lastName)}</div>
    <div class="agent-info">
      <h4>${fullName(a)}</h4>
      <p>${a.phone || 'Pas de téléphone'}</p>
      <div class="agent-sites">
        ${(a.sites || []).slice(0,3).map(s => `<span class="site-chip">${s}</span>`).join('')}
        ${(a.sites || []).length > 3 ? `<span class="site-chip">+${a.sites.length - 3}</span>` : ''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.35rem;">
      <div style="display:flex;align-items:center;gap:.3rem;">
        <div class="avail-dot ${a.available ? 'available' : 'unavailable'}"></div>
        <span style="font-size:.75rem;color:${a.available ? 'var(--success)' : 'var(--danger)'};">${a.available ? 'Disponible' : 'Indisponible'}</span>
      </div>
    </div>
  </div>`;
}

// ---- AGENT DETAIL ----
function openAgentDetail(id) {
  const a = getUser(id);
  if (!a) return;
  const myApps = getApplications().filter(ap => ap.agentId === id);
  const accepted = myApps.filter(ap => ap.status === 'accepted').length;

  qs('agent-detail-body').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.25rem;">
      <div style="display:flex;align-items:center;gap:1rem;">
        <div class="agent-avatar" style="width:60px;height:60px;font-size:1.3rem;font-weight:800;">${initials(a.firstName, a.lastName)}</div>
        <div>
          <h2 style="margin:0;font-size:1.25rem;">${fullName(a)}</h2>
          <span class="badge badge-profile" style="margin-top:.3rem;">${a.profile}</span>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:.4rem;">
          <div class="avail-dot ${a.available ? 'available' : 'unavailable'}"></div>
          <span style="font-size:.85rem;font-weight:600;color:${a.available ? 'var(--success)':'var(--danger)'};">${a.available ? 'Disponible':'Indisponible'}</span>
        </div>
      </div>
      <div class="grid-2" style="gap:.75rem;">
        <div class="card card-sm" style="background:var(--bg-muted);">
          <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:700;">Téléphone</div>
          <div style="font-weight:600;">${a.phone || '—'}</div>
        </div>
        <div class="card card-sm" style="background:var(--bg-muted);">
          <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:700;">Remplacements effectués</div>
          <div style="font-weight:700;color:var(--success);">${accepted}</div>
        </div>
      </div>
      <div>
        <div style="font-size:.75rem;color:var(--text-light);text-transform:uppercase;font-weight:700;margin-bottom:.5rem;">Sites habituels</div>
        <div style="display:flex;flex-wrap:wrap;gap:.35rem;">
          ${(a.sites || []).length ? a.sites.map(s => `<span class="site-chip">${s}</span>`).join('') : '<span style="color:var(--text-light);font-size:.85rem;">Aucun site renseigné</span>'}
        </div>
      </div>
      <div style="font-size:.8rem;color:var(--text-light);">Compte créé le ${formatDate(a.createdAt)}</div>
    </div>
  `;
  qs('agent-detail-footer').innerHTML = `
    <button class="btn btn-outline" onclick="closeModal('modal-agent-detail')">Fermer</button>
    <button class="btn btn-outline-admin" onclick="toggleAgentAvail('${id}')">
      ${a.available ? 'Marquer indisponible' : 'Marquer disponible'}
    </button>
    <button class="btn btn-danger" onclick="if(confirm('Supprimer cet agent ?')){deleteAgent('${id}');closeModal('modal-agent-detail');renderAgentsList();showToast('Agent supprimé.','info');}">
      Supprimer
    </button>
  `;
  openModal('modal-agent-detail');
}

function toggleAgentAvail(id) {
  const a = getUser(id);
  if (!a) return;
  updateAgent(id, { available: !a.available });
  closeModal('modal-agent-detail');
  renderAgentsList();
  showToast(`Agent marqué ${!a.available ? 'disponible' : 'indisponible'}.`, 'info');
}

// ---- NEW AGENT ----
function submitNewAgent() {
  const fn      = qs('na-firstname').value.trim();
  const ln      = qs('na-lastname').value.trim();
  const profile = qs('na-profile').value;
  const phone   = qs('na-phone').value.trim();
  const pwd     = qs('na-pwd').value;
  const sites   = getSelectedSites('na-sites-grid', 'checked-admin');
  const errEl   = qs('new-agent-error');

  if (!fn || !ln || !profile || !pwd) {
    errEl.textContent = 'Veuillez remplir tous les champs obligatoires (*)';
    errEl.classList.remove('hidden'); return;
  }
  if (pwd.length < 6) {
    errEl.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
    errEl.classList.remove('hidden'); return;
  }
  errEl.classList.add('hidden');

  const result = createAgent({ firstName: fn, lastName: ln, profile, phone, sites, password: pwd });
  if (!result.ok) {
    errEl.textContent = result.error;
    errEl.classList.remove('hidden'); return;
  }
  closeModal('modal-new-agent');
  qs('form-new-agent').reset();
  buildSiteGrid('na-sites-grid', [], 'checked-admin');
  showToast('Agent créé avec succès !', 'success');
  renderAgentsList();
}

// ---- APPLICATIONS TABLE ----
function renderApplicationsTable() {
  let apps = getApplications();
  const statusF = qs('filter-app-status')?.value;
  const siteF   = qs('filter-app-site')?.value;

  if (statusF) apps = apps.filter(a => a.status === statusF);
  if (siteF) {
    apps = apps.filter(a => {
      const r = getReplacement(a.replacementId);
      return r && r.site === siteF;
    });
  }
  apps = apps.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const wrapper = qs('applications-table-wrapper');
  if (!apps.length) {
    wrapper.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/></svg><h3>Aucune candidature trouvée</h3><p>Les candidatures des agents apparaîtront ici.</p></div>`;
    return;
  }

  const appStatusMap = { pending:'badge-pending', accepted:'badge-assigned', rejected:'badge-cancelled' };
  const appLabelMap  = { pending:'En attente', accepted:'Acceptée', rejected:'Refusée' };
  wrapper.innerHTML = `<table>
    <thead><tr><th>Agent</th><th>Profil</th><th>Site</th><th>Période</th><th>Candidature</th><th>Statut</th><th>Actions</th></tr></thead>
    <tbody>
      ${apps.map(a => {
        const ag  = getUser(a.agentId);
        const rep = getReplacement(a.replacementId);
        if (!ag || !rep) return '';
        return `<tr>
          <td>
            <div style="display:flex;align-items:center;gap:.6rem;">
              <div class="agent-avatar" style="width:32px;height:32px;font-size:.75rem;">${initials(ag.firstName, ag.lastName)}</div>
              <div>
                <div style="font-weight:700;font-size:.875rem;">${fullName(ag)}</div>
                <div style="font-size:.75rem;color:var(--text-light);">${ag.phone || '—'}</div>
              </div>
            </div>
          </td>
          <td><span class="badge badge-profile">${rep.profile}</span></td>
          <td><span class="replacement-card-site">${rep.site}</span></td>
          <td style="font-size:.8rem;white-space:nowrap;">${formatDateTime(rep.startDate)}<br>${formatDateTime(rep.endDate)}</td>
          <td style="font-size:.8rem;color:var(--text-light);">${formatDate(a.createdAt)}</td>
          <td><span class="badge ${appStatusMap[a.status] || ''}">${appLabelMap[a.status] || a.status}</span></td>
          <td>
            ${a.status === 'pending' ? `
              <div style="display:flex;gap:.35rem;">
                <button class="btn btn-agent btn-sm" onclick="acceptApp('${a.id}')">✓ Accepter</button>
                <button class="btn btn-danger btn-sm" onclick="rejectApp('${a.id}')">✗ Refuser</button>
              </div>` : '<span style="color:var(--text-light);font-size:.8rem;">—</span>'
            }
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function acceptApp(id) {
  acceptApplication(id);
  showToast('Candidature acceptée ! Agent assigné au remplacement.', 'success');
  renderDashboard();
  renderApplicationsTable();
  renderReplacementsTable();
}

function rejectApp(id) {
  rejectApplication(id);
  showToast('Candidature refusée.', 'info');
  renderDashboard();
  renderApplicationsTable();
}

function handleApp(id) {
  const a = getApplication(id);
  if (!a) return;
  openRepDetail(a.replacementId);
}

// ---- ADMIN PROFILE ----
function renderAdminProfile() {
  const etab = getEtablissement();
  qs('admin-profile-content').innerHTML = `
    <div class="profile-banner profile-banner-admin">
      <div class="profile-banner-avatar">${initials(currentUser.firstName, currentUser.lastName)}</div>
      <div>
        <h2>${fullName(currentUser)}</h2>
        <p>${etab ? etab.name : 'EHPAD'}</p>
        <div class="profile-banner-badges">
          <span class="profile-banner-badge">Administrateur de garde</span>
          <span class="profile-banner-badge">FPH</span>
        </div>
      </div>
    </div>

    <div class="grid-2" style="gap:1.5rem;">
      <div class="card">
        <div class="card-header"><h3>Informations du compte</h3></div>
        <div style="display:flex;flex-direction:column;gap:.75rem;font-size:.9rem;">
          <div class="flex justify-between"><span style="color:var(--text-light);">Prénom</span><strong>${currentUser.firstName}</strong></div>
          <div class="flex justify-between"><span style="color:var(--text-light);">Nom</span><strong>${currentUser.lastName}</strong></div>
          <div class="flex justify-between"><span style="color:var(--text-light);">Rôle</span><span class="badge badge-admin">Administrateur</span></div>
          <div class="flex justify-between"><span style="color:var(--text-light);">Compte créé le</span><strong>${formatDate(currentUser.createdAt)}</strong></div>
        </div>
      </div>

      ${etab ? `<div class="card">
        <div class="card-header"><h3>Établissement</h3></div>
        <div style="display:flex;flex-direction:column;gap:.75rem;font-size:.9rem;">
          <div class="flex justify-between"><span style="color:var(--text-light);">Nom</span><strong>${etab.name}</strong></div>
          <div class="flex justify-between"><span style="color:var(--text-light);">Directeur·trice</span><strong>${etab.director}</strong></div>
          <div class="flex justify-between"><span style="color:var(--text-light);">Adresse</span><strong>${etab.address}, ${etab.postalCode} ${etab.city}</strong></div>
          ${etab.phone ? `<div class="flex justify-between"><span style="color:var(--text-light);">Téléphone</span><strong>${etab.phone}</strong></div>` : ''}
          ${etab.finess ? `<div class="flex justify-between"><span style="color:var(--text-light);">FINESS</span><strong>${etab.finess}</strong></div>` : ''}
        </div>
        <button class="btn btn-outline-admin btn-sm" style="margin-top:1rem;" onclick="window.location.href='index.html'">Modifier le profil établissement</button>
      </div>` : ''}
    </div>

    <div class="card" style="margin-top:1.5rem;">
      <div class="card-header"><h3>Changer mon mot de passe</h3></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;max-width:600px;">
        <div class="form-group">
          <label class="form-label">Nouveau mot de passe</label>
          <div class="password-wrapper">
            <input type="password" id="chg-pwd" class="form-input" placeholder="Min. 6 caractères"/>
            <button type="button" class="password-toggle" id="toggle-chg-pwd">
              <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg class="eye-closed hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Confirmer</label>
          <div class="password-wrapper">
            <input type="password" id="chg-pwd2" class="form-input" placeholder="Répéter"/>
            <button type="button" class="password-toggle" id="toggle-chg-pwd2">
              <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg class="eye-closed hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
        </div>
      </div>
      <button class="btn btn-admin btn-sm" style="margin-top:1rem;" onclick="changeAdminPwd()">Mettre à jour</button>
    </div>
  `;
  initPasswordToggle('chg-pwd',  'toggle-chg-pwd');
  initPasswordToggle('chg-pwd2', 'toggle-chg-pwd2');
}

function changeAdminPwd() {
  const p1 = qs('chg-pwd').value;
  const p2 = qs('chg-pwd2').value;
  if (!p1) return showToast('Saisissez un mot de passe.', 'error');
  if (p1.length < 6) return showToast('Minimum 6 caractères.', 'error');
  if (p1 !== p2) return showToast('Les mots de passe ne correspondent pas.', 'error');
  updateAgent(currentUser.id, { password: btoa(p1) });
  qs('chg-pwd').value = '';
  qs('chg-pwd2').value = '';
  showToast('Mot de passe mis à jour !', 'success');
}
