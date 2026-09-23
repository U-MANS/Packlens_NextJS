import { NextResponse } from 'next/server';

const FORMATS = [
  'Tarro vidrio 340g',
  'Tarro vidrio 500g',
  'Lata 800g',
  'Botella PET 500ml',
  'Doypack 250g',
];

export async function GET() {
  return NextResponse.json(FORMATS);
}
