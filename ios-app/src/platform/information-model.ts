import { array, assetUrl, record, text } from './validation';
import { externalUrl } from './links-model';
export interface InformationBlock { kind: 'heading' | 'paragraph' | 'item' | 'link' | 'image'; text: string; href: string; src: string }
export interface InformationSection { title: string; subtitle: string; blocks: InformationBlock[] }
export interface InformationValue { title: string; subtitle: string; sections: InformationSection[]; footer: InformationBlock[] }
function decodeBlock(value: unknown): InformationBlock {
  const row = record(value), kind = text(row.kind);
  if (!['heading', 'paragraph', 'item', 'link', 'image'].includes(kind)) throw new Error('محتوى الصفحة غير صالح.');
  let href = text(row.href, ''), src = text(row.src, '');
  if (kind === 'link') {
    if (href.startsWith('/')) { if (href.startsWith('//') || href.includes('\\') || href.split('/').some(part => part === '..')) throw new Error('الرابط غير صالح.'); }
    else href = externalUrl(href);
  }
  if (kind === 'image') { const url = assetUrl(src); if (!url) throw new Error('الصورة غير صالحة.'); src = url; }
  return { kind: kind as InformationBlock['kind'], text: text(row.text), href, src };
}
export function decodeInformation(value: unknown): InformationValue {
  const row = record(value);
  return { title: text(row.title), subtitle: text(row.subtitle), sections: array(row.sections).map(raw => { const section = record(raw); return { title: text(section.title), subtitle: text(section.subtitle), blocks: array(section.blocks).map(decodeBlock) }; }), footer: array(row.footer).map(decodeBlock) };
}
