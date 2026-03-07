export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  grokApiKey: process.env.GROK_API_KEY ?? "",
  pineconeApiKey: process.env.PINECONE_API_KEY ?? "",
};

/**
 * Validate that all critical environment variables are set at startup.
 * Call this once during server initialization to fail fast on misconfiguration.
 */
export function validateEnvironment(): void {
  const required: { key: keyof typeof ENV; envVar: string }[] = [
    { key: 'databaseUrl', envVar: 'DATABASE_URL' },
    { key: 'cookieSecret', envVar: 'JWT_SECRET' },
  ];

  const missing: string[] = [];
  for (const { key, envVar } of required) {
    if (!ENV[key]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error(
      `[ENV] FATAL: Missing required environment variables: ${missing.join(', ')}`
    );
    console.error(
      '[ENV] The server cannot start without these variables. See .env.example for guidance.'
    );
    process.exit(1);
  }

  // Warn about optional-but-recommended vars
  const recommended: { key: keyof typeof ENV; envVar: string; purpose: string }[] = [
    { key: 'oAuthServerUrl', envVar: 'OAUTH_SERVER_URL', purpose: 'OAuth authentication' },
    { key: 'appId', envVar: 'VITE_APP_ID', purpose: 'application identification' },
  ];

  for (const { key, envVar, purpose } of recommended) {
    if (!ENV[key]) {
      console.warn(`[ENV] WARNING: ${envVar} not set — ${purpose} may not work`);
    }
  }

  console.log('[ENV] Environment validation passed');
}
