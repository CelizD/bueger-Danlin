const FORBIDDEN_DISPLAY_TERMS = [
  "puta",
  "puto",
  "pendeja",
  "pendejo",
  "pinche",
  "mierda",
  "culera",
  "culero",
  "cabrona",
  "cabron",
  "verga",
  "chingada",
  "chingado",
  "chingar",
  "mamada",
  "mamon",
  "mamona",
  "joder",
  "cono",
  "gilipollas",
  "maricon",
  "idiota",
  "imbecil",
  "estupida",
  "estupido",
  "fuck",
  "fucking",
  "shit",
  "bitch",
  "asshole",
  "motherfucker",
  "cunt",
] as const;

const LOOKALIKE_CHARACTERS: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "$": "s",
  "!": "i",
  "а": "a",
  "е": "e",
  "о": "o",
  "р": "p",
  "с": "c",
  "х": "x",
  "α": "a",
  "ε": "e",
  "ο": "o",
  "ρ": "p",
  "υ": "u",
};

function normalizeForModeration(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/\p{Cf}+/gu, "")
    .toLowerCase()
    .replace(
      /[013456789@$!аеорсхαεορυ]/gu,
      (character) =>
        LOOKALIKE_CHARACTERS[character] ?? character,
    );
}

function termPattern(term: string) {
  const letters = [...term]
    .map((letter) => `${letter}+`)
    .join("[^a-z]*");

  return new RegExp(
    `(?:^|[^a-z])${letters}(?=$|[^a-z])`,
    "i",
  );
}

const FORBIDDEN_PATTERNS =
  FORBIDDEN_DISPLAY_TERMS.map(termPattern);

export function containsForbiddenDisplayLanguage(
  value: string,
) {
  const normalized = normalizeForModeration(value);

  return FORBIDDEN_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}
