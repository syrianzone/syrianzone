import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { processColor } from 'react-native';

import { getThemeById, type ThemeConfig } from '@/lib/ported/theme';

import * as ProjectIcons from './ProjectIcons';
import {
  type FeatureIcon,
  NewsIcon,
  quickLinkIcon,
  SyOfficialIcon,
} from './ProjectIcons';

const mockTheme: { current: ThemeConfig | undefined } = { current: undefined };

jest.mock('@/contexts/ThemeContext', () => ({
  useAppTheme: () => ({ theme: mockTheme.current }),
}));

function applyTheme(id: 'light' | 'dark'): ThemeConfig {
  const theme = getThemeById(id);
  if (!theme) {
    throw new Error(`Theme ${id} is not registered`);
  }
  mockTheme.current = theme;
  return theme;
}

function iconFor(id: string): FeatureIcon {
  const Icon = quickLinkIcon(id);
  if (!Icon) {
    throw new Error(`No quick link icon for ${id}`);
  }
  return Icon;
}

interface Node {
  children: (Node | string)[] | null;
  props: Record<string, unknown>;
  type: string;
}

async function drawShapes(element: ReactElement) {
  const view = await render(element);
  const root = view.toJSON() as Node;
  const group = root.children?.[0] as Node;
  return { root, shapes: (group.children ?? []) as Node[] };
}

// One entry per exported svg icon: the number of shapes the web source draws.
const goldenShapeCounts: Readonly<Record<string, number>> = {
  AnswersIcon: 3,
  BoardIcon: 4,
  CodexCommunityIcon: 4,
  CompassIcon: 6,
  GovAppsIcon: 7,
  HouseIcon: 4,
  JusticeIcon: 5,
  MishwarIcon: 2,
  NewsIcon: 5,
  PartyIcon: 5,
  PhonebookIcon: 5,
  PopulationIcon: 4,
  PrioritiesIcon: 6,
  RecipesIcon: 5,
  RoznamaIcon: 9,
  SitesIcon: 3,
  SyIdIcon: 4,
  SyOfficialIcon: 3,
  TierlistIcon: 5,
  TransitIcon: 6,
  WarningsIcon: 3,
};

const exportedIcons = Object.entries(ProjectIcons).filter(
  (entry): entry is [string, FeatureIcon] => /^[A-Z]\w*Icon$/.test(entry[0]),
);

test('the golden table names every exported icon', () => {
  expect(exportedIcons.map(([name]) => name).sort()).toEqual(
    Object.keys(goldenShapeCounts).sort(),
  );
});

test.each(['light', 'dark'] as const)(
  'every icon draws its web shape count in the %s theme',
  async (id) => {
    applyTheme(id);
    for (const [name, Icon] of exportedIcons) {
      const { root, shapes } = await drawShapes(<Icon />);
      expect([name, root.type, root.props.width, shapes.length]).toEqual([
        name,
        'RNSVGSvgView',
        28,
        goldenShapeCounts[name],
      ]);
    }
  },
);

test('picks the light colors and alpha in the light theme', async () => {
  applyTheme('light');
  const { shapes } = await drawShapes(<SyOfficialIcon />);
  expect(shapes[0]?.props).toMatchObject({
    fillOpacity: 0.15,
    stroke: { payload: processColor('#2563EB') },
  });
});

test('picks the dark colors and alpha in the dark theme', async () => {
  applyTheme('dark');
  const { shapes } = await drawShapes(<SyOfficialIcon />);
  expect(shapes[0]?.props).toMatchObject({
    fillOpacity: 0.25,
    stroke: { payload: processColor('#60A5FA') },
  });
});

test('fills the accent with the theme primary unless a color is given', async () => {
  const theme = applyTheme('light');
  const themed = await drawShapes(<SyOfficialIcon />);
  expect(themed.shapes[2]?.props.fill).toEqual({
    payload: processColor(theme.palette.primary),
    type: 0,
  });

  const custom = await drawShapes(<SyOfficialIcon color="#123456" size={40} />);
  expect(custom.shapes[2]?.props.fill).toEqual({
    payload: processColor('#123456'),
    type: 0,
  });
  expect(custom.root.props.width).toBe(40);
});

test('maps the external quick links to the website icons', () => {
  expect(quickLinkIcon('news')).toBe(NewsIcon);
  expect(quickLinkIcon('answers')).toBe(ProjectIcons.AnswersIcon);
  expect(quickLinkIcon('recipes')).toBe(ProjectIcons.RecipesIcon);
  expect(quickLinkIcon('codex-community')).toBe(ProjectIcons.CodexCommunityIcon);
  expect(quickLinkIcon('unknown')).toBeNull();
});

test.each([
  ['joory', { uri: 'https://joory.chat/favicon.svg' }],
  ['jard', { uri: 'https://jard.chat/images/logo-light.svg' }],
])('draws %s as a sized remote image', async (id, source) => {
  const Icon = iconFor(id);
  const view = await render(<Icon size={20} />);
  const image = view.toJSON() as Node;
  // expo-image normalizes a single source into a one-element list.
  expect(image.props.source).toEqual([source]);
  expect(image.props.style).toEqual({ height: 20, width: 20 });
});

test('draws the flag replacer from the bundled asset', async () => {
  const Icon = iconFor('flag-replacer');
  const view = await render(<Icon />);
  const image = view.toJSON() as Node;
  expect(image.props.source).toBeTruthy();
  expect(image.props.style).toEqual({ height: 28, width: 28 });
});
