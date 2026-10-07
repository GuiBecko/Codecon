// Extrai um perfil parcial a partir do texto de um currículo (PDF já convertido em texto).
// Módulo PURO (sem DOM), testado em Node. Heurístico: nunca lança; o que não reconhece, omite.
import { UFS, formatBrPhone, normalizeLinkedin } from './validators.js';

// ---------------------------------------------------------------------------
// Tecnologias: [nome canônico, padrão regex, case-sensitive?]
// ---------------------------------------------------------------------------
const TECHS = [
  ['javascript', 'javascript|ecmascript|es6'],
  ['typescript', 'typescript'],
  ['node', 'node(?:\\.?js)?'],
  ['react native', 'react[\\s-]native'],
  ['react', 'react(?:\\.?js)?(?![\\s-]native)'],
  ['next.js', 'next\\.?js'],
  ['vue', 'vue(?:\\.?js)?(?:\\s?[23])?'],
  ['nuxt', 'nuxt(?:\\.?js)?'],
  ['angular', 'angular(?:\\.?js)?'],
  ['svelte', 'svelte(?:kit)?'],
  ['redux', 'redux'],
  ['express', 'express(?:\\.?js)?'],
  ['nestjs', 'nest\\.?js'],
  ['html', 'html5?'],
  ['css', 'css3?'],
  ['sass', 'sass|scss'],
  ['tailwind', 'tailwind(?:\\s?css)?'],
  ['bootstrap', 'bootstrap'],
  ['webpack', 'webpack'],
  ['vite', 'vite'],
  ['jquery', 'jquery'],
  ['java', 'java'],
  ['spring boot', 'spring[\\s-]boot'],
  ['spring', 'spring(?![\\s-]boot)'],
  ['hibernate', 'hibernate'],
  ['kotlin', 'kotlin'],
  ['scala', 'scala'],
  ['c#', 'c#'],
  ['c++', 'c\\+\\+'],
  ['.net', '(?:asp)?\\.net(?:\\s?core)?|dotnet'],
  ['python', 'python'],
  ['django', 'django'],
  ['flask', 'flask'],
  ['fastapi', 'fastapi'],
  ['pandas', 'pandas'],
  ['numpy', 'numpy'],
  ['scikit-learn', 'scikit[\\s-]learn|sklearn'],
  ['tensorflow', 'tensorflow'],
  ['pytorch', 'pytorch'],
  ['php', 'php'],
  ['laravel', 'laravel'],
  ['ruby', 'ruby'],
  ['rails', 'rails'],
  ['go', 'golang'],
  ['go', 'Go', true],
  ['rust', 'rust'],
  ['elixir', 'elixir'],
  ['swift', 'swift'],
  ['dart', 'dart'],
  ['flutter', 'flutter'],
  ['android', 'android'],
  ['ios', 'ios'],
  ['sql', 'sql'],
  ['nosql', 'nosql'],
  ['postgresql', 'postgre(?:s|sql)?'],
  ['mysql', 'mysql'],
  ['sql server', 'sql\\s?server|mssql'],
  ['oracle', 'oracle'],
  ['sqlite', 'sqlite'],
  ['mongodb', 'mongo(?:db)?'],
  ['redis', 'redis'],
  ['elasticsearch', 'elastic\\s?search'],
  ['firebase', 'firebase'],
  ['graphql', 'graphql'],
  ['rest', 'REST(?:ful)?', true],
  ['kafka', 'kafka'],
  ['rabbitmq', 'rabbitmq'],
  ['aws', 'aws|amazon web services'],
  ['azure', 'azure'],
  ['gcp', 'gcp|google cloud(?: platform)?'],
  ['docker', 'docker'],
  ['kubernetes', 'kubernetes|k8s'],
  ['terraform', 'terraform'],
  ['ansible', 'ansible'],
  ['jenkins', 'jenkins'],
  ['github actions', 'github actions'],
  ['ci/cd', 'ci\\s?/\\s?cd'],
  ['git', 'git'],
  ['linux', 'linux'],
  ['bash', 'bash|shell script'],
  ['nginx', 'nginx'],
  ['jest', 'jest'],
  ['cypress', 'cypress'],
  ['playwright', 'playwright'],
  ['selenium', 'selenium'],
  ['junit', 'junit'],
  ['pytest', 'pytest'],
  ['spark', 'spark|pyspark'],
  ['airflow', 'airflow'],
  ['power bi', 'power\\s?bi'],
  ['tableau', 'tableau'],
  ['excel', 'excel'],
  ['figma', 'figma'],
  ['photoshop', 'photoshop'],
  ['scrum', 'scrum'],
  ['kanban', 'kanban'],
  ['jira', 'jira'],
  ['siem', 'siem'],
  ['sap', 'SAP', true],
  ['salesforce', 'salesforce'],
];

