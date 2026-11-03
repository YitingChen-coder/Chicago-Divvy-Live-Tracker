-- The worker calls this to check the x-worker-secret header against Vault,
-- so the secret never lives in code or in the function's settings.
create function public.check_worker_secret(candidate text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(candidate, '') <> '' and exists (
    select 1 from vault.decrypted_secrets
    where name = 'worker_secret' and decrypted_secret = candidate
  );
$$;
revoke execute on function public.check_worker_secret(text) from public, anon, authenticated;
grant execute on function public.check_worker_secret(text) to service_role;
