import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const originalContext = `    self.loggingConfiguration = [MLNLoggingConfiguration sharedConfiguration];
    [self.loggingConfiguration setLoggingLevel:MLNLoggingLevelWarning];
    __weak typeof(self) weakSelf = self;`;

const patchedContext = `    self.loggingConfiguration = [MLNLoggingConfiguration sharedConfiguration];
    [self.loggingConfiguration setLoggingLevel:MLNLoggingLevelNone];
    __weak typeof(self) weakSelf = self;`;

function occurrences(source, target) {
  return source.split(target).length - 1;
}

export function patchMapLibreIosLogging(source) {
  const originalCount = occurrences(source, originalContext);
  const patchedCount = occurrences(source, patchedContext);

  if (originalCount === 1 && patchedCount === 0) {
    return {
      changed: true,
      source: source.replace(originalContext, patchedContext),
    };
  }

  if (originalCount === 0 && patchedCount === 1) {
    return {
      changed: false,
      source,
    };
  }

  throw new Error(
    'MapLibre iOS logging source drifted. Review MLRNLogging.m before updating the patch.',
  );
}

async function main() {
  const target = resolve(
    import.meta.dirname,
    '../node_modules/@maplibre/maplibre-react-native/ios/modules/logging/MLRNLogging.m',
  );
  const source = await readFile(target, 'utf8');
  const result = patchMapLibreIosLogging(source);

  if (result.changed) {
    await writeFile(target, result.source, 'utf8');
    console.log('Patched MapLibre iOS native logging default.');
  } else {
    console.log('MapLibre iOS native logging default is already patched.');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
