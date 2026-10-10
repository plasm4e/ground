import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Large title for tab screens, which have no navigation header of their own. */
export function TabHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.two }}>
      <View style={{ flexShrink: 1 }}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </View>
  );
}
