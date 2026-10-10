import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { DocumentEditor } from '@/components/document-editor';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Empty, Screen } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/store';
import { draftEdited } from '@/store/capture-slice';
import { topicSelectors } from '@/store/selectors';
import { saveCapturedDraft } from '@/store/thunks';

const SOURCE_LABEL = { ai: '✨ Read by AI', offline: '🔎 Read on this phone (free)', manual: '✍️ Entered by hand' };

export default function ReviewScreen() {
  const dispatch = useAppDispatch();
  const { draft, draftSource, notice } = useAppSelector((s) => s.capture);
  const topics = useAppSelector(topicSelectors.selectAll);
  const [saving, setSaving] = useState(false);

  if (!draft) return <Empty title="Nothing to review" hint="Capture a paper first." />;

  const save = async () => {
    setSaving(true);
    const doc = await dispatch(saveCapturedDraft()).unwrap();
    setSaving(false);
    router.dismissAll();
    if (doc) router.push({ pathname: '/document/[id]', params: { id: doc.id } });
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <Button variant="ghost" title="Save" onPress={save} /> }} />
      <Card>
        <ThemedText type="smallBold">{SOURCE_LABEL[draftSource]}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {notice ?? 'Check the details below and fix anything that was read wrong. Nothing is saved until you tap Save.'}
        </ThemedText>
      </Card>
      <DocumentEditor value={draft} onChange={(d) => dispatch(draftEdited(d))} topics={topics} />
      <Button title="Save paper" onPress={save} loading={saving} />
    </Screen>
  );
}
