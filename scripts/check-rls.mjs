// End-to-end check: Clerk test user -> session token -> Supabase RLS. Deletes the user at the end.
// Run: npm run check:rls  (reads .env.local)
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(process.argv[2], "utf8").split("\n")
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const clerk = (path, body, method = "POST") => fetch(`https://api.clerk.com/v1${path}`, {
  method, headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
  body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
const sb = (path, token, opts = {}) => fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
  ...opts, headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`,
  "Content-Type": "application/json", Prefer: "return=representation", ...(opts.headers || {}) } })
  .then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 200) }));

const u = await clerk("/users", { email_address: [`divvy-rls-${Date.now()}+clerk_test@example.com`], password: crypto.randomUUID() + "Aa1!", skip_password_checks: true });
console.log("create user:", u.status, u.json?.errors?.[0]?.message ?? "");
if (!u.json?.id) process.exit(1);
try {
  const s = await clerk("/sessions", { user_id: u.json.id });
  console.log("create session:", s.status, s.json?.errors?.[0]?.message ?? "");
  const t = await clerk(`/sessions/${s.json.id}/tokens`, {});
  console.log("get token:", t.status);
  const jwt = t.json.jwt;
  const claims = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
  console.log("token has role claim:", claims.role ?? "(none)");
  console.log("read stations:", (await sb("stations?select=name&limit=1", jwt)));
  const st = JSON.parse((await sb("stations?select=station_id&limit=1", jwt)).body || "[]")[0]?.station_id;
  console.log("add follow:", await sb("follows", jwt, { method: "POST", body: JSON.stringify({ station_id: st }) }));
  console.log("read own follows:", await sb("follows?select=user_id,station_id", jwt));
  console.log("anon read (should be blocked):", await sb("follows?select=*", env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
  console.log("remove follow:", (await sb(`follows?station_id=eq.${st}`, jwt, { method: "DELETE" })).status);
} finally {
  console.log("delete test user:", (await clerk(`/users/${u.json.id}`, null, "DELETE")).status);
}
