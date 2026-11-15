import { expect, test } from 'bun:test';
import { extractInformation, nativeInformation } from './extract';
test('native information pages preserve all website sections, named credits and resource actions', async () => {
  for (const [page, count] of [['About', 6], ['Privacy', 5], ['Terms', 7]] as const) {
    const source = await Bun.file(new URL(`../../../../resources/js/Pages/${page}.tsx`, import.meta.url)).text();
    const original = extractInformation(source, page);
    expect(original.sections).toHaveLength(count);
    const native = await Bun.file(new URL(`../${page}/content.json`, import.meta.url)).json();
    expect(native).toEqual(nativeInformation(original, page));
    expect(native.sections.map((section: { title: string }) => section.title)).toEqual(original.sections.map(section => section.title));
    if (page === 'About') {
      const text = JSON.stringify(native); for (const name of ['هادي الأحمد', 'نور صوفناتي', 'macdoos', 'tirh25', 'haiueida', 'WaleedKhamees', 'SourceM7', 'WaheedShaar', 'abd_hmh', 'walaa_akdesign', 'يوري دندشي']) expect(text).toContain(name);
      expect(text).toContain('brandkit-y5sZMu.zip');
    }
    if (page === 'Privacy') { expect(JSON.stringify(native)).not.toContain('مسح كافة بيانات ملفك الشخصي بالكامل'); expect(JSON.stringify(native)).toContain('حذف منطقي'); }
  }
});
