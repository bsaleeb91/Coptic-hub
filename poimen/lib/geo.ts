// lib/geo.ts
// Ordering churches by distance. Runs on the phone: the member's location is
// used here and never sent anywhere.

export interface LatLng {
  latitude: number;
  longitude: number;
}

interface Placed {
  name: string;
  latitude: number | null;
  longitude: number | null;
}

// Great-circle distance in kilometres (haversine).
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Nearest first. Churches with no coordinates keep their alphabetical order
// after all the placed ones, so none of them drops out of the list.
export function sortByDistance<T extends Placed>(items: T[], here: LatLng): T[] {
  const placed: { item: T; km: number }[] = [];
  const unplaced: T[] = [];
  for (const item of items) {
    if (item.latitude == null || item.longitude == null) unplaced.push(item);
    else placed.push({ item, km: distanceKm(here, { latitude: item.latitude, longitude: item.longitude }) });
  }
  placed.sort((a, b) => a.km - b.km || a.item.name.localeCompare(b.item.name));
  unplaced.sort((a, b) => a.name.localeCompare(b.name));
  return [...placed.map(p => p.item), ...unplaced];
}
