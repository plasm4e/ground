import { isOpenAt } from '@ground/core';
import { useMemo, useState } from 'react';

import { PlaceCard } from '@/components/entity-cards';
import { TabHeader } from '@/components/tab-header';
import { TopicFilter } from '@/components/topic-filter';
import { Chip, Empty, Field, Row, Screen } from '@/components/ui';
import { useAppSelector } from '@/store';
import { selectAllPlaces, topicSelectors } from '@/store/selectors';

export default function PlacesScreen() {
  const places = useAppSelector(selectAllPlaces);
  const topics = useAppSelector(topicSelectors.selectAll);
  const [topic, setTopic] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openNow, setOpenNow] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    return places.filter(
      (p) =>
        (!topic || p.topicIds.includes(topic)) &&
        (!openNow || isOpenAt(p.hours, now) === true) &&
        (!q || [p.name, p.kind, p.address, p.phone, p.description, p.documentTitle].some((f) => f?.toLowerCase().includes(q))),
    );
  }, [places, topic, query, openNow]);

  return (
    <Screen>
      <TabHeader title="Places" subtitle="Where to go, when it's open, how to call" />
      <Field placeholder="Filter by name, address, phone…" value={query} onChangeText={setQuery} autoCorrect={false} />
      <TopicFilter topics={topics} value={topic} onChange={setTopic} />
      <Row>
        <Chip label="🟢 Open now" selected={openNow} onPress={() => setOpenNow(!openNow)} />
      </Row>
      {visible.length ? (
        visible.map((p) => <PlaceCard key={p.id} place={p} documentId={p.documentId} documentTitle={p.documentTitle} />)
      ) : (
        <Empty title={places.length ? 'No places match' : 'No places yet'} hint={places.length ? undefined : 'Places appear here when a captured paper mentions an address, phone number or opening hours.'} />
      )}
    </Screen>
  );
}

