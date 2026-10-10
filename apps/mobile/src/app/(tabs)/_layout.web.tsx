import { TabList, TabSlot, Tabs, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    <Pressable {...props} style={[styles.button, isFocused && { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold" style={{ color: isFocused ? theme.tint : theme.textSecondary }}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

function Bar(props: TabListProps) {
  const theme = useTheme();
  return <View {...props} style={[styles.bar, { backgroundColor: theme.backgroundElement }]} />;
}

/** Web has no native tab bar: a simple top bar instead. */
export default function TabLayout() {
  return (
    <Tabs>
      <TabList asChild>
        <Bar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="places" href="/places" asChild>
            <TabButton>Places</TabButton>
          </TabTrigger>
          <TabTrigger name="agenda" href="/agenda" asChild>
            <TabButton>Agenda</TabButton>
          </TabTrigger>
          <TabTrigger name="people" href="/people" asChild>
            <TabButton>People</TabButton>
          </TabTrigger>
        </Bar>
      </TabList>
      <TabSlot style={{ flex: 1 }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, padding: Spacing.two },
  button: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
});
