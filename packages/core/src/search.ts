import type { GroundDocument } from './model';

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/** Everything searchable about a document, flattened into one string. */
export function documentHaystack(doc: GroundDocument): string {
  const parts: (string | null)[] = [doc.title, doc.summary, doc.documentType, doc.notes, doc.rawText, ...doc.keyFacts];
  for (const p of doc.places) parts.push(p.name, p.kind, p.description, p.address, p.phone, p.email, p.website);
  for (const c of doc.contacts) parts.push(c.name, c.role, c.organization, c.phone, c.email, c.notes);
  for (const a of doc.appointments) parts.push(a.title, a.date, a.location, a.withWhom, a.notes);
  return fold(parts.filter(Boolean).join(' \n '));
}

/** All whitespace-separated terms must appear somewhere in the document. */
export function matchesQuery(doc: GroundDocument, query: string): boolean {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = documentHaystack(doc);
  return terms.every((t) => hay.includes(t));
}

/** "HH:MM" -> minutes since midnight. */
const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const DAY_INDEX: [RegExp, number[]][] = [
  [/daily|every ?day|todos los d[ií]as|tutti i giorni/i, [0, 1, 2, 3, 4, 5, 6]],
  [/weekdays|mon(?:day)?\s*(?:-|–|to|through)\s*fri(?:day)?|lun(?:es|edì)?\s*(?:-|–|a)\s*(?:vie(?:rnes)?|ven(?:erdì)?)/i, [1, 2, 3, 4, 5]],
  [/weekends?/i, [0, 6]],
  [/\bsun|\bdom/i, [0]],
  [/\bmon|\blun/i, [1]],
  [/\btue|\bmart/i, [2]],
  [/\bwed|\bmi[eé]r|\bmerc/i, [3]],
  [/\bthu|\bjue|\bgio/i, [4]],
  [/\bfri|\bvie|\bven/i, [5]],
  [/\bsat|\bs[aá]b/i, [6]],
];

/** Best-effort: which weekdays (0=Sun) a free-form "days" label covers. */
export function daysCovered(label: string): number[] {
  for (const [re, days] of DAY_INDEX.slice(0, 3)) if (re.test(label)) return days;
  const out = new Set<number>();
  for (const [re, days] of DAY_INDEX.slice(3)) if (re.test(label)) days.forEach((d) => out.add(d));
  return [...out];
}

/** true/false when it can tell, null when the hours are too vague to decide. */
export function isOpenAt(hours: { days: string; open: string | null; close: string | null }[], at: Date): boolean | null {
  let decided = false;
  for (const h of hours) {
    if (!h.open || !h.close) continue;
    const days = daysCovered(h.days);
    if (!days.length) continue;
    decided = true;
    const now = at.getHours() * 60 + at.getMinutes();
    if (days.includes(at.getDay()) && now >= minutes(h.open) && now < minutes(h.close)) return true;
  }
  return decided ? false : null;
}
