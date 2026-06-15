/**
 * Env-gated Sentry init. Imports the SDK lazily so the dependency is optional
 * — Cosmo runs fine without `@sentry/node` installed. To enable in prod:
 *   SENTRY_DSN=https://...
 *   SENTRY_ENVIRONMENT=production
 *   SENTRY_TRACES_SAMPLE_RATE=0.1
 */
export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    // @sentry/node is an optional peer dep; use a runtime require shim so
    // TypeScript doesn't try to resolve types at compile time when the
    // package isn't installed.
    const dynamicImport = new Function(
      'spec',
      'return import(spec)',
    ) as (spec: string) => Promise<unknown>;
    const Sentry = (await dynamicImport('@sentry/node').catch(() => null)) as
      | {
          init: (opts: Record<string, unknown>) => void;
        }
      | null;
    if (!Sentry) {
      // eslint-disable-next-line no-console
      console.warn(
        '[sentry] SENTRY_DSN is set but @sentry/node is not installed. Run `npm install @sentry/node` in the backend to enable error reporting.',
      );
      return;
    }
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
    });
    // eslint-disable-next-line no-console
    console.log(
      `[sentry] initialised for env=${process.env.SENTRY_ENVIRONMENT ?? 'development'}`,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[sentry] init failed:', (err as Error).message);
  }
}
