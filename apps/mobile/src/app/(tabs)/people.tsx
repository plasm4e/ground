import { useMemo, useState } from 'react';

import { ContactCard } from '@/components/entity-cards';
import { TabHeader } from '@/components/tab-header';
import { TopicFilter } from '@/components/topic-filter';
import { Empty, Field, Screen } from '@/components/ui';
import { useAppSelector } from '@/store';
import { selectAllContacts, topicSelectors } from '@/store/selectors';

export default function PeopleScreen() {
  const contacts = useAppSelector(selectAllContacts);
  const topics = useAppSelector(topicSelectors.selectAll);
  const [topic, setTopic] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        (!topic || c.topicIds.includes(topic)) &&
        (!q || [c.name, c.role, c.organization, c.phone, c.email].some((f) => f?.toLowerCase().includes(q))),
    );
  }, [contacts, topic, query]);

  return (
    <Screen>
      <TabHeader title="People" subtitle="Doctors, case workers and other contacts" />
      <Field placeholder="Filter by name, role, organization…" value={query} onChangeText={setQuery} autoCorrect={false} />
      <TopicFilter topics={topics} value={topic} onChange={setTopic} />
      {visible.length ? (
        visible.map((c) => <ContactCard key={c.id} contact={c} documentId={c.documentId} documentTitle={c.documentTitle} />)
      ) : (
        <Empty title={contacts.length ? 'No one matches' : 'No people yet'} hint={contacts.length ? undefined : 'Names found on your papers show up here with their phone numbers.'} />
      )}
    </Screen>
  );
}
