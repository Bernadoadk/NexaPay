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

function uploadToCloudinary(buffer: Buffer, folder: string, publicId?: string): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, overwrite: true, resource_type: 'image' },
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

const USER_SELECT = {
  id: true, email: true, name: true, companyName: true,
  phone: true, address: true, ifu: true, rccm: true,
  logoUrl: true, quoteLogoUrl: true, useProfilePhotoAsLogo: true,
  plan: true, planExpiresAt: true,
};

export { router as uploadRouter };
