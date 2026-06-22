
let API_BASE = '';
try {
  const proto = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;
  const isLocalhost = host === '127.0.0.1' || host === 'localhost';
  if (proto === 'file:') {
    // opened directly from filesystem -> point to local server
    API_BASE = 'http://localhost:5000';
  } else if (isLocalhost && port && port !== '5000') {

    API_BASE = 'http://localhost:5000';
  } else {
    // same-origin (served by backend) -> use relative paths
    API_BASE = '';
  }
} catch (e) {
  API_BASE = '';
}

const employeeTableBody = document.querySelector('#employeeTable tbody');
const modal = document.getElementById('editModal');
const closeModal = document.getElementById('closeModal');
const deleteModalGlobal = document.getElementById('deleteConfirmationModal');
const form = document.getElementById('editForm');

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  // Try to parse JSON, but fallback to text if not JSON
  let data = null;
  let text = null;
  try {
    data = await res.json();
  } catch (e) {
    try { text = await res.text(); } catch (e2) { text = null; }
    data = {};
  }
  if (!res.ok) {
    const msg = (data && data.message) ? data.message : (text || 'Request failed');
    const err = new Error(`${res.status} ${res.statusText} - ${msg}`);
    err.status = res.status;
    err.body = data || text;
    throw err;
  }
  return data;
}

async function loadDashboard() {
  try {
  const users = await fetchJSON(`${API_BASE}/api/users`);
  const attendance = await fetchJSON(`${API_BASE}/api/attendance`);

    // Debugging: log counts and samples so we can tell whether attendance
    // records are being returned from the server or being hidden by CSS.
    console.debug('loadDashboard -> users:', users && users.length, 'attendance:', attendance && attendance.length);
    if (attendance && attendance.length > 0) console.debug('attendance[0]:', attendance[0]);

    // Debug UI removed: rely on console.debug for developer information.

    // Only show employees on the manager dashboard. Exclude managers/admins.
    const employees = users.filter(u => (u && String(u.role || '').toLowerCase()) === 'employee');
    renderEmployees(employees);

    // Attendance table removed from manager page. We still fetch attendance
    // above to compute stats only; per-employee details are available via
    // the attendance modal opened from the Emp ID cell.

  // Only count today's attendance for stats
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const todaysAttendance = attendance.filter(a => a.date === todayStr);
  document.getElementById('presentCount').textContent = todaysAttendance.filter(a => a.status === 'Present').length;
  document.getElementById('absentCount').textContent = todaysAttendance.filter(a => a.status === 'Absent').length;
  document.getElementById('leaveCount').textContent = todaysAttendance.filter(a => a.status === 'Leave' || a.status === 'On Leave').length;
  // Use the rendered employee table rows to compute the visible total so
  // the UI reflects what the manager actually sees (avoids discrepancies
  // when backend returns stale/hidden records).
  const visibleEmployees = employeeTableBody ? employeeTableBody.querySelectorAll('tr').length : employees.length;
  document.getElementById('totalCount').textContent = visibleEmployees;
  } catch (err) {
    console.error('Failed loading dashboard', err);
    alert('Failed to load dashboard: ' + (err.message || err));
  }
}

