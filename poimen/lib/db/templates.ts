// Priest canon templates — named, reusable snapshots of the assign-canon
// editor. Private to the priest who wrote them (see the 20260811 migration);
// they are a drafting aid and never part of any member's canon.
import { supabase } from '../supabase';

export interface CanonTemplateRow {
  id: string;
  priest_id: string;
  name: string;
  body: any;
  created_at: string;
  updated_at: string;
}

export async function getCanonTemplates(priestId: string): Promise<CanonTemplateRow[]> {
  const { data } = await supabase
    .from('canon_templates')
    .select('id, priest_id, name, body, created_at, updated_at')
    .eq('priest_id', priestId)
    .order('created_at', { ascending: false });
  return (data as CanonTemplateRow[]) ?? [];
}

export async function createCanonTemplate(
  priestId: string,
  name: string,
  body: any,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('canon_templates')
    .insert({ priest_id: priestId, name: name.trim(), body });
  return { error: error?.message ?? null };
}

// Overwrite an existing template's contents — "update this one" rather than
// accumulating near-identical copies.
export async function updateCanonTemplate(
  id: string,
  patch: { name?: string; body?: any },
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('canon_templates')
    .update({ ...patch, ...(patch.name ? { name: patch.name.trim() } : {}), updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteCanonTemplate(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('canon_templates').delete().eq('id', id);
  return { error: error?.message ?? null };
}
