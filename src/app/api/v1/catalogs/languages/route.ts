import { NextResponse } from 'next/server';

const LANGUAGES = ['Español', 'Portugués', 'Francés', 'Italiano', 'Alemán', 'Inglés'];

export async function GET() {
  return NextResponse.json(LANGUAGES);
}
