// public/js/navbar-loader.js
async function loadNavbar() {
    const res = await fetch('/components/navbar.html');
    const html = await res.text();
    document.getElementById('navbar').innerHTML = html;
  
    document.getElementById('galleryBtn')?.addEventListener('click', () => {
      window.location.href = 'gallery.html';
    });
  
    document.getElementById('uploadBtn')?.addEventListener('click', () => {
      window.location.href = 'upload.html';
    });
  
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      localStorage.removeItem('token');
      window.location.href = 'login.html';
    });
  
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'admin') {
          const adminBtn = document.getElementById('adminBtn');
          if (adminBtn) {
            adminBtn.style.display = 'inline-block';
            adminBtn.addEventListener('click', () => {
              window.location.href = 'admin.html';
            });
          }
        }
      } catch (err) {
        console.warn('Failed to parse JWT:', err);
      }
    }
  }
  
  document.addEventListener('DOMContentLoaded', loadNavbar);
  