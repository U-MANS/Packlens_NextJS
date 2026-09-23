import { NextRequest } from 'next/server';
import { toFile } from 'openai';
import { requireUser } from '@/lib/server/auth';
import { jsonError, jsonOk } from '@/lib/server/http';
import { env } from '@/lib/env';
import { getOpenAI } from '@/lib/openai';
import { generateStorageKey, uploadBytes, getSignedDownloadUrl } from '@/lib/server/files';

const DEFAULT_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2.5-flare';
/** Mejor precisión al editar / usar referencias de estilo */
const STYLE_MODEL =
  process.env.OPENAI_IMAGE_STYLE_MODEL?.trim() || 'gpt-image-2.5-sunburst';

const MAX_REFS = 3;
const MAX_REF_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const VARIATIONS = [
  {
    label: 'Propuesta A · Premium',
    hint: 'Premium minimal packaging, clean typography, soft studio lighting, elegant materials, restrained color palette.',
  },
  {
    label: 'Propuesta B · Retail impact',
    hint: 'Bold colorful retail shelf impact, strong brand hierarchy, high contrast, eye-catching packaging for supermarket aisle.',
  },
  {
    label: 'Propuesta C · Craft',
    hint: 'Craft artisanal natural materials, textured paper or glass, warm organic aesthetic, handmade feel.',
  },
] as const;

function buildPrompt(userPrompt: string, hint: string, withRefs: boolean): string {
  const base = [
    'Creative packaging moodboard inspiration for a food/consumer product.',
    'Photorealistic product packaging concept on a clean studio background.',
    'No logos of real brands. No unreadable gibberish text; keep labels simple or abstract.',
    hint,
    `Brief from the user: ${userPrompt.trim()}`,
  ];

  if (withRefs) {
    base.unshift(
      'Use the uploaded images STRICTLY as artistic style references (color palette, typography feel, materials, layout language, brand mood).',
      'Create a NEW packaging concept inspired by that style. Do not copy logos, trademarks, or exact artwork from the references.',
    );
  }

  return base.join('\n');
}

async function persistProposal(
  userId: string,
  index: number,
  b64: string,
  label: string,
  revisedPrompt: string | null | undefined,
) {
  const buffer = Buffer.from(b64, 'base64');
  const storageKey = generateStorageKey(`moodboard/${userId}`, `proposal-${index + 1}.png`);

  let url: string;
  try {
    await uploadBytes(buffer, storageKey, 'image/png');
    url = await getSignedDownloadUrl(storageKey, 60 * 60 * 24);
  } catch {
    url = `data:image/png;base64,${b64}`;
  }

  return {
    id: `mood-${Date.now()}-${index}`,
    label,
    url,
    storage_key: url.startsWith('data:') ? null : storageKey,
    revised_prompt: revisedPrompt ?? null,
  };
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (!env.openaiApiKey()) {
    return jsonError(
      'OPENAI_API_KEY no configurada. Añádela en PackLens_Nextjs/.env.local y reinicia el servidor.',
      503,
    );
  }

  const contentType = request.headers.get('content-type') || '';
  let prompt = '';
  const referenceFiles: File[] = [];

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    prompt = String(form.get('prompt') ?? '').trim();
    for (const value of form.getAll('references')) {
      if (value instanceof File && value.size > 0) referenceFiles.push(value);
    }
  } else {
    const body = (await request.json().catch(() => ({}))) as { prompt?: string };
    prompt = body.prompt?.trim() ?? '';
  }

  if (!prompt) return jsonError('El prompt es obligatorio', 400);
  if (prompt.length < 8) return jsonError('Describe un poco más la idea (mín. 8 caracteres)', 400);
  if (prompt.length > 1200) return jsonError('Prompt demasiado largo (máx. 1200 caracteres)', 400);

  if (referenceFiles.length > MAX_REFS) {
    return jsonError(`Máximo ${MAX_REFS} diseños de referencia`, 400);
  }

  for (const file of referenceFiles) {
    const type = (file.type || '').toLowerCase();
    if (type && !ALLOWED_TYPES.has(type)) {
      return jsonError(`Formato no soportado (${file.name}). Usa PNG, JPG o WEBP.`, 400);
    }
    if (file.size > MAX_REF_BYTES) {
      return jsonError(`"${file.name}" supera 8 MB`, 400);
    }
  }

  const withRefs = referenceFiles.length > 0;
  const model = withRefs ? STYLE_MODEL : DEFAULT_MODEL;

  try {
    const openai = getOpenAI();

    const refBuffers = withRefs
      ? await Promise.all(
          referenceFiles.map(async (file, i) => ({
            bytes: Buffer.from(await file.arrayBuffer()),
            type: file.type || 'image/png',
            name: file.name || `reference-${i + 1}.png`,
          })),
        )
      : [];

    const results = await Promise.all(
      VARIATIONS.map(async (variation, index) => {
        const fullPrompt = buildPrompt(prompt, variation.hint, withRefs);

        const result = withRefs
          ? await openai.images.edit({
              model,
              image: await Promise.all(
                refBuffers.map((r) => toFile(r.bytes, r.name, { type: r.type })),
              ),
              prompt: fullPrompt,
              size: '1024x1024',
            })
          : await openai.images.generate({
              model,
              prompt: fullPrompt,
              size: '1024x1024',
            });

        const image = result.data?.[0];
        const b64 = image?.b64_json;
        if (!b64) {
          throw new Error(`OpenAI no devolvió imagen (b64) para ${variation.label}`);
        }

        return persistProposal(user.id, index, b64, variation.label, image.revised_prompt);
      }),
    );

    return jsonOk({
      prompt,
      proposals: results,
      model,
      used_references: referenceFiles.length,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[moodboard/generate]', err);
    const message = err instanceof Error ? err.message : 'Error generando moodboard';
    if (message.includes('OPENAI_API_KEY')) return jsonError(message, 503);
    if (message.toLowerCase().includes('verification') || message.toLowerCase().includes('organization')) {
      return jsonError(
        'Tu organización OpenAI puede necesitar verificación para GPT Image. Revisa platform.openai.com → Settings → Organization.',
        403,
      );
    }
    if (message.toLowerCase().includes('billing') || message.includes('429')) {
      return jsonError('Cuota o límite de OpenAI alcanzado. Revisa billing en platform.openai.com.', 429);
    }
    return jsonError(message, 500);
  }
}
