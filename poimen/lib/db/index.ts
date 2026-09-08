// Data-access layer (DAL) barrel.
//
// Screens and the auth provider import everything from '@/lib/db' and never
// touch Supabase directly. This is the seam: to move Nepsis onto a different
// backend (or to add an offline/SQLite cache for a native iOS/Android build),
// reimplement these modules — the screens stay untouched.
//
//   lib/supabase.ts  → backend client (the only file that constructs Supabase)
//   lib/db/*.ts      → typed, backend-agnostic queries grouped by domain
export * from './auth';
export * from './profiles';
export * from './pastoral';
export * from './canons';
export * from './prayer';
export * from './progress';
export * from './admin';
export * from './scheduling';
export * from './photos';
export * from './templates';
export * from './feedback';
