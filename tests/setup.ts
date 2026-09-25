// Make Deno globals available to modules that read environment (crypto vault
// helpers check Deno.env.get('TAL_CREDENTIALS_KEY')) without touching the
// network or disk.
(globalThis as Record<string, unknown>).Deno = {
  env: {
    get: (key: string) => {
      if (key === 'TAL_CREDENTIALS_KEY') {
        return process.env.TAL_CREDENTIALS_KEY ?? 'test-credential-vault-key-0123456789abcdef';
      }
      return undefined;
    },
  },
};