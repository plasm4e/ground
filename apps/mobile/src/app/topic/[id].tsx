import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { DocumentCard } from '@/components/document-card';
import { AppointmentCard, ContactCard, PlaceCard } from '@/components/entity-cards';
import { Chip, Empty, Row, Screen } from '@/components/ui';
import { useAppSelector } from '@/store';
import { selectDocumentsByTopic, selectAllContacts, selectAllPlaces, selectUpcomingAppointments, topicSelectors } from '@/store/selectors';

type View = 'places' | 'agenda' | 'people' | 'papers';

export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const topic = useAppSelector((s) => topicSelectors.selectById(s, id));
  const topics = useAppSelector(topicSelectors.selectAll);
  const docs = useAppSelector(selectDocumentsByTopic)[id] ?? [];
  const topicIds = useAppSelector(topicSelectors.selectIds);
  const inTopic = (x: { topicIds: string[] }) => (id === '__none' ? !x.topicIds.some((t) => topicIds.includes(t)) : x.topicIds.includes(id));
  const places = useAppSelector(selectAllPlaces).filter(inTopic);
  const appointments = useAppSelector(selectUpcomingAppointments).filter(inTopic);
  const contacts = useAppSelector(selectAllContacts).filter(inTopic);
  const [view, setView] = useState<View>(places.length ? 'places' : 'papers');

  const title = id === '__none' ? '🗂️ Unsorted' : topic ? `${topic.emoji} ${topic.name}` : 'Topic';

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Row>
        <Chip label={`Places (${places.length})`} color={topic?.color} selected={view === 'places'} onPress={() => setView('places')} />
        <Chip label={`Upcoming (${appointments.length})`} color={topic?.color} selected={view === 'agenda'} onPress={() => setView('agenda')} />
        <Chip label={`People (${contacts.length})`} color={topic?.color} selected={view === 'people'} onPress={() => setView('people')} />
        <Chip label={`Papers (${docs.length})`} color={topic?.color} selected={view === 'papers'} onPress={() => setView('papers')} />
      </Row>
      {view === 'places' && (places.length ? places.map((p) => <PlaceCard key={p.id} place={p} documentId={p.documentId} documentTitle={p.documentTitle} />) : <Empty title="No places here yet" />)}
      {view === 'agenda' &&
        (appointments.length ? appointments.map((a) => <AppointmentCard key={a.id} appointment={a} documentId={a.documentId} documentTitle={a.documentTitle} />) : <Empty title="Nothing coming up" />)}
      {view === 'people' && (contacts.length ? contacts.map((c) => <ContactCard key={c.id} contact={c} documentId={c.documentId} documentTitle={c.documentTitle} />) : <Empty title="No people here yet" />)}
      {view === 'papers' && (docs.length ? docs.map((d) => <DocumentCard key={d.id} doc={d} topics={topics} />) : <Empty title="No papers in this topic yet" />)}
    </Screen>
  );
}
