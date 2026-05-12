/**
 * lib/utils/is-bot.ts
 *
 * Détection basée sur User-Agent des principaux bots / crawlers / health checks
 * pour exclure leurs visites des compteurs analytics (nb_vues pronostics, etc.).
 *
 * Pourquoi : sans filtre, ~50-70% des "vues" en BDD sont en réalité des bots
 * (Googlebot, Bingbot, scrapers concurrents, OpenGraph crawlers Facebook/WhatsApp,
 * health checks Cloudflare). Cela biaise les stats et empêche le pilotage produit.
 *
 * Liste maintenue à jour avec les principaux bots impactant un site PMU
 * francophone. Pour les bots exotiques rares, on accepte un faux négatif minime.
 */

// Liste regex compilée 1× pour performance. Les patterns sont en lowercase,
// l'appelant doit passer le UA déjà mis en minuscules.
const BOT_PATTERNS = [
  // Moteurs de recherche
  /googlebot/i,
  /bingbot/i,
  /slurp/i,                 // Yahoo
  /duckduckbot/i,           // DuckDuckGo
  /yandex/i,                // Yandex
  /baiduspider/i,           // Baidu
  /qwant/i,                 // Qwant (FR)

  // Réseaux sociaux & messageries (OpenGraph crawlers)
  /facebookexternalhit/i,   // Facebook
  /facebot/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,              // WhatsApp link preview
  /telegrambot/i,
  /slackbot/i,
  /discord(bot|app)/i,
  /pinterest/i,

  // SEO / analytics crawlers
  /ahrefsbot/i,
  /semrushbot/i,
  /mj12bot/i,
  /dotbot/i,
  /screaming\s?frog/i,
  /serpstat/i,

  // Monitoring / uptime
  /uptimerobot/i,
  /pingdom/i,
  /statuscake/i,
  /better\s?uptime/i,
  /cloudflare/i,            // CF health checks (peut filtrer trop large mais OK)

  // Génériques
  /bot\b/i,                 // catch-all "*bot*" mais avec word boundary pour éviter false positive
  /crawler/i,
  /spider/i,
  /scraper/i,
  /headlesschrome/i,        // Puppeteer / Playwright headless
  /phantom/i,               // PhantomJS
  /lighthouse/i,            // Google Lighthouse audits

  // Spécifiques Elite Turf (à filtrer car nos propres outils)
  /elite-turf-monitor/i,    // nom custom si on en a un un jour
];

/**
 * Retourne true si le User-Agent passé correspond à un bot/crawler/health check.
 *
 * @param userAgent  Valeur brute du header User-Agent (peut être null/undefined)
 * @returns boolean — true si bot, false si humain probable
 *
 * @example
 *   const ua = headers().get("user-agent");
 *   if (!isBot(ua)) {
 *     // incrémenter compteur, log analytics, etc.
 *   }
 */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) {
    // Sans UA = probablement bot mal configuré. On filtre par défaut.
    return true;
  }
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some((rx) => rx.test(ua));
}
