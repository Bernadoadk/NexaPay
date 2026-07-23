import nodemailer from 'nodemailer';

export class SmtpConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmtpConfigError';
  }
}

export function assertSmtpConfigured(): void {
  if (!process.env.SMTP_USER?.trim() || !process.env.SMTP_PASS?.trim()) {
    throw new SmtpConfigError(
      'SMTP non configuré : définissez SMTP_USER et SMTP_PASS (mot de passe d\'application Gmail).',
    );
  }
}

export function smtpErrorMessage(err: unknown): string {
  if (err instanceof SmtpConfigError) return err.message;

  const msg = err instanceof Error ? err.message : String(err);
  if (/EAUTH|Invalid login|authentication|535|534/i.test(msg)) {
    return 'Authentification SMTP refusée. Vérifiez SMTP_USER et SMTP_PASS (mot de passe d\'application Google).';
  }
  if (/ECONNECTION|ETIMEDOUT|ESOCKET|ECONNREFUSED/i.test(msg)) {
    return 'Connexion SMTP impossible. Vérifiez SMTP_HOST, SMTP_PORT et votre réseau.';
  }
  return `Envoi e-mail échoué : ${msg}`;
}

type QuoteEmailData = {
  to: string;
  clientName: string;
  quoteNumber: string;
  quoteTitle: string;
  total: number;
  companyName: string;
  templateName?: string;
  paymentUrl?: string;
  pdfBuffer: Buffer;
};

type AdminAlertData = {
  subject: string;
  title: string;
  message: string;
  details?: Record<string, unknown>;
};

