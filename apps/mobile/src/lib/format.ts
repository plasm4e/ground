import { Linking, Platform } from 'react-native';

const parseIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function formatDate(iso: string | null, locale?: string): string {
  if (!iso) return 'Date unknown';
  const d = parseIso(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Today", "Tomorrow", "In 5 days", "3 days ago". */
export function relativeDay(iso: string | null): string | null {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((parseIso(iso).getTime() - today.getTime()) / 86_400_000);
  if (Number.isNaN(days)) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

export const openPhone = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
export const openEmail = (email: string) => Linking.openURL(`mailto:${email}`);
export const openWebsite = (url: string) => Linking.openURL(/^https?:\/\//i.test(url) ? url : `https://${url}`);

export function openMap(address: string) {
  const q = encodeURIComponent(address);
  const url = Platform.select({
    ios: `maps:0,0?q=${q}`,
    android: `geo:0,0?q=${q}`,
    default: `https://www.google.com/maps/search/?api=1&query=${q}`,
  });
  return Linking.openURL(url);
}
