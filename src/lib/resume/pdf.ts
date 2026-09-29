import { getDocumentProxy, extractText } from 'unpdf';

export const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6 MiB
export const MAX_PAGES = 20;
export const MAX_TEXT_LENGTH = 100_000;

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
export type PDFExtractionErrorKind = 'malformed' | 'too_many_pages' | 'no_text' | 'too_long';

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

/**
 * The ONE shared, trustworthy PDF extraction boundary (browser upload and
 * worker AI extraction both use this). Backed by unpdf's serverless pdf.js
 * build, which decompresses real content streams — unlike naive byte regex.
 */
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<ExtractedPDFContent> {
  try {
    const uint8Array = new Uint8Array(buffer);

    const doc = await getDocumentProxy(uint8Array);

    const pageCount = doc.numPages;

    if (pageCount > MAX_PAGES) {
      throw new PDFExtractionError(
        'too_many_pages',
        `PDF has ${pageCount} pages. Maximum allowed is ${MAX_PAGES}.`
      );
    }

    const { text: fullText } = await extractText(doc);

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
  } catch (err) {
    if (err instanceof PDFExtractionError) {
      throw err;
    }
    // Corrupted, encrypted, or otherwise unparseable input: one safe message,
    // never the parser's internal stack.
    throw new PDFExtractionError(
      'malformed',
      'Failed to parse PDF. File may be corrupted, password-protected, or not a valid PDF.'
    );
  }
}
