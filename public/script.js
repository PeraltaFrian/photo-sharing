let allPhotos = [];

async function fetchPhotos() {
  const res = await fetch('/photos');
  const photos = await res.json();
  allPhotos = photos;

  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';

  photos.forEach((photo, index) => {
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
    likeLabel.textContent = '❤️ Likes:';

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
          },
          body: JSON.stringify({ likes: selectedLikes }),
        });

        if (!response.ok) throw new Error('Failed to update like');
        photo.likes = selectedLikes;
        likeCount.textContent = selectedLikes;

        const currentDetailId = document.getElementById('detail-img').dataset.id;
        if (currentDetailId === photo.id) {
          document.getElementById('detail-likes').textContent = `❤️ ${selectedLikes} likes`;
        }

      } catch (err) {
        console.error('Error updating like:', err);
        alert('Failed to update like. Please try again.');
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

  // Show first photo by default
  if (photos.length > 0) showDetails(photos[0]);
}

function showDetails(photo) {
  document.getElementById('detail-name').textContent = photo.name;
  document.getElementById('detail-img').src = photo.imageUrl;
  document.getElementById('detail-img').dataset.id = photo.id;
  document.getElementById('detail-desc').textContent = photo.description;
  document.getElementById('detail-likes').textContent = `❤️ ${photo.likes} likes`;
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);

  const name = formData.get('name')?.trim();
  const description = formData.get('description')?.trim();
  const file = formData.get('image');

  if (!name || !description || !file) {
    alert('❗ Please fill in all fields and select an image before uploading.');
    return;
  }

  try {
    const res = await fetch('/photos', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      e.target.reset();
      fetchPhotos();
    } else {
      const error = await res.json();
      alert(`Upload failed: ${error.error || 'Unknown error occurred.'}`);
    }
  } catch (err) {
    console.error('Upload error:', err);
    alert('Something went wrong. Please check your internet connection or try again later.');
  }
});

fetchPhotos();
