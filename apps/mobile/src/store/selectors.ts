import { createSelector } from '@reduxjs/toolkit';
import { matchesQuery, type GroundDocument, type StoredAppointment, type StoredContact, type StoredPlace } from '@ground/core';

import type { RootState } from './index';
import { documentsAdapter } from './documents-slice';
import { topicsAdapter } from './topics-slice';

export const documentSelectors = documentsAdapter.getSelectors((s: RootState) => s.documents);
export const topicSelectors = topicsAdapter.getSelectors((s: RootState) => s.topics);

/** Every entity keeps a pointer back to the paper it came from. */
export type FromDocument<T> = T & { documentId: string; documentTitle: string; topicIds: string[] };

const attach = <T,>(doc: GroundDocument, item: T): FromDocument<T> => ({
  ...item,
  documentId: doc.id,
  documentTitle: doc.title,
  topicIds: doc.topicIds,
});

export const selectAllPlaces = createSelector([documentSelectors.selectAll], (docs) =>
  docs
    .flatMap((d) => d.places.map((p) => attach<StoredPlace>(d, p)))
    .sort((a, b) => a.name.localeCompare(b.name)),
);

export const selectAllContacts = createSelector([documentSelectors.selectAll], (docs) =>
  docs
    .flatMap((d) => d.contacts.map((c) => attach<StoredContact>(d, c)))
    .sort((a, b) => a.name.localeCompare(b.name)),
);

const appointmentKey = (a: StoredAppointment) => `${a.date ?? '9999-99-99'}T${a.time ?? '99:99'}`;

export const selectAllAppointments = createSelector([documentSelectors.selectAll], (docs) =>
  docs
    .flatMap((d) => d.appointments.map((a) => attach<StoredAppointment>(d, a)))
    .sort((a, b) => appointmentKey(a).localeCompare(appointmentKey(b))),
);

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Appointments from today on, plus the ones whose date couldn't be read (so they are not forgotten). */
export const selectUpcomingAppointments = createSelector([selectAllAppointments], (all) => {
  const today = todayIso();
  return all.filter((a) => !a.date || a.date >= today);
});

export const selectPastAppointments = createSelector([selectAllAppointments], (all) => {
  const today = todayIso();
  return all.filter((a) => a.date && a.date < today).reverse();
});

/** Papers grouped by topic id; papers with no (remaining) topic go under `__none`. */
export const selectDocumentsByTopic = createSelector([documentSelectors.selectAll, topicSelectors.selectIds], (docs, topicIds) => {
  const byTopic: Record<string, GroundDocument[]> = {};
  for (const d of docs) {
    const known = d.topicIds.filter((t) => topicIds.includes(t));
    for (const t of known.length ? known : ['__none']) (byTopic[t] ??= []).push(d);
  }
  return byTopic;
});

export const selectSearchResults = createSelector(
  [documentSelectors.selectAll, (_: RootState, query: string) => query],
  (docs, query) => (query.trim() ? docs.filter((d) => matchesQuery(d, query)) : []),
);

export const selectPendingChanges = (s: RootState) =>
  s.documents.dirtyIds.length + s.documents.pendingDeleteIds.length + s.topics.dirtyIds.length + s.topics.pendingDeleteIds.length;
