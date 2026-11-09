/**
 * EPIA Fertility - Frontend Application Logic
 * Implements:
 * - Patient CRUD & Search
 * - AI Follow-Up Draft Generation
 * - Staff Review, In-line Editing & Approval Workflow
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const headerTodayDate = document.getElementById('headerTodayDate');
  const statTotal = document.getElementById('statTotal');
  const statDueToday = document.getElementById('statDueToday');
  const statPendingApproval = document.getElementById('statPendingApproval');
  const statCompleted = document.getElementById('statCompleted');

  const dueDateFilter = document.getElementById('dueDateFilter');
  const btnRefreshDue = document.getElementById('btnRefreshDue');
  const duePatientsContainer = document.getElementById('duePatientsContainer');

  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const btnRefreshAll = document.getElementById('btnRefreshAll');
  const patientsTableBody = document.getElementById('patientsTableBody');

  const btnOpenAddModal = document.getElementById('btnOpenAddModal');
  const btnCloseAddModal = document.getElementById('btnCloseAddModal');
  const btnCancelAdd = document.getElementById('btnCancelAdd');
  const addPatientModal = document.getElementById('addPatientModal');
  const addPatientForm = document.getElementById('addPatientForm');
  const formErrorBox = document.getElementById('formErrorBox');
  const btnSeedDemo = document.getElementById('btnSeedDemo');

  // Default date setup (Today in YYYY-MM-DD)
  const today = new Date();
  const todayStr = formatDate(today);
  headerTodayDate.textContent = today.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  dueDateFilter.value = todayStr;

  // Initialize data
  loadStats();
  loadDuePatients();
  loadAllPatients();

  // Event Listeners
  btnRefreshDue.addEventListener('click', loadDuePatients);
  dueDateFilter.addEventListener('change', loadDuePatients);

  btnRefreshAll.addEventListener('click', loadAllPatients);
  statusFilter.addEventListener('change', loadAllPatients);
  searchInput.addEventListener('input', debounce(loadAllPatients, 300));

  btnOpenAddModal.addEventListener('click', openAddModal);
  btnCloseAddModal.addEventListener('click', closeAddModal);
  btnCancelAdd.addEventListener('click', closeAddModal);
  addPatientForm.addEventListener('submit', handleAddPatient);

  btnSeedDemo.addEventListener('click', handleSeedDemo);

  // Helper: Format Date as YYYY-MM-DD
  function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Toast Notification Helper
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠'}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Debounce helper
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // Helper to escape HTML to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Count words helper
  function countWords(str) {
    if (!str) return 0;
    return str.trim().split(/\s+/).filter(Boolean).length;
  }

  // 1. Fetch & Display Stats
  async function loadStats() {
    try {
      const selectedDate = dueDateFilter ? (dueDateFilter.value || todayStr) : todayStr;
      const res = await fetch(`/api/stats?date=${encodeURIComponent(selectedDate)}&_t=${Date.now()}`);
      const data = await res.json();
      if (data.success && data.data) {
        statTotal.textContent = data.data.total;
        statDueToday.textContent = data.data.dueToday;
        statPendingApproval.textContent = data.data.pendingApproval;
        statCompleted.textContent = data.data.completed;
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  // 2. Fetch & Display Due Patients (Task 2 Queue)
  async function loadDuePatients() {
    duePatientsContainer.innerHTML = '<div class="loading-state">Loading due patients...</div>';
    const selectedDate = dueDateFilter.value || todayStr;

    try {
      const res = await fetch(`/api/patients/due-today?date=${encodeURIComponent(selectedDate)}&_t=${Date.now()}`);
      const result = await res.json();

      if (!result.success || !result.data || result.data.length === 0) {
        statDueToday.textContent = '0';
        duePatientsContainer.innerHTML = `
          <div class="empty-draft-prompt">
            <p><strong>🎉 All caught up!</strong> No pending follow-ups due for <strong>${escapeHtml(selectedDate)}</strong>.</p>
            <p style="font-size: 0.8rem;">To test the review flow, select a different date or click "Reset / Seed Demo Data".</p>
          </div>
        `;
        return;
      }

      statDueToday.textContent = result.data.length;
      duePatientsContainer.innerHTML = '';
      result.data.forEach(patient => {
        const card = createDuePatientCard(patient);
        duePatientsContainer.appendChild(card);
      });
    } catch (err) {
      console.error('Error fetching due patients:', err);
      duePatientsContainer.innerHTML = '<div class="alert alert-error">Failed to load due follow-up patients.</div>';
    }
  }

  // Render a Due Patient Card with AI workflow & review controls
  function createDuePatientCard(patient) {
    const card = document.createElement('div');
    card.className = 'due-card';
    card.id = `due-card-${patient.id}`;

    const hasDraft = Boolean(patient.ai_draft_message);
    const draftText = patient.ai_draft_message || '';
    const wordCount = countWords(draftText);

    card.innerHTML = `
      <!-- Left: Patient Details -->
      <div class="due-patient-info">
        <div class="due-patient-name">${escapeHtml(patient.name)}</div>
        <div class="info-item">
          <span class="info-item-label">Phone</span>
          <span class="info-item-value">📱 ${escapeHtml(patient.phone)}</span>
        </div>
        <div class="info-item">
          <span class="info-item-label">Initial Consultation</span>
          <span class="info-item-value">📅 ${escapeHtml(patient.consultation_date)}</span>
        </div>
        <div class="info-item">
          <span class="info-item-label">Follow-up Due</span>
          <span class="info-item-value">⏰ ${escapeHtml(patient.next_follow_up_date)}</span>
        </div>
        <div class="info-item">
          <span class="info-item-label">Approval Status</span>
          <span class="badge badge-${escapeHtml(patient.approval_status)}">${escapeHtml(patient.approval_status)}</span>
        </div>
      </div>

      <!-- Right: AI Draft & Staff Approval Workflow -->
      <div class="due-ai-section">
        <div class="ai-header">
          <div class="ai-title">
            <span>✨ WhatsApp Follow-Up Message</span>
            ${hasDraft ? '<span class="provider-badge">Draft Ready for Review</span>' : ''}
          </div>
          <div>
            <button class="btn btn-primary btn-sm btn-generate" data-id="${patient.id}">
              ${hasDraft ? '🔄 Regenerate AI Draft' : '✨ Generate AI Draft'}
            </button>
          </div>
        </div>

        ${hasDraft ? `
          <div class="whatsapp-preview-box">
            <div class="whatsapp-label">
              <span>💬</span> WhatsApp Preview (Staff Editable)
            </div>
            <textarea 
              id="draft-text-${patient.id}" 
              class="draft-textarea" 
              placeholder="Edit draft here before approving..."
            >${escapeHtml(draftText)}</textarea>
            
            <div class="draft-meta">
              <span>Words: <strong id="word-count-${patient.id}">${wordCount}</strong> / 60 max</span>
              <span>Review carefully before approving</span>
            </div>
          </div>

          <div class="actions-row">
            <button class="btn btn-secondary btn-sm btn-save-draft" data-id="${patient.id}">
              💾 Save Edit
            </button>
            <button class="btn btn-danger btn-sm btn-reject-draft" data-id="${patient.id}">
              ❌ Reject
            </button>
            <button class="btn btn-success btn-approve" data-id="${patient.id}">
              ✅ Approve & Mark Sent
            </button>
          </div>
        ` : `
          <div class="empty-draft-prompt">
            <p>No draft generated yet for <strong>${escapeHtml(patient.name)}</strong>.</p>
            <button class="btn btn-primary btn-generate" data-id="${patient.id}">
              ✨ Generate AI WhatsApp Draft
            </button>
          </div>
        `}
      </div>
    `;

    // Attach card event listeners
    const btnGen = card.querySelectorAll('.btn-generate');
    btnGen.forEach(b => b.addEventListener('click', () => handleGenerateDraft(patient.id)));

    const textarea = card.querySelector(`#draft-text-${patient.id}`);
    if (textarea) {
      textarea.addEventListener('input', (e) => {
        const countSpan = card.querySelector(`#word-count-${patient.id}`);
        if (countSpan) countSpan.textContent = countWords(e.target.value);
      });
    }

    const btnSave = card.querySelector('.btn-save-draft');
    if (btnSave) {
      btnSave.addEventListener('click', () => handleSaveDraft(patient.id));
    }

    const btnApprove = card.querySelector('.btn-approve');
    if (btnApprove) {
      btnApprove.addEventListener('click', () => handleApproveDraft(patient.id));
    }

    const btnReject = card.querySelector('.btn-reject-draft');
    if (btnReject) {
      btnReject.addEventListener('click', () => handleRejectDraft(patient.id));
    }

    return card;
  }

  // 3. Fetch & Display All Patients (Task 1 Table)
  async function loadAllPatients() {
    const status = statusFilter.value;
    const search = searchInput.value.trim();

    const queryParams = new URLSearchParams();
    if (status) queryParams.append('status', status);
    if (search) queryParams.append('search', search);

    try {
      queryParams.append('_t', Date.now());
      const res = await fetch(`/api/patients?${queryParams.toString()}`);
      const result = await res.json();

      // Synchronize dashboard summary cards when unfiltered
      if (result.success && Array.isArray(result.data) && !status && !search) {
        statTotal.textContent = result.data.length;
        statCompleted.textContent = result.data.filter(p => p.follow_up_status === 'completed').length;
        statPendingApproval.textContent = result.data.filter(p => p.ai_draft_message && p.approval_status === 'pending').length;
      }

      if (!result.success || !result.data || result.data.length === 0) {
        patientsTableBody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-4" style="color: var(--text-muted);">
              No patients found matching the criteria.
            </td>
          </tr>
        `;
        return;
      }

      patientsTableBody.innerHTML = '';
      result.data.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>#${p.id}</td>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td>${escapeHtml(p.phone)}</td>
          <td>${escapeHtml(p.consultation_date)}</td>
          <td>${escapeHtml(p.next_follow_up_date)}</td>
          <td>
            <span class="badge badge-${escapeHtml(p.follow_up_status)}">
              ${escapeHtml(p.follow_up_status)}
            </span>
          </td>
          <td>
            <span class="badge badge-${escapeHtml(p.approval_status)}">
              ${escapeHtml(p.approval_status)}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              ${p.follow_up_status === 'pending' ? `
                <button class="btn btn-secondary btn-sm btn-mark-complete" data-id="${p.id}" title="Mark completed directly">
                  Mark Done
                </button>
              ` : `
                <span style="font-size: 0.8rem; color: var(--success); font-weight: 600;">✓ Done</span>
              `}
            </div>
          </td>
        `;

        const btnComplete = tr.querySelector('.btn-mark-complete');
        if (btnComplete) {
          btnComplete.addEventListener('click', () => handleQuickComplete(p.id));
        }

        patientsTableBody.appendChild(tr);
      });
    } catch (err) {
      console.error('Failed to load patients table:', err);
      patientsTableBody.innerHTML = `
        <tr><td colspan="8" class="text-center py-4 alert-error">Error loading patients.</td></tr>
      `;
    }
  }

  // 4. Handle Generate AI Draft
  async function handleGenerateDraft(patientId) {
    const card = document.getElementById(`due-card-${patientId}`);
    if (card) {
      card.style.opacity = '0.7';
    }

    try {
      const res = await fetch(`/api/patients/${patientId}/generate-draft`, {
        method: 'POST'
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Draft generated using ${data.provider}!`);
        loadDuePatients();
        loadStats();
        loadAllPatients();
      } else {
        showToast(data.error || 'Failed to generate draft', 'error');
        if (card) card.style.opacity = '1';
      }
    } catch (err) {
      console.error(err);
      showToast('Error generating AI draft', 'error');
      if (card) card.style.opacity = '1';
    }
  }

  // 5. Handle Save Edited Draft
  async function handleSaveDraft(patientId) {
    const textarea = document.getElementById(`draft-text-${patientId}`);
    if (!textarea) return;

    const draft_message = textarea.value.trim();
    if (!draft_message) {
      showToast('Draft message cannot be empty', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/patients/${patientId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_message })
      });
      const data = await res.json();

      if (data.success) {
        showToast('Draft edits saved successfully!');
      } else {
        showToast(data.error || 'Failed to save draft', 'error');
      }
    } catch (err) {
      showToast('Error saving draft', 'error');
    }
  }

  // 6. Handle Approve Draft & Mark Sent
  async function handleApproveDraft(patientId) {
    // Save any pending textarea edits first
    const textarea = document.getElementById(`draft-text-${patientId}`);
    if (textarea && textarea.value.trim()) {
      await fetch(`/api/patients/${patientId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_message: textarea.value.trim() })
      });
    }

    try {
      const res = await fetch(`/api/patients/${patientId}/approve`, {
        method: 'POST'
      });
      const data = await res.json();

      if (data.success) {
        showToast('Draft approved & marked as completed (sent simulation)!');
        loadDuePatients();
        loadStats();
        loadAllPatients();
      } else {
        showToast(data.error || 'Approval failed', 'error');
      }
    } catch (err) {
      showToast('Error approving draft', 'error');
    }
  }

  // 7. Handle Reject Draft
  async function handleRejectDraft(patientId) {
    try {
      const res = await fetch(`/api/patients/${patientId}/reject`, {
        method: 'POST'
      });
      const data = await res.json();

      if (data.success) {
        showToast('Draft marked as rejected.');
        loadDuePatients();
        loadStats();
        loadAllPatients();
      } else {
        showToast(data.error || 'Failed to reject draft', 'error');
      }
    } catch (err) {
      showToast('Error rejecting draft', 'error');
    }
  }

  // 8. Handle Quick Complete from directory
  async function handleQuickComplete(patientId) {
    try {
      const res = await fetch(`/api/patients/${patientId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follow_up_status: 'completed' })
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Patient #${patientId} follow-up completed!`);
        loadStats();
        loadDuePatients();
        loadAllPatients();
      } else {
        showToast(data.error || 'Update failed', 'error');
      }
    } catch (err) {
      showToast('Error updating status', 'error');
    }
  }

  // 9. Add Patient Form Modal Handling
  function openAddModal() {
    formErrorBox.classList.add('hidden');
    formErrorBox.textContent = '';
    addPatientForm.reset();

    // Default consultation to today, follow-up to today or +7 days
    document.getElementById('consultationDate').value = todayStr;
    document.getElementById('nextFollowUpDate').value = todayStr;

    addPatientModal.classList.remove('hidden');
  }

  function closeAddModal() {
    addPatientModal.classList.add('hidden');
  }

  async function handleAddPatient(e) {
    e.preventDefault();
    formErrorBox.classList.add('hidden');

    const name = document.getElementById('patientName').value.trim();
    const phone = document.getElementById('patientPhone').value.trim();
    const consultation_date = document.getElementById('consultationDate').value;
    const next_follow_up_date = document.getElementById('nextFollowUpDate').value;

    const payload = { name, phone, consultation_date, next_follow_up_date };

    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Patient "${name}" registered successfully!`);
        closeAddModal();
        loadStats();
        loadDuePatients();
        loadAllPatients();
      } else {
        formErrorBox.textContent = data.details ? data.details.join(' ') : (data.error || 'Registration failed');
        formErrorBox.classList.remove('hidden');
      }
    } catch (err) {
      formErrorBox.textContent = 'Server error registering patient.';
      formErrorBox.classList.remove('hidden');
    }
  }

  // 10. Reset / Seed Demo Data
  async function handleSeedDemo() {
    if (!confirm('Reset database with initial sample fictional patients?')) return;

    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        showToast('Database reset and seeded with sample patients!');
        loadStats();
        loadDuePatients();
        loadAllPatients();
      } else {
        showToast('Failed to seed demo data', 'error');
      }
    } catch (err) {
      showToast('Error connecting to seed endpoint', 'error');
    }
  }
});
