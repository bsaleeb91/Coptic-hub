// supabase/functions/delete-account/index.ts
// Deletes the CALLER's own account: their photos in storage, then their auth
// user. Deleting the auth user cascades to profiles and everything keyed to it;
// what a priest keeps about a deleted member is decided by the foreign keys
// (20261014050000_account_deletion_keeps_pastoral_records.sql), not here.
//
// Runs with the service role because only it can delete an auth user. That
// makes the identity check the whole of its safety:
//   - the platform's JWT gate accepts the ANON key, which ships in the app, so
//     it proves nothing on its own;
//   - the caller's token is therefore resolved through /auth/v1/user, and only
//     the user it names is ever deleted — no user id is read from the request.
// The body must also carry { confirm: "DELETE" }, so a stray call from a
// signed-in client can't delete anyone by accident.
//
// Same style as push-worker: plain fetch, no supabase-js.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET = 'avatars';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const service = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

// Photo paths inside the bucket from a stored public URL
// (".../object/public/avatars/<path>?v=123" -> "<path>").
function pathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i < 0 ? null : url.slice(i + marker.length).split('?')[0];
}

async function photoPaths(userId: string): Promise<string[]> {
  const paths = new Set<string>([`self/${userId}.jpg`]);

  // Photos this user took of their flock/class, and photos others took of them.
  const rows = await fetch(
    `${SUPABASE_URL}/rest/v1/member_photos?select=url&or=(subject_id.eq.${userId},owner_id.eq.${userId})`,
    { headers: service },
  );
  if (rows.ok) {
    for (const r of await rows.json() as { url: string }[]) {
      const p = pathFromUrl(r.url);
      if (p) paths.add(p);
    }
  }

  // Anything left under their own flock/ prefix without a row.
  const listed = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...service, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: `flock/${userId}/`, limit: 1000 }),
  });
  if (listed.ok) {
    for (const o of await listed.json() as { name: string }[]) paths.add(`flock/${userId}/${o.name}`);
  }
  return [...paths];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });

  const auth = req.headers.get('Authorization') ?? '';
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: auth } });
  if (!who.ok) return reply(401, { error: 'Sign in again, then try deleting your account.' });
  const user = await who.json() as { id?: string };
  if (!user.id) return reply(401, { error: 'Sign in again, then try deleting your account.' });

  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  if (body.confirm !== 'DELETE') return reply(400, { error: 'Confirmation missing.' });

  // Photos first: the member_photos rows that point at them go with the user.
  const paths = await photoPaths(user.id);
  if (paths.length) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: { ...service, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: paths }),
    });
  }

  const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: service });
  if (!del.ok) {
    const detail = await del.text();
    console.error('delete-account: auth delete failed', user.id, del.status, detail);
    return reply(500, { error: "Your account couldn't be deleted. Nothing was removed except photos — please try again." });
  }
  return reply(200, { deleted: true });
});
