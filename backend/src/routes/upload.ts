import { Router } from 'express';
import multer from 'multer';
import { cloudinary, deleteCloudinaryImage } from '../lib/cloudinary';
import { authenticate, AuthRequest } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Store in memory then push to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Seules les images sont acceptées'));
    } else {
      cb(null, true);
    }
  },
});

function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId?: string,
  transformation?: object[],
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
        format: 'webp',
        quality: 'auto',
        transformation,
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Upload échoué'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

// POST /api/upload/avatar — upload photo de profil
router.post('/avatar', authenticate, upload.single('image'), async (req: AuthRequest, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ message: 'Aucun fichier reçu' }); return; }

  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { logoPublicId: true } });

  // Delete old avatar from Cloudinary if exists
  if (user?.logoPublicId) await deleteCloudinaryImage(user.logoPublicId);

  const { url, publicId } = await uploadToCloudinary(
    req.file.buffer,
    'NexaPay/avatars',
    `avatar_${req.userId}`
  );

  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: { logoUrl: url, logoPublicId: publicId },
    select: USER_SELECT,
  });

  res.json(updated);
});

// DELETE /api/upload/avatar — supprimer photo de profil
router.delete('/avatar', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { logoPublicId: true } });

  if (user?.logoPublicId) await deleteCloudinaryImage(user.logoPublicId);

  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: { logoUrl: null, logoPublicId: null },
    select: USER_SELECT,
  });

  res.json(updated);
});

// POST /api/upload/quote-logo — upload logo devis séparé
router.post('/quote-logo', authenticate, upload.single('image'), async (req: AuthRequest, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ message: 'Aucun fichier reçu' }); return; }

  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { quoteLogoPublicId: true } });

  if (user?.quoteLogoPublicId) await deleteCloudinaryImage(user.quoteLogoPublicId);

  const { url, publicId } = await uploadToCloudinary(
    req.file.buffer,
    'NexaPay/quote-logos',
    `quotelogo_${req.userId}`
  );

  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: { quoteLogoUrl: url, quoteLogoPublicId: publicId },
    select: USER_SELECT,
  });

  res.json(updated);
});

// DELETE /api/upload/quote-logo — supprimer logo devis
router.delete('/quote-logo', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { quoteLogoPublicId: true } });

  if (user?.quoteLogoPublicId) await deleteCloudinaryImage(user.quoteLogoPublicId);

  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: { quoteLogoUrl: null, quoteLogoPublicId: null },
    select: USER_SELECT,
  });

  res.json(updated);
});

// POST /api/upload/store-logo
router.post('/store-logo', authenticate, upload.single('image'), async (req: AuthRequest, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ message: 'Aucun fichier reçu' }); return; }
  const store = await prisma.store.findUnique({ where: { userId: req.userId! }, select: { id: true } });
  if (!store) { res.status(404).json({ message: 'Boutique introuvable' }); return; }

  const { url } = await uploadToCloudinary(
    req.file.buffer,
    'NexaPay/stores/logos',
    `store_logo_${store.id}`,
    [{ width: 600, height: 600, crop: 'fill', gravity: 'auto' }],
  );
  const updated = await prisma.store.update({ where: { id: store.id }, data: { logoUrl: url } });
  res.json(updated);
});

router.delete('/store-logo', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const store = await prisma.store.findUnique({ where: { userId: req.userId! }, select: { id: true } });
  if (!store) { res.status(404).json({ message: 'Boutique introuvable' }); return; }
  await deleteCloudinaryImage(`NexaPay/stores/logos/store_logo_${store.id}`);
  const updated = await prisma.store.update({ where: { id: store.id }, data: { logoUrl: null } });
  res.json(updated);
});

// POST /api/upload/store-cover
router.post('/store-cover', authenticate, upload.single('image'), async (req: AuthRequest, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ message: 'Aucun fichier reçu' }); return; }
  const store = await prisma.store.findUnique({ where: { userId: req.userId! }, select: { id: true } });
  if (!store) { res.status(404).json({ message: 'Boutique introuvable' }); return; }

  const { url } = await uploadToCloudinary(
    req.file.buffer,
    'NexaPay/stores/covers',
    `store_cover_${store.id}`,
    [{ width: 1800, height: 720, crop: 'fill', gravity: 'auto' }],
  );
  const updated = await prisma.store.update({ where: { id: store.id }, data: { coverImageUrl: url } });
  res.json(updated);
});

router.delete('/store-cover', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const store = await prisma.store.findUnique({ where: { userId: req.userId! }, select: { id: true } });
  if (!store) { res.status(404).json({ message: 'Boutique introuvable' }); return; }
  await deleteCloudinaryImage(`NexaPay/stores/covers/store_cover_${store.id}`);
  const updated = await prisma.store.update({ where: { id: store.id }, data: { coverImageUrl: null } });
  res.json(updated);
});

// POST /api/upload/store-product/:productId
router.post('/store-product/:productId', authenticate, upload.single('image'), async (req: AuthRequest, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ message: 'Aucun fichier reçu' }); return; }
  const product = await prisma.storeProduct.findFirst({
    where: { id: String(req.params.productId), store: { userId: req.userId! } },
    select: { id: true },
  });
  if (!product) { res.status(404).json({ message: 'Produit boutique introuvable' }); return; }

  const { url } = await uploadToCloudinary(
    req.file.buffer,
    'NexaPay/stores/products',
    `store_product_${product.id}`,
    [{ width: 1200, height: 900, crop: 'fill', gravity: 'auto' }],
  );
  const updated = await prisma.storeProduct.update({ where: { id: product.id }, data: { imageUrl: url } });
  res.json(updated);
});

router.delete('/store-product/:productId', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const product = await prisma.storeProduct.findFirst({
    where: { id: String(req.params.productId), store: { userId: req.userId! } },
    select: { id: true },
  });
  if (!product) { res.status(404).json({ message: 'Produit boutique introuvable' }); return; }
  await deleteCloudinaryImage(`NexaPay/stores/products/store_product_${product.id}`);
  const updated = await prisma.storeProduct.update({ where: { id: product.id }, data: { imageUrl: null } });
  res.json(updated);
});

const USER_SELECT = {
  id: true, email: true, name: true, companyName: true,
  phone: true, address: true, ifu: true, rccm: true,
  logoUrl: true, quoteLogoUrl: true, useProfilePhotoAsLogo: true,
  plan: true, planExpiresAt: true,
};

export { router as uploadRouter };
