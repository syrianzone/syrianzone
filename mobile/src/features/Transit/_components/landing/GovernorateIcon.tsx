import { MapPin } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { GOVERNORATE_SVGS } from '../../_data/governorate_svgs';
import { getGovernorateSvgKey } from '../../model';

export function GovernorateIcon({
  cityId,
  color,
  size = 28,
}: {
  cityId: string;
  color: string;
  size?: number;
}) {
  const data = GOVERNORATE_SVGS[getGovernorateSvgKey(cityId)];
  if (!data) {
    return <MapPin color={color} size={size} />;
  }
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox={data.viewBox}
      width={size}
    >
      <Path d={data.path} fill={color} />
    </Svg>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/landing/CityCard.tsx (118 lines)
  confidence: high
  todos:      0
  notes:      Compact native SVG paths preserve each governorate silhouette and alias mapping.
*/
