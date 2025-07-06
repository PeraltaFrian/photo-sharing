let allPhotos = [];

// Token Handling
function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
  document.getElementById('nav-login').style.display = 'none';
  document.getElementById('nav-register').style.display = 'none';
  document.getElementById('nav-logout').style.display = 'inline-block';
}

function clearToken() {
  localStorage.removeItem('token');
  document.getElementById('nav-login').style.display = 'inline-block';
  document.getElementById('nav-register').style.display = 'inline-block';
  document.getElementById('nav-logout').style.display = 'none';
}

// Section Switching
function showSection(id) {
  ['gallery-section', 'register-section', 'login-section'].forEach(sec => {
    document.getElementById(sec).style.display = (sec === id) ? 'block' : 'none';
  });
}

// Fetch and Display Photos
async function fetchPhotos() {
  try {
    const res = await fetch('/photos');
    if (!res.ok) throw new Error('Failed to fetch photos');
    const photos = await res.json();
    allPhotos = photos;

    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';

    photos.forEach((photo) => {
      const card = document.createElement('div');
      card.className = 'card';

      const img = document.createElement('img');
      img.src = photo.imageUrl;
      img.alt = photo.name;

      const title = document.createElement('h3');
      title.textContent = photo.name;

      const likeWrapper = document.createElement('div');
      likeWrapper.style.display = 'flex';
      likeWrapper.style.flexDirection = 'column';
      likeWrapper.style.alignItems = 'center';
      likeWrapper.style.marginBottom = '8px';

      const likeRow = document.createElement('div');
      likeRow.style.display = 'flex';
      likeRow.style.justifyContent = 'center';
      likeRow.style.alignItems = 'center';
      likeRow.style.gap = '6px';

      const likeLabel = document.createElement('label');
      likeLabel.textContent = 'Likes:';

      const likeCount = document.createElement('strong');
      likeCount.textContent = photo.likes;

      const likeSelect = document.createElement('select');
      likeSelect.className = 'like-select';
      likeSelect.style.width = '100%';
      likeSelect.style.marginTop = '4px';

      for (let i = 0; i <= 5; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        if (i === photo.likes) option.selected = true;
        likeSelect.appendChild(option);
      }

      likeSelect.onchange = async (e) => {
        e.stopPropagation();
        const selectedLikes = parseInt(e.target.value);
        try {
          const response = await fetch(`/photos/${photo.id}/like`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ likes: selectedLikes }),
          });

          if (!response.ok) throw new Error('Failed to update like');
          photo.likes = selectedLikes;
          likeCount.textContent = selectedLikes;

          const currentDetailId = document.getElementById('detail-img').dataset.id;
          if (currentDetailId === photo.id) {
            document.getElementById('detail-likes').textContent = `${selectedLikes} likes`;
          }

        } catch (err) {
          console.error('Error updating like:', err);
          alert('Failed to update like. Please login first.');
        }
      };

      likeRow.appendChild(likeLabel);
      likeRow.appendChild(likeCount);
      likeWrapper.appendChild(likeRow);
      likeWrapper.appendChild(likeSelect);

      card.append(img, title, likeWrapper);
      card.onclick = () => showDetails(photo);
      gallery.appendChild(card);
    });

    if (photos.length > 0) showDetails(photos[0]);
  } catch (error) {
    console.error('Error fetching photos:', error);
    alert('Failed to load photos.');
  }
}

// Show Selected Photo Details
function showDetails(photo) {
  const detailImg = document.getElementById('detail-img');
  detailImg.src = photo.imageUrl;
  detailImg.alt = photo.name;
  detailImg.dataset.id = photo.id;

  document.getElementById('detail-name').textContent = photo.name;
  document.getElementById('detail-desc').textContent = photo.description;
  document.getElementById('detail-likes').textContent = `${photo.likes} likes`;
}

// Upload Photo
document.getElementById('uploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const token = getToken();

  try {
    const res = await fetch('/photos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.ok) {
      e.target.reset();
      fetchPhotos();
    } else {
      const error = await res.json();
      alert(`Upload failed: ${error.error || 'Unauthorized'}`);
    }
  } catch (err) {
    console.error('Upload error:', err);
    alert('Something went wrong. Please login.');
  }
});

// Register 
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value.trim();
  const password = e.target.password.value;

  if (!email || !password) {
    const msg = document.getElementById('register-message');
    msg.textContent = 'Please enter both email and password.';
    msg.style.color = 'red';
    return;
  }

  const res = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  const msg = document.getElementById('register-message');
  msg.textContent = data.message || data.error || 'Registration error';
  msg.style.color = res.ok ? 'green' : 'red';

  if (res.ok) {
    e.target.reset();
    showSection('login-section');
  }
});

// Login (using email instead of username)
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value.trim();
  const password = e.target.password.value;

  if (!email || !password) {
    const msg = document.getElementById('login-message');
    msg.textContent = 'Please enter both email and password.';
    msg.style.color = 'red';
    return;
  }

  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  const msg = document.getElementById('login-message');
  msg.textContent = data.message || data.error || 'Login error';
  msg.style.color = res.ok ? 'green' : 'red';

  if (res.ok && data.token) {
    setToken(data.token);
    showSection('gallery-section');
    fetchPhotos();
  }
});

// Navigation buttons
document.getElementById('nav-home')?.addEventListener('click', () => {
  showSection('gallery-section');
});
document.getElementById('nav-register')?.addEventListener('click', () => {
  showSection('register-section');
});
document.getElementById('nav-login')?.addEventListener('click', () => {
  showSection('login-section');
});
document.getElementById('nav-logout')?.addEventListener('click', () => {
  clearToken();
  alert('Logged out.');
  showSection('login-section');
});

// Initialize on page load
if (getToken()) {
  setToken(getToken());
  showSection('gallery-section');
} else {
  showSection('login-section');
}
fetchPhotos();
