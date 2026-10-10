import { newId, parseHoursLine, type Appointment, type Contact, type Extraction, type OpeningHours, type Place, type Topic } from '@ground/core';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Field, Row, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';

/**
 * Editor for everything extracted from a paper. Used both to review a fresh capture
 * and to correct a saved document. Items keep any extra properties (like stored ids).
 */

const orNull = (s: string) => (s.trim() === '' ? null : s);

const hoursToText = (hours: OpeningHours[]) =>
  hours
    .map((h) => [h.days, h.open && h.close ? `${h.open}-${h.close}` : null, h.note].filter(Boolean).join(' '))
    .join('\n');

const textToHours = (text: string): OpeningHours[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => parseHoursLine(line) ?? { days: line, open: null, close: null, note: null });

const EMPTY_PLACE: Place = { name: '', kind: null, description: null, address: null, phone: null, email: null, website: null, hours: [] };
const EMPTY_CONTACT: Contact = { name: '', role: null, organization: null, phone: null, email: null, notes: null };
const EMPTY_APPOINTMENT: Appointment = { title: '', date: null, time: null, location: null, withWhom: null, notes: null };

/** Every item gets an id so list keys stay stable and saved documents get real entity ids. */
const withId = <T extends object>(item: T, prefix: string) => Object.assign({}, item, { id: newId(prefix) });
const keyOf = (item: object, i: number) => ('id' in item ? String(item.id) : String(i));

function replaceAt<T>(list: T[], index: number, item: T): T[] {
  return list.map((x, i) => (i === index ? item : x));
}

function PlaceEditor({ place, onChange, onRemove }: { place: Place; onChange: (p: Place) => void; onRemove: () => void }) {
  // Hours are edited as free text and parsed when the field loses focus.
  const [hoursText, setHoursText] = useState(() => hoursToText(place.hours));
  return (
    <Card>
      <Field label="Name" value={place.name} onChangeText={(name) => onChange({ ...place, name })} />
      <Field label="Kind" placeholder="restaurant, clinic, office…" value={place.kind ?? ''} onChangeText={(v) => onChange({ ...place, kind: orNull(v) })} />
      <Field label="Address" value={place.address ?? ''} onChangeText={(v) => onChange({ ...place, address: orNull(v) })} />
      <Field label="Phone" keyboardType="phone-pad" value={place.phone ?? ''} onChangeText={(v) => onChange({ ...place, phone: orNull(v) })} />
      <Field label="Email" keyboardType="email-address" autoCapitalize="none" value={place.email ?? ''} onChangeText={(v) => onChange({ ...place, email: orNull(v) })} />
      <Field label="Website" autoCapitalize="none" value={place.website ?? ''} onChangeText={(v) => onChange({ ...place, website: orNull(v) })} />
      <Field
        label="Opening hours (one per line, e.g. “Mon-Fri 9:00-17:00”)"
        multiline
        value={hoursText}
        onChangeText={setHoursText}
        onBlur={() => onChange({ ...place, hours: textToHours(hoursText) })}
      />
      <Field label="Description" multiline value={place.description ?? ''} onChangeText={(v) => onChange({ ...place, description: orNull(v) })} />
      <Button title="Remove place" variant="danger" onPress={onRemove} />
    </Card>
  );
}

function ContactEditor({ contact, onChange, onRemove }: { contact: Contact; onChange: (c: Contact) => void; onRemove: () => void }) {
  return (
    <Card>
      <Field label="Name" value={contact.name} onChangeText={(name) => onChange({ ...contact, name })} />
      <Field label="Role" placeholder="doctor, case manager…" value={contact.role ?? ''} onChangeText={(v) => onChange({ ...contact, role: orNull(v) })} />
      <Field label="Organization" value={contact.organization ?? ''} onChangeText={(v) => onChange({ ...contact, organization: orNull(v) })} />
      <Field label="Phone" keyboardType="phone-pad" value={contact.phone ?? ''} onChangeText={(v) => onChange({ ...contact, phone: orNull(v) })} />
      <Field label="Email" keyboardType="email-address" autoCapitalize="none" value={contact.email ?? ''} onChangeText={(v) => onChange({ ...contact, email: orNull(v) })} />
      <Field label="Notes" multiline value={contact.notes ?? ''} onChangeText={(v) => onChange({ ...contact, notes: orNull(v) })} />
      <Button title="Remove person" variant="danger" onPress={onRemove} />
    </Card>
  );
}

