import type { GroundDocument, Topic } from '@ground/core';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Card, Chip, Row } from '@/components/ui';

export function DocumentCard({ doc, topics }: { doc: GroundDocument; topics: Topic[] }) {
  const counts = [
    doc.places.length && `${doc.places.length} place${doc.places.length > 1 ? 's' : ''}`,
    doc.appointments.length && `${doc.appointments.length} appointment${doc.appointments.length > 1 ? 's' : ''}`,
    doc.contacts.length && `${doc.contacts.length} ${doc.contacts.length > 1 ? 'people' : 'person'}`,
  ].filter(Boolean);
  return (
    <Card onPress={() => router.push({ pathname: '/document/[id]', params: { id: doc.id } })}>
      <ThemedText type="smallBold" style={{ fontSize: 17 }} numberOfLines={2}>
        {doc.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {[doc.documentType, new Date(doc.createdAt).toLocaleDateString(), ...counts].filter(Boolean).join(' · ')}
      </ThemedText>
      {doc.summary ? (
        <ThemedText type="small" numberOfLines={2}>
          {doc.summary}
        </ThemedText>
      ) : null}
      {doc.topicIds.length > 0 && (
        <Row>
          {doc.topicIds.map((id) => {
            const t = topics.find((x) => x.id === id);
            return t ? <Chip key={id} label={`${t.emoji} ${t.name}`} color={t.color} /> : null;
          })}
        </Row>
      )}
    </Card>
  );
}
