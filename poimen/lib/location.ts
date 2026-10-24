// lib/location.ts
// The member's rough location, asked for only when they tap "Sort by nearest"
// in the church picker. Used on the phone to order the list; never sent or
// stored.
//
// expo-location is loaded lazily: phones on a build made before it was added
// have no native location module, and a top-level import would crash them if
// this code ever reached them in an over-the-air update. Here it fails softly
// as 'unavailable' instead.

import type { LatLng } from '@/lib/geo';

export type LocationResult =
  | { status: 'ok'; coords: LatLng }
  | { status: 'denied' }
  | { status: 'unavailable' };

export async function getApproxLocation(): Promise<LocationResult> {
  try {
    const Location = await import('expo-location');
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { status: 'denied' };
    // A recent cached fix is plenty for ordering parishes and returns at once.
    const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });
    const pos = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    return { status: 'ok', coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } };
  } catch {
    return { status: 'unavailable' };
  }
}
