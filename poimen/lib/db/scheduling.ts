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