function AppointmentEditor({
  appointment,
  onChange,
  onRemove,
}: {
  appointment: Appointment;
  onChange: (a: Appointment) => void;
  onRemove: () => void;
}) {
  const dateValid = !appointment.date || /^\d{4}-\d{2}-\d{2}$/.test(appointment.date);
  const timeValid = !appointment.time || /^\d{2}:\d{2}$/.test(appointment.time);
  return (
    <Card>
      <Field label="What" value={appointment.title} onChangeText={(title) => onChange({ ...appointment, title })} />
      <Row>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Field label={dateValid ? 'Date (YYYY-MM-DD)' : '⚠️ Date (YYYY-MM-DD)'} placeholder="2026-10-14" value={appointment.date ?? ''} onChangeText={(v) => onChange({ ...appointment, date: orNull(v) })} />
        </View>
        <View style={{ flex: 1, minWidth: 100 }}>
          <Field label={timeValid ? 'Time (HH:MM)' : '⚠️ Time (HH:MM)'} placeholder="10:30" value={appointment.time ?? ''} onChangeText={(v) => onChange({ ...appointment, time: orNull(v) })} />
        </View>
      </Row>
      <Field label="Where" value={appointment.location ?? ''} onChangeText={(v) => onChange({ ...appointment, location: orNull(v) })} />
      <Field label="With" value={appointment.withWhom ?? ''} onChangeText={(v) => onChange({ ...appointment, withWhom: orNull(v) })} />
      <Field label="Notes" multiline value={appointment.notes ?? ''} onChangeText={(v) => onChange({ ...appointment, notes: orNull(v) })} />
      <Button title="Remove appointment" variant="danger" onPress={onRemove} />
    </Card>
  );
}

export function DocumentEditor<T extends Extraction>({
  value,
  onChange,
  topics,
}: {
  value: T;
  onChange: (next: T) => void;
  topics: Topic[];
}) {
  const set = <K extends keyof Extraction>(key: K, v: Extraction[K]) => onChange({ ...value, [key]: v });
  const toggleTopic = (id: string) =>
    set('topicIds', value.topicIds.includes(id) ? value.topicIds.filter((t) => t !== id) : [...value.topicIds, id]);

  return (
    <View style={{ gap: Spacing.three }}>
      <Field label="Title" value={value.title} onChangeText={(v) => set('title', v)} />
      <Field label="Summary" multiline value={value.summary} onChangeText={(v) => set('summary', v)} />
      <Field label="Type of paper" placeholder="flyer, appointment letter, prescription…" value={value.documentType} onChangeText={(v) => set('documentType', v)} />

      <SectionTitle>Topics</SectionTitle>
      <Row>
        {topics.map((t) => (
          <Chip key={t.id} label={`${t.emoji} ${t.name}`} color={t.color} selected={value.topicIds.includes(t.id)} onPress={() => toggleTopic(t.id)} />
        ))}
      </Row>

      <SectionTitle action={<Button variant="ghost" title="+ Add" onPress={() => set('places', [...value.places, withId(EMPTY_PLACE, 'pl_')])} />}>
        Places ({value.places.length})
      </SectionTitle>
      {value.places.map((p, i) => (
        <PlaceEditor
          key={keyOf(p, i)}
          place={p}
          onChange={(np) => set('places', replaceAt(value.places, i, np))}
          onRemove={() => set('places', value.places.filter((_, j) => j !== i))}
        />
      ))}

      <SectionTitle action={<Button variant="ghost" title="+ Add" onPress={() => set('appointments', [...value.appointments, withId(EMPTY_APPOINTMENT, 'ap_')])} />}>
        Appointments ({value.appointments.length})
      </SectionTitle>
      {value.appointments.map((a, i) => (
        <AppointmentEditor
          key={keyOf(a, i)}
          appointment={a}
          onChange={(na) => set('appointments', replaceAt(value.appointments, i, na))}
          onRemove={() => set('appointments', value.appointments.filter((_, j) => j !== i))}
        />
      ))}

      <SectionTitle action={<Button variant="ghost" title="+ Add" onPress={() => set('contacts', [...value.contacts, withId(EMPTY_CONTACT, 'ct_')])} />}>
        People ({value.contacts.length})
      </SectionTitle>
      {value.contacts.map((c, i) => (
        <ContactEditor
          key={keyOf(c, i)}
          contact={c}
          onChange={(nc) => set('contacts', replaceAt(value.contacts, i, nc))}
          onRemove={() => set('contacts', value.contacts.filter((_, j) => j !== i))}
        />
      ))}

      <SectionTitle>Good to know</SectionTitle>
      <Field
        multiline
        placeholder="One fact per line: “Bring photo ID”, “Free for everyone”…"
        value={value.keyFacts.join('\n')}
        onChangeText={(v) => set('keyFacts', v.split('\n'))}
        onBlur={() => set('keyFacts', value.keyFacts.map((f) => f.trim()).filter(Boolean))}
      />

      <SectionTitle>Full text</SectionTitle>
      <Field multiline value={value.rawText} onChangeText={(v) => set('rawText', v)} style={{ minHeight: 140 }} />
      {!value.rawText ? (
        <ThemedText type="small" themeColor="textSecondary">
          The text of the paper. Filled in automatically by AI extraction; makes the paper searchable.
        </ThemedText>
      ) : null}
    </View>
  );
}
