// Ambient types for the subset of Deno globals used by edge functions, so the
// shared engine type-checks under tsc/vitest while still running in Deno.

declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    has(key: string): boolean;
    delete(key: string): void;
    toObject(): Record<string, string>;
  };
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
  function resolveDns(hostname: string, type?: 'A' | 'AAAA'): Promise<Deno.ResolveDnsResult>;
  interface ResolveDnsResult {
    addresses: string[];
  }
  const args: string[];
  interface CronHandler {
    (now?: Date): Promise<void> | void;
  }
  function cron(name: string, schedule: string, handler: CronHandler): void;
}