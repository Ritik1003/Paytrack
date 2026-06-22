// ===== Config =====
// Determine API base: when the frontend is served from Live Server (port 5500)
// or opened via file://, a relative "/api" request will go to that origin
// (which may not implement the backend) and fail. Detect that case and
// point requests to the backend at http://localhost:5000 instead.
let API_BASE = '/api/auth'; // default: same-origin
try {
  const host = window.location.hostname;
  const port = window.location.port;
  const proto = window.location.protocol;
  const isLocalhost = host === '127.0.0.1' || host === 'localhost';
  if (proto === 'file:' || (isLocalhost && port && port !== '5000')) {
    API_BASE = 'http://localhost:5000/api/auth';
    console.log('Login: using backend API base ->', API_BASE);
  }
} catch (e) {
  API_BASE = 'http://localhost:5000/api/auth';
}

// ===== DOM helpers =====
const qs = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => [...el.querySelectorAll(s)];

// ===== Elements =====
const form = qs('#loginForm');
const emailEl = qs('#email');
const pwdEl = qs('#password');
const rememberEl = qs('#rememberMe');
const signInBtn = qs('#signInBtn');
const altLoginBtn = qs('#altLogin');
const forgotLink = qs('#forgotLink');

let emailError = qs('#emailError');
let pwdError = qs('#pwdError');
 

const toggleBtn = qs('#togglePassword');

// Ensure error containers exist and have proper aria roles [1][8]
function ensureErrorRegion(el, id) {
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'error';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');
    // Insert after the appropriate field
    const field = id.includes('email') ? emailEl.closest('.field') : pwdEl.closest('.field');
    field.appendChild(el);
  }
  return el;
}
emailError = ensureErrorRegion(emailError, 'emailError');
pwdError = ensureErrorRegion(pwdError, 'pwdError');

// Associate fields with error regions for AT [8]
emailEl.setAttribute('aria-describedby', 'emailError');
pwdEl.setAttribute('aria-describedby', 'pwdError');

// ===== Networking =====
async function postJSON(url, data) {
  // Avoid sending credentials by default - this prevents common CORS/preflight
  // failures when the backend is on a different origin and the server isn't
  // configured to allow credentials. If your backend requires cookies,
  // enable credentials on the server-side CORS config and re-enable here.
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (networkError) {
    // Convert low-level network/CORS errors into a user-friendly message
    const err = new Error('Network error: Unable to reach authentication server. Is the backend running?');
    err.cause = networkError;
    throw err;
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload.message || 'Request failed';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return payload;
}

// ===== Validation =====
// Simple email validation; rely on backend for final checks [11]
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

// Strength with even weight per criterion; UI is batched by percent [12][6]
// Password strength evaluation and UI removed for login page (not needed)

// Mark field valid/invalid for AT and visually [8][5]
function setFieldValidity(input, errorEl, message) {
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    errorEl.textContent = message;
  } else {
    input.removeAttribute('aria-invalid');
    errorEl.textContent = '';
  }
}

// ===== Event bindings =====
// Toggle password visibility with accessible label [4]
toggleBtn.addEventListener('click', () => {
  const isPwd = pwdEl.type === 'password';
  pwdEl.type = isPwd ? 'text' : 'password';
  toggleBtn.setAttribute('aria-label', isPwd ? 'Hide password' : 'Show password');
});

// Realtime validation [4][11]
emailEl.addEventListener('input', () => {
  const ok = isValidEmail(emailEl.value.trim());
  setFieldValidity(emailEl, emailError, ok || emailEl.value.trim().length === 0 ? '' : 'Enter a valid email address');
});

pwdEl.addEventListener('input', () => {
  // Clear any previous password error while typing; do not evaluate strength here.
  setFieldValidity(pwdEl, pwdError, '');
});

// Remember-me hydration: store only email, never password [7][10]
(function hydrateFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem('authPrefs') || '{}');
    if (saved.email) emailEl.value = saved.email;
    if (saved.remember) rememberEl.checked = true;
    if (saved.email) pwdEl.focus();
  } catch {}
})();

// No strength UI initialization for login page

