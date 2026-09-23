/**
 * Diff visual entre dos imágenes.
 *
 * - Las dos imágenes se renderizan al tamaño de la imagen A (la "versión de diseño").
 * - Cada píxel se compara en RGB usando una distancia Manhattan; si supera el umbral
 *   se considera diferente.
 * - El resultado es una imagen donde:
 *     · los píxeles diferentes se pintan de rojo opaco
 *     · el resto de la imagen es la versión de diseño al 10% de opacidad sobre fondo blanco
 */

export interface DiffResult {
  /** Imagen resultante (PNG) lista para mostrarse en un <img>. */
  dataUrl: string;
  /** Píxeles totales evaluados. */
  total: number;
  /** Píxeles marcados como diferentes. */
  diff: number;
  /** Tamaño efectivo (puede ser < tamaño nativo si se aplicó cap). */
  width: number;
  height: number;
}

const MAX_DIM = 1600;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = src;
  });

export async function computeImageDiff(
  designSrc: string,
  candidateSrc: string,
  threshold: number,
): Promise<DiffResult> {
  const [imgA, imgB] = await Promise.all([loadImage(designSrc), loadImage(candidateSrc)]);

  let w = imgA.naturalWidth || imgA.width;
  let h = imgA.naturalHeight || imgA.height;
  if (!w || !h) {
    throw new Error('La versión de diseño no se pudo decodificar.');
  }

  const longest = Math.max(w, h);
  if (longest > MAX_DIM) {
    const ratio = MAX_DIM / longest;
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const make = () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Canvas no soportado');
    return { c, ctx };
  };

  const A = make();
  A.ctx.drawImage(imgA, 0, 0, w, h);
  const dataA = A.ctx.getImageData(0, 0, w, h).data;

  const B = make();
  B.ctx.drawImage(imgB, 0, 0, w, h);
  const dataB = B.ctx.getImageData(0, 0, w, h).data;

  const out = make();
  out.ctx.fillStyle = '#ffffff';
  out.ctx.fillRect(0, 0, w, h);
  out.ctx.globalAlpha = 0.1;
  out.ctx.drawImage(imgA, 0, 0, w, h);
  out.ctx.globalAlpha = 1;
  const outData = out.ctx.getImageData(0, 0, w, h);
  const outBuf = outData.data;

  let diff = 0;
  for (let i = 0; i < dataA.length; i += 4) {
    const dr = Math.abs(dataA[i] - dataB[i]);
    const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
    const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
    if (dr + dg + db > threshold) {
      outBuf[i] = 255;
      outBuf[i + 1] = 0;
      outBuf[i + 2] = 0;
      outBuf[i + 3] = 255;
      diff++;
    }
  }

  out.ctx.putImageData(outData, 0, 0);

  return {
    dataUrl: out.c.toDataURL('image/png'),
    total: w * h,
    diff,
    width: w,
    height: h,
  };
}
