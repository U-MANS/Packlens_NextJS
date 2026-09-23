import { NextResponse } from 'next/server';

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(detail: string, status: number) {
  return NextResponse.json({ detail }, { status });
}

export function mapAuthStatus(status: number): number {
  return status === 400 || status === 401 || status === 422 ? 401 : status;
}
