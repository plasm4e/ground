import { useState } from 'react';

import { AppointmentCard } from '@/components/entity-cards';
import { TabHeader } from '@/components/tab-header';
import { Chip, Empty, Row, Screen, SectionTitle } from '@/components/ui';
import { useAppSelector } from '@/store';
import { selectPastAppointments, selectUpcomingAppointments } from '@/store/selectors';

export default function AgendaScreen() {
  const upcoming = useAppSelector(selectUpcomingAppointments);
  const past = useAppSelector(selectPastAppointments);
  const [showPast, setShowPast] = useState(false);
  const list = showPast ? past : upcoming;

  return (
    <Screen>
      <TabHeader title="Agenda" subtitle="Appointments and dates from your papers" />
      <Row>
        <Chip label={`Upcoming (${upcoming.length})`} selected={!showPast} onPress={() => setShowPast(false)} />
        <Chip label={`Past (${past.length})`} selected={showPast} onPress={() => setShowPast(true)} />
      </Row>
      {!showPast && upcoming.some((a) => !a.date) && <SectionTitle>Includes items with an unknown date</SectionTitle>}
      {list.length ? (
        list.map((a) => <AppointmentCard key={a.id} appointment={a} documentId={a.documentId} documentTitle={a.documentTitle} />)
      ) : (
        <Empty title={showPast ? 'Nothing in the past' : 'Nothing coming up'} hint={showPast ? undefined : 'Dates from appointment letters and reminders show up here.'} />
      )}
    </Screen>
  );
}
