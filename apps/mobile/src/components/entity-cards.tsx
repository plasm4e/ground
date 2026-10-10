import { isOpenAt, type Appointment, type Contact, type Place } from '@ground/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Chip, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, openEmail, openMap, openPhone, openWebsite, relativeDay } from '@/lib/format';

function Action({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]} hitSlop={6}>
      <ThemedText type="small">{icon}</ThemedText>
      <ThemedText type="small" style={{ color: theme.tint, flexShrink: 1 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function SourceLink({ documentId, documentTitle }: { documentId?: string; documentTitle?: string }) {
  if (!documentId) return null;
  return (
    <Pressable onPress={() => router.push({ pathname: '/document/[id]', params: { id: documentId } })}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        📄 From: {documentTitle}
      </ThemedText>
    </Pressable>
  );
}

type Source = { documentId?: string; documentTitle?: string };

export function PlaceCard({ place, documentId, documentTitle }: { place: Place } & Source) {
  const theme = useTheme();
  const open = isOpenAt(place.hours, new Date());
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <ThemedText type="smallBold" style={{ fontSize: 17, flexShrink: 1 }}>
          {place.name}
        </ThemedText>
        {open !== null && <Chip label={open ? 'Open now' : 'Closed now'} color={open ? '#2B8A3E' : theme.danger} />}
      </Row>
      {place.kind ? (
        <ThemedText type="small" themeColor="textSecondary">
          {place.kind}
        </ThemedText>
      ) : null}
      {place.description ? <ThemedText type="small">{place.description}</ThemedText> : null}
      {place.address ? <Action icon="📍" label={place.address} onPress={() => openMap(place.address!)} /> : null}
      {place.phone ? <Action icon="📞" label={place.phone} onPress={() => openPhone(place.phone!)} /> : null}
      {place.email ? <Action icon="✉️" label={place.email} onPress={() => openEmail(place.email!)} /> : null}
      {place.website ? <Action icon="🌐" label={place.website} onPress={() => openWebsite(place.website!)} /> : null}
      {place.hours.length > 0 && (
        <View style={styles.hours}>
          {place.hours.map((h, i) => (
            <View key={i} style={styles.hoursRow}>
              <ThemedText type="small" style={{ flex: 1 }}>
                🕒 {h.days}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {h.open && h.close ? `${h.open}–${h.close}` : (h.note ?? '')}
                {h.open && h.close && h.note ? ` · ${h.note}` : ''}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
      <SourceLink documentId={documentId} documentTitle={documentTitle} />
    </Card>
  );
}

export function ContactCard({ contact, documentId, documentTitle }: { contact: Contact } & Source) {
  return (
    <Card>
      <ThemedText type="smallBold" style={{ fontSize: 17 }}>
        {contact.name}
      </ThemedText>
      {contact.role || contact.organization ? (
        <ThemedText type="small" themeColor="textSecondary">
          {[contact.role, contact.organization].filter(Boolean).join(' · ')}
        </ThemedText>
      ) : null}
      {contact.phone ? <Action icon="📞" label={contact.phone} onPress={() => openPhone(contact.phone!)} /> : null}
      {contact.email ? <Action icon="✉️" label={contact.email} onPress={() => openEmail(contact.email!)} /> : null}
      {contact.notes ? <ThemedText type="small">{contact.notes}</ThemedText> : null}
      <SourceLink documentId={documentId} documentTitle={documentTitle} />
    </Card>
  );
}

export function AppointmentCard({ appointment, documentId, documentTitle }: { appointment: Appointment } & Source) {
  const theme = useTheme();
  const rel = relativeDay(appointment.date);
  const soon = rel === 'Today' || rel === 'Tomorrow';
  return (
    <Card style={soon ? { borderLeftWidth: 4, borderLeftColor: theme.tint } : undefined}>
      <Row style={{ justifyContent: 'space-between' }}>
        <ThemedText type="smallBold" style={{ fontSize: 17, flexShrink: 1 }}>
          {appointment.title}
        </ThemedText>
        {rel ? <Chip label={rel} color={soon ? theme.tint : undefined} /> : null}
      </Row>
      <ThemedText type="small">
        📅 {formatDate(appointment.date)}
        {appointment.time ? ` · ${appointment.time}` : ''}
      </ThemedText>
      {appointment.withWhom ? <ThemedText type="small">👤 {appointment.withWhom}</ThemedText> : null}
      {appointment.location ? (
        <Action icon="📍" label={appointment.location} onPress={() => openMap(appointment.location!)} />
      ) : null}
      {appointment.notes ? (
        <ThemedText type="small" themeColor="textSecondary">
          {appointment.notes}
        </ThemedText>
      ) : null}
      <SourceLink documentId={documentId} documentTitle={documentTitle} />
    </Card>
  );
}

const styles = StyleSheet.create({
  action: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  hours: { gap: 2, marginTop: Spacing.one },
  hoursRow: { flexDirection: 'row', gap: Spacing.two },
});
