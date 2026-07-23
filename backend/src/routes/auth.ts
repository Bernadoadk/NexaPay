import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { sendOtpEmail, smtpErrorMessage } from '../utils/email';
import { countryFromPhone, toE164 } from '../utils/phone';
import { deleteCloudinaryImage } from '../lib/cloudinary';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

type GoogleAuthMode = 'login' | 'register';
type GoogleProfile = { email: string; name?: string };

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createAndSendOtp(userId: string, email: string, name: string): Promise<void> {
  const code = generateOtp();
  await sendOtpEmail(email, code, name);
  await prisma.otpCode.deleteMany({ where: { userId } });
  const hashedCode = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.otpCode.create({ data: { email, code: hashedCode, expiresAt, userId } });
}

function otpSendFailureResponse(
  res: import('express').Response,
  email: string,
  err: unknown,
): void {
  console.error('[OTP] Envoi email échoué:', err);
  res.status(502).json({
    message: smtpErrorMessage(err),
    requiresVerification: true,
    email,
    emailSent: false,
  });
}

const authAttemptLimiter = rateLimit({
  keyPrefix: 'auth-attempt',
  windowMs: 15 * 60 * 1000,
  max: 20,
  key: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
});

const otpLimiter = rateLimit({
  keyPrefix: 'otp',
  windowMs: 10 * 60 * 1000,
  max: 6,
  key: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
  message: 'Trop de tentatives OTP. Réessayez dans quelques minutes.',
});

const resendOtpLimiter = rateLimit({
  keyPrefix: 'otp-resend',
  windowMs: 10 * 60 * 1000,
  max: 3,
  key: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
  message: 'Trop de demandes de renvoi. Réessayez dans quelques minutes.',
});

async function getGoogleProfile(token: string): Promise<GoogleProfile> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error('Email Google manquant');
    return { email: payload.email, name: payload.name };
  } catch {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Token Google invalide');

    const profile = await response.json() as GoogleProfile;
    if (!profile.email) throw new Error('Email Google manquant');
    return { email: profile.email, name: profile.name };
  }
}

// POST /auth/register
router.post(
  '/register',
  authAttemptLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().notEmpty(),
  async (req, res): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

      const { email, password, name, companyName, phoneCountry } = req.body;
      const country = countryFromPhone(req.body.phone, phoneCountry || 'bj');
      const phone = req.body.phone ? toE164(req.body.phone, country) : undefined;
      const existing = await prisma.user.findUnique({ where: { email } });

      if (existing) {
        if (existing.isEmailVerified) {
          res.status(409).json({ message: 'Email déjà utilisé' });
          return;
        }
        const hashed = await bcrypt.hash(password, 10);
        await prisma.user.update({
          where: { id: existing.id },
          data: { password: hashed, name, companyName, phone, phoneCountry: country },
        });
        try {
          await createAndSendOtp(existing.id, email, name);
          res.status(200).json({ requiresVerification: true, email, emailSent: true });
        } catch (otpErr) {
          otpSendFailureResponse(res, email, otpErr);
        }
        return;
      }

      const hashed = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email, password: hashed, name, companyName,
          phone, phoneCountry: country,
          isEmailVerified: false, authProvider: 'email',
          aiCredits: 10,
        },
      });

      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          amount: 10,
          type: 'signup_bonus',
          description: 'Crédits offerts à l\'inscription',
          balanceAfter: 10,
        },
      });

      try {
        await createAndSendOtp(user.id, email, name);
        res.status(201).json({ requiresVerification: true, email, emailSent: true });
      } catch (otpErr) {
        otpSendFailureResponse(res, email, otpErr);
      }
    } catch (err) {
      console.error('[Register]', err);
      if (err instanceof Prisma.PrismaClientInitializationError) {
        res.status(503).json({ message: 'Base de données inaccessible. Vérifiez DATABASE_URL sur Vercel.' });
        return;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
        res.status(503).json({ message: 'Tables manquantes. Exécutez: npx prisma db push' });
        return;
      }
      res.status(500).json({ message: 'Erreur lors de la création du compte' });
    }
  }
);

