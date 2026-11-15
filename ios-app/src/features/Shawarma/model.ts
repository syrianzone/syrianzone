export interface ShawarmaSpot { readonly name: string; readonly logo: string; readonly href: string; readonly social: 'instagram' | 'facebook' }
export interface ShawarmaTier { readonly rank: 'S' | 'A' | 'B' | 'C'; readonly color: string; readonly spots: readonly ShawarmaSpot[] }
// A dark backing keeps the original yellow, green and orange rank colors readable in light mode too.
export const rankBackground = '#0D1117';

// PORT NOTE: The original static ranking is editorial content, not a score or a user ballot.
export const shawarmaTiers: readonly ShawarmaTier[] = [
  { rank: 'S', color: '#EF4444', spots: [
    { name: 'Just Shawarma', logo: '/assets/shawarma/just-shawarma.webp', href: 'https://www.instagram.com/justshawarma.sy/', social: 'instagram' },
    { name: 'Alger', logo: '/assets/shawarma/alager.webp', href: 'https://www.instagram.com/shawrma.alaghr/', social: 'instagram' },
    { name: 'Check In', logo: '/assets/shawarma/checkin.webp', href: 'https://www.instagram.com/checkin.sy/', social: 'instagram' },
    { name: 'Sbenti', logo: '/assets/shawarma/sbenti.webp', href: 'https://www.facebook.com/p/Spenti-snak-100063744110605/', social: 'facebook' }
  ] },
  { rank: 'A', color: '#F97316', spots: [
    { name: 'Kamal Ayash', logo: '/assets/shawarma/Kamal-Ayash.webp', href: 'https://www.instagram.com/kamalayash1/', social: 'instagram' },
    { name: 'Paprika', logo: '/assets/shawarma/paprika.webp', href: 'https://www.instagram.com/paprika.syria', social: 'instagram' }
  ] },
  { rank: 'B', color: '#FACC15', spots: [
    { name: 'Shawerha', logo: '/assets/shawarma/SHAWERHA.webp', href: 'https://www.instagram.com/shawerhaofficial/', social: 'instagram' },
    { name: 'Faruk', logo: '/assets/shawarma/faruk.webp', href: 'https://www.instagram.com/alfarouk.res/', social: 'instagram' },
    { name: 'Abu Rateb', logo: '/assets/shawarma/abu-rateb.webp', href: 'https://www.instagram.com/aburatebchicken', social: 'instagram' }
  ] },
  { rank: 'C', color: '#22C55E', spots: [
    { name: 'Alaga', logo: '/assets/shawarma/alaga.webp', href: 'https://www.facebook.com/alagha.Broast.shawarma/', social: 'facebook' }
  ] }
];
// PORT STATUS: source resources/js/Pages/Shawarma/Index.tsx; confidence high; todos 0.
