// Validação/formatação de campos do currículo. Módulo PURO (sem DOM): testado em Node.
// Espelha as regras do backend (telefone, UF, LinkedIn).

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const DEFAULT_COUNTRY = 'Brasil';

function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

/** País vazio conta como Brasil (o backend usa 'Brasil' como padrão). */
export function isBrazil(country) {
  const c = fold(country);
  return c === '' || c === 'brasil' || c === 'brazil';
}

function digitsOf(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** Dígitos de um telefone brasileiro, sem o DDI 55 quando presente. */
function brDigits(value) {
  let d = digitsOf(value);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d;
}

/**
 * Máscara progressiva de telefone BR: "11988881111" → "(11) 98888-1111";
 * fixo (10 dígitos) → "(11) 3888-1111". Entradas parciais são formatadas até onde dá.
 */
export function formatBrPhone(value) {
  let d = digitsOf(value);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (d.length <= 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

/** Valida telefone conforme o país. Retorna mensagem de erro ou null. Vazio é válido (opcional). */
export function validatePhone(phone, country) {
  const raw = String(phone ?? '').trim();
  if (!raw) return null;
  if (isBrazil(country)) {
    if (/[^\d\s().+-]/.test(raw)) return 'Telefone inválido. Use apenas números, ex.: (11) 98888-1111.';
    const all = digitsOf(raw);
    const hasDdi = (all.length === 12 || all.length === 13) && all.startsWith('55');
    if (raw.startsWith('+') && !hasDdi) return 'Telefone inválido. Para o Brasil, use DDD + número, ex.: (11) 98888-1111.';
    const len = brDigits(raw).length;
    if (len !== 10 && len !== 11) return 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).';
    return null;
  }
  if (!/^\+?[\d\s().-]+$/.test(raw)) return 'Telefone inválido. Use apenas números, espaços, "-", parênteses e "+" no início.';
  const len = digitsOf(raw).length;
  if (len < 8 || len > 15) return 'Telefone inválido. Informe de 8 a 15 dígitos, com o código do país (ex.: +1 555 123 4567).';
  return null;
}

const SLUG_RE = /^[A-Za-z0-9_%-]{3,100}$/;
const LINKEDIN_URL_RE = /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]{3,100})\/?(?:[?#].*)?$/i;

/**
 * Normaliza LinkedIn para "https://www.linkedin.com/in/<slug>".
 * Retorna '' para vazio e null quando não é um perfil do LinkedIn válido.
 */
export function normalizeLinkedin(value) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (SLUG_RE.test(v)) return `https://www.linkedin.com/in/${v}`;
  const m = LINKEDIN_URL_RE.exec(v);
  if (!m) return null;
  return `https://www.linkedin.com/in/${m[1]}`;
}

/** UF válida (maiúscula) ou ''. */
export function normalizeUf(value) {
  const uf = String(value ?? '').trim().toUpperCase();
  return UFS.includes(uf) ? uf : '';
}
