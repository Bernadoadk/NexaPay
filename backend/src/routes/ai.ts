import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { maybeRenewCredits } from './credits';
import { sendAdminAlertEmail } from '../utils/email';

const router = Router();
const prisma = new PrismaClient();

const OPENAI_BASE = 'https://api.openai.com/v1';
const AI_COST = 1; // 1 crédit par appel IA
let lastQuotaAlertAt = 0;

class OpenAiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function openaiChat(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAiError('OPENAI_API_KEY non configuré', 'no_api_key');

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.4,
    }),
  });

  const data = await res.json() as any;
  if (!res.ok) {
    throw new OpenAiError(
      data?.error?.message || JSON.stringify(data),
      data?.error?.code || data?.error?.type,
      res.status,
    );
  }
  return data.choices?.[0]?.message?.content || '';
}

// Refund a previously-deducted credit (when AI call fails after deduction).
async function refundCredit(userId: string, reason: string): Promise<number> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { aiCredits: { increment: AI_COST } },
    select: { aiCredits: true },
  });
  await prisma.creditTransaction.create({
    data: {
      userId,
      amount: AI_COST,
      type: 'refund',
      description: `Remboursement — ${reason} (échec IA)`,
      balanceAfter: user.aiCredits,
    },
  });
  return user.aiCredits;
}

// Map an OpenAI error to a user-friendly French message.
function aiErrorMessage(err: any): string {
  const raw: string = err?.message || '';
  const code: string = err?.code || '';
  const status: number = err?.status || 0;

  if (code === 'insufficient_quota' || /exceeded your current quota/i.test(raw)) {
    return "Bientôt disponible. Vos crédits n'ont pas été consommés.";
  }
  if (status === 429 || /rate limit/i.test(raw)) {
    return "Trop de demandes vers l'IA en ce moment. Réessayez dans quelques secondes — votre crédit a été restitué.";
  }
  if (code === 'no_api_key') {
    return "Bientôt disponible. Vos crédits n'ont pas été consommés.";
  }
  if (status >= 500) {
    return "Le service IA est momentanément indisponible. Votre crédit a été restitué — réessayez dans un instant.";
  }
  return `Erreur IA : ${raw}`;
}

function isAiProviderQuotaError(err: any): boolean {
  const raw: string = err?.message || '';
  const code: string = err?.code || '';
  return code === 'insufficient_quota' || /exceeded your current quota/i.test(raw);
}

async function notifyAiQuotaIfNeeded(err: any, context: { action: string; userId?: string }) {
  if (!isAiProviderQuotaError(err)) return;
  const now = Date.now();
  if (now - lastQuotaAlertAt < 15 * 60 * 1000) return;
  lastQuotaAlertAt = now;

  await sendAdminAlertEmail({
    subject: 'NexaPay — quota OpenAI épuisé',
    title: 'Quota fournisseur IA épuisé',
    message: 'Une requête IA a échoué car le quota de la clé API semble épuisé.',
    details: {
      action: context.action,
      userId: context.userId,
      code: err?.code,
      status: err?.status,
      message: err?.message,
      date: new Date().toISOString(),
    },
  }).catch((mailErr) => {
    console.error('[AIQuotaAlert] Notification échouée:', mailErr?.message ?? mailErr);
  });
}

async function deductCredit(userId: string, action: string): Promise<{ ok: boolean; remaining: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { aiCredits: true } });
  if (!user || user.aiCredits < AI_COST) return { ok: false, remaining: user?.aiCredits ?? 0 };

  const newBalance = user.aiCredits - AI_COST;
  await prisma.user.update({ where: { id: userId }, data: { aiCredits: newBalance } });
  await prisma.creditTransaction.create({
    data: {
      userId,
      amount: -AI_COST,
      type: 'ai_use',
      description: action,
      balanceAfter: newBalance,
    },
  });
  return { ok: true, remaining: newBalance };
}

