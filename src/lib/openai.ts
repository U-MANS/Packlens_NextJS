import OpenAI from 'openai';
import { env } from '@/lib/env';

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  const key = env.openaiApiKey();
  if (!key) {
    throw new Error('Falta OPENAI_API_KEY en .env.local');
  }
  if (!client) {
    client = new OpenAI({ apiKey: key });
  }
  return client;
}
