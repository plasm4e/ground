import type { GroundDocument } from '@ground/core';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import { DocumentEditor } from '@/components/document-editor';
import { AppointmentCard, ContactCard, PlaceCard } from '@/components/entity-cards';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Empty, Field, Row, Screen, SectionTitle } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/store';
import { documentPatched } from '@/store/documents-slice';
import { documentSelectors, topicSelectors } from '@/store/selectors';
import { deleteDocument, syncNow } from '@/store/thunks';

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onYes },
  ]);
}

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const doc = useAppSelector((s) => documentSelectors.selectById(s, id));
  const topics = useAppSelector(topicSelectors.selectAll);
  const [editing, setEditing] = useState<GroundDocument | null>(null);
  const [showText, setShowText] = useState(false);

  if (!doc) return <Empty title="Paper not found" hint="It may have been deleted on another device." />;

  const save = () => {
    if (!editing) return;
    const { id: _id, ...changes } = editing;
    dispatch(documentPatched({ id: doc.id, changes }));
    void dispatch(syncNow());
    setEditing(null);
  };

  const remove = () =>
    confirm('Delete this paper?', 'Its places, people and appointments will be removed too.', () => {
      router.back();
      void dispatch(deleteDocument(doc.id));
    });

  if (editing) {
    return (
      <Screen>
        <Stack.Screen
          options={{
            title: 'Edit paper',
            headerLeft: () => <Button variant="ghost" title="Cancel" onPress={() => setEditing(null)} />,
            headerRight: () => <Button variant="ghost" title="Save" onPress={save} />,
          }}
        />
        <DocumentEditor value={editing} onChange={setEditing} topics={topics} />
        <Button title="Save changes" onPress={save} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{ title: doc.documentType && doc.documentType !== 'other' ? doc.documentType : 'Paper', headerRight: () => <Button variant="ghost" title="Edit" onPress={() => setEditing(doc)} /> }}
      />
      <ThemedText type="subtitle" style={{ fontSize: 26, lineHeight: 32 }}>
        {doc.title}
      </ThemedText>
      <Row>
        {doc.topicIds.map((tid) => {
          const t = topics.find((x) => x.id === tid);
          return t ? (
            <Chip key={tid} label={`${t.emoji} ${t.name}`} color={t.color} onPress={() => router.push({ pathname: '/topic/[id]', params: { id: tid } })} />
          ) : null;
        })}
      </Row>
      {doc.summary ? <ThemedText>{doc.summary}</ThemedText> : null}

      {doc.imageUri ? <Image source={{ uri: doc.imageUri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 14 }} contentFit="contain" /> : null}

      {doc.keyFacts.length > 0 && (
        <Card>
          {doc.keyFacts.map((f, i) => (
            <ThemedText key={i} type="small">
              • {f}
            </ThemedText>
          ))}
        </Card>
      )}

      {doc.appointments.length > 0 && <SectionTitle>Appointments</SectionTitle>}
      {doc.appointments.map((a) => (
        <AppointmentCard key={a.id} appointment={a} />
      ))}

      {doc.places.length > 0 && <SectionTitle>Places</SectionTitle>}
      {doc.places.map((p) => (
        <PlaceCard key={p.id} place={p} />
      ))}

      {doc.contacts.length > 0 && <SectionTitle>People</SectionTitle>}
      {doc.contacts.map((c) => (
        <ContactCard key={c.id} contact={c} />
      ))}

      <SectionTitle>My notes</SectionTitle>
      <Field
        multiline
        placeholder="Anything you want to remember about this paper"
        defaultValue={doc.notes}
        onEndEditing={(e) => {
          const notes = e.nativeEvent.text;
          if (notes !== doc.notes) {
            dispatch(documentPatched({ id: doc.id, changes: { notes } }));
            void dispatch(syncNow());
          }
        }}
      />

      {doc.rawText ? (
        <>
          <SectionTitle action={<Button variant="ghost" title={showText ? 'Hide' : 'Show'} onPress={() => setShowText(!showText)} />}>Full text</SectionTitle>
          {showText && (
            <Card>
              <ThemedText type="small" selectable>
                {doc.rawText}
              </ThemedText>
            </Card>
          )}
        </>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        Saved {new Date(doc.createdAt).toLocaleString()} · {doc.source === 'ai' ? 'read by AI' : doc.source === 'offline' ? 'read on device' : 'entered by hand'}
      </ThemedText>
      <Button title="Delete paper" variant="danger" onPress={remove} />
    </Screen>
  );
}
