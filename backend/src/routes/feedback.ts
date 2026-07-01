import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendFeedbackEmail } from '../utils/email';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

function cleanString(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cleanFontFamily(value: string) {
  const font = value.replace(/[^a-zA-Z0-9À-ÿ ._-]/g, '').trim().slice(0, 80);
  return font || null;
}

function sanitizeRichHtml(value: string) {
  let html = value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\son\w+=\S+/gi, '')
    .replace(/javascript:/gi, '');

  html = html.replace(/<(\/?)([^>\s/]+)([^>]*)>/gi, (_match, slash, tag, attrs) => {
    const safeTag = String(tag).toLowerCase();
    if (!['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div'].includes(safeTag)) {
      return '';
    }
    if (slash) return `</${safeTag}>`;
    if (safeTag !== 'span' && safeTag !== 'div' && safeTag !== 'p') return `<${safeTag}>`;

    const styleMatch = String(attrs).match(/style=(["'])(.*?)\1/i);
    if (!styleMatch) return `<${safeTag}>`;
    const safeStyles = styleMatch[2]
      .split(';')
      .map(part => part.trim())
      .filter(part => /^(font-family|font-size|font-weight|font-style)\s*:/i.test(part))
      .filter(part => !/url|expression|javascript/i.test(part))
      .join('; ');
    return safeStyles ? `<${safeTag} style="${safeStyles}">` : `<${safeTag}>`;
  });

  return html.trim();
}

router.post('/', async (req: AuthRequest, res): Promise<void> => {
  try {
    const subject = cleanString(req.body?.subject, 160);
    const rawHtml = cleanString(req.body?.messageHtml, 12000);
    const rawText = cleanString(req.body?.messageText || stripHtml(rawHtml), 6000);
    const fontFamily = cleanString(req.body?.fontFamily, 80);
    const fontSizeRaw = Number(req.body?.fontSize);
    const fontSize = Number.isFinite(fontSizeRaw)
      ? Math.max(10, Math.min(24, Math.round(fontSizeRaw)))
      : null;
    const source = cleanString(req.body?.source || 'dashboard', 60);

    if (subject.length < 2) {
      res.status(400).json({ message: "L'objet est obligatoire" });
      return;
    }
    if (rawText.length < 4) {
      res.status(400).json({ message: 'Le message est trop court' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, companyName: true, plan: true },
    });
    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }

    const messageHtml = sanitizeRichHtml(rawHtml) || escapeHtml(rawText).replace(/\n/g, '<br/>');
    const messageText = rawText;
    const safeFont = cleanFontFamily(fontFamily);

    const feedback = await prisma.feedbackReview.create({
      data: {
        userId: user.id,
        subject,
        messageHtml,
        messageText,
        fontFamily: safeFont,
        fontSize,
        source,
      },
      select: {
        id: true,
        subject: true,
        messageHtml: true,
        messageText: true,
        createdAt: true,
      },
    });

    await sendFeedbackEmail({
      subject,
      messageHtml,
      messageText,
      user,
      source,
      createdAt: feedback.createdAt,
    });

    res.status(201).json(feedback);
  } catch (err: any) {
    console.error('[Feedback] Envoi échoué:', err?.message ?? err);
    res.status(500).json({ message: "Impossible d'envoyer le retour pour le moment" });
  }
});

export { router as feedbackRouter };
