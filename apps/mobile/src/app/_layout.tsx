import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { persistor, store } from '@/store';
import { syncNow } from '@/store/thunks';

SplashScreen.preventAutoHideAsync();

function useSyncOnForeground() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void store.dispatch(syncNow());
    });
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useSyncOnForeground();

  return (
    <Provider store={store}>
      <PersistGate
        persistor={persistor}
        onBeforeLift={() => {
          SplashScreen.hideAsync();
          void store.dispatch(syncNow());
        }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="capture" options={{ title: 'Capture a paper', presentation: 'modal' }} />
            <Stack.Screen name="review" options={{ title: 'Review' }} />
            <Stack.Screen name="document/[id]" options={{ title: 'Paper' }} />
            <Stack.Screen name="topic/[id]" options={{ title: '' }} />
            <Stack.Screen name="topics" options={{ title: 'Your topics' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          </Stack>
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}
