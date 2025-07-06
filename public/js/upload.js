// public/js/upload.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('uploadForm');
  const messageContainer = document.getElementById('uploadMessage');

  // Get JWT token from localStorage
  const token = localStorage.getItem('token');
  if (!token) {
    alert('You must be logged in.');
    window.location.href = 'login.html';
    return;
  }

  // Function to read CSRF token from cookie
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    try {
      // fetch CSRF token again to ensure freshness
      await fetch('/csrf-token', { credentials: 'include' });

      const csrfToken = getCookie('csrfToken'); // cookie name must match server
      if (!csrfToken) throw new Error('CSRF token not found');

      const res = await fetch('/photos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'CSRF-Token': csrfToken
        },
        body: formData,
        credentials: 'include'
      });

      const contentType = res.headers.get('content-type') || '';

      if (!res.ok) {
        if (contentType.includes('application/json')) {
          const err = await res.json();
          throw new Error(err.error || 'Upload failed');
        } else {
          const text = await res.text();
          console.error('Server returned non-JSON error:', text);
          throw new Error('Upload failed: Unexpected server response');
        }
      }

      alert('Upload successful!');
      form.reset();
      window.location.href = 'gallery.html';

    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload error: ' + err.message);
    }
  });
});