const TECH_MATCHERS = TECHS.map(([name, pattern, cs]) => ({
  name,
  re: new RegExp(`(?<![\\p{L}\\p{N}_.#+])(?:${pattern})(?![\\p{L}\\p{N}_#+])`, cs ? 'u' : 'iu'),
}));

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------
const MONTHS = {
  jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12,
};
const MONTH_NAME = '(?:jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-zç]*\\.?';
const YEAR = '(?:19|20)\\d{2}';
const DATE = `(?:${MONTH_NAME}\\s*(?:\\/|-|de|\\s)?\\s*${YEAR}|\\d{1,2}\\s*\\/\\s*${YEAR}|${YEAR})`;
const PRESENT = '(?:at[ée]\\s+o\\s+momento|o\\s+momento|atualmente|atual|presente|hoje|current(?:ly)?|present|now|today)';
const RANGE_RE = new RegExp(
  `(?<![\\p{L}\\d])(${DATE})\\s*(?:-|–|—|\\bat[ée]\\b|\\ba\\b|\\bto\\b)\\s*(${DATE}|${PRESENT})(?![\\p{L}\\d])`, 'iu',
);
const SINCE_RE = new RegExp(`\\b(?:desde|since)\\s+(${DATE})(?!\\d)`, 'iu');
const DATE_RE_G = new RegExp(`(?<![\\p{L}\\d])${DATE}(?![\\p{L}\\d])`, 'giu');
const PRESENT_RE = new RegExp(`^${PRESENT}$`, 'iu');

/** Converte um token de data em 'YYYY-MM' ('' se não reconhecer). Ano solto → YYYY-01. */
export function parseDateToken(token) {
  const t = String(token || '').trim().toLowerCase();
  let m = /^(\d{1,2})\s*\/\s*(\d{4})$/.exec(t);
  if (m) {
    const mo = Number(m[1]);
    return mo >= 1 && mo <= 12 ? `${m[2]}-${String(mo).padStart(2, '0')}` : `${m[2]}-01`;
  }
  m = /^([a-zç]{3})[a-zç]*\.?\s*(?:\/|-|de|\s)?\s*(\d{4})$/.exec(t);
  if (m && MONTHS[m[1]]) return `${m[2]}-${String(MONTHS[m[1]]).padStart(2, '0')}`;
  m = /^(\d{4})$/.exec(t);
  if (m) return `${m[1]}-01`;
  return '';
}

