//js/gallery.js
import { apiFetch } from './api.js';

// Try to get token from URL (Google login redirect)
const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get('token');
if (urlToken) {
  localStorage.setItem('token', urlToken);
  window.history.replaceState({}, '', 'gallery.html');
}

function getTokenFromCookie() {
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? match[1] : null;
}

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

async function fetchNewToken() {
  try {
    const refreshRes = await fetch('/auth/refresh-token', {
      method: 'POST',
      credentials: 'include',
    });
    if (!refreshRes.ok) throw new Error('Refresh failed');
    const meRes = await fetch('/auth/me', { credentials: 'include' });
    if (!meRes.ok) throw new Error('Failed to fetch user after refresh');
    const data = await meRes.json();
    return data.token;
  } catch (err) {
    console.error('Token refresh failed:', err);
    return null;
  }
}

// Init logic
let token = localStorage.getItem('token') || getTokenFromCookie();

async function init() {
  if (!token || isTokenExpired(token)) {
    const newToken = await fetchNewToken();
    if (!newToken) {
      window.location.href = 'login.html';
      return;
    }
    token = newToken;
    localStorage.setItem('token', token);
  }

  // Check if admin and set up button
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload?.role === 'admin') {
      document.getElementById('adminBtn')?.addEventListener('click', () => {
        window.location.href = 'admin.html';
      });
    } else {
      document.getElementById('adminBtn')?.remove();
    }
  } catch {
    console.warn('Invalid token format');
  }

  setupUI();
  await fetchPhotos();
}

// -----------------------------
// UI Setup & Photo Rendering
// -----------------------------
function setupUI() {
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = 'login.html';
  });

  document.getElementById('uploadBtn')?.addEventListener('click', () => {
    window.location.href = 'upload.html';
  });
}

let csrfToken = null;
async function ensureCsrf() {
  if (!csrfToken) {
    const res = await fetch('/csrf-token', { credentials: 'include' });
    const json = await res.json();
    csrfToken = json.csrfToken;
  }
  return csrfToken;
}

async function fetchPhotos() {
  await ensureCsrf();
  const res = await apiFetch('/photos');

  if (!res.ok) {
    console.error('Failed to load photos:', res.statusText);
    return;
  }

  const photos = await res.json();
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';

  for (const p of photos) {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
      <img src="${p.imageUrl}" alt="${p.name}">
      <p>${p.name}</p>
      <p style="font-size:12px;color:#555">${p.description || ''}</p>
      <label>Likes: <select>${[0,1,2,3,4,5].map(n => `<option value="${n}" ${p.likes===n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    `;
    const sel = card.querySelector('select');
    sel.addEventListener('change', async () => {
      const likes = parseInt(sel.value, 10);
      try {
        const csrf = await ensureCsrf();
        const r = await apiFetch(`/photos/${p.id}/likes`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrf,
          },
          body: JSON.stringify({ likes }),
        });
        if (!r.ok) throw new Error(await r.text() || r.status);
        alert('Updated');
      } catch (e) {
        console.error(e);
        alert('Error updating likes');
      }
    });
    gallery.appendChild(card);
  }
}

init();
