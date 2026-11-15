// Build/test adapter only. Native screens import the generated JSON, never TypeScript's parser.
import ts from 'typescript';
import media from '../../../../resources/data/media.json';
export interface InformationBlock { kind: string; text: string; href: string; src: string }
export interface InformationSection { title: string; subtitle: string; blocks: InformationBlock[] }
export interface InformationDocument { title: string; subtitle: string; sections: InformationSection[]; footer: InformationBlock[] }
function clean(value: string): string { return value.replace(/[\u2013\u2014]/g, '،').replace(/\s+/g, ' ').trim(); }
export function extractInformation(source: string, filename: string): InformationDocument {
  const tree = ts.createSourceFile(`${filename}.tsx`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const tag = (node: ts.JsxElement | ts.JsxSelfClosingElement): string => ts.isJsxElement(node) ? node.openingElement.tagName.getText(tree) : node.tagName.getText(tree);
  function text(node: ts.Node): string {
    if (ts.isJsxText(node)) return node.text;
    if (ts.isJsxExpression(node)) return node.expression && ts.isStringLiteral(node.expression) ? node.expression.text : '';
    if (ts.isJsxElement(node)) return node.children.map(text).join('');
    return '';
  }
  function all(node: ts.Node, match: (item: ts.Node) => boolean): ts.Node[] { const found: ts.Node[] = []; const visit = (item: ts.Node): void => { if (match(item)) found.push(item); ts.forEachChild(item, visit); }; visit(node); return found; }
  function attribute(node: ts.JsxElement | ts.JsxSelfClosingElement, name: string): string {
    const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
    const property = attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(tree) === name);
    if (!property || !ts.isJsxAttribute(property) || !property.initializer) return '';
    if (ts.isStringLiteral(property.initializer)) return property.initializer.text;
    if (ts.isJsxExpression(property.initializer) && property.initializer.expression) {
      const expression = property.initializer.expression;
      if (ts.isStringLiteral(expression)) return expression.text;
      if (ts.isTemplateExpression(expression) && expression.templateSpans.length === 1 && expression.templateSpans[0]?.expression.getText(tree) === 'MEDIA_BASE') return expression.head.text + media.public_base + expression.templateSpans[0].literal.text;
    }
    return '';
  }
  const elements = all(tree, node => ts.isJsxElement(node)) as ts.JsxElement[];
  const heading = elements.find(node => tag(node) === 'h1'), subtitle = elements.find(node => tag(node) === 'p');
  const sections = elements.filter(node => tag(node) === 'Card').map(card => {
    const title = (all(card, node => ts.isJsxElement(node) && tag(node) === 'CardTitle')[0]) as ts.JsxElement | undefined;
    const description = (all(card, node => ts.isJsxElement(node) && tag(node) === 'CardDescription')[0]) as ts.JsxElement | undefined;
    const blocks: InformationBlock[] = [];
    function block(kind: string, value: string, href = '', src = ''): void { const content = clean(value); if (content || src) blocks.push({ kind, text: content, href, src }); }
    function links(node: ts.Node): void {
      for (const link of all(node, item => ts.isJsxElement(item) && ['a', 'Link'].includes(tag(item))) as ts.JsxElement[]) { const href = attribute(link, 'href'); if (href) block('link', text(link), href); }
    }
    function visit(node: ts.Node): void {
      if (ts.isJsxExpression(node)) return;
      if (ts.isJsxSelfClosingElement(node)) { if (tag(node) === 'img' && attribute(node, 'src')) block('image', attribute(node, 'alt'), '', attribute(node, 'src')); return; }
      if (ts.isJsxElement(node)) {
        const name = tag(node);
        if (['CardHeader', 'CardTitle', 'CardDescription'].includes(name)) return;
        if (['p', 'li', 'h2', 'span'].includes(name)) { block(name === 'h2' || /font-bold/.test(attribute(node, 'className')) && name === 'span' ? 'heading' : name === 'li' ? 'item' : 'paragraph', text(node)); links(node); return; }
        if (['a', 'Link'].includes(name)) { const href = attribute(node, 'href'); if (href) block('link', text(node), href); return; }
      }
      ts.forEachChild(node, visit);
    }
    visit(card);
    return { title: clean(title ? text(title) : ''), subtitle: clean(description ? text(description) : ''), blocks };
  });
  const footer = elements.filter(node => tag(node) === 'Link' && !ancestorCard(node)).map(node => ({ kind: 'link', text: clean(text(node)), href: attribute(node, 'href'), src: '' })).filter(row => row.href);
  function ancestorCard(node: ts.Node): boolean { let parent = node.parent; while (parent) { if (ts.isJsxElement(parent) && tag(parent) === 'Card') return true; parent = parent.parent; } return false; }
  return { title: clean(heading ? text(heading) : ''), subtitle: clean(subtitle ? text(subtitle) : ''), sections, footer };
}
export function nativeInformation(original: InformationDocument, page: string): InformationDocument {
  return { ...original, sections: original.sections.map(section => ({ ...section, blocks: section.blocks.map(block => {
    let text = block.text;
    if (page === 'Terms') text = text.replace('تطبيق الأندرويد التابع لها', 'تطبيقاتها على الهواتف').replace(' (`is_banned`)', '');
    if (page === 'Privacy') {
      if (text.startsWith('حذف الحساب والبيانات:')) text = 'حذف الحساب والبيانات: يمكنك الانتقال إلى لوحة التحكم وطلب حذف الحساب. التنفيذ الحالي حذف منطقي يخفي الحساب ويلغي رموز الدخول ويحذف الصورة المستضافة. لا يعني ذلك محو جميع البيانات الشخصية من قاعدة البيانات، وقد يعيد تسجيل الدخول عبر Google تفعيل الحساب. تبقى المساهمات العامة وفق شروط المنصة.';
      if (text.startsWith('تطلب أقسام «الترانزيت»')) text = 'تطلب أقسام «الترانزيت» و«مشوار» إذن موقع الجهاز عند اختيارك استخدامه. تُرسل الإحداثيات إلى خدمات القرب عند البحث عن مواقف أو أماكن قريبة. كما تُرسل الإحداثيات التقريبية المختارة إلى خادمنا ثم إلى خدمات المواقيت والطقس، وقد تُحفظ الاستجابة والإحداثيات مؤقتاً لتقليل الطلبات. لا يُزامن موقع GPS أو IP مع إعدادات حسابك.';
      if (text.startsWith('تحديد الموقع (GPS')) text = 'تحديد الموقع (GPS / عنوان IP عبر ipwho.is): عند اختيار التحديد التلقائي، يحفظ التطبيق الإحداثيات التقريبية محلياً، ويرسلها لخدمات المواقيت والطقس أو القرب عند استخدام تلك الميزات. لا يطلب التطبيق إذن تتبع الموقع في الخلفية.';
      if (text.startsWith('مواقيت الصلاة (AlAdhan')) text = 'مواقيت الصلاة (AlAdhan API): تُرسل إحداثيات الموقع المختار عبر خادمنا لحساب المواقيت، وتُحفظ الاستجابة مؤقتاً لليوم الحالي.';
      if (text.startsWith('خرائط MapLibre')) text = 'الخرائط: تستخدم نسخة iOS خرائط Apple عبر MapKit. تستخدم نسخة الموقع MapLibre GL JS وOpenStreetMap.';
      if (text.startsWith('محركات البحث (Google')) text = 'محركات البحث الخارجية (Google وDuckDuckGo وBing وSearX): عند فتح محرك خارجي يُرسل إليه استعلامك. البحث الداخلي في التطبيق يستخدم خادم المساحة السورية.';
      if (text.startsWith('إحصاءات الزيارات (Google')) text = 'إحصاءات الزيارات (Google Analytics): يصف الموقع قياس زياراته بعد الموافقة، مع إرسال مسارات الصفحات دون سلاسل الاستعلام. لا تتضمن نسخة iOS الحالية حزمة Google Analytics ولا ترسل زيارات التطبيق إليها. تُدار موافقة الموقع داخل المتصفح، وتخضع الخدمة الخارجية لسياسة خصوصية Google.';
    }
    if (page === 'About') {
      if (text.startsWith('أيقونات واجهة المستخدم')) text += ' تستخدم واجهة iOS أيضاً رموز Apple SF Symbols وعناصر SwiftUI وUIKit الأصلية.';
      if (text.startsWith('بيانات الخرائط التفاعلية')) text += ' تعرض نسخة iOS الخرائط عبر Apple MapKit، مع بقاء إسنادات مصادر البيانات الأصلية.';
      if (text.startsWith('نص مصحف المدينة')) text = 'نص مصحف المدينة وخط حفص العثماني من مجمع الملك فهد لطباعة المصحف الشريف. تُستخدم نسخة الخط الأصلية دون تعديل. علامة نهاية الآية في نسخة iOS هي Alkalami001 من فهرس quran.ws، برخصة SIL Open Font License 1.1، مع حفظ الهندسة والإسناد والرخصة.';
    }
    return { ...block, text };
  }) })) };
}
