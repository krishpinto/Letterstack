// Overpass API — queries OpenStreetMap for local businesses
// No API key needed, completely free
// Two step process:
//   1. Nominatim geocodes city name to lat/lon
//   2. Overpass queries for businesses within radius of those coords

// Change this line at the top
const OVERPASS_URL = "https://overpass.openstreetmap.ru/api/interpreter";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export interface OverpassQuery {
  category: string;  // e.g. "restaurant", "cafe", "shop"
  city: string;      // e.g. "Mumbai", "Delhi"
  radius?: number;   // meters, default 10km
}

async function getCityCoords(city: string): Promise<{ lat: number; lon: number } | null> {
  // Nominatim is OSM's free geocoding service
  // Converts "Mumbai" → { lat: 19.076, lon: 72.877 }
  // Required because Overpass queries by coordinates not city name
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(city)}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: {
      // Nominatim requires a User-Agent identifying your app
      // Without this they may block your requests
      "User-Agent": "LetterStack/1.0 (leadgen tool)"
    }
  });

  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);

  const data = await res.json();
  if (!data.length) return null;

  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon)
  };
}

function buildQuery(lat: number, lon: number, category: string, radius: number): string {
  // Overpass QL query
  // Searches nodes (points on map) tagged with the category
  // within a circle of [radius] meters centered on [lat, lon]
  // We check three tag types because OSM is inconsistent:
  //   amenity = restaurants, cafes, hospitals, schools etc.
  //   shop = retail stores, supermarkets etc.
  //   office = companies, agencies, NGOs etc.
  return `
    [out:json][timeout:30];
    (
      node["amenity"="${category}"](around:${radius},${lat},${lon});
      node["shop"="${category}"](around:${radius},${lat},${lon});
      node["office"="${category}"](around:${radius},${lat},${lon});
    );
    out body;
  `;
}

export async function scrapeOverpass(query: OverpassQuery): Promise<any[]> {
  // Main export — call this from the API route or test script
  // Returns raw OSM nodes — pass these into normalizeOverpass() next

  const coords = await getCityCoords(query.city);
  if (!coords) throw new Error(`Could not geocode city: ${query.city}`);

  const radius = query.radius ?? 10000; // 10km default
  const ql = buildQuery(coords.lat, coords.lon, query.category, radius);

  const res = await fetch(OVERPASS_URL, {
  method: "POST",
  body: "data=" + encodeURIComponent(ql),
  headers: {
    "Content-Type": "application/x-www-form-urlencoded"
  }
});

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);

  const data = await res.json();

  // data.elements is the array of matching nodes
  // Each node: { id, lat, lon, tags: { name, phone, website, ... } }
  return data.elements ?? [];
}