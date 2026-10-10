import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Screen({ children, contentContainerStyle, ...rest }: ScrollViewProps & { children: ReactNode }) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.screen, contentContainerStyle]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      {...rest}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const theme = useTheme();
  const body = <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {body}
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {children}
      </ThemedText>
      {action}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const bg = { primary: theme.tint, secondary: theme.backgroundSelected, danger: theme.backgroundElement, ghost: 'transparent' }[variant];
  const fg = { primary: theme.onTint, secondary: theme.text, danger: theme.danger, ghost: theme.tint }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        variant === 'ghost' && styles.ghostButton,
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <ThemedText style={{ color: fg, fontWeight: 600 }}>{title}</ThemedText>}
    </Pressable>
  );
}

export function Chip({
  label,
  color,
  selected = true,
  onPress,
}: {
  label: string;
  color?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const c = color ?? theme.textSecondary;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[styles.chip, { borderColor: c, backgroundColor: selected ? c + '22' : 'transparent', opacity: selected ? 1 : 0.6 }]}>
      <ThemedText type="small" style={{ color: selected ? c : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
          props.multiline && { minHeight: 80, textAlignVertical: 'top' },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <ThemedText type="smallBold" style={{ textAlign: 'center' }}>
        {title}
      </ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {hint}
        </ThemedText>
      ) : null}
      {action}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    padding: Spacing.three,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
  button: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButton: { minHeight: 32, paddingHorizontal: Spacing.one },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.two + 2, paddingVertical: 2 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.two + 4, paddingVertical: Spacing.two + 2, fontSize: 16 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
});
