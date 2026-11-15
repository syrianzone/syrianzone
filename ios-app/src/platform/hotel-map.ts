import type { Coordinate } from '../domain';
import { array, record, text } from './validation';
import { decodeCoordinate } from './geo';
import { positiveId } from './entity-data';

export function decodeHotelPins(value: unknown): { id: number; name: string; coordinate: Coordinate }[] {
  const collection = record(value);
  if (collection.type !== 'FeatureCollection') throw new Error('بيانات خريطة الفنادق غير صالحة.');
  return array(collection.features).map(item => {
    const feature = record(item), geometry = record(feature.geometry), point = array(geometry.coordinates), row = record(feature.properties);
    if (feature.type !== 'Feature' || geometry.type !== 'Point' || point.length !== 2 || row.type !== 'hotel') throw new Error('نقطة الفندق غير صالحة.');
    return { id: positiveId(row.id), name: text(row.name_ar, '') || text(row.name), coordinate: decodeCoordinate(point[1], point[0]) };
  });
}
