// Vitest global setup — ensures JWT_SECRET is available for all test files.
// Tests run via `npx vitest run` (without cross-env) still get the secret.

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-blog-demo';
