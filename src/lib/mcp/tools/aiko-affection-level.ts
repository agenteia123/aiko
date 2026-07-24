import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const TITLES: { min: number; title: string }[] = [
  { min: 15, title: "Enamorada" },
  { min: 10, title: "Devota" },
  { min: 6, title: "Cariñosa" },
  { min: 3, title: "Amistosa" },
  { min: 1, title: "Curiosa" },
];

export default defineTool({
  name: "aiko_affection_title",
  title: "Aiko affection title",
  description:
    "Given an affection level (1+), return Aiko's title at that level (Curiosa, Amistosa, Cariñosa, Devota, Enamorada).",
  inputSchema: {
    level: z.number().int().min(1).describe("Affection level (integer, 1 or greater)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ level }) => {
    const title = TITLES.find((t) => level >= t.min)?.title ?? "Curiosa";
    return {
      content: [{ type: "text", text: `Nivel ${level} — ${title}` }],
      structuredContent: { level, title },
    };
  },
});