// POST /auth/verify-email
router.post(
  '/verify-email',
  otpLimiter,
  body('email').isEmail().normalizeEmail(),
  body('code').isLength({ min: 6, max: 6 }),
  async (req, res): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { email, code } = req.body;
    const otps = await prisma.otpCode.findMany({
      where: { email, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    let otp = null;
    for (const candidate of otps) {
      if (await bcrypt.compare(code, candidate.code)) {
        otp = candidate;
        break;
      }
    }

    if (!otp) {
      res.status(400).json({ message: 'Code invalide ou expiré' });
      return;
    }

    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    const user = await prisma.user.update({
      where: { email },
      data: { isEmailVerified: true },
      select: USER_SELECT,
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ token, user });
  }
);

// POST /auth/resend-otp
router.post(
  '/resend-otp',
  resendOtpLimiter,
  body('email').isEmail().normalizeEmail(),
  async (req, res): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { res.status(404).json({ message: 'Compte introuvable' }); return; }
    if (user.isEmailVerified) { res.status(400).json({ message: 'Compte déjà vérifié' }); return; }

    try {
      await createAndSendOtp(user.id, email, user.name);
      res.json({ message: 'Code renvoyé', emailSent: true });
    } catch (otpErr) {
      console.error('[OTP] Renvoi échoué:', otpErr);
      res.status(502).json({ message: smtpErrorMessage(otpErr), emailSent: false });
    }
  }
);

// POST /auth/login
router.post(
  '/login',
  authAttemptLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { res.status(401).json({ message: 'Identifiants incorrects' }); return; }

    if (user.authProvider !== 'email' || !user.password) {
      res.status(401).json({
        message: `Ce compte utilise la connexion ${user.authProvider === 'google' ? 'Google' : 'Apple'}`,
      });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) { res.status(401).json({ message: 'Identifiants incorrects' }); return; }

    if (!user.isEmailVerified) {
      try {
        await createAndSendOtp(user.id, email, user.name);
        res.status(200).json({ requiresVerification: true, email, emailSent: true });
      } catch (otpErr) {
        otpSendFailureResponse(res, email, otpErr);
      }
      return;
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  }
);

// POST /auth/google
router.post('/google', async (req, res): Promise<void> => {
  const { idToken } = req.body;
  const mode = req.body.mode === 'login' || req.body.mode === 'register'
    ? req.body.mode as GoogleAuthMode
    : undefined;
  if (!idToken) { res.status(400).json({ message: 'Token Google manquant' }); return; }

  try {
    const { email, name } = await getGoogleProfile(idToken);
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user && mode === 'login') {
      res.status(404).json({
        message: 'Aucun compte Google trouvé avec cette adresse. Créez d’abord un compte.',
      });
      return;
    }

    if (user && mode === 'register') {
      res.status(409).json({
        message: 'Un compte existe déjà avec cette adresse Google. Connectez-vous plutôt.',
      });
      return;
    }

    if (user) {
      if (user.authProvider === 'email') {
        // Merge: allow Google on existing email account
        user = await prisma.user.update({
          where: { email },
          data: { isEmailVerified: true, authProvider: 'google' },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          isEmailVerified: true,
          authProvider: 'google',
          aiCredits: 10,
        },
      });
      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          amount: 10,
          type: 'signup_bonus',
          description: 'Crédits offerts à l\'inscription',
          balanceAfter: 10,
        },
      });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('[Google Auth]', err);
    res.status(401).json({ message: 'Authentification Google échouée' });
  }
});

// POST /auth/apple
router.post('/apple', async (req, res): Promise<void> => {
  const { identityToken, user: appleUser } = req.body;
  if (!identityToken) { res.status(400).json({ message: 'Token Apple manquant' }); return; }

  try {
    const payload = await appleSignin.verifyIdToken(identityToken, {
      audience: process.env.APPLE_CLIENT_ID,
      ignoreExpiration: false,
    });

    const email = payload.email;
    if (!email) { res.status(400).json({ message: 'Email Apple non disponible' }); return; }

    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      if (user.authProvider === 'email') {
        user = await prisma.user.update({
          where: { email },
          data: { isEmailVerified: true, authProvider: 'apple' },
        });
      }
    } else {
      const name = appleUser?.name
        ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim()
        : email.split('@')[0];
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          isEmailVerified: true,
          authProvider: 'apple',
          aiCredits: 10,
        },
      });
      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          amount: 10,
          type: 'signup_bonus',
          description: 'Crédits offerts à l\'inscription',
          balanceAfter: 10,
        },
      });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch {
    res.status(401).json({ message: 'Authentification Apple échouée' });
  }
});

export const USER_SELECT = {
  id: true, email: true, name: true, companyName: true,
  phone: true, phoneCountry: true, address: true, ifu: true, rccm: true,
  logoUrl: true, quoteLogoUrl: true, useProfilePhotoAsLogo: true,
  plan: true, planExpiresAt: true, planInterval: true,
  aiCredits: true, isEmailVerified: true, authProvider: true,
};

router.get('/me', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: USER_SELECT });
  if (!user) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }
  res.json(user);
});

router.get('/export-data', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const [user, clients, products, quotes, payments, creditTransactions] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT }),
    prisma.client.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.product.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.quote.findMany({
      where: { userId },
      include: { client: true, items: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.creditTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ]);

  if (!user) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }

  res.json({
    exportedAt: new Date().toISOString(),
    user,
    clients,
    products,
    quotes,
    payments,
    creditTransactions,
  });
});

router.put('/me', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const { name, companyName, phoneCountry, address, ifu, rccm, useProfilePhotoAsLogo } = req.body;
  const country = countryFromPhone(req.body.phone, phoneCountry || 'bj');
  const phone = req.body.phone !== undefined
    ? (req.body.phone ? toE164(req.body.phone, country) : '')
    : undefined;
  const data: Record<string, unknown> = { name, companyName, phoneCountry: country, address, ifu, rccm };
  if (phone !== undefined) data.phone = phone;
  if (useProfilePhotoAsLogo !== undefined) data.useProfilePhotoAsLogo = Boolean(useProfilePhotoAsLogo);
  const user = await prisma.user.update({
    where: { id: req.userId },
    data,
    select: USER_SELECT,
  });
  res.json(user);
});

router.delete('/me', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (req.body?.confirm !== 'SUPPRIMER') {
    res.status(400).json({ message: 'Confirmation requise' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { logoPublicId: true, quoteLogoPublicId: true },
  });
  if (!user) { res.status(404).json({ message: 'Utilisateur introuvable' }); return; }

  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { userId: req.userId! } }),
    prisma.user.delete({ where: { id: req.userId! } }),
  ]);

  await Promise.all([
    user.logoPublicId ? deleteCloudinaryImage(user.logoPublicId) : Promise.resolve(),
    user.quoteLogoPublicId ? deleteCloudinaryImage(user.quoteLogoPublicId) : Promise.resolve(),
  ]);

  res.status(204).send();
});

export { router as authRouter };
