//js/register.js
const form = document.getElementById('registerForm');
const messageDiv = document.getElementById('message');

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
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      messageDiv.textContent = 'Registration successful! Redirecting to login...';
      messageDiv.style.color = 'green';
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    } else {
      messageDiv.textContent = data.error || 'Registration failed.';
      messageDiv.style.color = 'red';
    }
  } catch (err) {
    messageDiv.textContent = 'Error: ' + err.message;
    messageDiv.style.color = 'red';
  }
});
