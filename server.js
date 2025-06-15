require('dotenv').config();
const fs = require('fs');
const https = require('https');
const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const { createClient } = require('contentful');
const contentfulManagement = require('contentful-management');

const app = express();
app.use(express.json());

// Helmet middleware: sets various HTTP headers to secure the app
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "https://images.ctfassets.net", "data:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

// ROUTE 6: Serve static files with caching for 10 minutes
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.html') || path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=600'); // 10 minutes
    }
  }
}));

// Use memoryStorage to keep files in memory instead of disk
const storage = multer.memoryStorage();
const upload = multer({ storage });

const {
  CONTENTFUL_SPACE_ID,
  CONTENTFUL_ENVIRONMENT_ID,
  CONTENTFUL_DELIVERY_TOKEN,
  CONTENTFUL_MANAGEMENT_TOKEN,
  SSL_KEY_PATH,
  SSL_CERT_PATH,
  PORT = 3000,
} = process.env;

const deliveryClient = createClient({
  space: CONTENTFUL_SPACE_ID,
  accessToken: CONTENTFUL_DELIVERY_TOKEN,
});

const managementClient = contentfulManagement.createClient({
  accessToken: CONTENTFUL_MANAGEMENT_TOKEN,
});


//  ROUTE 1: GET /photos – Fetch all public photos
app.get('/photos', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60'); // 5 min cache
  try {
    const entries = await deliveryClient.getEntries({ content_type: 'photoShare' });

    const photos = entries.items.map(item => {
      const imageField = item.fields.image;
      const imageUrl = imageField?.fields?.file?.url ? `https:${imageField.fields.file.url}` : '';

      return {
        id: item.sys.id,
        imageUrl,
        name: item.fields.name || '',
        description: item.fields.description || '',
        likes: item.fields.like || 0,
      };
    });

    res.json(photos);
  } catch (err) {
    console.error('Error fetching photos:', err.message);
    res.status(500).json({ error: 'Failed to fetch photos', details: err.message });
  }
});


//  ROUTE 2: GET /photos/:id – Fetch a single photo by ID
app.get('/photos/:id', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=300'); // cache individual photo 5 mins
  try {
    const entry = await deliveryClient.getEntry(req.params.id);
    const imageField = entry.fields.image;
    const imageUrl = imageField?.fields?.file?.url ? `https:${imageField.fields.file.url}` : '';

    res.json({
      id: entry.sys.id,
      imageUrl,
      name: entry.fields.name || '',
      description: entry.fields.description || '',
      likes: entry.fields.like || 0,
    });

  } catch (err) {
    console.error('Failed to fetch photo:', err.message);
    res.status(500).json({ error: 'Failed to fetch photo', details: err.message });
  }
});


//  ROUTE 3: POST /photos – Upload a new photo
app.post('/photos', upload.single('image'), async (req, res) => {
  res.set('Cache-Control', 'no-store'); // prevent caching upload request
    const file = req.file;
    const { name, description } = req.body;

  try {
    // Server-side validation
    if (!file || !name || !description) {
      return res.status(400).json({ error: 'All fields (image, name, description) are required.' });
    }

    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Invalid file type. Only image files are allowed.' });
    }

    if (name.length > 100 || description.length > 300) {
      return res.status(400).json({ error: 'Name or description exceeds character limit.' });
    }

    const space = await managementClient.getSpace(CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(CONTENTFUL_ENVIRONMENT_ID);

    // 1. Upload Asset
    let asset = await env.createAssetFromFiles({
      fields: {
        title: { 'en-US': file.originalname },
        file: {
          'en-US': {
            contentType: file.mimetype,
            fileName: file.originalname,
            file: file.buffer,
          },
        },
      },
    });

    // 2. Process and wait
    await asset.processForAllLocales();

    let processed = false;
    while (!processed) {
      asset = await env.getAsset(asset.sys.id);
      const fileField = asset.fields.file?.['en-US'];
      if (fileField?.url) processed = true;
      else await new Promise(r => setTimeout(r, 1000));
    }

    // 3. Publish asset
    if (!asset.isPublished()) asset = await asset.publish();

    // 4. Create entry
    let entry = await env.createEntry('photoShare', {
      fields: {
        image: { 'en-US': { sys: { type: 'Link', linkType: 'Asset', id: asset.sys.id } } },
        name: { 'en-US': name },
        description: { 'en-US': description },
        like: { 'en-US': 0 },
      },
    });

    // 5. Publish entry
    entry = await entry.publish();

    res.status(201).json({ message: 'Photo uploaded successfully', id: entry.sys.id });

  } catch (err) {
    console.error('Upload failed:', err.message);

    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});


//  ROUTE 4: POST /photos/:id/like – Like a photo
app.post('/photos/:id/like', async (req, res) => {
  res.set('Cache-Control', 'no-store'); //  No caching for actions
  const { likes } = req.body; 
  
  try {
    // Validate
    const parsedLikes = parseInt(likes);
    if (isNaN(parsedLikes) || parsedLikes < 0 || parsedLikes > 5) {
      return res.status(400).json({ error: 'Invalid likes value' });
    }

    const space = await managementClient.getSpace(CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(CONTENTFUL_ENVIRONMENT_ID);
    const entry = await env.getEntry(req.params.id);

    entry.fields.like['en-US'] = parsedLikes;

    const updated = await entry.update();
    await updated.publish();

    res.json({ message: 'Like value updated', likes: parsedLikes });
  } catch (err) {
    console.error('Failed to update likes:', err);
    res.status(500).json({ error: 'Failed to update likes', details: err.message });
  }
});


//  ROUTE 5: GET /health – Health check (for monitoring)
app.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store'); // no need to cache
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});


// HTTPS server
const sslOptions = {
  key: fs.readFileSync(SSL_KEY_PATH),
  cert: fs.readFileSync(SSL_CERT_PATH),
};

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`HTTPS Server running at https://localhost:${PORT}`);
});
