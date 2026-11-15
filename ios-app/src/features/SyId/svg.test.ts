import { expect, test } from 'bun:test';
import { resolveSvgCss, recolorArtwork } from './svg';
test('resolves shared selectors and inline precedence into native SVG attributes', () => {
  const native = resolveSvgCss('<svg><style>.a{fill:#04018c}.a,.b{stroke:#04018c;stroke-width:1.6px}</style><path class="a" d="M0 0"/><rect class="b" style="stroke:#fff"/></svg>');
  expect(native).not.toContain('<style'); expect(native).not.toContain('class=');
  expect(native).toContain('fill="#04018c"'); expect(native).toContain('stroke="#fff"'); expect(native).toContain('stroke-width="1.6"');
  expect(recolorArtwork(native, '#054239', '#edebe0')).toContain('fill="#054239"');
});
test('refuses a selector that native conversion cannot preserve', () => {
  expect(() => resolveSvgCss('<svg><style>svg path{fill:red}</style><path/></svg>')).toThrow();
});
test('keeps fixed-coordinate artwork scalable when native previews override its dimensions', () => {
  const flag = '<svg width="900" height="600"><path d="M0 0h900v600H0z"/></svg>';
  expect(resolveSvgCss(flag)).toContain('viewBox="0 0 900 600"');
  expect(resolveSvgCss(flag)).toContain('d="M0 0h900v600H0z"');
  expect(resolveSvgCss('<svg width="90px" height="60px" viewBox="0 -30 90 60"/>')).toContain('viewBox="0 -30 90 60"');
  expect(resolveSvgCss('<svg width="100%" height="100%"/>')).not.toContain('viewBox');
});
