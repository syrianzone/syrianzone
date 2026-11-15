from pathlib import Path
import subprocess, sys, tempfile

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'node_modules/react-native'
utils = source / 'ReactCommon/react/renderer/textlayoutmanager/platform/ios/react/renderer/textlayoutmanager/RCTAttributedTextUtils.mm'
component = source / 'React/Fabric/Mounting/ComponentViews/TextInput/RCTTextInputComponentView.mm'
# Compile the actual comparison implementations. AppKit supplies the same Foundation attributed-string and
# paragraph-style classes on the host. Only the two direction fields of RN TextAttributes are a type seam.
comparison = utils.read_text().split('static BOOL RCTIsParagraphStyleEffectivelySame(', 1)[1]
comparison = 'static BOOL RCTIsParagraphStyleEffectivelySame(' + comparison
method = component.read_text().split('- (BOOL)_textOf:', 1)[1].split('- (SubmitBehavior)getSubmitBehavior', 1)[0]
method = '- (BOOL)_textOf:' + method
prefix = r'''
#import <AppKit/AppKit.h>
#include <optional>
enum class LayoutDirection { LeftToRight, RightToLeft };
enum class WritingDirection { Natural, LeftToRight, RightToLeft };
struct TextAttributes {
  std::optional<LayoutDirection> layoutDirection;
  std::optional<WritingDirection> baseWritingDirection;
};
struct TextInputProps { bool multiline = false; TextAttributes textAttributes; };
static NSWritingDirection RCTNSWritingDirectionFromWritingDirection(WritingDirection value) {
  return value == WritingDirection::Natural ? NSWritingDirectionNatural :
    value == WritingDirection::RightToLeft ? NSWritingDirectionRightToLeft : NSWritingDirectionLeftToRight;
}
static NSString *const RCTAttributedStringEventEmitterKey = @"EventEmitter";
@interface InputMode : NSObject
@property NSString *primaryLanguage;
@end
@implementation InputMode
@end
@interface Input : NSObject
@property NSDictionary *defaultTextAttributes;
@property InputMode *textInputMode;
@property id markedTextRange;
@property BOOL isSecureTextEntry;
@end
@implementation Input
@end
@interface Comparison : NSObject {
  Input *_backedTextInputView;
  NSDictionary *_originalTypingAttributes;
  TextInputProps *_props;
}
- (instancetype)initWithMultiline:(BOOL)multiline;
- (BOOL)_textOf:(NSAttributedString *)newText equals:(NSAttributedString *)oldText;
@end
'''
implementation = r'''
@implementation Comparison
- (instancetype)initWithMultiline:(BOOL)multiline {
  if ((self = [super init])) {
    _backedTextInputView = [Input new];
    _backedTextInputView.defaultTextAttributes = @{
      NSForegroundColorAttributeName: NSColor.blackColor,
      NSBackgroundColorAttributeName: NSColor.clearColor,
      RCTAttributedStringEventEmitterKey: @1,
    };
    _originalTypingAttributes = @{};
    _props = new TextInputProps();
    _props->multiline = multiline;
  }
  return self;
}
- (void)dealloc { delete _props; }
'''
tests = r'''
@end
static int failures = 0, checks = 0;
static void check(BOOL value, NSString *name) {
  checks++;
  if (!value) { failures++; fprintf(stderr, "FAIL %s\n", name.UTF8String); }
}
static NSAttributedString *text(NSString *value, NSDictionary *attributes) {
  return [[NSAttributedString alloc] initWithString:value attributes:attributes];
}
int main() { @autoreleasepool {
  Comparison *single = [[Comparison alloc] initWithMultiline:NO];
  Comparison *multi = [[Comparison alloc] initWithMultiline:YES];
  NSMutableParagraphStyle *typed = [NSParagraphStyle.defaultParagraphStyle mutableCopy];
  typed.lineBreakMode = NSLineBreakByTruncatingTail;
  typed.baseWritingDirection = NSWritingDirectionLeftToRight;
  NSDictionary *normal = @{NSForegroundColorAttributeName: NSColor.blackColor};
  NSDictionary *shown = @{NSForegroundColorAttributeName: NSColor.blackColor, NSParagraphStyleAttributeName: typed};
  check([single _textOf:text(@"n", normal) equals:text(@"n", shown)], @"same first character does not enter attributed write");
  check([single _textOf:text(@"م", normal) equals:text(@"م", shown)], @"Arabic first character does not enter attributed write");
  NSMutableParagraphStyle *lineHeight = [NSParagraphStyle.defaultParagraphStyle mutableCopy];
  lineHeight.minimumLineHeight = 26; lineHeight.maximumLineHeight = 26;
  check([single _textOf:text(@"n", @{NSParagraphStyleAttributeName:lineHeight}) equals:text(@"n", @{NSParagraphStyleAttributeName:typed})], @"single-line UIKit paragraph normalization");
  check(![multi _textOf:text(@"n", @{NSParagraphStyleAttributeName:lineHeight}) equals:text(@"n", @{NSParagraphStyleAttributeName:typed})], @"multiline line height remains a real write");
  check(![single _textOf:text(@"n", @{NSForegroundColorAttributeName:NSColor.redColor}) equals:text(@"n", normal)], @"real color changes still write");
  check(![single _textOf:text(@"n", @{NSFontAttributeName:[NSFont systemFontOfSize:20]}) equals:text(@"n", @{NSFontAttributeName:[NSFont systemFontOfSize:16]})], @"real font and Dynamic Type changes still write");
  check(![single _textOf:text(@"N", normal) equals:text(@"n", normal)], @"transformed value remains a real write");
  check([single _textOf:text(@"n", @{RCTAttributedStringEventEmitterKey:@1}) equals:text(@"n", @{RCTAttributedStringEventEmitterKey:@2})], @"event emitter differences are metadata");
  check([single _textOf:text(@"n", @{NSBackgroundColorAttributeName:NSColor.clearColor}) equals:text(@"n", @{})], @"default attribute added after first event is equal");
  NSMutableParagraphStyle *right = [typed mutableCopy]; right.alignment = NSTextAlignmentRight;
  check(![single _textOf:text(@"n", @{NSParagraphStyleAttributeName:right}) equals:text(@"n", @{NSParagraphStyleAttributeName:typed})], @"real alignment changes still write");
  check(![single _textOf:text(@"n", @{NSKernAttributeName:@2}) equals:text(@"n", @{NSKernAttributeName:@1})], @"real letter spacing changes still write");
  check(![single _textOf:text(@"n", @{NSUnderlineStyleAttributeName:@1}) equals:text(@"n", @{})], @"real underline changes still write");
  check(![single _textOf:text(@"n", @{}) equals:text(@"n", @{NSFontAttributeName:[NSFont systemFontOfSize:16]})], @"removing a real font attribute still writes");
  NSMutableParagraphStyle *charWrap = [typed mutableCopy]; charWrap.lineBreakMode = NSLineBreakByCharWrapping;
  check(![multi _textOf:text(@"n", @{NSParagraphStyleAttributeName:charWrap}) equals:text(@"n", @{NSParagraphStyleAttributeName:typed})], @"multiline line break changes still write");
  NSMutableParagraphStyle *rtl = [typed mutableCopy]; rtl.baseWritingDirection = NSWritingDirectionRightToLeft;
  check([single _textOf:text(@"م", @{NSParagraphStyleAttributeName:rtl}) equals:text(@"م", @{NSParagraphStyleAttributeName:typed})], @"single-line UIKit writing direction normalization");
  check(![multi _textOf:text(@"م", @{NSParagraphStyleAttributeName:rtl}) equals:text(@"م", @{NSParagraphStyleAttributeName:typed})], @"multiline writing direction changes still write");
  check([single _textOf:text(@"👍🏽é", normal) equals:text(@"👍🏽é", shown)], @"comparison retains composed characters");
  printf("%d comparison checks, %d failures\n", checks, failures);
  return failures ? 1 : 0;
} }
'''
with tempfile.TemporaryDirectory(prefix='sz-input84-comparison-') as temporary:
  folder = Path(temporary)
  test = folder / 'comparison.mm'
  test.write_text(prefix + comparison + implementation + method + tests)
  subprocess.run(['xcrun', 'clang++', '-std=c++20', '-fobjc-arc', '-fblocks', '-framework', 'AppKit', str(test), '-o', str(folder / 'comparison')], check=True)
  sys.exit(subprocess.run([str(folder / 'comparison')]).returncode)
