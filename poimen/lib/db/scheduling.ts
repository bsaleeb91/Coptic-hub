// Appointment scheduling queries + RPCs.
//
// Everything here is cloud-only (Supabase). The priest owns their appointment
// types and recurring availability rules; congregants read their Father of
// Confession's types/rules (consent-gated by RLS) and request slots through
// SECURITY DEFINER RPCs. See supabase/migrations/20260723_scheduling.sql.
import { supabase } from '../supabase';
import { SCHEDULE_HORIZON_DAYS } from '../scheduling/slots';

export interface AppointmentType {
  id: string;
  priest_id: string;
  label: string;
  duration_minutes: number;
  active: boolean;
  sort: number;
  created_at: string;
}

export interface AvailabilityRuleRow {
  id: string;
  priest_id: string;
  type_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  active: boolean;
  created_at: string;
}

// A one-off change to a calendar date: 'block' closes (null minutes = the whole
// day), 'open' adds extra hours the weekly pattern doesn't offer (type_id and
// both minutes required).
export interface AvailabilityException {
  id: string;
  priest_id: string;
  on_date: string;                 // YYYY-MM-DD
  start_minute: number | null;
  end_minute: number | null;
  kind: 'block' | 'open';
  type_id: string | null;
  note: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  priest_id: string;
  congregant_id: string;
  type_id: string | null;
  type_label: string;
  starts_at: string;
  duration_minutes: number;
  status: 'requested' | 'confirmed' | 'declined' | 'cancelled';
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ── Master switch ───────────────────────────────────────────
export async function getSchedulingOpen(priestId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('scheduling_open').eq('id', priestId).single();
  return !!(data as any)?.scheduling_open;
}

export async function setSchedulingOpen(priestId: string, open: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update({ scheduling_open: open }).eq('id', priestId);
  return { error: error?.message ?? null };
}

// ── Booking mode ────────────────────────────────────────────
// Where this priest's members book him — the app's own scheduler or his
// Calendly page. Deliberately one or the other, never both: two live booking
// systems meant double-bookings. Reads default to 'app' so a database without
// the 20260829 column behaves exactly as before.
export type SchedulingMode = 'app' | 'calendly';

export async function getSchedulingMode(priestId: string): Promise<SchedulingMode> {
  const { data } = await supabase.from('profiles').select('scheduling_mode').eq('id', priestId).single();
  return (data as any)?.scheduling_mode === 'calendly' ? 'calendly' : 'app';
}

export async function setSchedulingMode(priestId: string, mode: SchedulingMode): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update({ scheduling_mode: mode }).eq('id', priestId);
  return { error: error?.message ?? null };
}

// ── Calendly link ───────────────────────────────────────────
// Queried on its own rather than folded into getFocProfile, so a database that
// doesn't have the column yet (migration not applied) fails only this call —
// the member still sees the priest's name and the in-app slots.
export async function getCalendlyUrl(priestId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('calendly_url').eq('id', priestId).single();
  return (data as any)?.calendly_url ?? null;
}

export async function setCalendlyUrl(priestId: string, url: string | null): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update({ calendly_url: url }).eq('id', priestId);
  return { error: error?.message ?? null };
}

// ── Appointment types ───────────────────────────────────────
export async function getAppointmentTypes(priestId: string): Promise<AppointmentType[]> {
  const { data } = await supabase
    .from('appointment_types')
    .select('id, priest_id, label, duration_minutes, active, sort, created_at')
    .eq('priest_id', priestId)
    .order('sort')
    .order('created_at');
  return data ?? [];
}

export async function createAppointmentType(
  priestId: string,
  fields: { label: string; duration_minutes: number; sort?: number },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('appointment_types').insert({
    priest_id: priestId,
    label: fields.label,
    duration_minutes: fields.duration_minutes,
    sort: fields.sort ?? 0,
  });
  return { error: error?.message ?? null };
}

