import { newId, type Topic } from '@ground/core';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Field, Row, Screen } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/store';
import { topicSelectors } from '@/store/selectors';
import { syncNow } from '@/store/thunks';
import { topicDeleted, topicSaved } from '@/store/topics-slice';

const COLORS = ['#E8590C', '#2B8A3E', '#C2255C', '#1971C2', '#6741D9', '#0C8599', '#E67700', '#5C940D', '#862E9C', '#495057'];

function TopicEditor({ topic, onDone }: { topic: Topic; onDone: () => void }) {
  const dispatch = useAppDispatch();
  const [draft, setDraft] = useState(topic);
  const [keywords, setKeywords] = useState(topic.keywords.join(', '));

  const save = () => {
    if (!draft.name.trim()) return;
    dispatch(topicSaved({ ...draft, name: draft.name.trim(), keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean) }));
    void dispatch(syncNow());
    onDone();
  };

  const remove = () => {
    const doIt = () => {
      dispatch(topicDeleted(topic.id));
      void dispatch(syncNow());
      onDone();
    };
    const msg = 'Papers in this topic are kept; they move to Unsorted if they have no other topic.';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doIt();
    } else {
      Alert.alert(`Delete “${topic.name}”?`, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: doIt }]);
    }
  };

  return (
    <Card>
      <Row>
        <Field label="Emoji" value={draft.emoji} onChangeText={(emoji) => setDraft({ ...draft, emoji })} style={{ width: 64, textAlign: 'center' }} />
        <Field label="Name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} style={{ minWidth: 200 }} />
      </Row>
      <Row>
        {COLORS.map((c) => (
          <Chip key={c} label={c === draft.color ? '●' : '○'} color={c} selected={c === draft.color} onPress={() => setDraft({ ...draft, color: c })} />
        ))}
      </Row>
      <Field
        label="Keywords (comma separated) — help Ground sort papers into this topic"
        multiline
        value={keywords}
        onChangeText={setKeywords}
      />
      <Row>
        <Button title="Save" onPress={save} style={{ flex: 1 }} />
        <Button title="Cancel" variant="secondary" onPress={onDone} style={{ flex: 1 }} />
      </Row>
      {topic.name ? <Button title="Delete topic" variant="danger" onPress={remove} /> : null}
    </Card>
  );
}

export default function TopicsScreen() {
  const topics = useAppSelector(topicSelectors.selectAll);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState<Topic | null>(null);

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Topics are the interests Ground files your papers under. Rename them, add your own, or remove the ones you don&apos;t need.
      </ThemedText>
      {topics.map((t) =>
        editingId === t.id ? (
          <TopicEditor key={t.id} topic={t} onDone={() => setEditingId(null)} />
        ) : (
          <Card key={t.id} onPress={() => setEditingId(t.id)} style={{ borderLeftWidth: 4, borderLeftColor: t.color }}>
            <ThemedText type="smallBold">
              {t.emoji} {t.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {t.keywords.join(', ') || 'No keywords'}
            </ThemedText>
          </Card>
        ),
      )}
      {creating ? (
        <TopicEditor topic={creating} onDone={() => setCreating(null)} />
      ) : (
        <Button
          title="+ New topic"
          variant="secondary"
          onPress={() => setCreating({ id: newId('tp_'), name: '', emoji: '📁', color: COLORS[topics.length % COLORS.length], keywords: [], builtIn: false })}
        />
      )}
    </Screen>
  );
}
