/** Test scripts never accept production database URLs, including through fallback env vars. */
export function testDatabase(name: 'e2e' | 'recovery') {
  const env = name === 'e2e' ? 'E2E_DATABASE_URL' : 'RECOVERY_TEST_DATABASE_URL';
  const url = process.env[env];
  if (url !== `mongodb://127.0.0.1:27017/studio_${name}_test?replicaSet=rs0`) throw new Error(`Set ${env} to the disposable localhost studio_${name}_test replica-set URL.`);
  return url;
}
