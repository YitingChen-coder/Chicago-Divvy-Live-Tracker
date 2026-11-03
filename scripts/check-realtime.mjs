// End-to-end Realtime check: signs in a throwaway Clerk user, subscribes to
// station_status and worker_runs the way the page does, and waits for the
// worker to push changes. Deletes the user at the end.
// Run: npm run check:realtime  (reads .env.local)
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(fs.readFileSync(process.argv[2], "utf8").split("\n")
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const clerk = (path, body, method = "POST") => fetch(`https://api.clerk.com/v1${path}`, {
  method, headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
  body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());

const user = await clerk("/users", { email_address: [`divvy-rt-${Date.now()}+clerk_test@example.com`], password: crypto.randomUUID() + "Aa1!", skip_password_checks: true });
const session = await clerk("/sessions", { user_id: user.id });
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  accessToken: async () => (await clerk(`/sessions/${session.id}/tokens`, {})).jwt,
});

const t0 = Date.now();
const s = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
let statusEvents = 0, runEvents = 0;
const done = new Promise((resolve) => {
  db.channel("check-status")
    .on("postgres_changes", { event: "*", schema: "public", table: "station_status" }, (p) => {
      statusEvents++;
      if (statusEvents <= 3) console.log(`${s()} station_status ${p.eventType}: ${p.new.station_id.slice(0, 12)}… bikes=${p.new.bikes_available} docks=${p.new.docks_available}`);
    })
    .subscribe((st) => console.log(`${s()} station_status channel: ${st}`));
  db.channel("check-runs")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "worker_runs" }, (p) => {
      runEvents++;
      console.log(`${s()} worker_runs INSERT: ok=${p.new.ok} rows_changed=${p.new.rows_changed}`);
      if (runEvents >= 2) resolve();
    })
    .subscribe((st) => console.log(`${s()} worker_runs channel: ${st}`));
  setTimeout(resolve, 80_000);
});
await done;
console.log(`RESULT: ${runEvents} run events, ${statusEvents} station_status events in ${s()}`);
await db.removeAllChannels();
await clerk(`/users/${user.id}`, null, "DELETE");
console.log("test user deleted");
process.exit(runEvents > 0 && statusEvents > 0 ? 0 : 1);
