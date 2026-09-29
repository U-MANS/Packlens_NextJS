import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([
    'Spot TV',
    'RRSS',
    'Corporativo',
    'Banner',
    'Gran formato',
  ]);
}
