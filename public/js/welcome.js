//js/welcome.js
document.addEventListener('DOMContentLoaded', () => {
    function decodeJwt(token) {
      try {
        const payloadBase64 = token.split('.')[1];
        const decodedPayload = atob(payloadBase64);
        return JSON.parse(decodedPayload);
      } catch (err) {
        console.error('[Error] Invalid JWT format:', err);
        return null;
      }
    }
  
    function redirectByRole(role) {
      if (role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'gallery.html';
      }
    }
  
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
  
    if (tokenFromUrl) {
  
      // Store token in localStorage and clean up URL
      localStorage.setItem('token', tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
  
      const payload = decodeJwt(tokenFromUrl);
  
      if (payload && payload.role) {
        redirectByRole(payload.role);
        return;
      } else {
        localStorage.removeItem('token');
      }
    }
  
    // If no valid token from URL, check localStorage
    const token = localStorage.getItem('token');
  
    if (token) {
      const payload = decodeJwt(token);
  
      if (payload && payload.exp * 1000 > Date.now()) {
        redirectByRole(payload.role);
      } else {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
      }
    } else {
      window.location.href = 'login.html';
    }
  });
  