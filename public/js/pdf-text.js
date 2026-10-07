// Extração de texto de PDF com pdf.js (carregado sob demanda de /vendor/pdfjs).

let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('/vendor/pdfjs/pdf.min.mjs')
      .then((mod) => {
        mod.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
        return mod;
      })
      .catch((err) => {
        pdfjsPromise = null;
        throw new Error('Não foi possível carregar o leitor de PDF.', { cause: err });
      });
  }
  return pdfjsPromise;
}

/**
 * Reconstrói as linhas de uma página agrupando os itens de texto pela coordenada y
 * (transform[5]), de cima para baixo; itens da mesma linha são unidos por espaço.
 */
export function itemsToLines(items) {
  const parts = items
    .filter((it) => it && typeof it.str === 'string' && it.str.trim() !== '')
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: Number(it.width) || 0,
      h: Math.abs(Number(it.height) || Number(it.transform[3]) || 10),
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  for (const p of parts) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line.y - p.y) <= Math.max(2, Math.min(line.h, p.h) * 0.4)) line.items.push(p);
    else lines.push({ y: p.y, h: p.h, items: [p] });
  }

  return lines.map((line) => {
    const sorted = line.items.sort((a, b) => a.x - b.x);
    let out = '';
    let prevEnd = null;
    for (const it of sorted) {
      // pdf.js às vezes quebra uma palavra em vários itens: só põe espaço se houver distância
      const gap = prevEnd === null ? 0 : it.x - prevEnd;
      if (out && gap > it.h * 0.15 && !/\s$/.test(out) && !/^\s/.test(it.str)) out += ' ';
      out += it.str;
      prevEnd = it.x + it.w;
    }
    return out.replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
}

/** Extrai o texto de um File/Blob PDF. Páginas separadas por '\n'. */
export async function extractPdfText(file) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, isEvalSupported: false });
  const doc = await task.promise;
  try {
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push(itemsToLines(content.items).join('\n'));
      page.cleanup();
    }
    return pages.join('\n').trim();
  } finally {
    // pdf.js 6: destroy() fica na loading task (versões antigas também tinham no documento)
    try {
      if (typeof task.destroy === 'function') task.destroy();
      else if (typeof doc.destroy === 'function') doc.destroy();
    } catch { /* limpeza não deve derrubar a leitura */ }
  }
}
