const attendanceForm = document.getElementById('attendanceForm');
const markBtn = document.getElementById('markBtn');
const logoutBtn = document.getElementById('logoutBtn');
const message = document.getElementById('message');
const currentDateElem = document.getElementById('currentDate');

function updateCurrentDate() {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    currentDateElem.textContent = "Today's Date: " + formattedDate;
}

function isToday(dateStr) {
    const today = new Date();
    const inputDate = new Date(dateStr);
    return (
        inputDate.getFullYear() === today.getFullYear() &&
        inputDate.getMonth() === today.getMonth() &&
        inputDate.getDate() === today.getDate()
    );
}

updateCurrentDate();
setInterval(updateCurrentDate, 60000);

// Populate startTime field with current time (login time) in HH:MM
function fillStartTimeNow() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const hhmm = `${hh}:${mm}`;
    const startInput = document.getElementById('startTime');
    if (startInput) startInput.value = hhmm;
}

fillStartTimeNow();

// Auto-fill empID, empName and department from session (set at login)
(function hydrateFromSession() {
    try {
        const sess = JSON.parse(sessionStorage.getItem('demoSession') || '{}');
        const user = sess && sess.user ? sess.user : null;
        if (user) {
            const empIdInput = document.getElementById('empID');
            const empNameInput = document.getElementById('empName');
            const deptInput = document.getElementById('department');
            if (empIdInput && user.empID) empIdInput.value = user.empID;
            if (empNameInput && user.name) empNameInput.value = user.name;
            if (deptInput && user.department) deptInput.value = user.department;
        }
    } catch (e) {}
})();

markBtn.addEventListener('click', async () => {
    const empID = document.getElementById('empID').value.trim();
    const empName = document.getElementById('empName').value.trim();
    const department = document.getElementById('department') ? document.getElementById('department').value.trim() : '';
    
    const status = document.getElementById('status').value;
    // Capture login/start time at the moment of submission
    const startInput = document.getElementById('startTime');
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const nowHHMM = `${hh}:${mm}`;
    if (startInput) startInput.value = nowHHMM;
    const startTime = startInput ? startInput.value : nowHHMM;
    const dateToday = new Date().toISOString().split('T')[0];

    if (!empID || !empName || !department) {
        message.style.color = 'red';
        message.textContent = 'Please fill Employee ID and Name!';
        return;
    }

    // Office hours enforcement
    const OFFICE_START = '08:00';
    const OFFICE_END = '18:00';

    // Default to 'Absent' when status not explicitly set by user
    let finalStatus = status || 'Absent';

    // Clamp start time to office start if earlier (employee login before 08:00)
    let clampedStart = startTime;
    if (clampedStart < OFFICE_START) clampedStart = OFFICE_START;

    // Ensure marking allowed only from OFFICE_START (08:00) based on login/submit time
    if (nowHHMM < OFFICE_START) {
        message.style.color = 'red';
        message.textContent = 'Attendance can be marked only from 08:00.';
        return;
    }

    // This check should always pass for dateToday, but kept for validation
    if (!isToday(dateToday)) {
        message.style.color = 'red';
        message.textContent = "Attendance can be marked only for today's date!";
        return;
    }

    try {
        const response = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                            empID,
                            empName,
                            department,
                            
                            status: finalStatus,
                            date: dateToday,
                            startTime: clampedStart,
                        }),
        });

        // Try to parse server response JSON for helpful messaging
        let respBody = null;
        try {
            respBody = await response.json();
        } catch (e) {
            // non-JSON body
        }

        if (response.ok) {
            message.style.color = 'green';
            message.textContent = (respBody && respBody.message) ? respBody.message : 'Attendance marked successfully!';
            attendanceForm.reset();
        } else {
            const serverMsg = respBody && respBody.message ? respBody.message : `Status ${response.status}`;
            console.error('Attendance save failed', response.status, respBody);
            message.style.color = 'red';
            message.textContent = serverMsg || 'Failed to mark attendance!';
        }
    } catch (err) {
        console.error(err);
        message.style.color = 'red';
        message.textContent = 'Error connecting to server!';
    }
});

// Logout flow: call backend then clear client session and redirect to signup
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        // Compute API base similar to login.js so this works when opened via file://
        let API_BASE = '/api/auth';
        try {
            const host = window.location.hostname;
            const port = window.location.port;
            const proto = window.location.protocol;
            const isLocalhost = host === '127.0.0.1' || host === 'localhost';
            if (proto === 'file:' || (isLocalhost && port && port !== '5000')) {
                API_BASE = 'http://localhost:5000/api/auth';
            }
        } catch (e) {
            API_BASE = 'http://localhost:5000/api/auth';
        }

        try {
            // Best-effort call to server to complete server-side logout actions
            await fetch(API_BASE + '/logout', { method: 'POST' });
        } catch (err) {
            // ignore network errors - proceed to clear client state and redirect
            console.warn('Logout request failed (continuing anyway):', err);
        }

        try { sessionStorage.removeItem('demoSession'); } catch (e) {}
        try { localStorage.removeItem('authPrefs'); } catch (e) {}

        // Redirect to signup page. Use same origin logic as login page so redirect works
        const redirectBase = (typeof API_BASE === 'string' && API_BASE.startsWith('http'))
            ? API_BASE.replace(/\/api\/auth\/?$/, '')
            : (window.location && window.location.origin ? window.location.origin : '');
        window.location.href = redirectBase + '/signup.html';
    });
}
