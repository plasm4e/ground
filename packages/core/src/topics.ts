import type { Topic } from './model';

/**
 * Starting set of interests. Users can rename, recolor, delete or add their own;
 * the keywords drive offline classification and are passed to the AI as hints.
 * Keywords include a few Spanish/Italian/French words since papers are often multilingual.
 */
export const DEFAULT_TOPICS: Topic[] = [
  {
    id: 'food',
    name: 'Food',
    emoji: '🍽️',
    color: '#E8590C',
    keywords: [
      'food', 'meal', 'meals', 'breakfast', 'lunch', 'dinner', 'restaurant', 'cafe', 'kitchen', 'menu',
      'groceries', 'market', 'pantry', 'bakery', 'comida', 'cena', 'pranzo', 'repas',
    ],
    builtIn: true,
  },
  {
    id: 'health',
    name: 'Health',
    emoji: '🩺',
    color: '#2B8A3E',
    keywords: [
      'health', 'clinic', 'doctor', 'dr.', 'hospital', 'pharmacy', 'prescription', 'rx', 'medication',
      'dosage', 'mg', 'patient', 'lab results', 'test results', 'referral', 'dental', 'dentist', 'vaccine',
      'insurance', 'salud', 'salute', 'santé', 'médico', 'medico',
    ],
    builtIn: true,
  },
  {
    id: 'appointments',
    name: 'Appointments',
    emoji: '📅',
    color: '#1971C2',
    keywords: [
      'appointment', 'scheduled', 'your visit', 'please arrive', 'reschedule', 'reminder', 'meeting',
      'interview', 'cita', 'appuntamento', 'rendez-vous',
    ],
    builtIn: true,
  },
  {
    id: 'services',
    name: 'Services & offices',
    emoji: '🏛️',
    color: '#6741D9',
    keywords: [
      'office', 'service', 'services', 'application', 'form', 'registration', 'benefits', 'bank',
      'legal', 'permit', 'license', 'id card', 'passport', 'documents', 'utilities', 'housing', 'rent',
      'servicios', 'servizi', 'ufficio', 'oficina',
    ],
    builtIn: true,
  },
  {
    id: 'work',
    name: 'Work & learning',
    emoji: '💼',
    color: '#E67700',
    keywords: [
      'job', 'work', 'employment', 'hiring', 'career', 'training', 'course', 'class', 'workshop',
      'school', 'library', 'trabajo', 'lavoro', 'corso',
    ],
    builtIn: true,
  },
  {
    id: 'places',
    name: 'Useful places',
    emoji: '📍',
    color: '#0C8599',
    keywords: [
      'address', 'located at', 'open', 'hours', 'store', 'shop', 'post office', 'laundry', 'gym',
      'park', 'station', 'bus', 'parking',
    ],
    builtIn: true,
  },
];

export function topicColor(topics: Topic[], id: string): string {
  return topics.find((t) => t.id === id)?.color ?? '#868E96';
}