function findRange(line) {
  const m = RANGE_RE.exec(line);
  if (m) {
    const inicio = parseDateToken(m[1]);
    const atual = PRESENT_RE.test(m[2].trim());
    const fim = atual ? '' : parseDateToken(m[2]);
    if (inicio) return { inicio, fim, atual, index: m.index, length: m[0].length };
  }
  const s = SINCE_RE.exec(line);
  if (s) {
    const inicio = parseDateToken(s[1]);
    if (inicio) return { inicio, fim: '', atual: true, index: s.index, length: s[0].length };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Utilitários de texto
// ---------------------------------------------------------------------------
function fold(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\s?55[\s.-]?)?(?:\(\s?\d{2}\s?\)|(?<!\d)\d{2})[\s.-]?(?:9[\s.]?)?\d{4}[\s.-]?\d{4}(?!\d)/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+\/?/i;
const URL_RE = /(?:https?:\/\/|www\.)\S+/gi;
const BULLET_RE = /^[•▪●◦‣∙·*\-–—>]+\s*/;

const SECTION_PATTERNS = {
  summary: /^(?:resumo(?: profissional)?|sobre(?: mim)?|perfil(?: profissional)?|objetivos?(?: profissional| profissionais)?|apresentacao|summary|professional summary|about(?: me)?|profile|objective)$/,
  experience: /^(?:experiencias?(?: profissional| profissionais)?|historico profissional|trajetoria profissional|experience|work experience|professional experience|employment(?: history)?|work history)$/,
  education: /^(?:formacao(?: academica)?|educacao|escolaridade|education|academic background|academic education)$/,
  skills: /^(?:habilidades(?: tecnicas)?|competencias(?: tecnicas)?|tecnologias|conhecimentos(?: tecnicos)?|ferramentas|stack|skills|technical skills|hard skills|soft skills|tech stack)$/,
  other: /^(?:idiomas|linguas|languages|certificac(?:oes|ao)|certifications?|cursos(?: complementares)?|courses|projetos|projects|contato|contact|dados pessoais|informacoes(?: adicionais| pessoais)?|additional information|interesses|interests|referencias|references|voluntariado|volunteering|premios|awards|atividades complementares|publicacoes)$/,
};

/** Retorna o tipo de seção se a linha for um título de seção; senão null. */
function headingOf(line) {
  const t = fold(line).replace(/[:\-–—|#*_.]+$/g, '').replace(/^[#*_\s]+/, '').trim();
  if (!t || t.length > 40) return null;
  for (const [key, re] of Object.entries(SECTION_PATTERNS)) if (re.test(t)) return key;
  return null;
}

const ROLE_RE = /\b(?:desenvolvedor[a]?|developer|dev|engenheir[oa]|engineer|analista|analyst|estagi[aá]ri[oa]|est[aá]gio|intern|trainee|designer|gerente|manager|coordenador[a]?|lead|l[ií]der|arquitet[oa]|architect|consultor[a]?|consultant|programador[a]?|programmer|cientista|scientist|devops|sre|qa|tester|product|owner|scrum master|suporte|support|t[eé]cnic[oa]|assistente|auxiliar|diretor[a]?|cto|ceo|head|especialista|specialist|administrador[a]?|front[\s-]?end|back[\s-]?end|full[\s-]?stack|j[uú]nior|pleno|s[eê]nior)\b/i;
const INSTITUTION_RE = /\b(?:universidade|faculdade|instituto|escola|centro universit[aá]rio|col[eé]gio|university|college|school|institute|fatec|etec|senai|senac|puc|usp|unicamp|unesp|ufrj|ufmg|ufrgs|ufsc|ufpe|ufba|ufpr|unb|ita|ime|fiap|mackenzie|insper|ifsp|if[a-z]{1,3}|uf[a-z]{1,3}|alura|rocketseat)\b/i;
const IN_PROGRESS_RE = /\b(?:cursando|em andamento|andamento|previs[aã]o|previsto|expected|in progress|incompleto|trancado|atual|presente)\b/i;
const SEPARATORS = [' | ', ' — ', ' – ', ' - ', ' @ ', ' at ', ' na ', ' no ', ' em ', ', '];

function splitPair(text) {
  for (const sep of SEPARATORS) {
    const idx = text.toLowerCase().indexOf(sep);
    if (idx > 0) {
      const a = text.slice(0, idx).trim();
      const b = text.slice(idx + sep.length).trim();
      if (a && b) return [a, b, sep.trim()];
    }
  }
  return null;
}

function cleanPiece(s) {
  return String(s || '').replace(/^[\s|,;:()\-–—•·]+|[\s|,;:()\-–—•·]+$/g, '').replace(/\s+/g, ' ').trim();
}

function titleCase(name) {
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return name.toLowerCase().split(' ').map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

function hasLetters(s, n = 2) {
  return (String(s).match(/\p{L}/gu) || []).length >= n;
}

// ---------------------------------------------------------------------------
// Extratores
// ---------------------------------------------------------------------------
function extractName(lines) {
  for (const raw of lines.slice(0, 12)) {
    if (headingOf(raw)) continue;
    if (/@|https?:|www\.|linkedin|github|\d{3,}/i.test(raw)) continue;
    if (/^(?:curr[ií]culo|curriculum|resume|cv)\b/i.test(fold(raw))) continue;
    let cand = raw;
    const pair = splitPair(raw);
    if (pair && !/,/.test(pair[2])) cand = pair[0];
    cand = cleanPiece(cand);
    if (!/^[\p{L}'. -]+$/u.test(cand)) continue;
    const words = cand.split(' ').filter(Boolean);
    if (words.length < 2 || words.length > 6 || cand.length > 60) continue;
    if (ROLE_RE.test(cand) && !pair) continue;
    if (words.some((w) => w.length === 2 && UFS.includes(w))) continue;
    return cand === cand.toUpperCase() || cand === cand.toLowerCase() ? titleCase(cand) : cand;
  }
  return '';
}

const CITY = "\\p{Lu}[\\p{L}'.]+(?:\\s+(?:d[aeo]s?|\\p{Lu}[\\p{L}'.]+)){0,4}";
const CITY_UF_RE = new RegExp(`(?:^|[^\\p{L}])(${CITY})\\s*(?:-|–|\\/|,)\\s*([A-Z]{2})(?![\\p{L}\\d])`, 'u');

function extractCity(lines) {
  for (const line of lines) {
    const segments = line.replace(EMAIL_RE, ' ').replace(URL_RE, ' ').split(/\s*[|•·;]\s*|\s{2,}/);
    for (const seg of segments) {
      const s = seg.replace(/^(?:endere[cç]o|local(?:iza[cç][aã]o)?|cidade|location|address)\s*:\s*/i, '');
      const m = CITY_UF_RE.exec(s);
      if (m && UFS.includes(m[2])) {
        const city = m[1].trim();
        if (ROLE_RE.test(city) || INSTITUTION_RE.test(city)) continue;
        return { city, state: m[2] };
      }
    }
  }
  return null;
}

const SENIORITY_PATTERNS = [
  ['estagio', /\best[aá]gi(?:o|[aá]ri[oa])\b|\bintern(?:ship)?\b|\btrainee\b/i],
  ['junior', /\bj[uú]nior\b|\bjr\b\.?/i],
  ['pleno', /\bpleno\b|\bmid[\s-]?level\b/i],
  ['senior', /\bs[eê]nior\b|\bsr\b\.?/i],
  ['especialista', /\bespecialista\b|\bstaff\b|\bprincipal\b|\btech\s?lead\b/i],
];

function extractSeniority(text) {
  let best = null;
  for (const [key, re] of SENIORITY_PATTERNS) {
    const m = re.exec(text);
    if (m && (!best || m.index < best.index)) best = { key, index: m.index };
  }
  return best ? best.key : '';
}

function extractTechs(text) {
  const clean = text.replace(EMAIL_RE, ' ').replace(URL_RE, ' ').replace(LINKEDIN_RE, ' ');
  const found = [];
  for (const { name, re } of TECH_MATCHERS) {
    if (!found.includes(name) && re.test(clean)) found.push(name);
  }
  return found;
}

/** Divide as linhas em seções { header: [...], summary: [...], experience: [...], ... }. */
function splitSections(lines) {
  const sections = { header: [] };
  let current = 'header';
  for (const line of lines) {
    const h = headingOf(line);
    if (h) {
      current = h;
      if (!sections[current]) sections[current] = [];
      continue;
    }
    // "Resumo: texto…" na mesma linha
    const inline = /^([^:]{3,30}):\s*(.+)$/.exec(line);
    if (inline) {
      const hi = headingOf(inline[1]);
      if (hi && hi !== 'other') {
        current = hi;
        if (!sections[current]) sections[current] = [];
        sections[current].push(inline[2]);
        continue;
      }
    }
    sections[current].push(line);
  }
  return sections;
}

const isShortHeader = (l) => l && l.length <= 90 && !BULLET_RE.test(l) && !/[.;]$/.test(l) && hasLetters(l, 2);

function assignRole(parts) {
  const res = { cargo: '', empresa: '' };
  const list = parts.map(cleanPiece).filter(Boolean);
  if (!list.length) return res;
  if (list.length === 1) {
    if (ROLE_RE.test(list[0])) res.cargo = list[0];
    else res.empresa = list[0];
    return res;
  }
  let [a, b] = list;
  if (!ROLE_RE.test(a) && ROLE_RE.test(b)) [a, b] = [b, a];
  res.cargo = a;
  res.empresa = b;
  return res;
}

function headerParts(lines) {
  const parts = [];
  for (const l of lines) {
    const pair = splitPair(l);
    if (pair && pair[2] !== ',') {
      // "Cargo na Empresa" / "Cargo at Empresa": a ordem é conhecida.
      parts.push(pair[0], pair[1]);
    } else {
      parts.push(l);
    }
  }
  return parts.map(cleanPiece).filter((p) => p && hasLetters(p, 2)).slice(0, 2);
}

function extractExperiences(lines) {
  const anchors = [];
  lines.forEach((line, i) => {
    const r = findRange(line);
    if (r) anchors.push({ i, r });
  });
  if (!anchors.length) return [];

  // 1) cabeçalho de cada entrada
  const entries = anchors.map(({ i, r }, k) => {
    const prevEnd = k > 0 ? anchors[k - 1].i : -1;
    const line = lines[i];
    const rest = cleanPiece(line.slice(0, r.index) + ' ' + line.slice(r.index + r.length)).replace(/\(\s*\)/g, '').trim();
    const header = [];
    let start = i;
    let bodyStart = i + 1;
    if (hasLetters(rest, 2)) header.push(rest);
    // linhas curtas imediatamente acima (até 2) que não pertencem à entrada anterior
    const above = [];
    for (let j = i - 1; j > prevEnd && above.length < (header.length ? 1 : 2); j--) {
      if (!isShortHeader(lines[j])) break;
      above.unshift(lines[j]);
    }
    header.unshift(...above);
    start = i - above.length;
    // layout "Empresa | data" seguido de "Cargo"
    const partsSoFar = headerParts(header);
    if (partsSoFar.length < 2 && i + 1 < lines.length && isShortHeader(lines[i + 1])
      && !findRange(lines[i + 1]) && lines[i + 1].length <= 60) {
      header.push(lines[i + 1]);
      bodyStart = i + 2;
    }
    return { start, bodyStart, r, header };
  });

  return entries.map((e, k) => {
    const end = k + 1 < entries.length ? entries[k + 1].start : lines.length;
    const { cargo, empresa } = assignRole(headerParts(e.header));
    const descricao = lines.slice(e.bodyStart, end)
      .map((l) => l.replace(BULLET_RE, '').trim())
      .filter(Boolean)
      .map((l) => `• ${l}`)
      .join('\n')
      .slice(0, 1000);
    return {
      empresa: empresa.slice(0, 120),
      cargo: cargo.slice(0, 120),
      inicio: e.r.inicio,
      fim: e.r.atual ? '' : e.r.fim,
      descricao: descricao.length > 2 ? descricao : '',
      atual: e.r.atual,
    };
  }).filter((x) => x.cargo || x.empresa);
}

function extractEducation(lines, now) {
  const nowYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const items = [];
  let cur = null;
  const flush = () => { if (cur && (cur.curso || cur.instituicao)) items.push(cur); cur = null; };

  for (const raw of lines) {
    const line = raw.replace(BULLET_RE, '').trim();
    if (!line) continue;
    const range = findRange(line);
    const dates = line.match(DATE_RE_G) || [];
    const progress = IN_PROGRESS_RE.test(line);
    let text = line;
    if (range) text = line.slice(0, range.index) + ' ' + line.slice(range.index + range.length);
    else for (const d of dates) text = text.replace(d, ' ');
    text = cleanPiece(text.replace(/\b(?:conclus[aã]o|conclu[ií]do|previs[aã]o(?: de conclus[aã]o)?|cursando|em andamento|expected|graduated|in progress|t[eé]rmino|in[ií]cio)\b\s*:?/gi, ' ')).replace(/\(\s*\)/g, '').trim();
    const hasText = hasLetters(text, 3);

    if (hasText && text.length <= 140) {
      if (!cur || (cur.curso && cur.instituicao) || cur.dated) {
        flush();
        cur = { instituicao: '', curso: '', situacao: 'concluido', conclusao: '', dated: false, progress: false };
      }
      const pair = splitPair(text);
      const parts = pair && pair[2] !== ',' ? [pair[0], pair[1]] : (pair ? [pair[0], pair[1]] : [text]);
      for (const p of parts.map(cleanPiece).filter(Boolean)) {
        if (INSTITUTION_RE.test(p) && !cur.instituicao) cur.instituicao = p.slice(0, 120);
        else if (!cur.curso) cur.curso = p.slice(0, 120);
        else if (!cur.instituicao) cur.instituicao = p.slice(0, 120);
      }
    } else if (!cur) {
      continue;
    }
    if (progress) cur.progress = true;
    if (range) {
      cur.dated = true;
      if (range.atual) cur.progress = true;
      else cur.conclusao = range.fim;
    } else if (dates.length) {
      cur.dated = true;
      cur.conclusao = parseDateToken(dates[dates.length - 1]);
    }
  }
  flush();

  return items.map((it) => {
    const inProgress = it.progress || (it.conclusao && it.conclusao > nowYm);
    return {
      instituicao: it.instituicao,
      curso: it.curso,
      situacao: inProgress ? 'em_andamento' : 'concluido',
      conclusao: it.conclusao || '',
    };
  });
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
function emptyResult() {
  return { technologies: [], experiences: [], education: [] };
}

/**
 * @param {string} text texto do currículo (linhas separadas por \n)
 * @param {{now?: Date}} [opts]
 * @returns perfil parcial: {fullName?, email?, phone?, city?, state?, linkedin?, seniority?,
 *   technologies[], summary?, experiences[], education[]}
 */
export function parseResumeText(text, { now = new Date() } = {}) {
  try {
    return parse(String(text ?? ''), now);
  } catch {
    return emptyResult();
  }
}

function parse(text, now) {
  const result = emptyResult();
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[ \t]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!lines.length) return result;
  const full = lines.join('\n');

  const email = EMAIL_RE.exec(full);
  if (email) result.email = email[0].toLowerCase();

  const li = LINKEDIN_RE.exec(full);
  if (li) {
    const norm = normalizeLinkedin(li[0]);
    if (norm) result.linkedin = norm;
  }

  for (const line of lines) {
    if (findRange(line) && !/\(\s?\d{2}\s?\)|\+55/.test(line)) continue;
    const m = PHONE_RE.exec(line.replace(EMAIL_RE, ' ').replace(URL_RE, ' '));
    if (m) {
      result.phone = formatBrPhone(m[0]);
      break;
    }
  }

  const sections = splitSections(lines);
  const header = sections.header || [];

  const name = extractName(lines);
  if (name) result.fullName = name;

  const loc = extractCity(header.length ? header : lines.slice(0, 10)) || extractCity(lines.slice(0, 15));
  if (loc) {
    result.city = loc.city;
    result.state = loc.state;
  }

  const techs = extractTechs(full);
  result.technologies = techs;

  if (sections.summary && sections.summary.length) {
    const summary = sections.summary.join(' ').replace(/\s+/g, ' ').trim();
    if (summary) result.summary = summary.slice(0, 2000);
  }

  if (sections.experience) result.experiences = extractExperiences(sections.experience).slice(0, 20);
  if (sections.education) result.education = extractEducation(sections.education, now).slice(0, 20);

  // Senioridade: cabeçalho (sem a linha do nome) → cargo da experiência mais recente
  const headerText = header.filter((l) => l !== name).join('\n');
  let seniority = extractSeniority(headerText);
  if (!seniority && result.experiences.length) seniority = extractSeniority(result.experiences[0].cargo);
  if (!seniority && sections.summary) seniority = extractSeniority(sections.summary.slice(0, 2).join(' '));
  if (seniority) result.seniority = seniority;

  return result;
}
