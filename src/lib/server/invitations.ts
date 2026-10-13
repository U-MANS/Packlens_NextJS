import { env } from '@/lib/env';
import { emailShell, escapeHtml, sendBrevoEmail } from '@/lib/server/email';

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

export async function sendInvitationEmail(input: InviteEmailInput): Promise<InviteEmailResult> {
  const url = inviteUrl(input.token);
  const who = input.inviterName || 'El equipo de PackLens';
  const greeting = input.name ? `Hola ${escapeHtml(input.name)},` : 'Hola,';

  return sendBrevoEmail({
    to: [{ email: input.to, name: input.name }],
    subject: 'Te han invitado a PackLens',
    html: emailShell(
      'Te han invitado a PackLens',
      `<p style="margin:0 0 12px;line-height:1.5;">${greeting}</p>
       <p style="margin:0 0 20px;line-height:1.5;">${escapeHtml(who)} te ha invitado como <strong>${escapeHtml(input.role)}</strong>. Crea tu cuenta con el enlace de abajo. Caduca en 7 días.</p>
       <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">Si el botón no funciona, copia este enlace:<br>${escapeHtml(url)}</p>`,
      url,
      'Aceptar invitación',
    ),
  });
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
