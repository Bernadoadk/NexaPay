import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendOtpEmail } from '../utils/email';
import { toE164 } from '../utils/phone';

const router = Router();
const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createAndSendOtp(userId: string, email: string, name: string): Promise<void> {
  await prisma.otpCode.deleteMany({ where: { userId } });
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.otpCode.create({ data: { email, code, expiresAt, userId } });
  await sendOtpEmail(email, code, name);
}

// POST /auth/register
router.post(
  '/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().notEmpty(),
  async (req, res): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { email, password, name, companyName, phoneCountry } = req.body;
    const country = phoneCountry || 'bj';
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
      await createAndSendOtp(existing.id, email, name);
      res.status(200).json({ requiresVerification: true, email });
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

    await createAndSendOtp(user.id, email, name);
    res.status(201).json({ requiresVerification: true, email });
  }
);

// POST /auth/verify-email
router.post(
  '/verify-email',
  body('email').isEmail().normalizeEmail(),
  body('code').isLength({ min: 6, max: 6 }),
  async (req, res): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { email, code } = req.body;
    const otp = await prisma.otpCode.findFirst({
      where: { email, code, used: false, expiresAt: { gt: new Date() } },
    });

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
  body('email').isEmail().normalizeEmail(),
  async (req, res): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { res.status(404).json({ message: 'Compte introuvable' }); return; }
    if (user.isEmailVerified) { res.status(400).json({ message: 'Compte déjà vérifié' }); return; }

    await createAndSendOtp(user.id, email, user.name);
    res.json({ message: 'Code renvoyé' });
  }
);

// POST /auth/login
router.post(
  '/login',
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
      await createAndSendOtp(user.id, email, user.name);
      res.status(200).json({ requiresVerification: true, email });
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
  if (!idToken) { res.status(400).json({ message: 'Token Google manquant' }); return; }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) { res.status(400).json({ message: 'Token Google invalide' }); return; }

    const { email, name, sub: googleId } = payload;
    let user = await prisma.user.findUnique({ where: { email } });

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
  } catch {
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

router.put('/me', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const { name, companyName, phoneCountry, address, ifu, rccm, useProfilePhotoAsLogo } = req.body;
  const country = phoneCountry || 'bj';
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

export { router as authRouter };
