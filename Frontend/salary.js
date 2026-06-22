(function(){
  // Read payload from sessionStorage
  let payload = null;
  try { payload = JSON.parse(sessionStorage.getItem('salaryPayload') || 'null'); } catch (e) { payload = null; }

  const empIdEl = document.getElementById('salaryEmpId');
  const nameEl = document.getElementById('salaryName');
  const deptEl = document.getElementById('salaryDept');
  const basicEl = document.getElementById('salaryBasic');
  const pfEl = document.getElementById('salaryPF');
  const monthEl = document.getElementById('salaryMonth');
  const resultEl = document.getElementById('salaryResult');
  const summary = document.getElementById('summary');

  // Back button: call backend (for logging/cleanup) then clear session payload and navigate
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        // best-effort backend call; failure shouldn't block navigation
        await fetch('/api/navigation/back', { method: 'POST' });
      } catch (err) {
        console.warn('Navigation callback failed', err && (err.message || err));
      }
      try { sessionStorage.removeItem('salaryPayload'); } catch (e) { /* ignore */ }
      const base = (window.location && window.location.origin) ? window.location.origin : '';
      window.location.href = base + '/manager.html';
    });
  }

  function exportToCSV(data, filename) {
    if (!Array.isArray(data)) data = [data];
    const headers = Object.keys(data.reduce((acc, cur) => Object.assign(acc, cur), {}));
    const rows = data.map(item => headers.map(h => String(item[h] === undefined || item[h] === null ? '' : item[h])));
    const csvRows = [headers, ...rows].map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (navigator.msSaveBlob) navigator.msSaveBlob(blob, filename);
    else {
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Export button wiring
  const exportBtn = document.getElementById('exportSalaryBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      // If there's a calculated result displayed, try to export it, else export saved payloads
      const resultText = resultEl ? (resultEl.innerText || resultEl.textContent || '').trim() : '';
      if (resultText && resultText.length > 0) {
        exportToCSV([{ result: resultText }], `salary_result_${new Date().toISOString().slice(0,10)}.csv`);
        return;
      }
      let saved = [];
      try { saved = JSON.parse(localStorage.getItem('salarySavedList') || '[]'); } catch (e) { saved = []; }
      if (!saved || saved.length === 0) return alert('No saved salary payloads to export');
      exportToCSV(saved, `salary_payloads_${new Date().toISOString().slice(0,10)}.csv`);
    });
  }

  if (payload) {
    if (empIdEl) empIdEl.value = payload.empID || '';
    if (nameEl) nameEl.value = payload.name || '';
    if (deptEl) deptEl.value = payload.department || '';
    if (basicEl) basicEl.value = payload.basicSalary || 0;
    // PF is stored as percent (e.g., 12 means 12%) — default to 12% when not provided
    if (pfEl) pfEl.value = (payload.pf != null) ? payload.pf : 12;
    summary.innerHTML = `<p>Working days: <strong>${payload.workingDays || 0}</strong></p><p>Non-working days: <strong>${payload.nonWorkingDays || 0}</strong></p>`;
  } else {
    summary.innerHTML = '<p>No salary payload found. Navigate from the manager dashboard and click Save Data for employees to see saved payloads below.</p>';
    // default PF when no payload
    if (pfEl) pfEl.value = 12;
  }

  // Render saved payloads list from localStorage
  function renderSavedList() {
    const container = document.getElementById('savedListContainer');
    if (!container) return;
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('salarySavedList') || '[]'); } catch (e) { saved = []; }
    container.innerHTML = '';
    if (!saved || saved.length === 0) {
      container.innerHTML = '<p>No saved salary payloads.</p>';
      return;
    }
    saved.forEach(item => {
      const div = document.createElement('div');
      div.className = 'saved-item';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `<strong>${item.name || item.empID}</strong> &nbsp; <span>${item.department || ''}</span><br><span>Working: ${item.workingDays || 0} | Non-working: ${item.nonWorkingDays || 0}</span>`;
      const actions = document.createElement('div');
      const btnExport = document.createElement('button');
      btnExport.textContent = 'Export';
      btnExport.addEventListener('click', () => {
        exportToCSV(item, `salary_payload_${item.empID || 'unknown'}.csv`);
      });
      const btnLoad = document.createElement('button');
      btnLoad.style.marginLeft = '8px';
      btnLoad.textContent = 'Load';
      btnLoad.addEventListener('click', () => {
        // load into the calculate form
        if (empIdEl) empIdEl.value = item.empID || '';
        if (nameEl) nameEl.value = item.name || '';
        if (deptEl) deptEl.value = item.department || '';
        if (basicEl) basicEl.value = item.basicSalary || 0;
        // PF saved as percent — default to 12 when not present
        if (pfEl) pfEl.value = (item.pf != null) ? item.pf : 12;
      });
      actions.appendChild(btnExport);
      actions.appendChild(btnLoad);
      div.appendChild(meta);
      div.appendChild(actions);
      container.appendChild(div);
    });
  }

  renderSavedList();

  async function postJSON(url, data) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json && json.message) ? json.message : ('Request failed ' + res.status));
    return json;
  }
  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const form = document.getElementById('salaryForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      resultEl.textContent = '';
      const userId = empIdEl.value;
  const basicSalary = Number(basicEl.value || 0);
  // PF is provided as percentage (e.g., 12 means 12%)
  const pfPercent = Number(pfEl ? pfEl.value : 12) || 0;
  const pfAmount = basicSalary * (pfPercent / 100);
      const month = monthEl.value; // expecting YYYY-MM
      if (!userId || !month || !basicSalary) {
        resultEl.style.color = 'red';
        resultEl.textContent = 'Please ensure Employee ID, Basic Salary and Month are filled';
        return;
      }
      try {
        // keep original server call to allow server-side data, but also compute local salary amount
        const reqPayload = { userId, basicSalary, month };
        // Try server call but don't fail the whole flow if server is unavailable — allow local/session payload calculation
        let resp = {};
        try {
          resp = await postJSON('/api/salary/calculate', reqPayload);
        } catch (serverErr) {
          console.warn('Server call failed, falling back to local payload:', serverErr && serverErr.message ? serverErr.message : serverErr);
          resp = {};
        }

        // Determine working days: prefer session payload (from manager save), fall back to server response
        let workingDays = 0;
        if (payload && (payload.workingDays != null)) {
          workingDays = Number(payload.workingDays) || 0;
        } else if (resp && resp.salary) {
          // server may return presentDays or workingDays
          workingDays = Number(resp.salary.presentDays != null ? resp.salary.presentDays : (resp.salary.workingDays != null ? resp.salary.workingDays : 0)) || 0;
        } else if (resp && resp.presentDays != null) {
          workingDays = Number(resp.presentDays) || 0;
        }

        const dailyRate = basicSalary / 30;
        // pfAmount is based on basic salary and pfPercent and is a monthly deduction (not pro-rated)
        const salaryBeforePf = workingDays * dailyRate;
        // PF monthly (full) based on basic
        const pfMonthly = pfAmount;
        // Medical charges fixed at 5% of basic per month
        const medicalPercent = 5;
        const medicalMonthly = basicSalary * (medicalPercent / 100);

        // Net pay for days (attendance-based) after monthly deductions (PF and medical still full month amounts)
        let netPayForDays = salaryBeforePf - pfMonthly - medicalMonthly;
        if (netPayForDays < 0) netPayForDays = 0;

        // Net monthly salary (if full month paid): basic - pfMonthly - medicalMonthly
        let netMonthly = basicSalary - pfMonthly - medicalMonthly;
        if (netMonthly < 0) netMonthly = 0;

        // Render a friendly result card
        const empDisplay = (empIdEl && empIdEl.value) ? escapeHtml(empIdEl.value) : '';
        const nameDisplay = (nameEl && nameEl.value) ? ' - ' + escapeHtml(nameEl.value) : '';
        const monthDisplay = escapeHtml(month || '');

        const html = `
          <div class="card result-card">
            <div class="result-header">Salary Calculation</div>
            <div class="result-row"><div class="result-label">Employee</div><div class="result-value">${empDisplay}${nameDisplay}</div></div>
            <div class="result-row"><div class="result-label">Month</div><div class="result-value">${monthDisplay}</div></div>
            <div class="result-row"><div class="result-label">Working Days</div><div class="result-value">${workingDays}</div></div>
            <div class="result-row"><div class="result-label">Daily Rate</div><div class="result-value">₹${Number(dailyRate.toFixed(2))}</div></div>
            <div class="result-row"><div class="result-label">Gross (for days)</div><div class="result-value">₹${Number(salaryBeforePf.toFixed(2))}</div></div>
            <div class="result-row"><div class="result-label">PF (${Number(pfPercent.toFixed(2))}%) - monthly</div><div class="result-value">₹${Number(pfMonthly.toFixed(2))}</div></div>
            <div class="result-row"><div class="result-label">Medical (${medicalPercent}%) - monthly</div><div class="result-value">₹${Number(medicalMonthly.toFixed(2))}</div></div>
            <div class="result-row"><div class="result-label">Net Pay (for days after monthly deductions)</div><div class="result-value">₹${Number(netPayForDays.toFixed(2))}</div></div>
            <div class="result-row"><div class="result-label">Net Monthly Salary (full month)</div><div class="result-value">₹${Number(netMonthly.toFixed(2))}</div></div>
            <div class="small-muted">Server: ${(resp && (resp.salary || resp)) ? 'OK' : 'No server data'}</div>
          </div>`;

        resultEl.style.color = '';
        resultEl.innerHTML = html;
      } catch (err) {
        console.error('Salary calculate failed', err);
        resultEl.style.color = 'red';
        resultEl.textContent = err.message || 'Failed to calculate salary';
      }
    });
  }
})();
