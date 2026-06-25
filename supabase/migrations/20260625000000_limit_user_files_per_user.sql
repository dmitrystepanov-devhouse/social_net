-- Hard limit: at most 30 files per user (server-side guard, complements the
-- client-side check in src/pages/MyFiles.jsx).
--
-- Why 30:
--   * Use case — "Мои файлы" is personal document storage (Word/PDF/Excel/
--     PowerPoint/ZIP). 30 documents comfortably covers a realistic personal
--     collection without feeling restrictive.
--   * Shared storage — the Supabase free tier shares ~1 GB of Storage across
--     ALL users. Typical office documents are a few MB, so 30 files ≈ tens to a
--     few hundred MB per user, keeping several active users within the free
--     quota. The existing per-file 100 MB cap (user_files.file_size CHECK) stays
--     the hard guard against a single oversized file.
--   * Performance — loadFiles() fetches a user's files in one query and the UI
--     renders a flat, unpaginated list; 30 keeps that query and render light.

create or replace function public.enforce_user_files_limit()
returns trigger
language plpgsql
as $$
declare
  file_count integer;
begin
  select count(*) into file_count
  from public.user_files
  where user_id = new.user_id;

  if file_count >= 30 then
    raise exception 'Лимит файлов исчерпан: не более 30 файлов на пользователя'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_user_files_limit on public.user_files;
create trigger trg_enforce_user_files_limit
  before insert on public.user_files
  for each row execute function public.enforce_user_files_limit();
