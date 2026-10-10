import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DocumentCard } from '@/components/document-card';
import { AppointmentCard } from '@/components/entity-cards';
import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Empty, Field, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppSelector } from '@/store';
import {
  documentSelectors,
  selectDocumentsByTopic,
  selectPendingChanges,
  selectSearchResults,
  selectUpcomingAppointments,
  topicSelectors,
} from '@/store/selectors';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function HomeScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const topics = useAppSelector(topicSelectors.selectAll);
  const docs = useAppSelector(documentSelectors.selectAll);
  const byTopic = useAppSelector(selectDocumentsByTopic);
  const upcoming = useAppSelector(selectUpcomingAppointments);
  const results = useAppSelector((s) => selectSearchResults(s, query));
  const pending = useAppSelector(selectPendingChanges);
  const serverUrl = useAppSelector((s) => s.settings.serverUrl);

  return (
    <Screen>
      <TabHeader
        title="Ground"
        subtitle={`${plural(docs.length, 'paper')}${serverUrl && pending ? ` · ${pending} to sync` : ''}`}
        right={<Button variant="ghost" title="⚙︎ Settings" onPress={() => router.push('/settings')} />}
      />

      <Button title="📷  Capture a paper" onPress={() => router.push('/capture')} />

      <Field placeholder="Search names, phones, addresses, text…" value={query} onChangeText={setQuery} clearButtonMode="while-editing" autoCorrect={false} />

      {query.trim() ? (
        <>
          <SectionTitle>Results ({results.length})</SectionTitle>
          {results.length ? results.map((d) => <DocumentCard key={d.id} doc={d} topics={topics} />) : <Empty title="Nothing found" hint="Try fewer or different words." />}
        </>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <SectionTitle action={<Button variant="ghost" title="All" onPress={() => router.push('/agenda')} />}>Coming up</SectionTitle>
              {upcoming.slice(0, 3).map((a) => (
                <AppointmentCard key={a.id} appointment={a} documentId={a.documentId} documentTitle={a.documentTitle} />
              ))}
            </>
          )}

          <SectionTitle action={<Button variant="ghost" title="Edit" onPress={() => router.push('/topics')} />}>Your topics</SectionTitle>
          <View style={styles.grid}>
            {topics.map((t) => (
              <Pressable
                key={t.id}
                style={({ pressed }) => [styles.tile, { backgroundColor: theme.backgroundElement, borderColor: t.color }, pressed && { opacity: 0.7 }]}
                onPress={() => router.push({ pathname: '/topic/[id]', params: { id: t.id } })}>
                <ThemedText style={{ fontSize: 28, lineHeight: 34 }}>{t.emoji}</ThemedText>
                <ThemedText type="smallBold" numberOfLines={2}>
                  {t.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {plural(byTopic[t.id]?.length ?? 0, 'paper')}
                </ThemedText>
              </Pressable>
            ))}
            {byTopic.__none?.length ? (
              <Pressable
                style={({ pressed }) => [styles.tile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && { opacity: 0.7 }]}
                onPress={() => router.push({ pathname: '/topic/[id]', params: { id: '__none' } })}>
                <ThemedText style={{ fontSize: 28, lineHeight: 34 }}>🗂️</ThemedText>
                <ThemedText type="smallBold">Unsorted</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {plural(byTopic.__none.length, 'paper')}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          <SectionTitle>Recent papers</SectionTitle>
          {docs.length ? (
            docs.slice(0, 5).map((d) => <DocumentCard key={d.id} doc={d} topics={topics} />)
          ) : (
            <Card>
              <Empty
                title="No papers yet"
                hint="Take a photo of a flyer, a clinic schedule or an appointment letter. Ground pulls out places, hours, phone numbers, people and dates, and files them under your topics."
              />
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: { flexBasis: '47%', flexGrow: 1, borderRadius: 14, padding: Spacing.three, gap: 2, borderLeftWidth: 4 },
});
