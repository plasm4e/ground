import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOPICS,
  classify,
  documentFromExtraction,
  findDates,
  findPhones,
  isOpenAt,
  matchesQuery,
  parseHoursLine,
  parseOffline,
  toTime24,
} from '../src';

const now = new Date('2026-10-10T12:00:00Z');

const FLYER = `Example Neighborhood Cafe
Fresh lunch and dinner every day
100 Example Street, Los Angeles, CA 90012
Phone: (213) 555-0100
Mon-Fri 7:00am - 1:30pm
Saturday 8-12
Sunday closed
Bring this flyer for a free drink
www.example.org`;

const APPOINTMENT = `Example Health Center
Appointment reminder
Patient: J. Doe
Dr. Alex Sample
Date: October 14, 2026
Time: 10:30 am
200 Sample Avenue, Los Angeles
Please arrive 15 minutes early. Call 213-555-0199 to reschedule.`;

describe('field finders', () => {
  it('finds phone numbers and ignores dates', () => {
    expect(findPhones('Call (213) 555-0100 or +44 20 7946 0000 by 2026-10-12')).toEqual([
      '(213) 555-0100',
      '+44 20 7946 0000',
    ]);
  });

  it('parses times to 24h', () => {
    expect(toTime24('7:00am')).toBe('07:00');
    expect(toTime24('1:30 p.m.')).toBe('13:30');
    expect(toTime24('12 am')).toBe('00:00');
    expect(toTime24('25:00')).toBeNull();
  });

  it('parses dates in several formats', () => {
    expect(findDates('Date: October 14, 2026', 'MDY', now)).toEqual(['2026-10-14']);
    expect(findDates('el 3 de noviembre', 'MDY', now)).toEqual(['2026-11-03']);
    expect(findDates('03/04/2026', 'MDY', now)).toEqual(['2026-03-04']);
    expect(findDates('03/04/2026', 'DMY', now)).toEqual(['2026-04-03']);
    expect(findDates('2026-12-01')).toEqual(['2026-12-01']);
    expect(findDates('open 9.30 to 5')).toEqual([]);
  });

  it('parses opening hours lines', () => {
    expect(parseHoursLine('Mon-Fri 7:00am - 1:30pm')).toEqual({ days: 'Mon-Fri', open: '07:00', close: '13:30', note: null });
    expect(parseHoursLine('Saturday 8-12')).toEqual({ days: 'Saturday', open: '08:00', close: '12:00', note: null });
    expect(parseHoursLine('Tue 9-5')?.close).toBe('17:00');
    expect(parseHoursLine('Sunday closed')).toEqual({ days: 'Sunday', open: null, close: null, note: 'closed' });
    expect(parseHoursLine('Fresh lunch daily')).toBeNull();
  });

  it('classifies against topic keywords', () => {
    expect(classify(FLYER, DEFAULT_TOPICS)[0]).toBe('food');
    expect(classify(APPOINTMENT, DEFAULT_TOPICS)).toContain('appointments');
  });
});

describe('parseOffline', () => {
  it('extracts a place with hours from a flyer', () => {
    const r = parseOffline(FLYER, { topics: DEFAULT_TOPICS, now });
    expect(r.title).toBe('Example Neighborhood Cafe');
    expect(r.places).toHaveLength(1);
    const place = r.places[0];
    expect(place.address).toBe('100 Example Street, Los Angeles, CA 90012');
    expect(place.phone).toBe('(213) 555-0100');
    expect(place.website).toBe('www.example.org');
    expect(place.hours.map((h) => h.days)).toEqual(['Mon-Fri', 'Saturday', 'Sunday']);
    expect(r.keyFacts).toContain('Bring this flyer for a free drink');
    expect(r.topicIds[0]).toBe('food');
  });

  it('extracts an appointment with time from the following line and the doctor', () => {
    const r = parseOffline(APPOINTMENT, { topics: DEFAULT_TOPICS, now });
    expect(r.appointments).toHaveLength(1);
    expect(r.appointments[0]).toMatchObject({ date: '2026-10-14', time: '10:30', location: '200 Sample Avenue, Los Angeles', withWhom: 'Dr. Alex Sample' });
    expect(r.contacts.map((c) => c.name)).toContain('Dr. Alex Sample');
    expect(r.places[0].phone).toBe('213-555-0199');
  });

  it('returns an empty extraction for empty text', () => {
    expect(parseOffline('   ', { topics: DEFAULT_TOPICS }).places).toEqual([]);
  });
});

describe('search helpers', () => {
  const doc = documentFromExtraction(parseOffline(FLYER, { topics: DEFAULT_TOPICS, now }), { source: 'offline' });

  it('matches all terms, accent-insensitive', () => {
    expect(matchesQuery(doc, 'example street')).toBe(true);
    expect(matchesQuery(doc, 'CAFE 0100')).toBe(true);
    expect(matchesQuery(doc, 'clinic')).toBe(false);
  });

  it('tells whether a place is open', () => {
    const hours = doc.places[0].hours;
    expect(isOpenAt(hours, new Date(2026, 9, 12, 9, 0))).toBe(true); // Monday 9:00
    expect(isOpenAt(hours, new Date(2026, 9, 12, 15, 0))).toBe(false); // Monday 15:00
    expect(isOpenAt(hours, new Date(2026, 9, 10, 9, 0))).toBe(true); // Saturday 9:00
    expect(isOpenAt([{ days: 'by appointment', open: '09:00', close: '10:00' }], new Date())).toBeNull();
  });
});
