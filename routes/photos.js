// routes/photos.js
import express from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import contentfulManagement from 'contentful-management';
import { createClient } from 'contentful';

const router = express.Router();
const upload = multer(); 

// GET /photos – Authenticated users only
router.get('/', authenticateToken, async (req, res) => {
  try {
    const deliveryClient = createClient({
      space: process.env.CONTENTFUL_SPACE_ID,
      accessToken: process.env.CONTENTFUL_DELIVERY_TOKEN,
    });

    const entries = await deliveryClient.getEntries({
      content_type: 'photoShare',
      order: '-sys.createdAt',
      include: 2,
    });

    const assetMap = {};
    if (entries.includes?.Asset) {
      for (const asset of entries.includes.Asset) {
        assetMap[asset.sys.id] = asset;
      }
    }

    const photos = entries.items.map((item) => {
      let imageUrl = null;
      const imageRef = item.fields.image;

      if (imageRef?.fields?.file?.url) {
        imageUrl = `https:${imageRef.fields.file.url}`;
      } else if (imageRef?.sys?.id && assetMap[imageRef.sys.id]) {
        const asset = assetMap[imageRef.sys.id];
        imageUrl = `https:${asset.fields.file.url}`;
      }

      return {
        id: item.sys.id,
        name: item.fields.name || 'Untitled',
        description: item.fields.description || '',
        imageUrl,
        likes: item.fields.like || 0,
      };
    });

    res.json(photos);
  } catch (err) {
    console.error('Error fetching photos:', err);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// POST /photos – Authenticated users only, upload photo
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const file = req.file;

    if (!name || !description || !file) {
      return res.status(400).json({ error: 'Name, description, and image are required' });
    }

    const client = contentfulManagement.createClient({
      accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
    });

    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT_ID);

    let asset = await env.createAssetFromFiles({
      fields: {
        title: {
          'en-US': name,
        },
        file: {
          'en-US': {
            contentType: file.mimetype,
            fileName: file.originalname,
            file: file.buffer,
          },
        },
      },
    });

    await asset.processForAllLocales();
    asset = await env.getAsset(asset.sys.id);
    await asset.publish();

    const entry = await env.createEntry('photoShare', {
      fields: {
        name: { 'en-US': name },
        description: { 'en-US': description },
        image: {
          'en-US': {
            sys: {
              type: 'Link',
              linkType: 'Asset',
              id: asset.sys.id,
            },
          },
        },
        like: { 'en-US': 0 },
      },
    });

    await entry.publish();

    res.json({ message: 'Photo uploaded successfully' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload photo', details: err.message || err.toString() });
  }
});

// DELETE /photos/:id – Admin only
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const client = contentfulManagement.createClient({
      accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
    });

    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT_ID);

    const entry = await env.getEntry(id);
    if (entry.isPublished()) {
      await entry.unpublish();
    }

    await entry.delete();
    res.json({ message: 'Photo deleted successfully.' });
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// PUT /photos/:id/likes – Update like count (Authenticated users)
router.put('/:id/likes', authenticateToken, async (req, res) => {
  const { likes } = req.body;
  const { id } = req.params;

  if (typeof likes !== 'number' || likes < 0 || likes > 5) {
    return res.status(400).json({ error: 'Likes must be a number between 0 and 5' });
  }

  try {
    const client = contentfulManagement.createClient({
      accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
    });

    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const env = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT_ID);

    const entry = await env.getEntry(id);
    entry.fields.like['en-US'] = likes;

    const updatedEntry = await entry.update();
    await updatedEntry.publish();

    res.json({ message: 'Likes updated', likes });
  } catch (err) {
    console.error('Error updating likes:', err.message || err);
    res.status(500).json({ error: 'Failed to update likes' });
  }
});

export default router;
