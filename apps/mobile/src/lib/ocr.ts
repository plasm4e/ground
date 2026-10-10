/**
 * On-device text recognition. Not available in the native app yet (it needs ML Kit /
 * Apple Vision through a development build); see ocr.web.ts for the browser version.
 */
export const ocrAvailable = false;

export async function recognizeText(
  _uris: string[],
  _locale: string,
  _onProgress?: (fraction: number) => void,
): Promise<string> {
  throw new Error('Text recognition is not available on this platform.');
}
