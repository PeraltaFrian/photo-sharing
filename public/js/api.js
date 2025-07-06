// public/js/api.js
let isRefreshing = false;
let refreshPromise = null;

// Helper to get JWT token from localStorage or cookie
function getToken() {
  let token = localStorage.getItem('token');
  if (!token) {
    const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) token = match[1];
  }
  return token;
}

// Refresh the access token using the refresh token cookie
async function refreshToken() {
  if (isRefreshing) return refreshPromise;

  isRefreshing = true;

  refreshPromise = fetch('/auth/refresh-token', {
    method: 'POST',
    credentials: 'include', 
  })
    .then(async res => {
      isRefreshing = false;

      if (!res.ok) throw new Error('Failed to refresh token');

      const data = await res.json();

      localStorage.setItem('token', json.token);
      return json;
    })
    .catch(err => {
      isRefreshing = false;
      throw err;
    });

  return refreshPromise;
}

// Main request wrapper
export async function apiFetch(url, options = {}, retry = true) {
  const token = getToken();

  const config = {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.headers || {}),
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  const res = await fetch(url, config);

  if (res.status === 401 && retry) {
    try {
      await refreshToken(); 
      return apiFetch(url, options, false); 
    } catch (err) {
      console.error('Refresh token failed:', err);
      localStorage.removeItem('token');
      window.location.href = '/login.html';
      return;
    }
  }

  return res;
}
