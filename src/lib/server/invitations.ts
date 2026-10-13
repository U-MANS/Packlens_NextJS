import { env } from '@/lib/env';

export function inviteUrl(token: string) {
  return `${env.frontendBaseUrl()}/invite/${token}`;
}

export function mapInvitation(
  row: Record<string, unknown> & { inviter?: { name?: string } | null; token?: string },
) {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    role: row.role,
    status: row.status,
    expires_at: row.expires_at,
    accepted_at: row.accepted_at ?? null,
    created_at: row.created_at,
    invited_by_name: row.inviter?.name ?? null,
    invite_url: row.token ? inviteUrl(String(row.token)) : null,
  };
}

export type InviteEmailInput = {
  to: string;
  token: string;
  role: string;
  name?: string | null;
  inviterName?: string | null;
};

export type InviteEmailResult = {
  sent: boolean;
  messageId: string | null;
  error: string | null;
};

function invitationHtml(input: InviteEmailInput & { url: string }) {
  const who = input.inviterName || 'El equipo de PackLens';
  const greeting = input.name ? `Hola ${input.name},` : 'Hola,';
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:32px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;">
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;font-weight:700;">PackLens</p>
        <h1 style="margin:0 0 16px;font-size:22px;">Te han invitado a PackLens</h1>
        <p style="margin:0 0 12px;line-height:1.5;">${greeting}</p>
        <p style="margin:0 0 20px;line-height:1.5;">${who} te ha invitado como <strong>${input.role}</strong>. Crea tu cuenta con el enlace de abajo. Caduca en 7 días.</p>
        <p style="margin:0 0 24px;">
          <a href="${input.url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Aceptar invitación</a>
        </p>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">Si el botón no funciona, copia este enlace:<br>${input.url}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendWithBrevo(input: InviteEmailInput, url: string): Promise<InviteEmailResult> {
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
      to: [
        {
          email: input.to,
          name: input.name || undefined,
        },
      ],
      subject: 'Te han invitado a PackLens',
      htmlContent: invitationHtml({ ...input, url }),
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    messageId?: string;
    message?: string;
    code?: string;
  };

  if (!res.ok) {
    return {
      sent: false,
      messageId: null,
      error: body.message || `Brevo ${res.status}`,
    };
  }

  return { sent: true, messageId: body.messageId ?? null, error: null };
}

export async function sendInvitationEmail(input: InviteEmailInput): Promise<InviteEmailResult> {
  const url = inviteUrl(input.token);
  try {
    if (!env.brevoApiKey()) {
      return {
        sent: false,
        messageId: null,
        error: 'Falta BREVO_API_KEY en .env.local (la invitación quedó creada).',
      };
    }
    return await sendWithBrevo(input, url);
  } catch (e) {
    return {
      sent: false,
      messageId: null,
      error: e instanceof Error ? e.message : 'Error enviando el correo',
    };
  }
}

export function invitationEmailResponse(
  row: Record<string, unknown> & { inviter?: { name?: string } | null; token?: string },
  email: InviteEmailResult,
) {
  return {
    invitation: mapInvitation(row),
    email_sent: email.sent,
    email_message_id: email.messageId,
    email_error: email.error,
    invite_url: row.token ? inviteUrl(String(row.token)) : null,
  };
}
