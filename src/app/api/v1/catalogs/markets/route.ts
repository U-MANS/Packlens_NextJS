import { NextResponse } from 'next/server';

const MARKETS = [
  { code: 'ES', label: 'España' },
  { code: 'PT', label: 'Portugal' },
  { code: 'FR', label: 'Francia' },
  { code: 'IT', label: 'Italia' },
  { code: 'DE', label: 'Alemania' },
  { code: 'UK', label: 'Reino Unido' },
];

export async function GET() {
  return NextResponse.json(MARKETS);
}
