import { NextResponse } from 'next/server';

const PRODUCT_LINES = [
  'Mermeladas y confituras',
  'Conservas vegetales',
  'Conservas de fruta',
  'Salsas y untables',
  'Encurtidos',
  'Frutas en almíbar',
  'Edición especial / Export',
];

export async function GET() {
  return NextResponse.json(PRODUCT_LINES);
}
