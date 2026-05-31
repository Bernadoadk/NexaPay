import nodemailer from 'nodemailer';

type QuoteEmailData = {
  to: string;
  clientName: string;
  quoteNumber: string;
  quoteTitle: string;
  total: number;
  companyName: string;
  templateName?: string;
  pdfBuffer: Buffer;
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
