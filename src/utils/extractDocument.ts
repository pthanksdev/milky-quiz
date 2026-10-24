import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export type DocumentType = 'pdf' | 'docx';

/**
 * Extract plain text from a PDF or DOCX buffer.
 * Used before sending content to Gemini for quiz generation.
 */
export const extractText = async (
  buffer: Buffer,
  type: DocumentType,
): Promise<string> => {
  if (type === 'pdf') {
    const data = await pdf(buffer);
    return data.text.trim();
  }

  if (type === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  throw new Error(`Unsupported document type: ${type}`);
};

export const getMimeType = (originalname: string): DocumentType | null => {
  const ext = originalname.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  return null;
};