export async function updateAppointmentType(
  id: string,
  patch: Partial<Pick<AppointmentType, 'label' | 'duration_minutes' | 'active' | 'sort'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('appointment_types').update(patch).eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteAppointmentType(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('appointment_types').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// ── Availability rules ──────────────────────────────────────
export async function getAvailabilityRules(priestId: string): Promise<AvailabilityRuleRow[]> {
  const { data } = await supabase
    .from('availability_rules')
    .select('id, priest_id, type_id, weekday, start_minute, end_minute, active, created_at')
    .eq('priest_id', priestId)
    .order('weekday')
    .order('start_minute');
  return data ?? [];
}

export async function createAvailabilityRule(
  priestId: string,
  fields: { type_id: string; weekday: number; start_minute: number; end_minute: number },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('availability_rules').insert({ priest_id: priestId, ...fields });
  return { error: error?.message ?? null };
}

export async function updateAvailabilityRule(
  id: string,
  patch: Partial<Pick<AvailabilityRuleRow, 'weekday' | 'start_minute' | 'end_minute' | 'active' | 'type_id'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('availability_rules').update(patch).eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteAvailabilityRule(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('availability_rules').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// ── Date-specific exceptions ────────────────────────────────
// One-off closures over the recurring rules. Read by the priest for his own
// calendar and by a consented member, whose client subtracts them when
// generating slots. Past dates are left out — they can't be booked anyway.
export async function getAvailabilityExceptions(
  priestId: string,
  fromDate = new Date(),
): Promise<AvailabilityException[]> {
  const p = (n: number) => String(n).padStart(2, '0');
  const from = `${fromDate.getFullYear()}-${p(fromDate.getMonth() + 1)}-${p(fromDate.getDate())}`;
  const { data } = await supabase
    .from('availability_exceptions')
    .select('id, priest_id, on_date, start_minute, end_minute, kind, type_id, note, created_at')
    .eq('priest_id', priestId)
    .gte('on_date', from)
    .order('on_date')
    .order('start_minute', { nullsFirst: true });
  return (data as AvailabilityException[]) ?? [];
}

export async function createAvailabilityException(
  priestId: string,
  fields: { on_date: string; start_minute?: number | null; end_minute?: number | null; note?: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('availability_exceptions').insert({
    priest_id: priestId,
    on_date: fields.on_date,
    start_minute: fields.start_minute ?? null,
    end_minute: fields.end_minute ?? null,
    kind: 'block',
    note: fields.note?.trim() || null,
  });
  return { error: error?.message ?? null };
}

// Extra hours on one date, over and above the weekly pattern.
export async function createExtraHours(
  priestId: string,
  fields: { on_date: string; type_id: string; start_minute: number; end_minute: number; note?: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('availability_exceptions').insert({
    priest_id: priestId,
    on_date: fields.on_date,
    start_minute: fields.start_minute,
    end_minute: fields.end_minute,
    kind: 'open',
    type_id: fields.type_id,
    note: fields.note?.trim() || null,
  });
  return { error: error?.message ?? null };
}

export async function deleteAvailabilityException(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('availability_exceptions').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// Every CLOSURE on a date, removed at once — what "reopen this day" does. Extra
// hours are left alone: they are not what makes a day closed, and removing them
// silently would throw away separate work.
export async function clearAvailabilityExceptions(priestId: string, onDate: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('availability_exceptions')
    .delete()
    .eq('priest_id', priestId)
    .eq('on_date', onDate)
    .eq('kind', 'block');
  return { error: error?.message ?? null };
}

// Just the part-day closures on a date. Closing the whole day supersedes them,
// but the all-day row is inserted FIRST and these are cleared after, so a failed
// insert can't leave the day with nothing on it at all. Scoped to 'block' — an
// extra-hours row also carries minutes and must survive.
export async function clearPartialExceptions(priestId: string, onDate: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('availability_exceptions')
    .delete()
    .eq('priest_id', priestId)
    .eq('on_date', onDate)
    .eq('kind', 'block')
    .not('start_minute', 'is', null);
  return { error: error?.message ?? null };
}

// ── Appointments ────────────────────────────────────────────
export async function getPriestAppointments(priestId: string): Promise<Appointment[]> {
  const { data } = await supabase
    .from('appointments')
    .select('*')
    .eq('priest_id', priestId)
    .order('starts_at');
  return (data as Appointment[]) ?? [];
}

export async function getMyAppointments(userId: string): Promise<Appointment[]> {
  const { data } = await supabase
    .from('appointments')
    .select('*')
    .eq('congregant_id', userId)
    .order('starts_at');
  return (data as Appointment[]) ?? [];
}

export async function requestAppointment(
  typeId: string,
  startsAtIso: string,
  note?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('request_appointment', {
    p_type_id: typeId,
    p_starts_at: startsAtIso,
    p_note: note ?? null,
  });
  return { error: error?.message ?? null };
}

export async function respondAppointment(id: string, confirm: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('respond_appointment', { p_appointment_id: id, p_confirm: confirm });
  return { error: error?.message ?? null };
}

export async function cancelAppointment(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cancel_appointment', { p_appointment_id: id });
  return { error: error?.message ?? null };
}

export async function getFocBusyRanges(days = SCHEDULE_HORIZON_DAYS): Promise<{ starts_at: string; duration_minutes: number }[]> {
  const { data } = await supabase.rpc('foc_busy_ranges', { p_days: days });
  return (data as { starts_at: string; duration_minutes: number }[]) ?? [];
}
