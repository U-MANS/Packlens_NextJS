/**
 * Utilidades para renderizar páginas de PDF usando PDF.js.
 * Acepta data URLs (base64) y URLs remotas (Supabase firmadas, proxy API).
 */
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';

import { loadArrayBufferFromUrl } from './files';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

async function loadPdfBytes(source: string): Promise<Uint8Array> {
  if (!source) throw new Error('PDF source vacío');
  const buffer = await loadArrayBufferFromUrl(source);
  return new Uint8Array(buffer);
}

const docCache = new Map<string, Promise<PDFDocumentProxy>>();

async function getPdfDocument(source: string): Promise<PDFDocumentProxy> {
  let pending = docCache.get(source);
  if (!pending) {
    pending = loadPdfBytes(source).then((data) => pdfjsLib.getDocument({ data }).promise);
    docCache.set(source, pending);
    pending.catch(() => docCache.delete(source));
  }
  return pending;
}

/** Obtiene el número total de páginas de un PDF. */
export async function getPdfPageCount(source: string): Promise<number> {
  const pdf = await getPdfDocument(source);
  return pdf.numPages;
}

/**
 * Renderiza una página de PDF a un dataUrl PNG.
 * @param source   Data URL base64 o URL remota del PDF
 * @param pageNum  Número de página (1-indexed)
 * @param scale    Factor de escala para la resolución (2 = Retina)
 */
export async function renderPdfPage(
  source: string,
  pageNum: number,
  scale = 2,
): Promise<string> {
  const pdf = await getPdfDocument(source);
  const page = await pdf.getPage(pageNum);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas');

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL('image/png');
}

// ─── Text extraction ───────────────────────────────────────────────────────────

export interface PdfTextLine {
  text: string;
  fontSize: number;
}

export interface PdfPageText {
  page: number;
  lines: PdfTextLine[];
}

/**
 * Extrae el texto de todas las páginas de un PDF agrupando los items en líneas
 * según su posición vertical (tolerancia de 2pt).
 */
export async function extractPdfText(source: string): Promise<PdfPageText[]> {
  const pdf = await getPdfDocument(source);
  const result: PdfPageText[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const buckets = new Map<number, { text: string; fontSize: number }[]>();
    for (const raw of content.items) {
      const item = raw as TextItem;
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5] / 2) * 2;
      const fontSize = Math.abs(item.transform[3]) || 10;
      if (!buckets.has(y)) buckets.set(y, []);
      buckets.get(y)!.push({ text: item.str, fontSize: Math.round(fontSize) });
    }

    const sortedYs = [...buckets.keys()].sort((a, b) => b - a);
    const lines: PdfTextLine[] = sortedYs
      .map((y) => {
        const items = buckets.get(y)!;
        return {
          text: items.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim(),
          fontSize: Math.round(items.reduce((s, i) => s + i.fontSize, 0) / items.length),
        };
      })
      .filter((l) => l.text.length > 0);

    result.push({ page: pageNum, lines });
  }

  return result;
}