// ===== Submit handler (single, unified) =====
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Clear errors
  setFieldValidity(emailEl, emailError, '');
  setFieldValidity(pwdEl, pwdError, '');

  const email = emailEl.value.trim();
  const password = pwdEl.value;

  // Client-side validation [11][8]
  let hasErr = false;
  if (!isValidEmail(email)) {
    setFieldValidity(emailEl, emailError, 'Please provide a valid email');
    hasErr = true;
  }
  if (!password) {
    setFieldValidity(pwdEl, pwdError, 'Password is required');
    hasErr = true;
  }
  if (hasErr) return;

  // Disable UI during submission
  signInBtn.disabled = true;
  const prevLabel = signInBtn.textContent;
  signInBtn.textContent = 'Signing in...';

  // Persist remember-me preferences (email only) [7][19]
  try {
    const prefs = { email: rememberEl.checked ? email : '', remember: !!rememberEl.checked };
    localStorage.setItem('authPrefs', JSON.stringify(prefs));
  } catch {}

  // Prefer real API; gracefully fallback to mock if API not available [4]
  try {
    const payload = await postJSON(`${API_BASE}/login`, { email, password });
    try {
      sessionStorage.setItem('demoSession', JSON.stringify({ email, ts: Date.now(), user: payload.user }));
    } catch {}

    // Redirect based on role returned from backend (normalize and log)
    console.debug('Login payload ->', payload);
    const roleRaw = payload.user && payload.user.role ? payload.user.role : null;
    const role = roleRaw ? roleRaw.toString().trim().toLowerCase() : null;
    // Compute redirect base: if API_BASE points to an absolute backend URL, use that origin.
    // Otherwise fall back to the current page origin to build a full URL. This ensures
    // redirects resolve correctly when the frontend is served from the same origin
    // or when the browser returns a usable origin value.
    const redirectBase = (typeof API_BASE === 'string' && API_BASE.startsWith('http'))
      ? API_BASE.replace(/\/api\/auth\/?$/, '')
      : (window.location && window.location.origin ? window.location.origin : '');
    if (role === 'employee') {
      window.location.href = redirectBase + '/attendance.html';
      return;
    }
    if (role === 'manager') {
      window.location.href = redirectBase + '/manager.html';
      return;
    }
    // If server returned a user but no recognized role, log and fall back to attendance
    if (payload.user) {
      console.warn('Unrecognized role for user, falling back to attendance:', roleRaw);
      // Use redirectBase so when the frontend is served from a different origin
      // the redirect targets the backend static files (where attendance.html lives).
      const redirectBase = (typeof API_BASE === 'string' && API_BASE.startsWith('http'))
        ? API_BASE.replace(/\/api\/auth\/?$/, '')
        : (window.location && window.location.origin ? window.location.origin : '');
      window.location.href = redirectBase + '/attendance.html';
      return;
    }
  } catch (apiErr) {
    // When the real API rejects (bad credentials, server error), show the error
    // to the user instead of silently using a demo fallback that always
    // redirects to attendance. This prevents role-less redirects.
    console.error('Login API error:', apiErr);
    setFieldValidity(pwdEl, pwdError, apiErr.message || 'Login failed');
    signInBtn.disabled = false;
    signInBtn.textContent = prevLabel;
    return;
  }
});

// Forgot password (demo) [4]
forgotLink.addEventListener('click', (e) => {
  e.preventDefault();
  const email = emailEl.value.trim();
  if (!email) {
    setFieldValidity(emailEl, emailError, 'Enter email to receive reset link');
    emailEl.focus();
    return;
  }
  if (!isValidEmail(email)) {
    setFieldValidity(emailEl, emailError, 'Email format looks invalid');
    emailEl.focus();
    return;
  }
  alert(`Password reset link sent to ${email} (demo)`);
});

// ===== Google OAuth Login =====
const googleBtn = qs('#googleLoginBtn');
if (googleBtn) {
  googleBtn.addEventListener('click', () => {
    // Determine the backend base URL (same logic as API_BASE)
    let backendBase = '';
    try {
      const host = window.location.hostname;
      const port = window.location.port;
      const proto = window.location.protocol;
      const isLocalhost = host === '127.0.0.1' || host === 'localhost';
      if (proto === 'file:' || (isLocalhost && port && port !== '5000')) {
        backendBase = 'http://localhost:5000';
      }
    } catch (e) {
      backendBase = 'http://localhost:5000';
    }
    // Redirect to Google OAuth initiation endpoint
    window.location.href = backendBase + '/api/auth/google';
  });
}

// ===== Handle Google OAuth callback (token in URL query params) =====
(function handleGoogleCallback() {
  try {
    const params = new URLSearchParams(window.location.search);

    // Show error if Google auth failed
    const error = params.get('error');
    if (error) {
      setFieldValidity(pwdEl, pwdError, 'Google login failed. Please ensure your Gmail is registered or try again.');
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const token = params.get('token');
    const userParam = params.get('user');
    if (token && userParam) {
      const user = JSON.parse(decodeURIComponent(userParam));
      // Store session data identical to normal login
      sessionStorage.setItem('demoSession', JSON.stringify({ email: user.email, ts: Date.now(), user }));

      // Redirect based on role
      const role = (user.role || '').toString().trim().toLowerCase();
      const redirectBase = (typeof API_BASE === 'string' && API_BASE.startsWith('http'))
        ? API_BASE.replace(/\/api\/auth\/?$/, '')
        : (window.location && window.location.origin ? window.location.origin : '');

      if (role === 'manager') {
        window.location.href = redirectBase + '/manager.html';
      } else {
        window.location.href = redirectBase + '/attendance.html';
      }
    }
  } catch (e) {
    console.error('Google OAuth callback handling error:', e);
  }
})();

