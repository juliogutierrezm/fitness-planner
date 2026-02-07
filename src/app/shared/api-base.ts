/**
 * Purpose: SSR-safe centralized API base URL resolver.
 * Input: none. Output: fully qualified API base URL string.
 * Error handling: falls back to environment.apiBase when process.env is unavailable.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 *
 * - Browser: returns environment.apiBase directly.
 * - SSR (Node): uses process.env['API_BASE'] if set, otherwise environment.apiBase.
 *
 * This ensures production SSR never uses a relative '/api' prefix (which would
 * fail without the dev proxy) and allows Elastic Beanstalk to override the
 * backend URL via environment variables without rebuilding.
 */
import { environment } from '../../environments/environment';

export function getApiBase(): string {
  if (typeof window === 'undefined') {
    // Running in Node (SSR) — prefer env-var override
    return process.env['API_BASE'] ?? environment.apiBase;
  }
  return environment.apiBase;
}
