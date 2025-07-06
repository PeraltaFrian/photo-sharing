// public/js/password-reset.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resetForm');
    const message = document.getElementById('message');
  
    // Get token
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
  
    if (!token) {
      message.textContent = 'Missing or invalid token.';
      return;
    }
  
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById('newPassword').value.trim();
  
      try {
        const res = await fetch('/auth/password-reset/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword }),
        });
  
        const data = await res.json();
        message.textContent = data.message || 'Something happened.';
        message.style.color = res.ok ? 'green' : 'red';
      } catch (err) {
        message.textContent = 'Error resetting password.';
        message.style.color = 'red';
      }
    });
  });
  