// Export employees data as CSV
function exportToCSV(data, filename) {
  const headers = ['Employee ID', 'Name', 'Department', 'Basic Salary', 'PF', 'Status'];
  const csvRows = [headers];
  
  data.forEach(item => {
    const row = [
      item.empID || '',
      item.name || '',
      item.department || '',
      item.basicSalary || '0',
      item.pf || '0',
      item.status || ''
    ];
    csvRows.push(row);
  });
  
  const csvContent = csvRows.map(row => row.map(cell => 
    `"${String(cell).replace(/"/g, '""')}"`
  ).join(',')).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (navigator.msSaveBlob) {
    navigator.msSaveBlob(blob, filename);
  } else {
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Initialize export button
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
  exportBtn.addEventListener('click', async () => {
    try {
      const users = await fetchJSON(`${API_BASE}/api/users`);
      const employees = users.filter(u => 
        (u && String(u.role || '').toLowerCase()) === 'employee'
      );
      
      const today = new Date();
      const filename = `employees_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.csv`;
      
      exportToCSV(employees, filename);
    } catch (err) {
      console.error('Failed to export data', err);
      alert('Failed to export data: ' + (err.message || 'Unknown error'));
    }
  });
}

function renderEmployees(users) {
  employeeTableBody.innerHTML = '';
  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="empIdCell">${user.empID || ''}</td>
      <td>${user.name || ''}</td>
      <td>${user.department || ''}</td>
      <td>${user.basicSalary || 0}</td>
      <td>${user.pf || 0}</td>
      <td>${user.status || ''}</td>
      <td>
        <button class="editBtn" data-id="${user._id}">Edit</button>
        <button class="deleteBtn" data-id="${user._id}" style="margin-left:8px">Delete</button>
        <button class="saveDataBtn" data-empid="${user.empID || ''}" style="margin-left:8px">Save Data</button>
      </td>
    `;
    employeeTableBody.appendChild(row);

    // Make Emp ID clickable to open full attendance in the left side panel
    const firstCell = row.querySelector('.empIdCell');
    if (firstCell) {
      firstCell.style.cursor = 'pointer';
      firstCell.title = 'Click to view attendance on the left panel';
      firstCell.addEventListener('click', () => openAttendanceSidePanel(user.empID || '', user._id, user.name || ''));
    }
    // attach per-employee Save Data handler (stores a salary payload into localStorage)
    const saveBtn = row.querySelector('.saveDataBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          const empId = saveBtn.dataset.empid || user.empID || '';
          if (!empId) return alert('Employee ID missing');
          // Fetch attendance for this empID
          const records = await fetchJSON(`${API_BASE}/api/attendance/user/${encodeURIComponent(empId)}`);
          // Count working (Present) and non-working (Absent/Leave)
          const working = (records || []).filter(r => String(r.status).toLowerCase() === 'present').length;
          const nonWorking = (records || []).length - working;
          // Build payload
          const payload = { empID: empId, name: user.name || '', department: user.department || '', workingDays: working, nonWorkingDays: nonWorking, basicSalary: user.basicSalary || 0, savedAt: new Date().toISOString() };
          // Save to localStorage list
          let saved = [];
          try { saved = JSON.parse(localStorage.getItem('salarySavedList') || '[]'); } catch (e) { saved = []; }
          // Replace existing entry for the empID if present
          const idx = saved.findIndex(s => s && String(s.empID) === String(empId));
          if (idx >= 0) saved[idx] = payload; else saved.push(payload);
          try { localStorage.setItem('salarySavedList', JSON.stringify(saved)); } catch (e) { console.warn('Failed to persist saved salary payload', e); }
          alert('Salary data saved for ' + (user.name || empId) + '. You can view/export it on the Salary page.');
        } catch (err) {
          console.error('Failed to save salary payload', err);
          alert('Failed to save salary data: ' + (err && err.message ? err.message : 'Unknown'));
        }
      });
    }
  });

  document.querySelectorAll('.editBtn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      const user = users.find(u => u._id === id);
      if (!user) return alert('User not found');
      document.getElementById('empId').value = user._id;
      document.getElementById('empIdentifier').value = user.empID || '';
      document.getElementById('department').value = user.department || '';
      document.getElementById('basicSalary').value = user.basicSalary || 0;
      document.getElementById('pf').value = user.pf || 0;
      document.getElementById('status').value = user.status || 'Active';
      modal.style.display = 'block';
    });
  });
  
  // Attach delete handlers
  const deleteModal = document.getElementById('deleteConfirmationModal');
  const closeDeleteModalSpan = document.getElementById('closeDeleteModal');
  const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
  const deleteConfirmInput = document.getElementById('deleteConfirmInput');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  
  document.querySelectorAll('.deleteBtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const user = users.find(u => u._id === id);
      if (!user) return alert('User not found');
      
      // Reset confirmation input
      deleteConfirmInput.value = '';
      confirmDeleteBtn.disabled = true;
      
      // Populate employee info in modal
      document.getElementById('deleteEmpName').textContent = user.name;
      document.getElementById('deleteEmpId').textContent = user.empID;
      document.getElementById('deleteEmpDept').textContent = user.department;
      
      // Set the user ID for deletion
      confirmDeleteBtn.dataset.userId = id;
      
      // Show modal
      deleteModal.style.display = 'block';
    });
  });
  
  // Close delete modal when clicking X or Cancel, or clicking outside
  if (closeDeleteModalSpan) closeDeleteModalSpan.onclick = () => deleteModal.style.display = 'none';
  if (closeDeleteModalBtn) closeDeleteModalBtn.onclick = () => deleteModal.style.display = 'none';
  // Clicking outside will be handled by a single global handler (added once)
  
  // Handle confirmation input
  if (deleteConfirmInput) {
    deleteConfirmInput.addEventListener('input', (e) => {
      const input = e.target.value.trim().toLowerCase();
      confirmDeleteBtn.disabled = input !== 'delete';
    });
  }
  
  // Handle delete confirmation
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      const id = confirmDeleteBtn.dataset.userId;
      try {
        await fetchJSON(`${API_BASE}/api/users/${id}`, { method: 'DELETE' });
        deleteModal.style.display = 'none';
        alert('Employee deleted successfully');
        loadDashboard();
      } catch (err) {
        console.error('Failed to delete user', err);
        alert('Failed to delete user: ' + (err.message || 'Unknown error'));
      }
    });
  }
}

// attendance table rendering removed from manager dashboard (replaced by
// the single employee details table). Per-employee attendance can be
// inspected/edited via the attendance modal opened from the Emp ID cell.

// --- Attendance details modal logic ---
const attendanceModal = document.getElementById('attendanceModal');
const closeAttendanceModal = document.getElementById('closeAttendanceModal');
const closeAttendanceBtn = document.getElementById('closeAttendanceBtn');
const attendanceEmpName = document.getElementById('attendanceEmpName');
const attendanceEmpIdSpan = document.getElementById('attendanceEmpId');
const attendanceDetailTable = document.getElementById('attendanceDetailTable');
const saveAttendanceUpdatesBtn = document.getElementById('saveAttendanceUpdates');

if (closeAttendanceModal) closeAttendanceModal.onclick = () => attendanceModal.style.display = 'none';
if (closeAttendanceBtn) closeAttendanceBtn.onclick = () => attendanceModal.style.display = 'none';

// Open the attendance modal and load attendance records for the employee
async function openAttendanceModal(empID, userId, name) {
  attendanceEmpName.textContent = name || '';
  attendanceEmpIdSpan.textContent = empID || userId || '';
  attendanceModal.style.display = 'block';
  try {
    let filtered = [];
    if (empID) {
      // Use server-side filtered endpoint for efficiency
      try {
        filtered = await fetchJSON(`${API_BASE}/api/attendance/user/${encodeURIComponent(empID)}`);
      } catch (e) {
        // fallback to full list
        const all = await fetchJSON(`${API_BASE}/api/attendance`);
        filtered = (all || []).filter(a => a && String(a.empID) === String(empID));
      }
    } else {
      const all = await fetchJSON(`${API_BASE}/api/attendance`);
      filtered = (all || []).filter(a => a && userId && String(a.userId) === String(userId));
    }
    // If there are no records, show an empty state for this employee
    renderAttendanceDetails(filtered || [], empID, userId);
  } catch (err) {
    console.error('Failed to load attendance for employee', err);
    alert('Failed to load attendance: ' + (err.message || err));
  }
}

function renderAttendanceDetails(records, empID, userId) {
  const tbody = attendanceDetailTable.querySelector('tbody');
  tbody.innerHTML = '';
  // Sort by date descending
  records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  // If no records at all, show a help row
  if (!records || records.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5">No attendance records found for this employee.</td>`;
    tbody.appendChild(tr);
    return;
  }

  records.forEach(rec => {
    const tr = document.createElement('tr');
    if (rec._id) tr.dataset.attId = rec._id;
    tr.innerHTML = `
      <td class="att-date">${rec.date || ''}</td>
      <td>
        <select class="detailStatus">
          <option value="Present">Present</option>
          <option value="Absent">Absent</option>
          <option value="Leave">Leave</option>
        </select>
      </td>
      <td><input class="detailStart" type="time" value="${rec.startTime || ''}" /></td>
      <td><input class="detailEnd" type="time" value="${rec.endTime || ''}" /></td>
      <td><button class="saveRowBtn">Save</button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector('.detailStatus').value = rec.status || 'Absent';
    tr.querySelector('.saveRowBtn').addEventListener('click', async () => {
      await saveAttendanceRow(tr, empID, userId);
    });
  });
}

// --- Side panel attendance logic ---
const attendanceSidePanel = document.getElementById('attendanceSidePanel');
const closeSidePanelBtn = document.getElementById('closeSidePanel');
const sideEmpName = document.getElementById('sideEmpName');
const sideEmpId = document.getElementById('sideEmpId');
const attendanceSideTable = document.getElementById('attendanceSideTable');
const saveSideAttendanceBtn = document.getElementById('saveSideAttendance');

if (closeSidePanelBtn) closeSidePanelBtn.onclick = () => {
  attendanceSidePanel.style.display = 'none';
  attendanceSidePanel.setAttribute('aria-hidden', 'true');
};

async function openAttendanceSidePanel(empID, userId, name) {
  sideEmpName.textContent = name || '';
  sideEmpId.textContent = empID || userId || '';
  attendanceSidePanel.style.display = 'block';
  attendanceSidePanel.setAttribute('aria-hidden', 'false');
  try {
    let filtered = [];
    if (empID) {
      try {
        filtered = await fetchJSON(`${API_BASE}/api/attendance/user/${encodeURIComponent(empID)}`);
      } catch (e) {
        const all = await fetchJSON(`${API_BASE}/api/attendance`);
        filtered = (all || []).filter(a => a && String(a.empID) === String(empID));
      }
    } else {
      const all = await fetchJSON(`${API_BASE}/api/attendance`);
      filtered = (all || []).filter(a => a && userId && String(a.userId) === String(userId));
    }
    renderAttendanceSideDetails(filtered || [], empID, userId);
  } catch (err) {
    console.error('Failed to load attendance for employee (side panel)', err);
    alert('Failed to load attendance: ' + (err.message || err));
  }
}

function renderAttendanceSideDetails(records, empID, userId) {
  const tbody = attendanceSideTable.querySelector('tbody');
  tbody.innerHTML = '';
  records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!records || records.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5">No attendance records found for this employee.</td>`;
    tbody.appendChild(tr);
    return;
  }
  records.forEach(rec => {
    const tr = document.createElement('tr');
    if (rec._id) tr.dataset.attId = rec._id;
    tr.innerHTML = `
      <td class="att-date">${rec.date || ''}</td>
      <td>
        <select class="detailStatus">
          <option value="Present">Present</option>
          <option value="Absent">Absent</option>
          <option value="Leave">Leave</option>
        </select>
      </td>
      <td><input class="detailStart" type="time" value="${rec.startTime || ''}" /></td>
      <td><input class="detailEnd" type="time" value="${rec.endTime || ''}" /></td>
      <td><button class="saveRowBtn">Save</button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector('.detailStatus').value = rec.status || 'Absent';
    tr.querySelector('.saveRowBtn').addEventListener('click', async () => {
      await saveSideAttendanceRow(tr, empID, userId);
    });
  });
}

async function saveSideAttendanceRow(row, empID, userId) {
  try {
    const attId = row.dataset.attId;
    const date = row.querySelector('.att-date').textContent.trim();
    const status = row.querySelector('.detailStatus').value;
    const startTime = row.querySelector('.detailStart').value || undefined;
    const endTime = row.querySelector('.detailEnd').value || undefined;

    if (attId) {
      await fetchJSON(`${API_BASE}/api/attendance/${attId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, startTime, endTime })
      });
    } else {
      const payload = {
        empID: empID || '',
        empName: sideEmpName.textContent || '',
        department: '',
        date,
        status: status || 'Absent',
        startTime: startTime || '08:00',
        endTime: endTime || undefined
      };
      await fetchJSON(`${API_BASE}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    // refresh side panel
    const currentEmpId = sideEmpId.textContent || empID;
    openAttendanceSidePanel(currentEmpId, userId, sideEmpName.textContent || '');
    loadDashboard();
  } catch (err) {
    console.error('Failed to save attendance row (side)', err);
    alert('Failed to save attendance: ' + (err.message || err));
  }
}

if (saveSideAttendanceBtn) {
  saveSideAttendanceBtn.addEventListener('click', async () => {
    const tbody = attendanceSideTable.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length === 0) return alert('No records to save');
    let success = 0, fail = 0;
    for (const r of rows) {
      try {
        await saveSideAttendanceRow(r, sideEmpId.textContent || '', null);
        success++;
      } catch (e) {
        console.error('row save failed', e);
        fail++;
      }
    }
    alert(`Saved: ${success}. Failed: ${fail}`);
  });
}

async function saveAttendanceRow(row, empID, userId) {
  try {
    const attId = row.dataset.attId;
    const date = row.querySelector('.att-date').textContent.trim();
    const status = row.querySelector('.detailStatus').value;
    const startTime = row.querySelector('.detailStart').value || undefined;
    const endTime = row.querySelector('.detailEnd').value || undefined;

    if (attId) {
      await fetchJSON(`${API_BASE}/api/attendance/${attId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, startTime, endTime })
      });
      alert('Attendance updated');
    } else {
      const payload = {
        empID: empID || '',
        empName: attendanceEmpName.textContent || '',
        department: '',
        date,
        status: status || 'Absent',
        startTime: startTime || '08:00',
        endTime: endTime || undefined
      };
      await fetchJSON(`${API_BASE}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      alert('Attendance created');
    }
    const currentEmpId = attendanceEmpIdSpan.textContent || empID;
    openAttendanceModal(currentEmpId, userId, attendanceEmpName.textContent || '');
    loadDashboard();
  } catch (err) {
    console.error('Failed to save attendance row', err);
    alert('Failed to save attendance: ' + (err.message || err));
  }
}

if (saveAttendanceUpdatesBtn) {
  saveAttendanceUpdatesBtn.addEventListener('click', async () => {
    const tbody = attendanceDetailTable.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length === 0) return alert('No records to save');
    let success = 0, fail = 0;
    for (const r of rows) {
      try {
        await saveAttendanceRow(r, attendanceEmpIdSpan.textContent || '', null);
        success++;
      } catch (e) {
        console.error('row save failed', e);
        fail++;
      }
    }
    alert(`Saved: ${success}. Failed: ${fail}`);
  });
}

// Reset attendance button handler (clears today's attendance by default)
const resetBtn = document.getElementById('resetAttendanceBtn');
if (resetBtn) {
  resetBtn.addEventListener('click', async () => {
    if (!confirm('This will delete today\'s attendance records and cannot be undone. Continue?')) return;
    try {
      console.debug('Calling reset endpoint', `${API_BASE}/api/attendance/reset`);
      const res = await fetch(`${API_BASE}/api/attendance/reset`, { method: 'DELETE' });
      // prefer JSON but handle non-JSON
      let payload = null;
      try { payload = await res.json(); } catch (e) { payload = await res.text().catch(() => null); }
      if (!res.ok) {
        console.error('Reset endpoint returned non-OK', res.status, payload);
        const serverMsg = (payload && payload.message) ? payload.message : (typeof payload === 'string' ? payload : null);
        alert('Failed to reset attendance: ' + (serverMsg || (`${res.status} ${res.statusText}`)));
        return;
      }
      console.info('Reset successful', payload);
      alert('Attendance records reset for today');
      loadDashboard();
    } catch (err) {
      console.error('Failed to reset attendance (network or other)', err);
      // If err is an Error from fetchJSON it may include status/body
      const msg = err && (err.message || (err.status ? `${err.status}` : 'Request failed'));
      alert('Failed to reset attendance: ' + msg);
    }
  });
}

closeModal.onclick = () => modal.style.display = 'none';
// Use a single global click handler (added once) to close modals when clicking outside
window.addEventListener('click', (e) => {
  if (e.target == modal) modal.style.display = 'none';
  if (deleteModalGlobal && e.target == deleteModalGlobal) deleteModalGlobal.style.display = 'none';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('empId').value;
  const payload = {
    empID: document.getElementById('empIdentifier').value || undefined,
    department: document.getElementById('department').value,
    basicSalary: Number(document.getElementById('basicSalary').value),
    pf: Number(document.getElementById('pf').value),
    status: document.getElementById('status').value
  };
  try {
    await fetchJSON(`${API_BASE}/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    alert('Employee updated successfully');
    modal.style.display = 'none';
    loadDashboard();
  } catch (err) {
    console.error('Failed to update user', err);
    alert('Failed to update user: ' + err.message);
  }
});

