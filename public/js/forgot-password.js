//js/forgot-password.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgotForm');
    const message = document.getElementById('message');
  
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
  
      try {
        const res = await fetch('/auth/password-reset/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
  
        const data = await res.json();
        message.textContent = data.message || 'Check your email if it exists in our system.';
        message.style.color = res.ok ? 'green' : 'red';
      } catch (err) {
        message.textContent = 'Error sending reset email.';
        message.style.color = 'red';
      }
    });
  });
  