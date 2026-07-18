-- Assigned-canon categories & structured payload
-- --------------------------------------------------------------------------
-- Lets a priest build a member's *personal rule* from the member detail view.
-- Each assigned row now names the canon category it addresses and carries a
-- structured payload for that category, so the member's Canon merges the
-- priest-assigned parts (read-only) over their own self-set rule.
--
-- category values:
--   'prostrations' | 'quiet' | 'fasting' | 'bible' | 'book' | 'confession'
--   | 'agpeya_hours' | 'services' | 'heart_of_service' | 'custom'
-- A null category (older rows) is treated as a free-text 'custom' component.
--
-- payload examples (jsonb), by category:
--   prostrations      {"count": 25}
--   quiet             {"minutes": 15}
--   fasting           {"until": "3:00 PM"}
--   bible             {"mode": "chapters", "amount": 2}
--   book              {"title": "The Spiritual Ladder", "mode": "chapters", "amount": 1}
--   confession        {"frequency": "Monthly"}
--   agpeya_hours      {"days": {"0": ["prime","vespers"], "3": ["compline"]}}
--   services          {"days": {"0": ["liturgy"]}}
--   heart_of_service  {"days": {"2": [{"text": "Sunday school", "freq": "Weekly"}]}}
--   custom            null   (the free-text lives in `component`)
--
-- Locking is computed on the client, not stored: an active assigned row is
-- read-only for the member until they confess after it was assigned
-- (last_confession_at >= created_at) or the priest deactivates it. Existing
-- RLS already covers this feature — priest inserts/updates their own
-- assignments, the congregant reads their own — so no policy changes here.
--
-- At the member's next confession the app folds the just-unlocked parts into
-- their own personal rule (agent_progress 'personal-rule'); the assigned rows
-- stay active but no longer lock (they're ignored once unlocked). If you'd
-- rather the member's app also mark them consumed, add a congregant-scoped
-- update policy, e.g.:
--   create policy "Congregant deactivates own canons" on public.spiritual_canons
--     for update using (congregant_id = auth.uid());
-- (optional — the feature works without it).

alter table public.spiritual_canons
  add column if not exists category text,
  add column if not exists payload  jsonb;

comment on column public.spiritual_canons.category is
  'Canon category this assignment addresses (null = free-text custom component).';
comment on column public.spiritual_canons.payload is
  'Structured value for the category; null for custom (text is in component).';
