/**
 * Shared HTTP utilities used across backend services that need to call
 * external REST APIs without pulling in a full HTTP client library.
 */

/** Default timeout (ms) for outgoing HTTP requests. */
export const DEFAULT_HTTP_TIMEOUT_MS = 5_000;

/**
 * Fetches a URL with a configurable timeout and returns the parsed JSON body.
 *
 * Throws on network errors, request timeout, or non-2xx HTTP responses.
 *
 * @param url     Fully-qualified URL to fetch.
 * @param timeout Timeout in milliseconds (default: {@link DEFAULT_HTTP_TIMEOUT_MS}).
 */
export async function fetchJson(url: string, timeout = DEFAULT_HTTP_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HermeneuticaAI/1.0 (theological analysis tool)',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}
