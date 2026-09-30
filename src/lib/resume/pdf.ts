import { getDocumentProxy, extractText } from 'unpdf';

export const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6 MiB
export const MAX_PAGES = 20;
export const MAX_TEXT_LENGTH = 100_000;
/** Deterministic production parse/extraction timeout (milliseconds). */
export const PARSE_TIMEOUT_MS = 10_000;

export interface PDFValidationResult {
  valid: boolean;
  error?: string;
  pageCount?: number;
  textLength?: number;
}

export interface ExtractedPDFContent {
  text: string;
  pageCount: number;
}

/**
 * Machine-readable failure kinds so server callers can map to stable error
 * codes without matching on prose. Messages stay customer-safe.
 */
export type PDFExtractionErrorKind =
  'malformed' | 'encrypted' | 'too_many_pages' | 'no_text' | 'too_long' | 'timeout' | 'too_large';

export class PDFExtractionError extends Error {
  readonly kind: PDFExtractionErrorKind;

  constructor(kind: PDFExtractionErrorKind, message: string) {
    super(message);
    this.name = 'PDFExtractionError';
    this.kind = kind;
  }
}

export function validatePDFFile(file: File): PDFValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MiB.`,
    };
  }

  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Invalid file type. Only PDF files are accepted.' };
  }

  return { valid: true };
}

export function validatePDFMagicBytes(buffer: ArrayBuffer): PDFValidationResult {
  const header = new Uint8Array(buffer.slice(0, 8));
  const magic = String.fromCharCode(...header);

  if (!magic.startsWith('%PDF')) {
    return { valid: false, error: 'Invalid PDF file. File may be corrupted or not a PDF.' };
  }

  return { valid: true };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new PDFExtractionError('timeout', 'The PDF took too long to process.'));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * The ONE shared, trustworthy PDF extraction boundary (browser upload and
 * worker AI extraction both use this). Backed by unpdf's serverless pdf.js
 * build, which decompresses real content streams.
 *
 * ENFORCED bounds (do not document others): 6 MiB input, %PDF magic bytes,
 * 20 pages, 100k extracted characters, a 10-second deterministic parse
 * timeout, encrypted-PDF rejection, and destroy() cleanup of the document
 * proxy in `finally` where the parser supports it.
 */
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<ExtractedPDFContent> {
  try {
    // Byte bound + magic bytes BEFORE any parse work.
    if (buffer.byteLength > MAX_FILE_SIZE) {
      throw new PDFExtractionError(
        'too_large',
        `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MiB.`
      );
    }
    const magicCheck = validatePDFMagicBytes(buffer);
    if (!magicCheck.valid) {
      throw new PDFExtractionError('malformed', magicCheck.error ?? 'Invalid PDF file.');
    }

    const uint8Array = new Uint8Array(buffer);

    const doc = await withTimeout(getDocumentProxy(uint8Array), PARSE_TIMEOUT_MS);

    // Destructor-style cleanup: unpdf's proxy exposes destroy() on the
    // underlying pdf.js document; call it in finally when available.
    const maybeDestroy = (): void => {
      const d = doc as { destroy?: () => void | Promise<void> };
      if (typeof d.destroy === 'function') {
        try {
          void d.destroy();
        } catch {
          // cleanup must never mask the real error
        }
      }
    };

    try {
      const pageCount = doc.numPages;

      if (pageCount > MAX_PAGES) {
        throw new PDFExtractionError(
          'too_many_pages',
          `PDF has ${pageCount} pages. Maximum allowed is ${MAX_PAGES}.`
        );
      }

      const { text: fullText } = await withTimeout(extractText(doc), PARSE_TIMEOUT_MS);

      const extractedText = fullText.join('\n\n').replace(/\s+/g, ' ').trim();

      if (extractedText.length < 50) {
        throw new PDFExtractionError(
          'no_text',
          'This PDF appears to be scanned or contains too little readable text. ' +
            'Please upload a text-based PDF.'
        );
      }

      if (extractedText.length > MAX_TEXT_LENGTH) {
        throw new PDFExtractionError(
          'too_long',
          `Extracted text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`
        );
      }

      return {
        text: extractedText,
        pageCount,
      };
    } finally {
      maybeDestroy();
    }
  } catch (err) {
    if (err instanceof PDFExtractionError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : '';
    // PasswordProtected / encrypted documents get their own truthful kind.
    if (/password|encrypt/i.test(message)) {
      throw new PDFExtractionError(
        'encrypted',
        'This PDF is password-protected. Please remove the password and try again.'
      );
    }
    // Corrupted or otherwise unparseable input: one safe message, never the
    // parser's internal stack.
    throw new PDFExtractionError(
      'malformed',
      'Failed to parse PDF. File may be corrupted, password-protected, or not a valid PDF.'
    );
  }
}
