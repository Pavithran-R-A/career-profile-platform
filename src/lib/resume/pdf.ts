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

export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<ExtractedPDFContent> {
  try {
    const uint8Array = new Uint8Array(buffer);

    const doc = await getDocumentProxy(uint8Array);

    const pageCount = doc.numPages;

    if (pageCount > MAX_PAGES) {
      throw new Error(`PDF has ${pageCount} pages. Maximum allowed is ${MAX_PAGES}.`);
    }

    const { text: fullText } = await extractText(doc);

    const extractedText = fullText.join('\n\n').replace(/\s+/g, ' ').trim();

    if (extractedText.length < 50) {
      throw new Error(
        'This PDF appears to be scanned or contains too little readable text. ' +
          'Please upload a text-based PDF.'
      );
    }

    if (extractedText.length > MAX_TEXT_LENGTH) {
      throw new Error(`Extracted text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`);
    }

    return {
      text: extractedText,
      pageCount,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('Maximum allowed')) {
      throw err;
    }
    if (err instanceof Error && err.message.includes('readable text')) {
      throw err;
    }
    if (err instanceof Error && err.message.includes('maximum length')) {
      throw err;
    }
    throw new Error('Failed to parse PDF. File may be corrupted or not a valid PDF.');
  }
}
