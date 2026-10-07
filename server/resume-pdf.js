import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { HttpError } from './validation.js';

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
const PDF_MAGIC = Buffer.from('%PDF-');

export const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
}).single('file');

export function sanitizePdfName(original) {
  let name = path.basename(String(original ?? '').replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f"'`]/g, '')
    .trim();
  if (!name.toLowerCase().endsWith('.pdf')) name = `${name || 'curriculo'}.pdf`;
  if (name.length > 120) name = `${name.slice(0, 116)}.pdf`;
  if (name === '.pdf') name = 'curriculo.pdf';
  return name;
}

export function assertPdf(file) {
  if (!file || !file.buffer || file.buffer.length < PDF_MAGIC.length
    || !file.buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new HttpError(400, 'Envie um arquivo PDF válido');
  }
}

// Só o nome UUID gravado no banco vira caminho; basename impede travessia de diretório.
export function storedPdfPath(uploadsDir, stored) {
  if (!stored) return null;
  return path.join(uploadsDir, path.basename(stored));
}

export function savePdf(uploadsDir, buffer) {
  const filename = `${crypto.randomUUID()}.pdf`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer, { flag: 'wx' });
  return filename;
}

export function removePdf(uploadsDir, stored) {
  const file = storedPdfPath(uploadsDir, stored);
  if (file) fs.rmSync(file, { force: true });
}

export function sendPdf(res, uploadsDir, row) {
  const file = row && storedPdfPath(uploadsDir, row.resume_pdf_path);
  if (!file || !fs.existsSync(file)) throw new HttpError(404, 'Nenhum PDF anexado');
  res.attachment(sanitizePdfName(row.resume_pdf_name));
  res.type('application/pdf');
  res.sendFile(file);
}
