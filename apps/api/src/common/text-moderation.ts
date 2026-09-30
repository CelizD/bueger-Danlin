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

function collapseRepeatedLetters(value: string) {
  let result = "";

  for (const character of value) {
    if (result.at(-1) !== character) {
      result += character;
    }
  }

  return result;
}

const FORBIDDEN_MATCH_TERMS =
  FORBIDDEN_DISPLAY_TERMS.map(collapseRepeatedLetters);

function isAsciiLetter(character: string | undefined) {
  return (
    character !== undefined &&
    character >= "a" &&
    character <= "z"
  );
}

function matchesObfuscatedTerm(
  value: string,
  term: string,
) {
  for (let start = 0; start < value.length; start += 1) {
    if (value[start] !== term[0]) {
      continue;
    }

    if (start > 0 && isAsciiLetter(value[start - 1])) {
      continue;
    }

    let cursor = start;
    let termIndex = 0;

    while (termIndex < term.length) {
      const expected = term[termIndex];

      if (value[cursor] !== expected) {
        break;
      }

      while (value[cursor] === expected) {
        cursor += 1;
      }

      termIndex += 1;

      if (termIndex === term.length) {
        if (!isAsciiLetter(value[cursor])) {
          return true;
        }

        break;
      }

      while (
        cursor < value.length &&
        !isAsciiLetter(value[cursor])
      ) {
        cursor += 1;
      }
    }
  }

  return false;
}

export function containsForbiddenDisplayLanguage(
  value: string,
) {
  const normalized = normalizeForModeration(value);

  return FORBIDDEN_MATCH_TERMS.some((term) =>
    matchesObfuscatedTerm(normalized, term),
  );
}
