import { env } from '@/lib/env';

export type SendEmailInput = {
  to: { email: string; name?: string | null }[];
  subject: string;
  html: string;
};

export type SendEmailResult = {
  sent: boolean;
  messageId: string | null;
  error: string | null;
};

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendBrevoEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!env.brevoApiKey()) {
    return { sent: false, messageId: null, error: 'Falta BREVO_API_KEY' };
  }

  const recipients = input.to.filter((r) => r.email?.includes('@'));
  if (!recipients.length) {
    return { sent: false, messageId: null, error: 'Sin destinatarios' };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.brevoApiKey(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: env.brevoSenderName(),
          email: env.brevoSenderEmail(),
        },
        to: recipients.map((r) => ({
          email: r.email,
          name: r.name || undefined,
        })),
        subject: input.subject,
        htmlContent: input.html,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      messageId?: string;
      message?: string;
    };

    if (!res.ok) {
      return { sent: false, messageId: null, error: body.message || `Brevo ${res.status}` };
    }

    return { sent: true, messageId: body.messageId ?? null, error: null };
  } catch (e) {
    return {
      sent: false,
      messageId: null,
      error: e instanceof Error ? e.message : 'Error enviando el correo',
    };
  }
}

export function emailShell(title: string, bodyHtml: string, ctaUrl?: string, ctaLabel?: string) {
  const button =
    ctaUrl && ctaLabel
      ? `<p style="margin:0 0 24px;">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">${escapeHtml(ctaLabel)}</a>
        </p>`
      : '';

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:32px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;">
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;font-weight:700;">PackLens</p>
        <h1 style="margin:0 0 16px;font-size:22px;">${escapeHtml(title)}</h1>
        ${bodyHtml}
        ${button}
      </td>
    </tr>
  </table>
</body>
</html>`;
}
