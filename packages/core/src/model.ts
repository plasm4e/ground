import { z } from 'zod';

/**
 * The extraction schema is what an AI model (or the offline parser) returns for one
 * captured paper. It is deliberately flat and uses `nullable` instead of `optional`
 * so it can be used as a strict JSON schema for structured outputs.
 */

export const OpeningHoursSchema = z.object({
  /** Free-form day range as written on the paper, e.g. "Mon–Fri", "Saturday", "Daily". */
  days: z.string(),
  /** 24h "HH:MM" when known. */
  open: z.string().nullable(),
  close: z.string().nullable(),
  /** Anything else: "lunch only", "bring ID", "closed on holidays"... */
  note: z.string().nullable(),
});

export const PlaceSchema = z.object({
  name: z.string(),
  /** What kind of place it is: "restaurant", "clinic", "pharmacy", "office"... */
  kind: z.string().nullable(),
  description: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  hours: z.array(OpeningHoursSchema),
});

export const ContactSchema = z.object({
  name: z.string(),
  /** "doctor", "social worker", "case manager"... */
  role: z.string().nullable(),
  organization: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
});

export const AppointmentSchema = z.object({
  title: z.string(),
  /** ISO date "YYYY-MM-DD" when known. */
  date: z.string().nullable(),
  /** 24h "HH:MM" when known. */
  time: z.string().nullable(),
  location: z.string().nullable(),
  withWhom: z.string().nullable(),
  notes: z.string().nullable(),
});

export const ExtractionSchema = z.object({
  title: z.string(),
  summary: z.string(),
  /** "flyer", "appointment letter", "prescription", "lab results", "brochure"... */
  documentType: z.string(),
  /** Ids of the user's topics this paper belongs to. */
  topicIds: z.array(z.string()),
  /** BCP-47 language code of the paper, e.g. "en", "es", "it". */
  language: z.string().nullable(),
  places: z.array(PlaceSchema),
  contacts: z.array(ContactSchema),
  appointments: z.array(AppointmentSchema),
  /** Short facts worth remembering that don't fit elsewhere ("bring photo ID", "free for under 18"). */
  keyFacts: z.array(z.string()),
  /** Full transcription of the text on the paper. */
  rawText: z.string(),
});

export type OpeningHours = z.infer<typeof OpeningHoursSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Appointment = z.infer<typeof AppointmentSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;

/** Stored entities carry an id so they can be edited and listed individually. */
type WithId<T> = T & { id: string };
export type StoredPlace = WithId<Place>;
export type StoredContact = WithId<Contact>;
export type StoredAppointment = WithId<Appointment>;

export type ExtractionSource = 'ai' | 'offline' | 'manual';

export const TopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  color: z.string(),
  /** Words that suggest a paper belongs to this topic. Used by the offline classifier and as hints for the AI. */
  keywords: z.array(z.string()),
  builtIn: z.boolean(),
  updatedAt: z.string().optional(),
});
export type Topic = z.infer<typeof TopicSchema>;

export const GroundDocumentSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  title: z.string(),
  summary: z.string(),
  documentType: z.string(),
  topicIds: z.array(z.string()),
  language: z.string().nullable(),
  places: z.array(PlaceSchema.extend({ id: z.string() })),
  contacts: z.array(ContactSchema.extend({ id: z.string() })),
  appointments: z.array(AppointmentSchema.extend({ id: z.string() })),
  keyFacts: z.array(z.string()),
  rawText: z.string(),
  /** Local URI of the photo on the device. Not synced. */
  imageUri: z.string().nullable(),
  notes: z.string(),
  source: z.enum(['ai', 'offline', 'manual']),
});
export type GroundDocument = z.infer<typeof GroundDocumentSchema>;

export function newId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

export function emptyExtraction(): Extraction {
  return {
    title: '',
    summary: '',
    documentType: 'other',
    topicIds: [],
    language: null,
    places: [],
    contacts: [],
    appointments: [],
    keyFacts: [],
    rawText: '',
  };
}

export function documentFromExtraction(
  extraction: Extraction,
  opts: { source: ExtractionSource; imageUri?: string | null; now?: Date },
): GroundDocument {
  const now = (opts.now ?? new Date()).toISOString();
  return {
    id: newId('doc_'),
    createdAt: now,
    updatedAt: now,
    title: extraction.title.trim() || 'Untitled paper',
    summary: extraction.summary,
    documentType: extraction.documentType,
    topicIds: extraction.topicIds,
    language: extraction.language,
    places: extraction.places.map((p) => ({ ...p, id: newId('pl_') })),
    contacts: extraction.contacts.map((c) => ({ ...c, id: newId('ct_') })),
    appointments: extraction.appointments.map((a) => ({ ...a, id: newId('ap_') })),
    keyFacts: extraction.keyFacts,
    rawText: extraction.rawText,
    imageUri: opts.imageUri ?? null,
    notes: '',
    source: opts.source,
  };
}