type FeedbackEmailData = {
  subject: string;
  messageHtml: string;
  messageText: string;
  user: {
    name: string;
    email: string;
    companyName?: string | null;
    plan?: string | null;
  };
  source?: string | null;
  createdAt: Date;
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function fromAddress() {
  return process.env.SMTP_FROM || `"NexaPay" <${process.env.SMTP_USER}>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtXof(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} FCFA`;
}

export async function sendOtpEmail(email: string, code: string, name: string): Promise<void> {
  assertSmtpConfigured();
  await transporter.sendMail({
    from: fromAddress(),
    to: email,
    subject: `${code} — Votre code de vérification NexaPay`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0F8F65,#0a6648);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">NexaPay</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111;">Bonjour ${name},</h2>
            <p style="margin:0 0 32px;color:#666;font-size:15px;line-height:1.6;">
              Voici votre code de vérification nexapay. Il expire dans <strong>10 minutes</strong>.
            </p>
            <div style="background:#f4fdf9;border:2px solid #0F8F65;border-radius:12px;padding:28px;text-align:center;margin-bottom:32px;">
              <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#0F8F65;font-family:'Courier New',monospace;">${code}</span>
            </div>
            <p style="margin:0;color:#999;font-size:13px;text-align:center;line-height:1.5;">
              Si vous n'avez pas demandé ce code, ignorez cet e-mail.<br/>
              Ce code ne peut être utilisé qu'une seule fois.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;color:#bbb;font-size:12px;">© 2025 NexaPay · Gestion de devis professionnels</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  });
}

export async function sendQuoteEmail(data: QuoteEmailData): Promise<void> {
  const clientName = escapeHtml(data.clientName || 'Client');
  const quoteNumber = escapeHtml(data.quoteNumber);
  const quoteTitle = escapeHtml(data.quoteTitle);
  const companyName = escapeHtml(data.companyName || 'NexaPay');
  const templateLine = data.templateName
    ? `<p style="margin:0 0 14px;color:#6b7280;font-size:13px;">Modèle utilisé : <strong>${escapeHtml(data.templateName)}</strong></p>`
    : '';
  const paymentButton = data.paymentUrl
    ? `
          <div style="margin:22px 0 18px;text-align:center;">
            <a href="${escapeHtml(data.paymentUrl)}" style="display:inline-block;background:#0F8F65;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 20px;border-radius:10px;">
              Payer le devis
            </a>
          </div>
          <p style="margin:0 0 18px;color:#6b7280;font-size:13px;line-height:1.5;text-align:center;">
            Paiement sécurisé par Mobile Money ou carte bancaire.
          </p>
    `
    : '';

  await transporter.sendMail({
    from: fromAddress(),
    to: data.to,
    subject: `Devis ${data.quoteNumber} — ${data.quoteTitle}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0F8F65;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${companyName}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">Bonjour ${clientName},</h2>
          <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.6;">
            Veuillez trouver en pièce jointe le devis <strong>${quoteNumber}</strong> concernant <strong>${quoteTitle}</strong>.
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px;margin:0 0 18px;">
            <div style="color:#166534;font-size:13px;margin-bottom:6px;">Montant total TTC</div>
            <div style="color:#14532d;font-size:24px;font-weight:700;">${fmtXof(data.total)}</div>
          </div>
          ${paymentButton}
          ${templateLine}
          <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">
            Merci de votre confiance.
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Envoyé avec NexaPay · Gestion de devis professionnels</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
    attachments: [{
      filename: `${data.quoteNumber}.pdf`,
      content: data.pdfBuffer,
      contentType: 'application/pdf',
    }],
  });
}

export async function sendAdminAlertEmail(data: AdminAlertData): Promise<void> {
  const details = data.details
    ? `<pre style="white-space:pre-wrap;background:#f4f4f5;border-radius:10px;padding:12px;color:#374151;font-size:12px;">${escapeHtml(JSON.stringify(data.details, null, 2))}</pre>`
    : '';

  await transporter.sendMail({
    from: fromAddress(),
    to: 'adikpetobernado@gmail.com',
    subject: data.subject,
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;">
    <h1 style="margin:0 0 12px;color:#111827;font-size:20px;">${escapeHtml(data.title)}</h1>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6;">${escapeHtml(data.message)}</p>
    ${details}
  </div>
</body>
</html>
    `,
  });
}

export async function sendFeedbackEmail(data: FeedbackEmailData): Promise<void> {
  const subject = escapeHtml(data.subject);
  const userName = escapeHtml(data.user.name);
  const userEmail = escapeHtml(data.user.email);
  const company = data.user.companyName ? escapeHtml(data.user.companyName) : 'Non renseigné';
  const source = escapeHtml(data.source || 'dashboard');
  const plan = escapeHtml(data.user.plan || 'FREE');
  const createdAt = data.createdAt.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

  await transporter.sendMail({
    from: fromAddress(),
    to: 'adikpetobernado@gmail.com',
    replyTo: data.user.email,
    subject: `[Retour NexaPay] ${data.subject}`,
    text: [
      `Objet : ${data.subject}`,
      `Utilisateur : ${data.user.name} <${data.user.email}>`,
      `Entreprise : ${data.user.companyName || 'Non renseigné'}`,
      `Plan : ${data.user.plan || 'FREE'}`,
      `Source : ${data.source || 'dashboard'}`,
      '',
      data.messageText,
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0F8F65;padding:22px 24px;color:#ffffff;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.82;">Nouveau retour utilisateur</div>
      <h1 style="margin:6px 0 0;font-size:20px;line-height:1.25;">${subject}</h1>
    </div>
    <div style="padding:22px 24px;">
      <div style="margin:0 0 18px;padding:14px;border-radius:12px;background:#f8faf9;border:1px solid #e4e7e3;">
        <div style="font-size:13px;color:#374151;line-height:1.7;">
          <strong>${userName}</strong> · ${userEmail}<br/>
          Entreprise : ${company}<br/>
          Plan : ${plan} · Source : ${source}<br/>
          Envoyé le ${escapeHtml(createdAt)}
        </div>
      </div>
      <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:10px;">Message</div>
      <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;color:#111827;font-size:14px;line-height:1.65;">
        ${data.messageHtml}
      </div>
    </div>
  </div>
</body>
</html>
    `,
  });
}
