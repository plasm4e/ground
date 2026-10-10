import type { DateOrder } from '@ground/core';
import { useState } from 'react';
import { Share, Switch, View } from 'react-native';

import { api, ApiError } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Field, Row, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { documentSelectors, selectPendingChanges, topicSelectors } from '@/store/selectors';
import { settingsChanged } from '@/store/settings-slice';
import { syncNow } from '@/store/thunks';

const LANGUAGES = [
  ['en', 'English'],
  ['es', 'Español'],
  ['it', 'Italiano'],
  ['fr', 'Français'],
  ['pt', 'Português'],
] as const;

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((s) => s.settings);
  const pending = useAppSelector(selectPendingChanges);
  const docs = useAppSelector(documentSelectors.selectAll);
  const topics = useAppSelector(topicSelectors.selectAll);
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [apiToken, setApiToken] = useState(settings.apiToken);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const saveServer = async () => {
    const cfg = { serverUrl: serverUrl.trim(), apiToken: apiToken.trim() };
    dispatch(settingsChanged(cfg));
    if (!cfg.serverUrl) {
      setStatus('Offline mode: papers stay on this phone only.');
      return;
    }
    setBusy(true);
    try {
      const health = await api.health(cfg);
      await dispatch(syncNow()).unwrap();
      setStatus(`Connected and synced. AI reading is ${health.ai ? 'available' : 'not configured on the server'}.`);
    } catch (e) {
      setStatus(`Problem: ${e instanceof ApiError || e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    try {
      await dispatch(syncNow()).unwrap();
      setStatus('Synced.');
    } catch (e) {
      setStatus(`Sync failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const exportAll = () =>
    Share.share({ title: 'Ground export', message: JSON.stringify({ exportedAt: new Date().toISOString(), topics, documents: docs }, null, 2) });

  return (
    <Screen>
      <SectionTitle>Server</SectionTitle>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Optional. A Ground server keeps your papers safe across phones and reinstalls, and reads photos with AI. Leave empty to use Ground fully offline.
        </ThemedText>
        <Field label="Server address" placeholder="http://192.168.1.20:4000" autoCapitalize="none" autoCorrect={false} keyboardType="url" value={serverUrl} onChangeText={setServerUrl} />
        <Field label="Access token" placeholder="GROUND_API_TOKEN from the server" autoCapitalize="none" autoCorrect={false} secureTextEntry value={apiToken} onChangeText={setApiToken} />
        <Button title="Save & connect" onPress={saveServer} loading={busy} />
        {settings.serverUrl ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {settings.lastSyncAt ? `Last sync ${new Date(settings.lastSyncAt).toLocaleString()}` : 'Never synced'} · {pending} change{pending === 1 ? '' : 's'} waiting
            </ThemedText>
            <Button title="Sync now" variant="secondary" onPress={sync} loading={busy} />
          </>
        ) : null}
        {status ? <ThemedText type="small">{status}</ThemedText> : null}
      </Card>

      <SectionTitle>Reading papers</SectionTitle>
      <Card>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <View style={{ flexShrink: 1 }}>
            <ThemedText type="smallBold">Use AI to read photos</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Sends photos to your server. Turn off to keep everything on the phone.
            </ThemedText>
          </View>
          <Switch value={settings.useAi} onValueChange={(useAi) => {
            dispatch(settingsChanged({ useAi }));
          }} />
        </Row>
        <ThemedText type="small" themeColor="textSecondary">
          Language for titles and summaries
        </ThemedText>
        <Row>
          {LANGUAGES.map(([code, label]) => (
            <Chip key={code} label={label} selected={settings.locale === code} onPress={() => dispatch(settingsChanged({ locale: code }))} />
          ))}
        </Row>
        <ThemedText type="small" themeColor="textSecondary">
          How dates like 03/04 are written where you live
        </ThemedText>
        <Row>
          {(['MDY', 'DMY'] as DateOrder[]).map((o) => (
            <Chip
              key={o}
              label={o === 'MDY' ? 'Month/Day (03/04 = Mar 4)' : 'Day/Month (03/04 = 3 Apr)'}
              selected={settings.dateOrder === o}
              onPress={() => dispatch(settingsChanged({ dateOrder: o }))}
            />
          ))}
        </Row>
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <View style={{ gap: Spacing.two }}>
        <Button title="Export everything (JSON)" variant="secondary" onPress={exportAll} />
        <ThemedText type="small" themeColor="textSecondary">
          {docs.length} papers, {topics.length} topics. Some papers are personal (health, finances, IDs): only connect to a server you control, and set an access token.
        </ThemedText>
      </View>
    </Screen>
  );
}
