import { emptyExtraction, type Appointment, type Contact, type Extraction, type OpeningHours, type Place, type Topic } from './model';

/**
 * A rule-based extractor that works without network or AI. It is intentionally
 * conservative: it pulls out phone numbers, emails, websites, dates, times,
 * opening hours and street addresses, and classifies the text against topic keywords.
 * The result is always shown to the user for review before saving.
 */

export type DateOrder = 'MDY' | 'DMY';

export interface OfflineParseOptions {
  topics: Topic[];
  /** How to read ambiguous numeric dates like 03/04/2026. */
  dateOrder?: DateOrder;
  /** Used to fill in the year for dates written without one. */
  now?: Date;
}

const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]?\d{2,4}){1,3}/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s,;)]+/gi;

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, ene: 1, enero: 1, gen: 1, gennaio: 1,
  feb: 2, february: 2, febrero: 2, febbraio: 2,
  mar: 3, march: 3, marzo: 3,
  apr: 4, april: 4, abr: 4, abril: 4, aprile: 4,
  may: 5, mayo: 5, mag: 5, maggio: 5,
  jun: 6, june: 6, junio: 6, giu: 6, giugno: 6,
  jul: 7, july: 7, julio: 7, lug: 7, luglio: 7,
  aug: 8, august: 8, ago: 8, agosto: 8,
  sep: 9, sept: 9, september: 9, septiembre: 9, set: 9, settembre: 9,
  oct: 10, october: 10, octubre: 10, ott: 10, ottobre: 10,
  nov: 11, november: 11, noviembre: 11, novembre: 11,
  dec: 12, december: 12, dic: 12, diciembre: 12, dicembre: 12,
};
const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

const DAY_WORDS =
  '(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|daily|every ?day|weekdays|weekends|lun(?:es|edì)?|mar(?:tes|tedì)?|mi[eé]r(?:coles)?|mer(?:coledì)?|jue(?:ves)?|gio(?:vedì)?|vie(?:rnes)?|ven(?:erdì)?|s[aá]b(?:ado|ato)?|dom(?:ingo|enica)?)';
const DAY_RE = new RegExp(`\\b${DAY_WORDS}\\b`, 'i');

const TIME_PART = String.raw`\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?`;
const TIME_RE = new RegExp(String.raw`\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?=\W|$)`, 'gi');
const TIME_RANGE_RE = new RegExp(String.raw`(${TIME_PART})\s*(?:-|–|—|to|a|al|alle|until)\s*(${TIME_PART})`, 'i');

