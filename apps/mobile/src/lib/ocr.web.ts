/**
 * Free, in-browser text recognition with tesseract.js. The engine and language data are
 * served by the app itself under /ocr (copied by scripts/copy-ocr-assets.mjs), and loaded
 * only the first time a photo is read.
 */

interface TesseractWorker {
  recognize(image: string): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
}

interface TesseractGlobal {
  createWorker(
    langs: string,
    oem: number,
    options: {
      workerPath: string;
      corePath: string;
      langPath: string;
      gzip: boolean;
      logger: (m: { status: string; progress: number }) => void;
    },
  ): Promise<TesseractWorker>;
}

const BASE = '/ocr';
const LANGS: Record<string, string> = { en: 'eng', es: 'spa+eng', it: 'ita+eng', fr: 'fra+eng', pt: 'por+eng' };

export const ocrAvailable = true;

let loading: Promise<TesseractGlobal> | null = null;

function loadTesseract(): Promise<TesseractGlobal> {
  const existing = (window as unknown as { Tesseract?: TesseractGlobal }).Tesseract;
  if (existing) return Promise.resolve(existing);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${BASE}/tesseract.min.js`;
    script.onload = () => resolve((window as unknown as { Tesseract: TesseractGlobal }).Tesseract);
    script.onerror = () => {
      loading = null;
      reject(new Error('Could not load the text recognizer.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Reads the text of each image (in order) and joins the pages. */
export async function recognizeText(uris: string[], locale: string, onProgress?: (fraction: number) => void): Promise<string> {
  const Tesseract = await loadTesseract();
  let page = 0;
  const worker = await Tesseract.createWorker(LANGS[locale] ?? 'eng', 1, {
    workerPath: `${BASE}/worker.min.js`,
    corePath: `${BASE}/core`,
    langPath: `${BASE}/lang`,
    gzip: true,
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.((page + m.progress) / uris.length);
    },
  });
  try {
    const pages: string[] = [];
    for (; page < uris.length; page++) {
      const { data } = await worker.recognize(uris[page]);
      pages.push(data.text.trim());
    }
    return pages.filter(Boolean).join('\n\n');
  } finally {
    await worker.terminate();
  }
}
