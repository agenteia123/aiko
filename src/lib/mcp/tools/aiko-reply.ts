import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { AIKO_MOCK_REPLIES } from "@/lib/aiko-lines";

export default defineTool({
  name: "aiko_reply",
  title: "Aiko mock reply",
  description:
    "Return a short in-character Spanish reply from Aiko. Optionally echo the caller's message for flavor.",
  inputSchema: {
    message: z
      .string()
      .max(500)
      .optional()
      .describe("Optional message the caller sent to Aiko."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: ({ message }) => {
    const reply = AIKO_MOCK_REPLIES[Math.floor(Math.random() * AIKO_MOCK_REPLIES.length)];
    const text = message ? `Ale dijo: "${message}"\n\nAiko: ${reply}` : reply;
    return { content: [{ type: "text", text }] };
  },
});
