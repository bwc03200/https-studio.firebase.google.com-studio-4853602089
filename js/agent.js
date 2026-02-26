/* =============================================
   EHPAD-STAFF - agent.js
   Logique de l'espace agent
   ============================================= */

'use strict';

let currentUser = null;

// ---- Navigation ----
const SECTION_TITLES = {
  replacements:    { title: 'Remplacements disponibles',  subtitle: 'Consultez et postulez aux offres' },
  'my-applications': { title: 'Mes candidatures',         subtitle: 'Suivez l\'état de vos réponses' },
  'my-profile':    { title: 'Mon profil',                 subtitle: 'Vos informations personnelles' }
};

function showSection(name, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-agent'));
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active-agent');
  const info = SECTION_TITLES[name] || {};
  document.getElementById('topbar-title').textContent    = info.title || '';
  document.getElementById('topbar-subtitle').textContent = info.subtitle || '';
  renderSection(name);
}

function renderSection(name) {
  if (name === 'replacements')     renderReplacements();
  if (name === 'my-applications')  renderMyApplications();
  if (name === 'my-profile')       renderMyProfile();
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  currentUser = requireAuth('agent');
  if (!currentUser) return;

  const etab = getEtablissement();
  if (etab) document.getElementById('sidebar-etab-name').textContent = etab.name;

  // Sidebar info
  document.getElementById('sidebar-user-name').textContent    = fullName(currentUser);
  document.getElementById('sidebar-user-profile').textContent = currentUser.profile || '—';
  document.getElementById('sidebar-avatar').textContent       = initials(currentUser.firstName, currentUser.lastName);

  // Date
  document.getElementById('current-date-display').textContent =
    new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  // Availability toggle
  updateAvailDisplay();

  // Password toggle in edit profile modal
  initPasswordToggle('ep-pwd', 'toggle-ep-pwd');

  // Initial render
  renderReplacements();
  updateBadges();
});

// ---- Availability ----
function updateAvailDisplay() {
  const u = getUser(currentUser.id) || currentUser;
  const dot   = qs('avail-dot');
  const label = qs('avail-label');
  const btn   = qs('avail-btn');
  if (u.available) {
    dot.className   = 'avail-dot available';
    label.textContent = 'Disponible';
    label.style.color = 'var(--success)';
  } else {
    dot.className   = 'avail-dot unavailable';
    label.textContent = 'Indisponible';
    label.style.color = 'var(--danger)';
  }
}

function toggleAvailability() {
  const u = getUser(currentUser.id) || currentUser;
  updateAgent(currentUser.id, { available: !u.available });
  currentUser = getUser(currentUser.id);
  updateAvailDisplay();
  showToast(currentUser.available ? 'Vous êtes maintenant disponible.' : 'Vous êtes maintenant indisponible.', 'info');
}

// ---- Badges sidebar ----
function updateBadges() {
  const openReps  = getReplacements().filter(r => r.status === 'open').length;
  const myApps    = getApplications().filter(a => a.agentId === currentUser.id && a.status === 'pending').length;

  const openBadge = qs('badge-open-count');
  const pendBadge = qs('badge-pending-count');

  if (openReps > 0) {
    openBadge.textContent = openReps;
    openBadge.style.display = 'inline-flex';
  } else {
    openBadge.style.display = 'none';
  }
  if (myApps > 0) {
    pendBadge.textContent = myApps;
    pendBadge.style.display = 'inline-flex';
  } else {
    pendBadge.style.display = 'none';
  }
}

