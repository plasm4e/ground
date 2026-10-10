import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field, Row, Screen, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ocrAvailable } from '@/lib/ocr';
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
  const { pages, text, status, ocrProgress } = useAppSelector((s) => s.capture);
  const { serverUrl, useAi, anthropicApiKey } = useAppSelector((s) => s.settings);
  const viaServer = useAi && serverUrl.trim() !== '';
  const aiOn = viaServer || (useAi && anthropicApiKey.trim() !== '');

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
          {aiOn && !viaServer
            ? 'Photos are sent to Claude with your Anthropic key, which pulls out places, hours, phone numbers, people and dates. You review everything before it is saved.'
            : aiOn
              ? 'Photos are sent to your Ground server, where AI reads them and pulls out places, hours, phone numbers, people and dates. You review everything before it is saved.'
              : ocrAvailable
                ? 'Free mode: the text in your photos is read on this phone (nothing is uploaded), then Ground picks out phone numbers, addresses, hours and dates. Flat, well-lit photos work best. For much better results, add an Anthropic key in Settings.'
                : 'Offline mode: Ground extracts phone numbers, addresses, hours and dates from the text you type. Add an Anthropic key in Settings to read photos automatically.'}
        </ThemedText>
      </Card>

      <View style={{ gap: Spacing.two }}>
        <Button
          title={aiOn || (ocrAvailable && pages.length > 0) ? '✨ Read this paper' : 'Continue'}
          onPress={read}
          loading={status === 'extracting'}
          disabled={nothing}
        />
        {status === 'extracting' && (
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {ocrProgress !== null
              ? `Reading text from the photo… ${Math.round(ocrProgress * 100)}%`
              : 'Reading… the first time can take up to a minute.'}
          </ThemedText>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 96, height: 128, borderRadius: 10 },
});