// ──────────────────────────────────────────────────────────────
// POST /api/ai/generate-quote
// Body: { description: string }
// Returns: { title, items: [{description, quantity, unitPrice}] }
// ──────────────────────────────────────────────────────────────
router.post('/generate-quote', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const { description } = req.body as { description: string };
  if (!description?.trim()) { res.status(400).json({ message: 'Description requise' }); return; }

  await maybeRenewCredits(req.userId!);
  const deduct = await deductCredit(req.userId!, 'Génération devis IA');
  if (!deduct.ok) {
    res.status(402).json({ message: 'Crédits IA insuffisants', aiCredits: deduct.remaining });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    const refunded = await refundCredit(req.userId!, 'Génération devis IA').catch(() => deduct.remaining);
    await sendAdminAlertEmail({
      subject: 'NexaPay — OPENAI_API_KEY manquante',
      title: 'IA non configurée',
      message: 'Une requête IA a été faite mais OPENAI_API_KEY est absente.',
      details: { action: 'Génération devis IA', userId: req.userId, date: new Date().toISOString() },
    }).catch(() => {});
    res.status(503).json({ message: "Bientôt disponible. Vos crédits n'ont pas été consommés.", aiCredits: refunded });
    return;
  }

  try {
    const prompt = `Tu es un assistant pour créer des devis professionnels au Bénin (monnaie : FCFA).
À partir de cette description de travaux : "${description}"

Génère un JSON avec :
- title (string) : titre court du devis
- items (array) : liste des postes, chacun avec :
  - description (string) : nom du poste
  - quantity (number) : quantité
  - unitPrice (number) : prix unitaire en FCFA (entier, prix réaliste pour le marché béninois)

Réponds UNIQUEMENT avec le JSON valide, sans markdown, sans explication.`;

    const raw = await openaiChat([{ role: 'user', content: prompt }]);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);
    res.json({ ...result, aiCredits: deduct.remaining });
  } catch (err: any) {
    await notifyAiQuotaIfNeeded(err, { action: 'Génération devis IA', userId: req.userId });
    const refunded = await refundCredit(req.userId!, 'Génération devis IA').catch(() => deduct.remaining);
    res.status(502).json({ message: aiErrorMessage(err), aiCredits: refunded });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/ai/suggest-price
// Body: { service: string, city?: string, details?: string }
// Returns: { min, max, average, currency, advice }
// ──────────────────────────────────────────────────────────────
router.post('/suggest-price', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const { service, city = 'Cotonou', details } = req.body as { service: string; city?: string; details?: string };
  if (!service?.trim()) { res.status(400).json({ message: 'Service requis' }); return; }

  await maybeRenewCredits(req.userId!);
  const deduct = await deductCredit(req.userId!, 'Suggestion de prix IA');
  if (!deduct.ok) {
    res.status(402).json({ message: 'Crédits IA insuffisants', aiCredits: deduct.remaining });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    const refunded = await refundCredit(req.userId!, 'Suggestion de prix IA').catch(() => deduct.remaining);
    await sendAdminAlertEmail({
      subject: 'NexaPay — OPENAI_API_KEY manquante',
      title: 'IA non configurée',
      message: 'Une requête IA a été faite mais OPENAI_API_KEY est absente.',
      details: { action: 'Suggestion de prix IA', userId: req.userId, date: new Date().toISOString() },
    }).catch(() => {});
    res.status(503).json({ message: "Bientôt disponible. Vos crédits n'ont pas été consommés.", aiCredits: refunded });
    return;
  }

  try {
    const prompt = `Tu es expert en tarification de services au Bénin et en Afrique de l'Ouest (FCFA).
Service : "${service}"
Ville : ${city}
${details ? `Détails : ${details}` : ''}

Donne une estimation de prix réaliste pour le marché local béninois en FCFA.
Réponds UNIQUEMENT avec ce JSON valide :
{"min": number, "max": number, "average": number, "currency": "FCFA", "advice": "conseil court en français"}`;

    const raw = await openaiChat([{ role: 'user', content: prompt }]);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);
    res.json({ ...result, aiCredits: deduct.remaining });
  } catch (err: any) {
    await notifyAiQuotaIfNeeded(err, { action: 'Suggestion de prix IA', userId: req.userId });
    const refunded = await refundCredit(req.userId!, 'Suggestion de prix IA').catch(() => deduct.remaining);
    res.status(502).json({ message: aiErrorMessage(err), aiCredits: refunded });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/ai/improve-text
// Body: { text: string, context?: string }
// Returns: { improved: string }
// ──────────────────────────────────────────────────────────────
router.post('/improve-text', authenticate, async (req: AuthRequest, res): Promise<void> => {
  const { text, context } = req.body as { text: string; context?: string };
  if (!text?.trim()) { res.status(400).json({ message: 'Texte requis' }); return; }

  await maybeRenewCredits(req.userId!);
  const deduct = await deductCredit(req.userId!, 'Amélioration texte IA');
  if (!deduct.ok) {
    res.status(402).json({ message: 'Crédits IA insuffisants', aiCredits: deduct.remaining });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    const refunded = await refundCredit(req.userId!, 'Amélioration texte IA').catch(() => deduct.remaining);
    await sendAdminAlertEmail({
      subject: 'NexaPay — OPENAI_API_KEY manquante',
      title: 'IA non configurée',
      message: 'Une requête IA a été faite mais OPENAI_API_KEY est absente.',
      details: { action: 'Amélioration texte IA', userId: req.userId, date: new Date().toISOString() },
    }).catch(() => {});
    res.status(503).json({ message: "Bientôt disponible. Vos crédits n'ont pas été consommés.", aiCredits: refunded });
    return;
  }

  try {
    const prompt = `Tu es rédacteur professionnel pour des devis commerciaux au Bénin.
${context ? `Contexte : ${context}\n` : ''}
Reformule ce texte de façon professionnelle, claire et convaincante en français.
Garde le même sens. Maximum 3 phrases. Ne commence pas par "Je".
Texte original : "${text}"

Réponds UNIQUEMENT avec le texte amélioré, sans guillemets, sans explication.`;

    const improved = await openaiChat([{ role: 'user', content: prompt }]);
    res.json({ improved: improved.trim(), aiCredits: deduct.remaining });
  } catch (err: any) {
    await notifyAiQuotaIfNeeded(err, { action: 'Amélioration texte IA', userId: req.userId });
    const refunded = await refundCredit(req.userId!, 'Amélioration texte IA').catch(() => deduct.remaining);
    res.status(502).json({ message: aiErrorMessage(err), aiCredits: refunded });
  }
});

export { router as aiRouter };
