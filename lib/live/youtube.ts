/**
 * lib/live/youtube.ts
 *
 * Extrait l'ID d'une vidéo YouTube depuis une URL (watch, youtu.be, embed,
 * shorts) ou un ID brut. Pur, testable. Sert à la curation admin des replays
 * OFFICIELS : on stocke l'ID, on affiche via l'embed YouTube standard (autorisé).
 */

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (YT_ID.test(s)) return s; // déjà un ID brut

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null; // pas une URL valide
  }

  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.split("/").filter(Boolean)[0] ?? "";
    return YT_ID.test(id) ? id : null;
  }

  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const v = u.searchParams.get("v");
    if (v && YT_ID.test(v)) return v; // /watch?v=ID
    const last = u.pathname.split("/").filter(Boolean).pop() ?? ""; // /embed/ID, /shorts/ID
    if (YT_ID.test(last)) return last;
  }

  return null;
}
