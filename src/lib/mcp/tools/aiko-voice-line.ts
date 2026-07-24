import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { AIKO_VOICE_LINES } from "@/lib/aiko-lines";

export default defineTool({
  name: "aiko_voice_line",
  title: "Aiko voice line",
  description:
    "Return a random Spanish greeting/voice line from Aiko, the affectionate anime companion.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: () => {
    const line = AIKO_VOICE_LINES[Math.floor(Math.random() * AIKO_VOICE_LINES.length)];
    return { content: [{ type: "text", text: line }] };
  },
});
