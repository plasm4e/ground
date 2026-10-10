import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field, Row, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { pageAdded, pageRemoved, textChanged, type CapturedPage } from '@/store/capture-slice';
import { extractCapture } from '@/store/thunks';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  // Enough for reading small print while keeping uploads reasonable.
  quality: 0.5,
  base64: true,
};

const toPage = (a: ImagePicker.ImagePickerAsset): CapturedPage => ({
  uri: a.uri,
  base64: a.base64 ?? null,
  mediaType: a.mimeType === 'image/png' ? 'image/png' : a.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg',
});

export default function CaptureScreen() {
  const dispatch = useAppDispatch();
  const { pages, text, status } = useAppSelector((s) => s.capture);
  const { serverUrl, useAi } = useAppSelector((s) => s.settings);
  const aiOn = useAi && serverUrl.trim() !== '';

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in your phone settings to photograph papers.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
    if (!res.canceled) res.assets.forEach((a) => dispatch(pageAdded(toPage(a))));
  };

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ ...PICKER_OPTIONS, allowsMultipleSelection: true, selectionLimit: 10 });
    if (!res.canceled) res.assets.forEach((a) => dispatch(pageAdded(toPage(a))));
  };

  const read = async () => {
    await dispatch(extractCapture());
    router.push('/review');
  };

  const nothing = pages.length === 0 && text.trim() === '';

  return (
    <Screen>
      <Row>
        <Button title="📷 Take photo" onPress={takePhoto} style={{ flex: 1 }} />
        <Button title="🖼️ From gallery" variant="secondary" onPress={pickFromGallery} style={{ flex: 1 }} />
      </Row>

      {pages.length > 0 && (
        <>
          <SectionTitle>
            {pages.length} page{pages.length > 1 ? 's' : ''} — tap to remove
          </SectionTitle>
          <ScrollView horizontal contentContainerStyle={{ gap: Spacing.two }}>
            {pages.map((p, i) => (
              <Pressable key={p.uri + i} onPress={() => dispatch(pageRemoved(i))}>
                <Image source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <Field
        label="Text (optional)"
        multiline
        placeholder="Type or paste the text of the paper, or add a note to help reading it."
        value={text}
        onChangeText={(t) => dispatch(textChanged(t))}
        style={{ minHeight: 120 }}
      />

      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {aiOn
            ? 'Photos are sent to your Ground server, where AI reads them and pulls out places, hours, phone numbers, people and dates. You review everything before it is saved.'
            : 'Offline mode: Ground extracts phone numbers, addresses, hours and dates from the text you type. Set up a server in Settings to read photos automatically.'}
        </ThemedText>
      </Card>

      <View style={{ gap: Spacing.two }}>
        <Button title={aiOn ? '✨ Read this paper' : 'Continue'} onPress={read} loading={status === 'extracting'} disabled={nothing} />
        {status === 'extracting' && (
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Reading… this can take up to a minute for long papers.
          </ThemedText>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 96, height: 128, borderRadius: 10 },
});