// ---- REPLACEMENTS ----
function renderReplacements() {
  let reps = getReplacements().filter(r => r.status === 'open');
  const myApps     = getApplications().filter(a => a.agentId === currentUser.id);
  const appliedIds = myApps.map(a => a.replacementId);

  const textF    = (qs('filter-site-text')?.value || '').toLowerCase();
  const profileF = qs('filter-profile')?.value;
  const siteF    = qs('filter-site-select')?.value;
  const dateF    = qs('filter-date')?.value;

  if (textF)    reps = reps.filter(r => r.site.toLowerCase().includes(textF));
  if (siteF === 'mine') reps = reps.filter(r => currentUser.sites && currentUser.sites.includes(r.site));
  else if (siteF) reps = reps.filter(r => r.site === siteF);
  if (profileF === 'mine') reps = reps.filter(r => r.profile === currentUser.profile);
  if (dateF)    reps = reps.filter(r => r.startDate && r.startDate.startsWith(dateF));

  reps = reps.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const grid = qs('replacements-grid');
  if (!reps.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><h3>Aucun remplacement disponible</h3><p>Revenez plus tard ou modifiez vos filtres.</p></div>`;
    return;
  }

  grid.innerHTML = reps.map((r, i) => {
    const hasApplied  = appliedIds.includes(r.id);
    const isMySite    = currentUser.sites && currentUser.sites.includes(r.site);
    const isMyProfile = r.profile === currentUser.profile;
    const urgency     = isUrgent(r.startDate);
    return `<div class="replacement-card status-open animate-fadeIn delay-${Math.min(i % 4 + 1, 4)}" onclick="openRepDetail('${r.id}')">
      <div class="replacement-card-header">
        <div class="replacement-card-title">
          <span class="replacement-card-site">${r.site}</span>
          ${isMySite ? '<span title="Votre site habituel" style="font-size:.75rem;background:#E0F2FE;color:#0369A1;padding:.15rem .5rem;border-radius:999px;font-weight:700;">Mon site</span>' : ''}
          ${isMyProfile ? '<span title="Votre profil" style="font-size:.75rem;background:#F0FDF4;color:#166534;padding:.15rem .5rem;border-radius:999px;font-weight:700;">Mon profil</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:.35rem;">
          ${urgency ? '<span style="font-size:.7rem;background:#FEF2F2;color:#991B1B;padding:.15rem .5rem;border-radius:999px;font-weight:700;letter-spacing:.03em;">URGENT</span>' : ''}
          ${hasApplied ? '<span class="badge badge-pending">Postulé</span>' : '<span class="badge badge-open">Ouvert</span>'}
        </div>
      </div>
      <div class="replacement-card-meta">
        <span>
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
          ${r.profile}
        </span>
        <span>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
          ${formatDateShort(r.startDate)}
        </span>
        <span>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
          ${durationLabel(r.startDate, r.endDate)}
        </span>
      </div>
      <div style="font-size:.8rem;color:var(--text-light);display:flex;align-items:center;gap:.3rem;margin-bottom:.75rem;">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
        ${formatDateTime(r.startDate)} → ${formatDateTime(r.endDate)}
      </div>
      ${r.notes ? `<div style="font-size:.8rem;color:var(--text-med);background:var(--bg-muted);padding:.5rem .75rem;border-radius:var(--radius-sm);margin-bottom:.75rem;">${r.notes}</div>` : ''}
      <div class="replacement-card-actions">
        ${hasApplied
          ? `<button class="btn btn-outline btn-sm" disabled>Déjà postulé</button>`
          : `<button class="btn btn-agent btn-sm" onclick="event.stopPropagation();applyNow('${r.id}')">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
              Je suis disponible
            </button>`
        }
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openRepDetail('${r.id}')">Détails</button>
      </div>
    </div>`;
  }).join('');
}

function isUrgent(startDate) {
  if (!startDate) return false;
  const diff = new Date(startDate) - new Date();
  return diff > 0 && diff < 24 * 60 * 60 * 1000; // < 24h
}

function clearFilters() {
  if(qs('filter-site-text'))   qs('filter-site-text').value = '';
  if(qs('filter-profile'))     qs('filter-profile').value = '';
  if(qs('filter-site-select')) qs('filter-site-select').value = '';
  if(qs('filter-date'))        qs('filter-date').value = '';
  renderReplacements();
}

function applyNow(repId) {
  const result = applyForReplacement(repId, currentUser.id);
  if (result.ok) {
    showToast('Candidature envoyée ! L\'administrateur sera notifié.', 'success');
    renderReplacements();
    updateBadges();
  } else {
    showToast(result.error, 'error');
  }
}

// ---- REPLACEMENT DETAIL ----
function openRepDetail(id) {
  const r = getReplacement(id);
  if (!r) return;
  const myApp     = getApplications().find(a => a.replacementId === id && a.agentId === currentUser.id);
  const hasApplied = !!myApp;
  const st = STATUS_LABELS[r.status] || {};
  const urgency = isUrgent(r.startDate);
  const isMySite    = currentUser.sites && currentUser.sites.includes(r.site);
  const isMyProfile = r.profile === currentUser.profile;

  qs('rep-detail-title').innerHTML = `${r.profile} — ${r.site} <span class="badge ${st.class || ''}" style="margin-left:.5rem;">${st.label}</span>`;
  qs('rep-detail-body').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.25rem;">
      ${urgency ? `<div class="alert alert-danger" style="font-weight:700;"><span class="alert-icon"><svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg></span><span>⚡ Remplacement urgent — dans moins de 24h !</span></div>` : ''}
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
        ${isMySite    ? '<span style="background:#E0F2FE;color:#0369A1;padding:.3rem .8rem;border-radius:999px;font-size:.8rem;font-weight:700;">Votre site habituel</span>' : ''}
        ${isMyProfile ? '<span style="background:#F0FDF4;color:#166534;padding:.3rem .8rem;border-radius:999px;font-size:.8rem;font-weight:700;">Votre profil</span>' : ''}
      </div>
      <div class="grid-2" style="gap:1rem;">
        <div class="card card-sm" style="background:var(--bg-muted);">
          <div style="font-size:.7rem;color:var(--text-light);font-weight:700;text-transform:uppercase;margin-bottom:.2rem;">Site / Unité</div>
          <div style="font-weight:700;">${r.site}</div>
        </div>
        <div class="card card-sm" style="background:var(--bg-muted);">
          <div style="font-size:.7rem;color:var(--text-light);font-weight:700;text-transform:uppercase;margin-bottom:.2rem;">Profil recherché</div>
          <span class="badge badge-profile">${r.profile}</span>
        </div>
        <div class="card card-sm" style="background:var(--bg-muted);">
          <div style="font-size:.7rem;color:var(--text-light);font-weight:700;text-transform:uppercase;margin-bottom:.2rem;">Début</div>
          <div style="font-weight:700;">${formatDateTime(r.startDate)}</div>
        </div>
        <div class="card card-sm" style="background:var(--bg-muted);">
          <div style="font-size:.7rem;color:var(--text-light);font-weight:700;text-transform:uppercase;margin-bottom:.2rem;">Fin</div>
          <div style="font-weight:700;">${formatDateTime(r.endDate)}</div>
        </div>
      </div>
      <div style="background:var(--agent-light);border:1px solid var(--agent-mid);border-radius:var(--radius);padding:.85rem 1rem;">
        <div style="font-size:.8rem;color:var(--agent-dark);font-weight:700;margin-bottom:.2rem;">Durée totale</div>
        <div style="font-size:1.25rem;font-weight:800;color:var(--agent-dark);">${durationLabel(r.startDate, r.endDate)}</div>
      </div>
      ${r.notes ? `<div><div style="font-size:.7rem;color:var(--text-light);font-weight:700;text-transform:uppercase;margin-bottom:.35rem;">Notes</div><div style="font-size:.9rem;background:var(--bg-muted);padding:.75rem;border-radius:var(--radius-sm);">${r.notes}</div></div>` : ''}
      ${hasApplied ? `<div class="alert alert-success"><span class="alert-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg></span><span>Vous avez postulé pour ce remplacement. En attente de réponse de l'administrateur.</span></div>` : ''}
    </div>
  `;
  qs('rep-detail-footer').innerHTML = `
    <button class="btn btn-outline" onclick="closeModal('modal-rep-detail')">Fermer</button>
    ${!hasApplied && r.status === 'open'
      ? `<button class="btn btn-agent btn-lg" onclick="applyNow('${r.id}');closeModal('modal-rep-detail');">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          Je suis disponible — Postuler
        </button>`
      : hasApplied
        ? `<button class="btn btn-outline" disabled>Candidature envoyée</button>`
        : ''
    }
  `;
  openModal('modal-rep-detail');
}

// ---- MY APPLICATIONS ----
function renderMyApplications() {
  const myApps = getApplications()
    .filter(a => a.agentId === currentUser.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const container = qs('my-applications-list');
  if (!myApps.length) {
    container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/></svg><h3>Aucune candidature</h3><p>Vous n'avez pas encore postulé à un remplacement.</p></div>`;
    return;
  }

  const appStatusMap  = { pending:'badge-pending', accepted:'badge-assigned', rejected:'badge-cancelled' };
  const appLabelMap   = { pending:'En attente', accepted:'Acceptée — Confirmé !', rejected:'Non retenue' };
  const appColorMap   = { pending:'var(--warning)', accepted:'var(--success)', rejected:'var(--danger)' };

  container.innerHTML = `<div style="display:flex;flex-direction:column;gap:1rem;">
    ${myApps.map(a => {
      const rep = getReplacement(a.replacementId);
      if (!rep) return '';
      return `<div class="replacement-card status-${rep.status}" onclick="openRepDetail('${rep.id}')">
        <div class="replacement-card-header">
          <div class="replacement-card-title">
            <span class="replacement-card-site">${rep.site}</span>
            <span style="font-weight:600;font-size:.9rem;">${rep.profile}</span>
          </div>
          <span class="badge ${appStatusMap[a.status] || ''}">${appLabelMap[a.status] || a.status}</span>
        </div>
        <div class="replacement-card-meta">
          <span>
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
            ${formatDateTime(rep.startDate)}
          </span>
          <span>
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
            ${durationLabel(rep.startDate, rep.endDate)}
          </span>
          <span style="color:var(--text-light);">Postulé le ${formatDate(a.createdAt)}</span>
        </div>
        ${a.status === 'accepted' ? `
          <div class="alert alert-success" style="margin-top:.5rem;margin-bottom:0;padding:.6rem .9rem;font-size:.85rem;">
            <span class="alert-icon"><svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg></span>
            <span>Vous avez été sélectionné pour ce remplacement. Présentez-vous à l'heure prévue.</span>
          </div>` : ''}
        ${a.status === 'rejected' ? `
          <div style="font-size:.8rem;color:var(--danger);margin-top:.3rem;">Ce remplacement a été pourvu par un autre agent.</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

// ---- MY PROFILE ----
function renderMyProfile() {
  const u = getUser(currentUser.id) || currentUser;
  const myApps     = getApplications().filter(a => a.agentId === u.id);
  const accepted   = myApps.filter(a => a.status === 'accepted').length;
  const pending    = myApps.filter(a => a.status === 'pending').length;

  qs('agent-profile-content').innerHTML = `
    <div class="profile-banner">
      <div class="profile-banner-avatar">${initials(u.firstName, u.lastName)}</div>
      <div>
        <h2>${fullName(u)}</h2>
        <p>${getEtablissement()?.name || 'EHPAD'}</p>
        <div class="profile-banner-badges">
          <span class="profile-banner-badge">${u.profile}</span>
          <span class="profile-banner-badge">${u.available ? 'Disponible' : 'Indisponible'}</span>
          <span class="profile-banner-badge">FPH</span>
        </div>
      </div>
      <div style="margin-left:auto;">
        <button class="btn btn-outline-agent" onclick="openModal('modal-edit-profile');loadEditProfileForm()" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff;">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
          Modifier
        </button>
      </div>
    </div>

    <div class="grid-3" style="gap:1rem;margin-bottom:1.5rem;">
      ${miniStat('Remplacements effectués', accepted, 'var(--success)', 'var(--agent-light)')}
      ${miniStat('Candidatures en attente', pending, 'var(--warning)', 'var(--warning-light)')}
      ${miniStat('Total candidatures', myApps.length, 'var(--primary)', 'var(--primary-light)')}
    </div>

    <div class="grid-2" style="gap:1.5rem;">
      <div class="card">
        <div class="card-header"><h3>Informations</h3></div>
        <div style="display:flex;flex-direction:column;gap:.75rem;font-size:.9rem;">
          <div class="flex justify-between"><span style="color:var(--text-light);">Prénom</span><strong>${u.firstName}</strong></div>
          <div class="flex justify-between"><span style="color:var(--text-light);">Nom</span><strong>${u.lastName}</strong></div>
          <div class="flex justify-between"><span style="color:var(--text-light);">Qualification</span><span class="badge badge-profile">${u.profile}</span></div>
          <div class="flex justify-between"><span style="color:var(--text-light);">Téléphone</span><strong>${u.phone || '—'}</strong></div>
          <div class="flex justify-between items-center">
            <span style="color:var(--text-light);">Disponibilité</span>
            <div style="display:flex;align-items:center;gap:.4rem;">
              <div class="avail-dot ${u.available ? 'available':'unavailable'}"></div>
              <strong style="color:${u.available ? 'var(--success)':'var(--danger)'};">${u.available ? 'Disponible':'Indisponible'}</strong>
            </div>
          </div>
        </div>
        <div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap;">
          <button class="btn btn-outline-agent btn-sm" onclick="openModal('modal-edit-profile');loadEditProfileForm()">Modifier</button>
          <button class="btn btn-outline btn-sm" onclick="toggleAvailability()">Changer disponibilité</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Mes sites habituels</h3></div>
        <div style="display:flex;flex-wrap:wrap;gap:.5rem;">
          ${(u.sites || []).length
            ? u.sites.map(s => `<span class="badge" style="background:var(--agent-light);color:var(--agent-dark);border:1px solid var(--agent-mid);">${s}</span>`).join('')
            : '<span style="color:var(--text-light);font-size:.875rem;">Aucun site renseigné</span>'}
        </div>
      </div>
    </div>
  `;
}

function miniStat(label, value, color, bg) {
  return `<div class="stat-card"><div class="stat-card-value" style="color:${color};font-size:1.75rem;">${value}</div><div class="stat-card-label">${label}</div></div>`;
}

// ---- EDIT PROFILE ----
function loadEditProfileForm() {
  const u = getUser(currentUser.id) || currentUser;
  qs('ep-phone').value = u.phone || '';

  // Build site grid
  const grid = qs('ep-sites-grid');
  grid.innerHTML = SITES.map(site => {
    const checked = (u.sites || []).includes(site);
    return `<label class="site-checkbox-item ${checked ? 'checked' : ''}" data-site="${site}" onclick="toggleSiteCheckAgent(this)">
      <svg class="site-check-icon" viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
      ${site}
    </label>`;
  }).join('');
}

function toggleSiteCheckAgent(el) {
  el.classList.toggle('checked');
}

function submitEditProfile() {
  const phone = qs('ep-phone').value.trim();
  const pwd   = qs('ep-pwd').value;
  const sites = [...document.querySelectorAll('#ep-sites-grid .checked')].map(el => el.dataset.site);
  const errEl = qs('edit-profile-error');

  const changes = { phone, sites };
  if (pwd) {
    if (pwd.length < 6) {
      errEl.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
      errEl.classList.remove('hidden'); return;
    }
    changes.password = btoa(pwd);
  }
  errEl.classList.add('hidden');
  updateAgent(currentUser.id, changes);
  currentUser = getUser(currentUser.id);
  closeModal('modal-edit-profile');
  showToast('Profil mis à jour !', 'success');
  renderMyProfile();
}
