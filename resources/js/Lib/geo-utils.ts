/**
 * Converts a GeoJSON (Feature or FeatureCollection) to an SVG string.
 * It crops the SVG to the bounding box of the input.
 */

export const GOVERNORATES_EN_TO_AR: Record<string, string> = {
    "Aleppo": "حلب",
    "Al Ḥasakah": "الحسكة",
    "Ar Raqqah": "الرقة",
    "As Suwayda": "السويداء",
    "Damascus": "دمشق",
    "Dar`a": "درعا",
    "Dayr Az Zawr": "دير الزور",
    "Hamah": "حماة",
    "Homs": "حمص",
    "Idlib": "إدلب",
    "Lattakia": "اللاذقية",
    "Quneitra": "القنيطرة",
    "Rif Dimashq": "ريف دمشق",
    "Tartus": "طرطوس"
};

export function getGovernorateNameAr(name: string): string {
    if (!name) return "";
    // If it's already Arabic (contains Arabic characters), return it
    if (/[\u0600-\u06FF]/.test(name)) return name;

    // Map of common variations to our standard keys
    const variations: Record<string, string> = {
        "Hasakah": "Al Ḥasakah",
        "Al Hasakah": "Al Ḥasakah",
        "Raqqa": "Ar Raqqah",
        "Ar Raqqa": "Ar Raqqah",
        "Daraa": "Dar`a",
        "Dara'a": "Dar`a",
        "Deir ez-Zor": "Dayr Az Zawr",
        "Deir Ezzor": "Dayr Az Zawr",
        "Rural Damascus": "Rif Dimashq",
        "Hama": "Hamah",
        "Idleb": "Idlib",
        "Tartous": "Tartus",
        "Latakia": "Lattakia"
    };

    const standardKey = variations[name] || name;
    return GOVERNORATES_EN_TO_AR[standardKey] || name;
}

export function geoJsonToSVG(geojson: any): string {
    if (!geojson) return "";

    let features: any[] = [];
    if (geojson.type === "FeatureCollection") {
        features = geojson.features;
    } else if (geojson.type === "Feature") {
        features = [geojson];
    } else {
        return "";
    }

    let allPoints: [number, number][] = [];

    // Extract all points to calculate bounds
    features.forEach(feature => {
        if (!feature.geometry) return;
        const { type, coordinates } = feature.geometry;
        if (type === "Polygon") {
            coordinates.forEach((ring: [number, number][]) => {
                allPoints.push(...ring);
            });
        } else if (type === "MultiPolygon") {
            coordinates.forEach((polygon: [number, number][][]) => {
                polygon.forEach((ring: [number, number][]) => {
                    allPoints.push(...ring);
                });
            });
        }
    });

    if (allPoints.length === 0) return "";

    // Calculate bounding box (Lon, Lat)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    allPoints.forEach(([x, y]) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });

    // Add padding
    const width = maxX - minX;
    const height = maxY - minY;
    const paddingX = width * 0.05;
    const paddingY = height * 0.05;

    minX -= paddingX;
    maxX += paddingX;
    minY -= paddingY;
    maxY += paddingY;

    const finalWidth = maxX - minX;
    const finalHeight = maxY - minY;

    const project = (lon: number, lat: number) => {
        const x = lon - minX;
        const y = maxY - lat; // Flip Y: maxY becomes 0
        return `${x.toFixed(6)},${y.toFixed(6)}`;
    };

    let svgPaths = "";

    features.forEach(feature => {
        if (!feature.geometry) return;
        const { type, coordinates } = feature.geometry;
        let pathData = "";

        if (type === "Polygon") {
            coordinates.forEach((ring: [number, number][]) => {
                pathData += ring.map((pt, i) => (i === 0 ? "M" : "L") + project(pt[0], pt[1])).join(" ") + " Z ";
            });
        } else if (type === "MultiPolygon") {
            coordinates.forEach((polygon: [number, number][][]) => {
                polygon.forEach((ring: [number, number][]) => {
                    pathData += ring.map((pt, i) => (i === 0 ? "M" : "L") + project(pt[0], pt[1])).join(" ") + " Z ";
                });
            });
        }

        if (pathData) {
            svgPaths += `<path d="${pathData.trim()}" fill="#428177" stroke="#0D1117" stroke-width="${(finalWidth / 500).toFixed(6)}" />\n`;
        }
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${finalWidth} ${finalHeight}" width="1200" height="auto">
${svgPaths}</svg>`;

    return svg;
}

// Deprecated alias for backwards compatibility
export const featureToSVG = geoJsonToSVG;