// initialize
loadDashboard();

// Reset all data button handler
const resetAllDataBtn = document.getElementById('resetAllDataBtn');
if (resetAllDataBtn) {
  // New behaviour: ask for month and delete attendance & salary for that month
  const monthDeleteModal = document.getElementById('monthDeleteModal');
  const closeMonthModal = document.getElementById('closeMonthModal');
  const cancelMonthDelete = document.getElementById('cancelMonthDelete');
  const confirmMonthDelete = document.getElementById('confirmMonthDelete');
  const deleteMonthInput = document.getElementById('deleteMonthInput');

  resetAllDataBtn.addEventListener('click', () => {
    // open month modal
    if (monthDeleteModal) monthDeleteModal.style.display = 'block';
  });

  if (closeMonthModal) closeMonthModal.onclick = () => { if (monthDeleteModal) monthDeleteModal.style.display = 'none'; };
  if (cancelMonthDelete) cancelMonthDelete.onclick = () => { if (monthDeleteModal) monthDeleteModal.style.display = 'none'; };

  if (confirmMonthDelete) {
    confirmMonthDelete.addEventListener('click', async () => {
      const month = deleteMonthInput ? deleteMonthInput.value : '';
      if (!month) return alert('Please select a month to delete');
      if (!confirm(`This will delete attendance and salary records for ${month}. Continue?`)) return;
      try {
        // Delete attendance for month
        await fetchJSON(`${API_BASE}/api/attendance/reset-month?month=${encodeURIComponent(month)}`, { method: 'DELETE' });
        // Delete salary records for month
        await fetchJSON(`${API_BASE}/api/salary/reset-month?month=${encodeURIComponent(month)}`, { method: 'DELETE' });
        if (monthDeleteModal) monthDeleteModal.style.display = 'none';
        alert('Data for ' + month + ' deleted successfully');
        loadDashboard();
      } catch (err) {
        console.error('Failed to delete month data', err);
        alert('Failed to delete month data: ' + (err.message || 'Unknown error'));
      }
    });
  }
}

