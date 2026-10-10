import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { ExtractionSchema, type Extraction, type Topic } from '@ground/core';

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export interface ExtractInput {
  /** One entry per photographed page, base64 without the data: prefix. */
  images: { data: string; mediaType: ImageMediaType }[];
  /** Optional text typed or pasted by the user, or produced by on-device OCR. */
  text?: string;
  topics: Pick<Topic, 'id' | 'name' | 'keywords'>[];
  /** "Today" from the user's point of view, so relative dates ("next Tuesday") resolve correctly. */
  today: string;
  /** Preferred language for titles and summaries, e.g. "en". */
  locale?: string;
}

export interface Extractor {
  extract(input: ExtractInput): Promise<Extraction>;
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const SYSTEM_PROMPT = `You read photos of paper documents someone has collected: flyers, opening-hours notices, letters, prescriptions, appointment reminders, brochures, business cards and similar papers.

Your job is to turn one document into structured data the person can rely on later, when they need to know where to go, when it is open, who to call and when their appointments are.

Guidelines:
- Transcribe all legible text into rawText, keeping line breaks.
- Only report what the paper says. Do not invent phone numbers, addresses, hours or dates. Use null when a field is not on the paper.
- Each distinct location with an address, phone or opening hours is a place. Put opening hours in hours, one entry per day range, with 24h "HH:MM" times.
- People named on the paper (doctors, staff, contacts) are contacts.
- Every specific date the person has to show up somewhere (appointments, hearings, pick-ups, vaccination days) is an appointment, with an ISO "YYYY-MM-DD" date. Resolve relative or yearless dates against today's date. Recurring schedules belong in a place's hours, not in appointments.
- keyFacts holds short practical notes: eligibility, what to bring, costs, languages spoken, warnings.
- topicIds must only contain ids from the topic list provided; pick every topic that applies, most relevant first, or none.
- Write title, summary and keyFacts in the requested language, but keep names, addresses and rawText exactly as written.
- Some papers (health, finances, IDs) are sensitive. Extract them faithfully and neutrally; do not add advice.`;

export class ClaudeExtractor implements Extractor {
  constructor(
    private client: Anthropic,
    private model: string,
  ) {}

  async extract(input: ExtractInput): Promise<Extraction> {
    if (!input.images.length && !input.text?.trim()) {
      throw new ExtractionError('Send at least one image or some text.', 400);
    }

    const topicList = input.topics.map((t) => `- ${t.id}: ${t.name} (${t.keywords.slice(0, 12).join(', ')})`).join('\n');
    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      ...input.images.map(
        (img): Anthropic.Beta.BetaImageBlockParam => ({
          type: 'image',
          source: { type: 'base64', media_type: img.mediaType, data: img.data },
        }),
      ),
      {
        type: 'text',
        text: [
          `Today is ${input.today}. Write title, summary and keyFacts in: ${input.locale ?? 'en'}.`,
          `Topics:\n${topicList || '(none)'}`,
          input.text?.trim() ? `Text provided by the user for this document:\n${input.text.trim()}` : null,
          input.images.length > 1 ? `The ${input.images.length} images are consecutive pages of the same document.` : null,
          'Extract the document.',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ];

    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
      output_config: { effort: 'medium', format: betaZodOutputFormat(ExtractionSchema) },
      // If a safety classifier declines (health papers can trip one), retry on a fallback model server-side.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });

    if (response.stop_reason === 'refusal') {
      throw new ExtractionError('The model declined to process this document.', 422);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new ExtractionError('The document was too long to extract in one go.', 422);
    }
    if (!response.parsed_output) {
      throw new ExtractionError('The model returned data that did not match the expected shape.', 502);
    }

    const known = new Set(input.topics.map((t) => t.id));
    return { ...response.parsed_output, topicIds: response.parsed_output.topicIds.filter((id) => known.has(id)) };
  }
}
