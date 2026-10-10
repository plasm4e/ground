import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

export default function TabLayout() {
  const theme = useTheme();
  return (
    <NativeTabs
      backgroundColor={theme.background}
      indicatorColor={theme.backgroundElement}
      labelStyle={{ selected: { color: theme.tint } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="places">
        <NativeTabs.Trigger.Label>Places</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'mappin.and.ellipse', selected: 'mappin.and.ellipse' }} md="location_on" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="agenda">
        <NativeTabs.Trigger.Label>Agenda</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="people">
        <NativeTabs.Trigger.Label>People</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