// Logout handling (re-attached in case it was removed earlier)
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    try { sessionStorage.removeItem('demoSession'); } catch {}
    try { localStorage.removeItem('authPrefs'); } catch {}
    const base = (window.location && window.location.origin) ? window.location.origin : '';
    window.location.href = base + '/signup.html';
  });
}

// --- Salary data modal logic ---
const viewSalaryDataBtn = document.getElementById('viewSalaryDataBtn');
const salaryDataModal = document.getElementById('salaryDataModal');
const closeSalaryModal = document.getElementById('closeSalaryModal');
const closeSalaryBtn = document.getElementById('closeSalaryBtn');
const sendAllToSalaryBtn = document.getElementById('sendAllToSalaryBtn');
const salaryListTable = document.getElementById('salaryListTable');

function renderSalaryList() {
  const tbody = salaryListTable.querySelector('tbody');
  tbody.innerHTML = '';
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('salarySavedList') || '[]'); } catch (e) { saved = []; }
  if (!saved || saved.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6">No saved salary payloads.</td>`;
    tbody.appendChild(tr);
    return;
  }
  saved.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.empID || ''}</td>
      <td>${item.name || ''}</td>
      <td>${item.department || ''}</td>
      <td>${item.workingDays || 0}</td>
      <td>${item.nonWorkingDays || 0}</td>
      <td>
        <button class="exportSalaryBtn">Export</button>
        <button class="openSalaryBtn" style="margin-left:6px">Open</button>
        <button class="deleteSalaryBtn" style="margin-left:6px">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
    tr.querySelector('.exportSalaryBtn').addEventListener('click', () => {
      exportToCSV(item, `salary_payload_${item.empID || 'unknown'}.csv`);
    });
    tr.querySelector('.openSalaryBtn').addEventListener('click', () => {
      try { sessionStorage.setItem('salaryPayload', JSON.stringify(item)); } catch (e) { console.warn('sessionStorage not available', e); }
      // navigate to salary page
      const base = (window.location && window.location.origin) ? window.location.origin : '';
      window.location.href = base + '/salary.html';
    });
    tr.querySelector('.deleteSalaryBtn').addEventListener('click', () => {
      let s = [];
      try { s = JSON.parse(localStorage.getItem('salarySavedList') || '[]'); } catch (e) { s = []; }
      const idx = s.findIndex(x => String(x.empID) === String(item.empID));
      if (idx >= 0) s.splice(idx, 1);
      try { localStorage.setItem('salarySavedList', JSON.stringify(s)); } catch (e) { console.warn('failed save', e); }
      renderSalaryList();
    });
  });
}

if (viewSalaryDataBtn) {
  viewSalaryDataBtn.addEventListener('click', () => {
    renderSalaryList();
    salaryDataModal.style.display = 'block';
  });
}
if (closeSalaryModal) closeSalaryModal.onclick = () => salaryDataModal.style.display = 'none';
if (closeSalaryBtn) closeSalaryBtn.onclick = () => salaryDataModal.style.display = 'none';
if (sendAllToSalaryBtn) sendAllToSalaryBtn.addEventListener('click', () => {
  // open salary page without selecting a particular payload
  const base = (window.location && window.location.origin) ? window.location.origin : '';
  window.location.href = base + '/salary.html';
});

// Keep a CSS variable synchronized with the header height so any sticky
// elements (table headers) can position themselves correctly and avoid
// overlapping content. This handles different screen sizes / font scaling.
function updateHeaderHeightVar() {
  const hdr = document.querySelector('header');
  const h = hdr ? hdr.getBoundingClientRect().height : 64;
  document.documentElement.style.setProperty('--header-height', `${Math.ceil(h)}px`);
}

window.addEventListener('load', updateHeaderHeightVar);
window.addEventListener('resize', updateHeaderHeightVar);
// call once now in case the script runs after load
updateHeaderHeightVar();
