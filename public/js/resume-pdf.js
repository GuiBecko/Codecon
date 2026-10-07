// Geração do currículo em PDF com jsPDF (UMD carregado sob demanda de /vendor/jspdf).
// buildResumePdf é independente do DOM (testável em Node passando o construtor jsPDF).
import { label, formatLocation, slugify, SENIORITY_LABELS } from './ui.js';
import { experiencePeriod, educationStatus } from './components.js';
import { isBrazil } from './validators.js';

const PRIMARY = [79, 70, 229];
const TEXT = [15, 23, 42];
const MUTED = [100, 116, 139];
const BORDER = [226, 232, 240];

/** Fontes padrão do PDF só cobrem Latin-1: troca símbolos comuns e remove o resto. */
function pdfText(value) {
  return String(value ?? '')
    .replace(/[–—]/g, '-')
    .replace(/→/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[•▪●◦‣∙]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\n\x20-\x7e\xa0-\xff]/g, '')
    .replace(/[ \t]+/g, ' ');
}

/** Nome do arquivo: curriculo-<slug-do-nome>.pdf */
export function resumeFileName(profile = {}) {
  const slug = slugify(profile.fullName);
  return slug ? `curriculo-${slug}.pdf` : 'curriculo.pdf';
}

/**
 * Monta o documento A4. Retorna a instância jsPDF.
 * @param JsPDF construtor jsPDF
 * @param profile perfil do candidato
 * @param opts.email e-mail de contato (opcional; usa profile.email se ausente)
 */
export function buildResumePdf(JsPDF, profile = {}, { email } = {}) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18;
  const W = pageW - M * 2;
  let y = M;

  const lineH = (size, factor = 1.35) => (size * factor * 25.4) / 72;
  const ensure = (h) => {
    if (y + h > pageH - M) {
      doc.addPage();
      y = M;
    }
  };
  const write = (text, { size = 10, style = 'normal', color = TEXT, indent = 0, gap = 0 } = {}) => {
    const str = pdfText(text).trim();
    if (!str) return;
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(str, W - indent);
    const lh = lineH(size);
    for (const l of lines) {
      ensure(lh);
      doc.text(l, M + indent, y + lh * 0.75);
      y += lh;
    }
    y += gap;
  };
  const section = (title) => {
    ensure(16);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY);
    doc.text(pdfText(title).toUpperCase(), M, y + 4);
    y += 6;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(M, y, M + W, y);
    y += 3;
  };

  // ----- cabeçalho -----
  write(profile.fullName || 'Currículo', { size: 22, style: 'bold' });
  const seniority = label(SENIORITY_LABELS, profile.seniority);
  if (seniority) write(seniority, { size: 12, color: MUTED, gap: 1 });

  let location = formatLocation(profile);
  if (location && isBrazil(profile.country)) location += ', Brasil';
  const contact = [
    email || profile.email,
    profile.phone,
    location,
    profile.linkedin ? String(profile.linkedin).replace(/^https?:\/\/(www\.)?/i, '') : '',
  ].filter(Boolean);
  if (contact.length) write(contact.join('  |  '), { size: 9.5, color: MUTED });

  y += 3;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.9);
  doc.line(M, y, M + W, y);
  y += 3;

  // ----- seções -----
  if (profile.summary) {
    section('Resumo');
    write(profile.summary, { size: 10 });
  }

  const techs = Array.isArray(profile.technologies) ? profile.technologies.filter(Boolean) : [];
  if (techs.length) {
    section('Tecnologias');
    write(techs.join(', '), { size: 10 });
  }

  const exps = Array.isArray(profile.experiences) ? profile.experiences : [];
  if (exps.length) {
    section('Experiência');
    exps.forEach((e, i) => {
      ensure(14);
      const title = [e.cargo || 'Cargo não informado', e.empresa].filter(Boolean).join(' - ');
      write(title, { size: 10.5, style: 'bold' });
      const period = experiencePeriod(e);
      if (period) write(period, { size: 9, color: MUTED, gap: 0.5 });
      if (e.descricao) write(e.descricao, { size: 9.5, indent: 0 });
      if (i < exps.length - 1) y += 3;
    });
  }

  const edus = Array.isArray(profile.education) ? profile.education : [];
  if (edus.length) {
    section('Formação');
    edus.forEach((e, i) => {
      ensure(12);
      write([e.curso || 'Curso não informado', e.instituicao].filter(Boolean).join(' - '), { size: 10.5, style: 'bold' });
      const status = educationStatus(e);
      if (status) write(status, { size: 9, color: MUTED });
      if (i < edus.length - 1) y += 3;
    });
  }

  // ----- rodapé com numeração -----
  const total = doc.getNumberOfPages();
  for (let n = 1; n <= total; n++) {
    doc.setPage(n);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${n}/${total}`, pageW - M, pageH - 8, { align: 'right' });
  }
  return doc;
}

let jspdfPromise = null;

/** Carrega o build UMD do jsPDF uma única vez (o build ES tem imports "nus"). */
export function loadJsPdf() {
  if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jspdfPromise) {
    jspdfPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/jspdf/jspdf.umd.min.js';
      script.async = true;
      script.onload = () => {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('Não foi possível carregar o gerador de PDF.'));
      };
      script.onerror = () => {
        script.remove();
        reject(new Error('Não foi possível carregar o gerador de PDF.'));
      };
      document.head.appendChild(script);
    }).catch((err) => {
      jspdfPromise = null;
      throw err;
    });
  }
  return jspdfPromise;
}

/** Gera e baixa o PDF do currículo. */
export async function downloadResumePdf(profile, email) {
  const JsPDF = await loadJsPdf();
  const doc = buildResumePdf(JsPDF, profile, { email });
  doc.save(resumeFileName(profile));
}
