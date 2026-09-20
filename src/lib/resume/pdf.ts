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

export function validatePDFContent(buffer: ArrayBuffer): PDFValidationResult {
  const header = new Uint8Array(buffer.slice(0, 8));
  const magic = String.fromCharCode(...header);

  if (!magic.startsWith('%PDF')) {
    return { valid: false, error: 'Invalid PDF file. File may be corrupted or not a PDF.' };
  }

  return { valid: true };
}

export function extractTextFromPDF(buffer: ArrayBuffer): ExtractedPDFContent {
  const uint8Array = new Uint8Array(buffer);

  const textChunks: string[] = [];
  let pageCount = 0;

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const fullText = decoder.decode(uint8Array);

  const pageMatches = fullText.match(/\/Type\s*\/Page[^s]/g);
  pageCount = pageMatches ? pageMatches.length : 0;

  if (pageCount > MAX_PAGES) {
    throw new Error(`PDF has ${pageCount} pages. Maximum allowed is ${MAX_PAGES}.`);
  }

  const streamMatches = fullText.match(/stream\r?\n([\s\S]*?)\r?\nendstream/g);
  if (streamMatches) {
    for (const match of streamMatches) {
      const streamContent = match.replace(/^stream\r?\n/, '').replace(/\r?\nendstream$/, '');
      const cleaned = streamContent
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleaned.length > 10) {
        textChunks.push(cleaned);
      }
    }
  }

  const extractedText = textChunks.join('\n\n');

  if (extractedText.trim().length < 50) {
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
    pageCount: pageCount || 1,
  };
}
