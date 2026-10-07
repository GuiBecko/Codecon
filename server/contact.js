import { HttpError, text } from './validation.js';

export const BR_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const BR_PHONE_ERROR = 'Telefone inválido. Use DDD + número, ex.: (11) 98888-1111';
const LINKEDIN_ERROR = 'LinkedIn inválido. Use linkedin.com/in/seu-perfil';
const SLUG = '[A-Za-z0-9_%-]{3,100}';
const LINKEDIN_URL_RE = new RegExp(`^(?:[a-z0-9-]+\\.)?linkedin\\.com/in/(${SLUG})/?(?:\\?.*)?$`, 'i');
const SLUG_RE = new RegExp(`^${SLUG}$`);

function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

export function isBrazil(country) {
  const c = fold(country);
  return c === 'brasil' || c === 'brazil';
}

export function normalizeCountry(value) {
  return text(value, 'País', { max: 60 }) || 'Brasil';
}

export function normalizeState(value, country) {
  const state = text(value, 'Estado', { max: 60 });
  if (!isBrazil(country) || !state) return state;
  const uf = state.toUpperCase();
  if (!BR_UFS.includes(uf)) throw new HttpError(400, 'Estado inválido');
  return uf;
}

export function normalizePhone(value, country) {
  const phone = text(value, 'Telefone', { max: 30 });
  if (!phone) return '';
  if (isBrazil(country)) {
    if (!/^[\d\s().+-]+$/.test(phone)) throw new HttpError(400, BR_PHONE_ERROR);
    let digits = phone.replace(/\D/g, '');
    const plus = phone.startsWith('+');
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
    else if (plus) throw new HttpError(400, BR_PHONE_ERROR);
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    throw new HttpError(400, BR_PHONE_ERROR);
  }
  const digits = phone.replace(/\D/g, '').length;
  if (!/^\+?[\d\s().-]+$/.test(phone) || digits < 8 || digits > 15) {
    throw new HttpError(400, 'Telefone inválido');
  }
  return phone;
}

export function normalizeLinkedin(value) {
  const raw = text(value, 'LinkedIn', { max: 200 });
  if (!raw) return '';
  const withoutProtocol = raw.replace(/^https?:\/\//i, '');
  const match = withoutProtocol.match(LINKEDIN_URL_RE);
  let slug;
  if (match) slug = match[1];
  else if (SLUG_RE.test(raw)) slug = raw;
  else throw new HttpError(400, LINKEDIN_ERROR);
  return `https://www.linkedin.com/in/${slug}`;
}
