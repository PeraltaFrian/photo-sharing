//js/login.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const messageDiv = document.getElementById('message');

  // --- Decode JWT ---
  function decodeJwt(token) {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }

  // --- Check if JWT token is expired ---
  function isTokenExpired(token) {
    const payload = decodeJwt(token);
    if (!payload || !payload.exp) return true;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }

  // --- Call refresh-token endpoint to get a new access token ---
  async function refreshToken() {
    const res = await fetch('/auth/refresh-token', {
      method: 'POST',
      credentials: 'include' // Includes HttpOnly cookie
    });

    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('token', data.token);
      return data.token;
    }

    throw new Error(data.error || 'Token refresh failed');
  }

  // --- Authenticated Fetch Helper ---
  async function fetchWithAuth(url, options = {}) {
    let token = localStorage.getItem('token');

    if (!token || isTokenExpired(token)) {
      try {
        token = await refreshToken();
      } catch (err) {
        console.error('Could not refresh token:', err);
        window.location.href = 'login.html';
        return;
      }
    }

    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }

  // --- Handle Google OAuth token in URL hash ---
  const hash = window.location.hash;
  if (hash && hash.includes('token=')) {
    const token = hash.split('token=')[1];
    localStorage.setItem('token', token);
    window.history.replaceState(null, null, window.location.pathname);

    const payload = decodeJwt(token);

    if (payload && payload.role) {
      messageDiv.textContent = 'Login successful! Redirecting...';
      messageDiv.style.color = 'green';

      setTimeout(() => {
        window.location.href = payload.role === 'admin' ? 'admin.html' : 'gallery.html';
      }, 1000);
    } else {
      messageDiv.textContent = 'Invalid token received.';
      messageDiv.style.color = 'red';
    }

    return;
  }

  // --- Handle email/password login form submit ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      messageDiv.textContent = 'Please enter both email and password.';
      messageDiv.style.color = 'red';
      return;
    }

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important to receive HttpOnly refresh token cookie
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        localStorage.setItem('token', data.token);

        const payload = decodeJwt(data.token);
        if (!payload) throw new Error('Invalid token format');

        messageDiv.textContent = 'Login successful! Redirecting...';
        messageDiv.style.color = 'green';

        setTimeout(() => {
          window.location.href = payload.role === 'admin' ? 'admin.html' : 'gallery.html';
        }, 1000);
      } else {
        messageDiv.textContent = data.error || 'Login failed.';
        messageDiv.style.color = 'red';
      }
    } catch (err) {
      messageDiv.textContent = 'Error: ' + err.message;
      messageDiv.style.color = 'red';
    }
  });
});
