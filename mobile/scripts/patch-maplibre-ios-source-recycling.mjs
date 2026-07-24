import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const mapLibreIosSourceComponents = [
  {
    label: 'GeoJSON source',
    propsClass: 'MLRNGeoJSONSourceProps',
    relativePath:
      '../node_modules/@maplibre/maplibre-react-native/ios/components/sources/geojson-source/MLRNGeoJSONSourceComponentView.mm',
    viewClass: 'MLRNGeoJSONSource',
  },
  {
    label: 'image source',
    propsClass: 'MLRNImageSourceProps',
    relativePath:
      '../node_modules/@maplibre/maplibre-react-native/ios/components/sources/image-source/MLRNImageSourceComponentView.mm',
    viewClass: 'MLRNImageSource',
  },
  {
    label: 'raster DEM source',
    propsClass: 'MLRNRasterDEMSourceProps',
    relativePath:
      '../node_modules/@maplibre/maplibre-react-native/ios/components/sources/tile-sources/raster-dem-source/MLRNRasterDEMSourceComponentView.mm',
    viewClass: 'MLRNRasterDEMSource',
  },
  {
    label: 'raster source',
    propsClass: 'MLRNRasterSourceProps',
    relativePath:
      '../node_modules/@maplibre/maplibre-react-native/ios/components/sources/tile-sources/raster-source/MLRNRasterSourceComponentView.mm',
    viewClass: 'MLRNRasterSource',
  },
  {
    label: 'vector source',
    propsClass: 'MLRNVectorSourceProps',
    relativePath:
      '../node_modules/@maplibre/maplibre-react-native/ios/components/sources/tile-sources/vector-source/MLRNVectorSourceComponentView.mm',
    viewClass: 'MLRNVectorSource',
  },
];

function recyclingContexts(component) {
  const original = `- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const ${component.propsClass}>();
    _props = defaultProps;
    [self prepareView];
  }

  return self;
}

- (void)prepareView {
  _view = [[${component.viewClass} alloc] init];`;

  const patched = `- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    [self prepareView];
  }

  return self;
}

- (void)prepareForRecycle {
  [super prepareForRecycle];
  [self prepareView];
}

- (void)prepareView {
  static const auto defaultProps = std::make_shared<const ${component.propsClass}>();
  _props = defaultProps;

  _view = [[${component.viewClass} alloc] init];`;

  return { original, patched };
}

function occurrences(source, target) {
  return source.split(target).length - 1;
}

export function patchMapLibreIosSourceRecycling(
  source,
  component = mapLibreIosSourceComponents[0],
) {
  const { original, patched } = recyclingContexts(component);
  const originalCount = occurrences(source, original);
  const patchedCount = occurrences(source, patched);

  if (originalCount === 1 && patchedCount === 0) {
    return {
      changed: true,
      source: source.replace(original, patched),
    };
  }

  if (originalCount === 0 && patchedCount === 1) {
    return {
      changed: false,
      source,
    };
  }

  throw new Error(
    `MapLibre iOS ${component.label} recycling code drifted. Review ${component.viewClass}ComponentView.mm before updating the patch.`,
  );
}

async function main() {
  const patches = await Promise.all(
    mapLibreIosSourceComponents.map(async (component) => {
      const target = resolve(import.meta.dirname, component.relativePath);
      const source = await readFile(target, 'utf8');
      return {
        component,
        result: patchMapLibreIosSourceRecycling(source, component),
        target,
      };
    }),
  );

  for (const patch of patches) {
    if (patch.result.changed) {
      await writeFile(patch.target, patch.result.source, 'utf8');
    }
  }

  const changed = patches.filter((patch) => patch.result.changed).length;
  console.log(
    changed > 0
      ? `Patched ${changed} MapLibre iOS source recycling component(s).`
      : 'MapLibre iOS source recycling is already patched.',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