const STREET_RE =
  /\b\d{1,5}[a-z]?\s+(?:[A-Z0-9][\w'.-]*\s+){0,4}(?:st(?:reet)?|ave(?:nue)?|rd|road|blvd|boulevard|dr(?:ive)?|ln|lane|way|pl(?:ace)?|ct|court|pkwy|parkway|hwy|highway|sq(?:uare)?|terrace)\b\.?/i;
const STREET_PREFIX_RE = /\b(?:via|viale|piazza|corso|calle|avenida|av\.|plaza|rue|boulevard)\s+[A-Z][\w'. -]{2,}/i;

const TITLES_RE = /\b(?:Dr|Doctor|Mr|Mrs|Ms|Miss|Prof|Nurse|Dott|Dott\.ssa|Sr|Sra)\.?\s+[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?/g;
const CONTACT_LABEL_RE = /^(?:contact|ask for|case manager|social worker|caseworker|provider|doctor|physician)\s*[:\-]\s*(.+)$/i;

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function findPhones(text: string): string[] {
  const found = text.match(PHONE_RE) ?? [];
  return unique(
    found
      .map((p) => p.trim())
      .filter((p) => {
        const digits = p.replace(/\D/g, '');
        if (digits.length < 7 || digits.length > 15) return false;
        // Skip things that look like dates (2026-10-12, 12.10.2026) or plain years.
        if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(p) || /^\d{1,2}[-./]\d{1,2}[-./]\d{2,4}$/.test(p)) return false;
        return true;
      }),
  );
}

export function findEmails(text: string): string[] {
  return unique(text.match(EMAIL_RE) ?? []);
}

export function findUrls(text: string): string[] {
  return unique((text.match(URL_RE) ?? []).map((u) => u.replace(/[.]+$/, '')));
}

const pad = (n: number) => String(n).padStart(2, '0');

function isoDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function normalizeYear(y: string | undefined, now: Date): number {
  if (!y) return now.getFullYear();
  const n = Number(y);
  return n < 100 ? 2000 + n : n;
}

/** Returns ISO dates (YYYY-MM-DD) found in a line, in order of appearance. */
export function findDates(line: string, order: DateOrder = 'MDY', now = new Date()): string[] {
  const out: { index: number; iso: string }[] = [];
  const push = (index: number, iso: string | null) => iso && out.push({ index, iso });

  for (const m of line.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
    push(m.index!, isoDate(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  for (const m of line.matchAll(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/g)) {
    // Without a year, only accept slash dates ("3/14"); "9.30" is far more likely a time.
    if (!m[3] && m[0].includes('.')) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    const [month, day] = order === 'MDY' ? [a, b] : [b, a];
    push(m.index!, isoDate(normalizeYear(m[3], now), month, day));
  }
  const monthFirst = new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'gi');
  for (const m of line.matchAll(monthFirst)) {
    push(m.index!, isoDate(normalizeYear(m[3], now), MONTHS[m[1].toLowerCase()], Number(m[2])));
  }
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th|º)?\\s+(?:de\\s+|di\\s+)?(${MONTH_NAMES})\\.?(?:,?\\s+(?:de\\s+)?(\\d{4}))?\\b`, 'gi');
  for (const m of line.matchAll(dayFirst)) {
    push(m.index!, isoDate(normalizeYear(m[3], now), MONTHS[m[2].toLowerCase()], Number(m[1])));
  }
  return unique(out.sort((x, y) => x.index - y.index).map((o) => o.iso));
}

/** Parses "9", "9:30", "9am", "2.15 p.m." into 24h "HH:MM". */
export function toTime24(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  const suffix = m[3]?.toLowerCase().replace(/\./g, '');
  if (suffix === 'pm' && h < 12) h += 12;
  if (suffix === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** Times written explicitly ("10:30", "3 pm"), ignoring bare numbers. */
export function findTimes(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(TIME_RE)) {
    if (!m[2] && !m[3]) continue;
    const t = toTime24(m[0]);
    if (t) out.push(t);
  }
  return unique(out);
}

export function parseHoursLine(line: string): OpeningHours | null {
  if (!DAY_RE.test(line)) return null;
  const range = line.match(TIME_RANGE_RE);
  const closed = /\bclosed\b|\bcerrado\b|\bchiuso\b/i.test(line);
  if (!range && !closed) return null;
  const daysPart = (range ? line.slice(0, range.index) : line.replace(/\b(?:closed|cerrado|chiuso)\b/i, ''))
    .replace(/[:\-–,\s]+$/, '')
    .trim();
  let open = range ? toTime24(range[1]) : null;
  let close = range ? toTime24(range[2]) : null;
  // "9-5" style ranges: assume a closing hour smaller than the opening one is in the afternoon.
  if (open && close && close < open && !/[ap]\.?m/i.test(range![2])) {
    const [h, m] = close.split(':').map(Number);
    if (h + 12 < 24) close = `${pad(h + 12)}:${pad(m)}`;
  }
  const rest = range ? line.slice(range.index! + range[0].length).replace(/^[\s,;:-]+/, '').trim() : '';
  if (closed && !range) {
    open = null;
    close = null;
  }
  return {
    days: daysPart || line,
    open,
    close,
    note: closed && !range ? 'closed' : rest || null,
  };
}

export function findAddress(line: string): string | null {
  const m = line.match(STREET_RE) ?? line.match(STREET_PREFIX_RE);
  if (!m) return null;
  // Keep the rest of the line (city, zip) when it follows the street.
  return line.slice(m.index).replace(/^(?:address|location|located at|dirección|indirizzo)\s*[:-]?\s*/i, '').trim();
}

export function classify(text: string, topics: Topic[]): string[] {
  const haystack = ` ${text.toLowerCase()} `;
  const scored = topics
    .map((topic) => {
      let score = 0;
      for (const kw of topic.keywords) {
        const k = kw.toLowerCase().trim();
        if (!k) continue;
        const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(^|[^\\p{L}])${escaped}(?=[^\\p{L}]|$)`, 'giu');
        score += (haystack.match(re) ?? []).length * (k.includes(' ') ? 2 : 1);
      }
      return { id: topic.id, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.id);
}

function guessTitle(ls: string[]): string {
  const candidate = ls.find(
    (l) => l.length >= 3 && l.length <= 80 && !findPhones(l).length && !findEmails(l).length && !findAddress(l),
  );
  return candidate ?? ls[0] ?? 'Untitled paper';
}

export function parseOffline(text: string, opts: OfflineParseOptions): Extraction {
  const result = emptyExtraction();
  const ls = lines(text);
  const now = opts.now ?? new Date();
  const order = opts.dateOrder ?? 'MDY';
  result.rawText = text.trim();
  if (!ls.length) return result;

  result.title = guessTitle(ls);
  result.topicIds = classify(text, opts.topics);

  const phones = findPhones(text);
  const emails = findEmails(text);
  const urls = findUrls(text);
  const hours = ls.map(parseHoursLine).filter((h): h is OpeningHours => h !== null);
  const addresses = unique(ls.map(findAddress).filter((a): a is string => a !== null));

  if (addresses.length || hours.length || phones.length) {
    const place: Place = {
      name: result.title,
      kind: null,
      description: null,
      address: addresses[0] ?? null,
      phone: phones[0] ?? null,
      email: emails[0] ?? null,
      website: urls[0] ?? null,
      hours,
    };
    result.places.push(place);
    for (const extra of addresses.slice(1)) {
      result.places.push({ ...place, name: `${result.title} (${extra})`, address: extra, hours: [] });
    }
  }

  const contacts = new Map<string, Contact>();
  for (const line of ls) {
    const labelled = line.match(CONTACT_LABEL_RE);
    const names = labelled ? [labelled[1].split(/[,(]/)[0].trim()] : (line.match(TITLES_RE) ?? []);
    for (const name of names) {
      if (contacts.has(name)) continue;
      contacts.set(name, {
        name,
        role: /\b(dr|doctor|dott)/i.test(name) ? 'doctor' : null,
        organization: null,
        phone: findPhones(line)[0] ?? null,
        email: findEmails(line)[0] ?? null,
        notes: null,
      });
    }
  }
  result.contacts = [...contacts.values()];

  const appointments: Appointment[] = [];
  ls.forEach((line, i) => {
    if (parseHoursLine(line)) return;
    const dates = findDates(line, order, now);
    if (!dates.length) return;
    // A time can be on the same line or on the next one ("Date: Oct 12" / "Time: 10:30 am").
    const time = findTimes(line)[0] ?? (ls[i + 1] && !findDates(ls[i + 1], order, now).length ? findTimes(ls[i + 1])[0] : undefined);
    for (const date of dates) {
      appointments.push({
        title: /appointment|cita|appuntamento|visit/i.test(text) ? `Appointment: ${result.title}` : line,
        date,
        time: time ?? null,
        location: addresses[0] ?? null,
        withWhom: result.contacts[0]?.name ?? null,
        notes: line,
      });
    }
  });
  result.appointments = appointments;

  result.keyFacts = ls.filter((l) => /\b(bring|must|required|free|no cost|gratis|gratuito|please|bring your|ID)\b/i.test(l)).slice(0, 8);
  result.summary = ls.slice(0, 3).join(' · ').slice(0, 240);
  return result;
}
