
// Frontend signup form handler
// This script runs in the browser. It gathers form data and POSTs to the backend
// endpoint at /api/auth/register. It also shows a success/error message to the user.

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");
  const roleEl = document.getElementById("role");

  // empID field element (keep visible for all roles; required only for employees)
  const empIDBox = document.querySelector('.emp-id-box');
  const empIDInput = document.getElementById('empID');
  
  function updateEmpIDVisibility() {
    const isEmployee = roleEl.value === 'employee';
    // Keep empID visible for both roles. Only toggle required state.
    empIDBox.style.display = 'block';
    empIDInput.required = isEmployee;
    // Enable input for all roles (managers can optionally provide empID)
    empIDInput.disabled = false;
  }
  
  roleEl.addEventListener("change", updateEmpIDVisibility);
  
  // Initial visibility
  updateEmpIDVisibility();

  // Strength UI elements (copied from login page)
  const pwdEl = document.getElementById('password');
  const bar = document.querySelector('#pwdStrength .bar');
  const criteriaItems = {
    len: document.querySelector('#pwdStrength .criteria li[data-crit="len"]'),
    upper: document.querySelector('#pwdStrength .criteria li[data-crit="upper"]'),
    lower: document.querySelector('#pwdStrength .criteria li[data-crit="lower"]'),
    digit: document.querySelector('#pwdStrength .criteria li[data-crit="digit"]'),
    symbol: document.querySelector('#pwdStrength .criteria li[data-crit="symbol"]')
  };

  // Ensure pwdError exists
  let pwdError = document.getElementById('pwdError');
  if (!pwdError) {
    pwdError = document.createElement('div');
    pwdError.id = 'pwdError';
    pwdError.className = 'error';
    pwdError.setAttribute('role', 'alert');
    pwdError.setAttribute('aria-live', 'polite');
    pwdEl.closest('.input-box').appendChild(pwdError);
  }

  function evaluatePassword(pwd) {
    const result = {
      len: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      digit: /\d/.test(pwd),
      symbol: /[@$#&!]/.test(pwd)
    };
    const score = Object.values(result).reduce((a, ok) => a + (ok ? 20 : 0), 0);
    return { result, score };
  }

  function updateStrengthUI(score, result) {
    // Update width by setting a CSS var used in login.css
    if (bar) bar.style.setProperty('--strength-width', `${score}%`);
    const color = score < 40 ? '#ff6b6b' : score < 80 ? '#ffcc66' : '#38d39f';
    if (bar) bar.style.setProperty('--strength-color', color);
    Object.entries(result).forEach(([k, ok]) => {
      const el = criteriaItems[k];
      if (el) el.classList.toggle('met', ok);
    });
  }

  // initialize
  updateStrengthUI(0, { len: false, upper: false, lower: false, digit: false, symbol: false });

  // Wire live updates
  pwdEl.addEventListener('input', () => {
    const { result, score } = evaluatePassword(pwdEl.value);
    updateStrengthUI(score, result);
    const msg = pwdEl.value.length === 0 ? '' : (score < 40 ? 'Weak password' : '');
    pwdError.textContent = msg;
  });

  // create a small status element
  const status = document.createElement("div");
  status.id = "signupStatus";
  status.style.marginTop = "12px";
  form.appendChild(status);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";

    const fullname = document.getElementById("fullname").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = pwdEl.value;
    const role = roleEl ? roleEl.value : "employee";
    const empID = document.getElementById("empID").value.trim();

    if (!fullname || !email || !password) {
      status.style.color = "red";
      status.textContent = "Please fill in all fields.";
      return;
    }

    // Require empID for employee role
    if (role === 'employee' && !empID) {
      status.style.color = "red";
      status.textContent = "Employee ID is required for employee accounts.";
      return;
    }

  // Determine API base: when the frontend is served by Live Server (port 5500)
  // or opened via file://, a relative "/api" request will go to that origin
  // (which doesn't implement the backend) and return 405. Detect that case
  // and point requests to the backend at http://localhost:5000 instead.
  let apiBase = "";
  try {
    const host = window.location.hostname;
    const port = window.location.port;
    const proto = window.location.protocol;
    const isLocalhost = host === '127.0.0.1' || host === 'localhost';
    // If opened from file:// or served from a different dev server port (e.g. 5500),
    // use the backend base URL. When running behind the backend (port 5000) keep relative paths.
    if (proto === 'file:' || (isLocalhost && port && port !== '5000')) {
      apiBase = 'http://localhost:5000';
    }
  } catch (e) {
    apiBase = 'http://localhost:5000';
  }
  const url = apiBase + "/api/auth/register";

    try {
      status.style.color = "black";
      status.textContent = "Saving...";

      const payload = { 
        name: fullname, 
        email, 
        password, 
        role,
        ...(empID ? { empID } : {}) // Include empID when provided (optional for managers)
      };
      console.debug("Signup request ->", url, payload);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // If the server doesn't return JSON this will throw; catch below will handle it.
      const contentType = res.headers.get("content-type") || "";
      let data = {};
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = { message: await res.text() };
      }

      if (res.ok) {
        status.style.color = "green";
        status.textContent = data.message || "Saved successfully";
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
      } else {
        // Provide richer error output so the user can see why the save failed (status + server message)
        status.style.color = "red";
        const serverMsg = (data && (data.message || data.error)) || (typeof data === 'string' ? data : null);
        // Show HTTP status and the server message when available
        status.textContent = serverMsg ? `${res.status} - ${serverMsg}` : `Failed to save (status ${res.status})`;

        // Append a small detail element with raw response body for debugging
        let detailEl = document.getElementById('signupErrorDetail');
        if (!detailEl) {
          detailEl = document.createElement('div');
          detailEl.id = 'signupErrorDetail';
          detailEl.style.fontSize = '0.85em';
          detailEl.style.color = '#800';
          detailEl.style.marginTop = '6px';
          form.appendChild(detailEl);
        }
        const details = (typeof data === 'object') ? JSON.stringify(data) : String(data);
        detailEl.textContent = `Details: ${details}`;

        // Also log everything to the console for inspection (useful when running the devtools)
        console.error('Signup failed ->', { status: res.status, statusText: res.statusText, serverMsg, details });
      }
    } catch (err) {
      status.style.color = "red";
      // Provide a friendly hint for common causes and log full error for debugging.
      const hint = " (hint: ensure backend is running on http://localhost:5000 and CORS is enabled)";
      status.textContent = "Network error: " + (err && err.message ? err.message : "could not reach the server.") + hint;
      console.error("Signup fetch error -> URL:", url, "payload:", { name: fullname, email, role }, err);
    }
  });
});
