import type { Topic } from '@ground/core';
import { ScrollView } from 'react-native';

import { Chip } from '@/components/ui';
import { Spacing } from '@/constants/theme';

/** Horizontal row of topic chips; `null` means all topics. */
export function TopicFilter({ topics, value, onChange }: { topics: Topic[]; value: string | null; onChange: (id: string | null) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
      <Chip label="All" selected={value === null} onPress={() => onChange(null)} />
      {topics.map((t) => (
        <Chip key={t.id} label={`${t.emoji} ${t.name}`} color={t.color} selected={value === t.id} onPress={() => onChange(value === t.id ? null : t.id)} />
      ))}
    </ScrollView>
  );
}
