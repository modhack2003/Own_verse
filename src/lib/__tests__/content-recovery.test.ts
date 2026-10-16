/** @jest-environment node */
import { CONTENT_MODELS, restoreData } from '../content-history';
import { validateBackup } from '../content-recovery';
import { jsonLd } from '../seo';
const backup = () => ({ format: 'own-verse-content', version: 1, collections: Object.fromEntries(CONTENT_MODELS.map(model => [model, []])), imports: [] });
test('backup validator accepts content only and rejects credentials or unknown schemas', () => {
  expect(validateBackup(backup()).count).toBe(0);
  expect(() => validateBackup({ ...backup(), version: 9 })).toThrow();
  expect(() => validateBackup({ ...backup(), collections: { ...backup().collections, AdminCredential: [] } })).toThrow();
});
test('a corrupt record or import ledger is rejected before restoration starts', () => {
  const source = backup();
  source.collections.Project.push({ id: 'not-an-id' } as never);
  expect(() => validateBackup(source)).toThrow();
  expect(() => validateBackup({ ...backup(), imports: [{ id: 'CVE-not-valid' }] })).toThrow();
  expect(() => restoreData('Project', { id: '000000000000000000000001', title: 'A', description: 'B', tags: [], deletedAt: 'not-a-date' })).toThrow();
  expect(() => restoreData('Project', { id: '000000000000000000000001', title: 'A', description: 'B', tags: [], credential: 'hidden' })).toThrow();
});
test('structured-data text cannot terminate its script element', () => {
  const text = jsonLd({ headline: '</script><script>alert(1)</script>' });
  expect(text).not.toContain('<');
  expect(JSON.parse(text).headline).toContain('</script>');
});
