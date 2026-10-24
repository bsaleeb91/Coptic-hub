// lib/geocode.ts
// Turns a church's address into coordinates when an admin adds it. Uses
// Nominatim (OpenStreetMap), which is free for low-volume use like this: one
// request per church saved, from the admin dashboard on the web, where the
// browser identifies the site to Nominatim through the Referer header.
// Usage policy: https://operations.osmfoundation.org/policies/nominatim/
//
// Only church addresses are sent, never a member's.

import type { LatLng } from '@/lib/geo';

export interface AddressParts {
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}

// null when there is nothing to look up, no match, or the request fails.
// A failed lookup must never stop the church being saved.
export async function geocodeAddress(parts: AddressParts): Promise<LatLng | null> {
  const country = (parts.country ?? 'US').trim() || 'US';
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: country.toLowerCase() });
  const set = (k: string, v: string | null | undefined) => { if (v && v.trim()) params.set(k, v.trim()); };
  set('street', parts.address_line1);
  set('city', parts.city);
  set('state', parts.state);
  set('postalcode', parts.zip);
  if (!params.has('street') && !params.has('city') && !params.has('postalcode')) return null;

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat: string; lon: string }[];
    if (!rows.length) return null;
    const latitude = Number(rows[0].lat);
    const longitude = Number(rows[0].lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  } catch {
    return null;
  }
}
