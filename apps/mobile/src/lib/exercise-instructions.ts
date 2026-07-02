export type ParsedInstructions = {
  startingPosition?: string;
  steps: string[];
  tips?: string;
};

const SECTION_HEADERS = [
  { key: "starting" as const, pattern: /^starting position:?$/i },
  { key: "steps" as const, pattern: /^steps?:?$/i },
  { key: "tips" as const, pattern: /^tips?:?$/i },
  { key: "cues" as const, pattern: /^cues?:?$/i },
  { key: "notes" as const, pattern: /^notes?:?$/i },
];

export function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<li>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanStepLine(line: string): string {
  return line
    .replace(/^\s*[-•*]\s+/, "")
    .replace(/^\s*\d+[\.\):\-]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoSteps(block: string): string[] {
  const lines = block
    .split(/\n+/)
    .map(cleanStepLine)
    .filter(Boolean);

  if (lines.length > 1) return lines;

  const single = lines[0] ?? block.trim();
  if (!single) return [];

  const numberedParts = single
    .split(/(?=\s*\d+[\.\)]\s+)/)
    .map(cleanStepLine)
    .filter(Boolean);

  if (numberedParts.length > 1) return numberedParts;

  const sentences = single
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);

  return sentences.length > 1 ? sentences : [single];
}

function parseSections(body: string): ParsedInstructions {
  const lines = body.split("\n").map((line) => line.trim());
  const sections: Array<{ key: string; lines: string[] }> = [];
  let current: { key: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (!line) continue;
    const header = SECTION_HEADERS.find((item) => item.pattern.test(line));
    if (header) {
      current = { key: header.key, lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { key: "body", lines: [] };
      sections.push(current);
    }
    current.lines.push(line);
  }

  const starting = sections.find((s) => s.key === "starting")?.lines.join(" ").trim();
  const tips =
    sections.find((s) => s.key === "tips" || s.key === "cues" || s.key === "notes")?.lines.join(" ").trim();
  const stepsBlock = sections.find((s) => s.key === "steps")?.lines.join("\n");
  const steps = stepsBlock ? splitIntoSteps(stepsBlock) : [];

  if (steps.length > 0 || starting || tips) {
    return {
      startingPosition: starting || undefined,
      steps,
      tips: tips || undefined,
    };
  }

  const bodyBlock = sections.flatMap((s) => s.lines).join("\n");
  return { steps: splitIntoSteps(bodyBlock) };
}

export function parseExerciseInstructions(raw: string | null | undefined): ParsedInstructions | null {
  if (!raw?.trim()) return null;
  const body = stripHtml(raw);
  if (!body) return null;

  const parsed = parseSections(body);
  if (parsed.steps.length === 0 && !parsed.startingPosition && !parsed.tips) {
    return { steps: [body] };
  }

  if (parsed.startingPosition && parsed.steps.length === 0) {
    return { ...parsed, steps: [parsed.startingPosition] };
  }

  return parsed;
}
