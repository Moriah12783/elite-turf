/**
 * scripts/genybet-health-cli.ts
 *
 * Health-check GenyBet → alimente la ligne « Source GenyBet » du monitoring
 * admin. Vérifie que genybet.fr sert bien le programme (jour + J+1) et
 * journalise dans `cron_logs` (cron_name="genybet-health") avec le nb de
 * courses/arrivées vues.
 *
 * Tourne sur GitHub Actions (IP Azure) : le Worker Cloudflare est
 * probablement bloqué par GenyBet comme il l'est par geny.com.
 *
 * Env requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { fetchGenybetHtml, toGenybetDate, parseGenybetReunions } from "@/lib/sync/genybet-programme";
import { parseGenybetArrivees } from "@/lib/sync/genybet-arrivees";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Date Paris (YYYY-MM-DD) décalée de `offsetDays`. */
function parisDate(offsetDays: number): string {
  const todayParis = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const d = new Date(`${todayParis}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

async function main(): Promise<void> {
  const start = Date.now();
  const today = parisDate(0);
  const j1 = parisDate(1);

  let status: "success" | "failure" = "failure";
  const details: Record<string, unknown> = {};

  try {
    const htmlToday = await fetchGenybetHtml(`https://www.genybet.fr/reunions/${toGenybetDate(today)}`);
    details.jour_courses = parseGenybetReunions(htmlToday, today).length;
    details.jour_arrivees = parseGenybetArrivees(htmlToday).size;

    const htmlJ1 = await fetchGenybetHtml(`https://www.genybet.fr/reunions/${toGenybetDate(j1)}`);
    details.j1_courses = parseGenybetReunions(htmlJ1, j1).length;

    status = (details.jour_courses as number) > 0 ? "success" : "failure";
    if (status === "failure") details.error = "0 course jour parsée";
  } catch (e) {
    details.error = e instanceof Error ? e.message : String(e);
  }

  const duration_ms = Date.now() - start;
  try {
    await supabase.from("cron_logs").insert({ cron_name: "genybet-health", status, details, duration_ms });
  } catch (e) {
    console.error("❌ insert cron_logs KO :", e instanceof Error ? e.message : String(e));
  }

  console.log(`GenyBet health : ${status}`, details);
  if (status === "failure") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
