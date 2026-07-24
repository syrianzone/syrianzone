import type {
  AdminPlace,
  PlaceDetail,
  PlacePhoto,
} from '@/features/Places/_lib/types';

export const placePhotos: readonly PlacePhoto[] = [
  {
    display_url: 'https://media.example/places/7/one.webp?v=1',
    id: 71,
    sort: 0,
    thumb_url: 'https://media.example/places/7/one-thumb.webp?v=1',
  },
  {
    display_url: 'https://media.example/places/7/two.jpg?v=2',
    id: 72,
    sort: 1,
    thumb_url: 'https://media.example/places/7/two-thumb.jpg?v=2',
  },
];

export const adminPlace: AdminPlace = {
  category: 'historical',
  created_at: '2026-07-18T10:00:00.000Z',
  description: 'وصف واضح لمكان تاريخي يستحق الزيارة في دمشق القديمة.',
  id: 7,
  lat: 33.5138,
  lng: 36.2765,
  name: 'بيت دمشقي قديم',
  photos: [...placePhotos],
  rejection_reason: null,
  saved_by_me: false,
  saves_count: 12,
  status: 'pending',
  thumb_url: placePhotos[0]?.thumb_url ?? null,
  user: {
    avatar_url: null,
    id: 3,
    name: 'مساهم سوري',
  },
};

export const placeDetail: PlaceDetail = {
  ...adminPlace,
  user: {
    ...adminPlace.user,
    level: 4,
    points: 280,
  },
};
