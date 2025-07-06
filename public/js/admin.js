//js/admin.js
import { apiFetch } from './api.js';

// Get JWT token from localStorage or cookie
function getToken() {
    let token = localStorage.getItem('token');
    if (!token) {
      const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
      if (match) token = match[1];
    }
    return token;
  }
  
  let token = getToken();
  
  // Cache CSRF token to avoid fetching it multiple times
  let cachedCsrfToken = null;
  
  async function getCsrfToken() {
    if (cachedCsrfToken) return cachedCsrfToken;
    const res = await fetch('/csrf-token', { credentials: 'include' });
    const data = await res.json();
    cachedCsrfToken = data.csrfToken;
    return cachedCsrfToken;
  }
  
  // Check if JWT token is expired
  function isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true; // Treat invalid token as expired
    }
  }
  
  async function fetchUserFromBackend() {
    try {
      // Try to fetch user info
      let res = await fetch('/auth/me', { credentials: 'include' });
  
      if (res.status === 401 || res.status === 403) {
        // If token expired, try to refresh
        console.warn('Access token expired. Attempting refresh...');
        const refreshRes = await fetch('/auth/refresh-token', {
          method: 'POST',
          credentials: 'include',
        });
  
        if (!refreshRes.ok) {
          console.error('Refresh failed');
          return null;
        }
  
        res = await fetch('/auth/me', { credentials: 'include' });
      }
  
      if (!res.ok) {
        console.error('Authentication failed even after refresh');
        return null;
      }
  
      const data = await res.json();
      return data.token;
    } catch (err) {
      console.error('Fetch or refresh error:', err);
      return null;
    }
  }
  
  // Main async init to check token and role
  async function init() {
    if (!token || isTokenExpired(token)) {
      const newToken = await fetchUserFromBackend();
      if (!newToken) {
        alert('You must be logged in as admin or your session has expired.');
        window.location.href = 'login.html';
        return;
      }
      token = newToken;
    } else if (!localStorage.getItem('token') && token) {
    }
  
    const role = getUserRoleFromToken(token);
    if (role !== 'admin') {
      alert('Access denied: Admins only.');
      localStorage.removeItem('token');
      window.location.href = 'gallery.html';
      return;
    }
  
    setupLogout();
    setupUpload();
    fetchUsers();
    fetchPhotos();
  }
  
  // Get user role from decoded JWT token payload
  function getUserRoleFromToken(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || 'user';
    } catch {
      return 'user';
    }
  }
  
  // Logout button handler
  function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include',
          });
        } catch (err) {
          console.error('Logout failed:', err);
        } finally {
          window.location.href = 'login.html';
        }
      });
    }
}
  
    
function setupUpload() {
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            window.location.href = 'upload.html';
        });
    }
}
  
  // Fetch users and populate users table
  async function fetchUsers() {
    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;
  
    try {
      const res = await apiFetch('/admin/users', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to load users');
      const users = await res.json();
  
      tbody.innerHTML = '';
      users.forEach(user => {
        const tr = document.createElement('tr');
  
        const emailTd = document.createElement('td');
        emailTd.textContent = user.email;
        tr.appendChild(emailTd);
  
        const roleTd = document.createElement('td');
        roleTd.textContent = user.role || 'user';
        tr.appendChild(roleTd);
  
        const actionsTd = document.createElement('td');
        if (user.role !== 'admin') {
          const promoteBtn = document.createElement('button');
          promoteBtn.textContent = 'Make Admin';
          promoteBtn.onclick = () => changeUserRole(user._id, 'admin');
          actionsTd.appendChild(promoteBtn);
        }
        tr.appendChild(actionsTd);
  
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="3">Error: ${err.message}</td></tr>`;
    }
  }
  
  // Change user role API call with CSRF token
  async function changeUserRole(userId, role) {
    if (!confirm(`Are you sure you want to change this user to ${role}?`)) return;
    try {
      const csrfToken = await getCsrfToken();
  
      const res = await apiFetch(`/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken,
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      });      
  
      if (!res.ok) throw new Error('Failed to update role');
      alert('User role updated!');
      fetchUsers();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }
  
  // Fetch photos and populate photos table
  async function fetchPhotos() {
    const tbody = document.querySelector('#photosTable tbody');
    if (!tbody) return;
  
    try {
      const res = await apiFetch('/photos');
      if (!res.ok) throw new Error('Failed to load photos');
      const photos = await res.json();

      tbody.innerHTML = '';
      photos.forEach(photo => {
        const tr = document.createElement('tr');
  
        const nameTd = document.createElement('td');
        nameTd.textContent = photo.name;
        tr.appendChild(nameTd);
  
        const imgTd = document.createElement('td');
        const img = document.createElement('img');
        img.src = photo.imageUrl;
        img.alt = photo.name;
        img.style.width = '100px';
        img.style.height = '60px';
        imgTd.appendChild(img);
        tr.appendChild(imgTd);
  
        const actionsTd = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => deletePhoto(photo.id));
        actionsTd.appendChild(delBtn);
        tr.appendChild(actionsTd);
  
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="3">Error: ${err.message}</td></tr>`;
    }
  }
  
  // Delete photo API call with CSRF token
  async function deletePhoto(photoId) {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    try {
      const csrfToken = await getCsrfToken();
  
      const res = await apiFetch(`/photos/${photoId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken,
          Authorization: `Bearer ${token}`
        }
      });      
  
      if (!res.ok) throw new Error('Failed to delete photo');
      alert('Photo deleted!');
      // Add a small delay to give Contentful time to update
      setTimeout(() => {
        fetchPhotos();
      }, 500); // 0.5 second delay
  } catch (err) {
    alert('Error: ' + err.message);
  }
}
  
  // Run the init function on page load
  init();
  