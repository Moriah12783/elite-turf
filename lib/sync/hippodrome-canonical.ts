/**
 * Cle canonique d'un nom d'hippodrome, robuste aux variations de source
 * (accents, casse, tirets/espaces, entites HTML). Sert a rapprocher un
 * hippodrome LONACI d'un hippodrome Geny EXISTANT — sans jamais en creer.
 *
 *   "SAINT-CLOUD" = "Saint-Cloud"           -> "saintcloud"
 *   "La Teste De Buch" = "La Teste-de-Buch" -> "latestedebuch"
 *   "Chateaubriant" = "CHATEAUBRIANT"       -> "chateaubriant"
 *   "Le Lion-d&#039;Angers"                 -> "leliondangers"
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&#0*39;/g, "'")
    .replace(/&#0*34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

// Retire les diacritiques combinants (U+0300..U+036F) apparus apres normalize("NFD").
// Filtrage par code-point pour eviter tout litteral de caractere combinant en source.
function stripCombining(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x0300 && c <= 0x036f) continue;
    out += ch;
  }
  return out;
}

export function canonicalHippodrome(name: string): string {
  return stripCombining(decodeEntities(name ?? "").normalize("NFD"))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // ne garde que [a-z0-9]
}
