const cities = [
  {
    "id": "damascus",
    "nameAr": "دمشق",
    "nameEn": "Damascus",
    "status": "active",
    "routeCount": 7,
    "bounds": [[35.8, 33.3], [36.8, 33.7]],
    "center": [36.29, 33.51],
    "zoom": 12
  },
  {
    "id": "rif-dimashq",
    "nameAr": "ريف دمشق",
    "nameEn": "Rif Dimashq",
    "status": "active",
    "routeCount": 0,
    "bounds": [[35.7, 33.1], [37.2, 34.0]],
    "center": [36.5, 33.55],
    "zoom": 10
  },
  {
    "id": "aleppo",
    "nameAr": "حلب",
    "nameEn": "Aleppo",
    "status": "active",
    "routeCount": 0,
    "bounds": [[36.9, 36.0], [37.5, 36.45]],
    "center": [37.16, 36.20],
    "zoom": 12
  },
  {
    "id": "homs",
    "nameAr": "حمص",
    "nameEn": "Homs",
    "status": "active",
    "routeCount": 0,
    "bounds": [[36.5, 34.55], [36.95, 34.95]],
    "center": [36.72, 34.73],
    "zoom": 12
  },
  {
    "id": "hama",
    "nameAr": "حماة",
    "nameEn": "Hama",
    "status": "active",
    "routeCount": 30,
    "bounds": [[36.6958, 35.0874], [36.8091, 35.1843]],
    "center": [36.75, 35.135],
    "zoom": 13
  },
  {
    "id": "latakia",
    "nameAr": "اللاذقية",
    "nameEn": "Latakia",
    "status": "active",
    "routeCount": 0,
    "bounds": [[35.6, 35.38], [35.97, 35.65]],
    "center": [35.79, 35.52],
    "zoom": 13
  },
  {
    "id": "tartous",
    "nameAr": "طرطوس",
    "nameEn": "Tartous",
    "status": "active",
    "routeCount": 12,
    "bounds": [[35.8, 34.8], [35.95, 34.95]],
    "center": [35.887, 34.888],
    "zoom": 13
  },
  {
    "id": "idlib",
    "nameAr": "إدلب",
    "nameEn": "Idlib",
    "status": "active",
    "routeCount": 0,
    "bounds": [[36.5, 35.8], [36.8, 36.1]],
    "center": [36.63, 35.93],
    "zoom": 13
  },
  {
    "id": "deir-ezzor",
    "nameAr": "دير الزور",
    "nameEn": "Deir ez-Zor",
    "status": "active",
    "routeCount": 0,
    "bounds": [[39.9, 35.18], [40.4, 35.52]],
    "center": [40.14, 35.34],
    "zoom": 12
  },
  {
    "id": "raqqa",
    "nameAr": "الرقة",
    "nameEn": "Raqqa",
    "status": "active",
    "routeCount": 0,
    "bounds": [[38.7, 35.78], [39.3, 36.08]],
    "center": [38.99, 35.95],
    "zoom": 12
  },
  {
    "id": "hasakah",
    "nameAr": "الحسكة",
    "nameEn": "Al-Hasakah",
    "status": "active",
    "routeCount": 0,
    "bounds": [[40.5, 36.3], [41.05, 36.68]],
    "center": [40.75, 36.48],
    "zoom": 12
  },
  {
    "id": "daraa",
    "nameAr": "درعا",
    "nameEn": "Daraa",
    "status": "active",
    "routeCount": 0,
    "bounds": [[35.9, 32.4], [36.35, 32.85]],
    "center": [36.10, 32.62],
    "zoom": 12
  },
  {
    "id": "suwayda",
    "nameAr": "السويداء",
    "nameEn": "As-Suwayda",
    "status": "active",
    "routeCount": 0,
    "bounds": [[36.3, 32.5], [36.85, 32.95]],
    "center": [36.57, 32.71],
    "zoom": 12
  },
  {
    "id": "quneitra",
    "nameAr": "القنيطرة",
    "nameEn": "Quneitra",
    "status": "active",
    "routeCount": 0,
    "bounds": [[35.6, 32.9], [36.1, 33.35]],
    "center": [35.82, 33.13],
    "zoom": 12
  }
] as const;

export default cities;

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_data/cities.json (142 lines)
  confidence: high
  todos:      0
  notes:      The complete city fallback is bundled for offline launch.
*/
