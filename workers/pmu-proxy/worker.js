/**
 * PMU Proxy Worker — Elite Turf
 * Contourne le blocage IP de Vercel/AWS en proxifiant les requêtes PMU
 * depuis l'infrastructure Cloudflare avec headers navigateur complets.
 *
 * Stratégie multi-endpoints :
 *  1. turfinfo.api.pmu.fr (API publique PMU OpenData — sans "online")
 *  2. online.turfinfo.api.pmu.fr client/61 (navigateur PMU.fr)
 *  3. online.turfinfo.api.pmu.fr client/7  (mobile PMU)
 *  4. online.turfinfo.api.pmu.fr client/1  (legacy)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Cookies réalistes simulant une session navigateur PMU.fr
const PMU_COOKIE =
  "_ga=GA1.1.1234567890.1700000000; _gid=GA1.1.0987654321.1700000000; didomi_token=eyJ1c2VySWQiOiJlbGl0ZXR1cmYiLCJjcmVhdGVkIjoiMjAyNi0wMS0wMVQwMDowMDowMC4wMDBaIiwidXBkYXRlZCI6IjIwMjYtMDEtMDFUMDA6MDA6MDAuMDAwWiIsInZlcnNpb24iOjIsInB1cnBvc2VzIjp7ImVuYWJsZWQiOlsiZ29vZ2xlIiwiYW5hbHl0aWNzIiwibWVhc3VyZW1lbnQiXX0sInZlbmRvcnMiOnsiZW5hYmxlZCI6W119fQ==";

const BROWSER_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  Cookie: PMU_COOKIE,
  Origin: "https://www.pmu.fr",
  Pragma: "no-cache",
  Referer: "https://www.pmu.fr/turf/programme-du-jour.html",
  "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

async function tryFetch(url) {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    const text = await res.text();
    return { status: res.status, text, ok: res.ok };
  } catch (e) {
    return { status: 0, text: e.message, ok: false };
  }
}

export default {
  async fetch(request) {
    // OPTIONS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const pmuPath = url.pathname + url.search;

    // Stratégie : essayer plusieurs bases d'URL dans l'ordre
    const bases = [
      // 1. API publique PMU OpenData (sans "online") — souvent non bloquée
      "https://turfinfo.api.pmu.fr",
      // 2. Site PMU — client navigateur web (61)
      "https://online.turfinfo.api.pmu.fr",
    ];

    // Extraire le numéro de client du path et l'adapter selon la base
    // Ex: /rest/client/1/programmeComplet/... → on teste plusieurs clients
    const pathWithoutClient = pmuPath.replace(/\/rest\/client\/\d+\//, "/rest/client/{C}/");

    const clientNums = ["1", "61", "7", "2"];

    let lastStatus = 0;
    let lastBody = "";

    for (const base of bases) {
      for (const clientNum of clientNums) {
        const finalPath = pathWithoutClient.replace("{C}", clientNum);
        const targetUrl = `${base}${finalPath}`;

        const result = await tryFetch(targetUrl);

        if (result.ok && result.text.length > 10) {
          // Vérifie que c'est du JSON valide avec des données
          try {
            const json = JSON.parse(result.text);
            // Succès seulement si on a des réunions ou des partants
            const hasData =
              json?.programme?.reunions?.length > 0 ||
              json?.reunions?.length > 0 ||
              json?.participants?.length > 0 ||
              json?.partants?.length > 0 ||
              json?.resultats != null ||
              json?.arrivee?.length > 0;

            if (hasData) {
              console.log(`[PMU Proxy] Succès: ${targetUrl}`);
              return new Response(result.text, {
                status: 200,
                headers: {
                  ...CORS_HEADERS,
                  "Content-Type": "application/json",
                  "X-Proxy-Source": targetUrl,
                },
              });
            }
          } catch {
            // Pas du JSON valide, continuer
          }
        }

        lastStatus = result.status;
        lastBody = result.text.slice(0, 300);

        // Petite pause pour éviter de spammer PMU
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Tous les endpoints ont échoué
    console.error(`[PMU Proxy] Tous les endpoints ont échoué. Dernier status: ${lastStatus}`);
    return new Response(
      JSON.stringify({
        error: `PMU Proxy: tous les endpoints ont échoué`,
        lastStatus,
        lastBody,
      }),
      {
        status: lastStatus || 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  },
};
