// Shepherd-set member photos (member_photos table).
//
// A priest or servant can attach a photo to a member of their flock/class who
// has no self-set picture. RLS is owner-only: each shepherd sees and manages
// only the photos THEY set, and the member has no read path at all — the
// photo never appears in the member's own account. The member's own picture
// lives on profiles.avatar_url instead (see lib/avatar.ts for upload paths).
import { supabase } from '../supabase';

export interface MemberPhoto {
  subject_id: string;
  owner_id: string;
  url: string;
  updated_at: string;
}

// All photos this shepherd has set, as subject_id → url.
export async function getMyMemberPhotos(ownerId: string): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('member_photos')
    .select('subject_id, url')
    .eq('owner_id', ownerId);
  return Object.fromEntries((data ?? []).map(r => [r.subject_id, r.url]));
}

export async function getMemberPhoto(ownerId: string, subjectId: string): Promise<string | null> {
  const { data } = await supabase
    .from('member_photos')
    .select('url')
    .eq('owner_id', ownerId)
    .eq('subject_id', subjectId)
    .maybeSingle();
  return (data as any)?.url ?? null;
}

export async function upsertMemberPhoto(
  ownerId: string,
  subjectId: string,
  url: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('member_photos')
    .upsert(
      { subject_id: subjectId, owner_id: ownerId, url, updated_at: new Date().toISOString() },
      { onConflict: 'subject_id,owner_id' },
    );
  return { error: error?.message ?? null };
}

export async function deleteMemberPhoto(ownerId: string, subjectId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('member_photos')
    .delete()
    .eq('owner_id', ownerId)
    .eq('subject_id', subjectId);
  return { error: error?.message ?? null };
}
