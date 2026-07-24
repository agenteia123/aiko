import { defineTool } from "@lovable.dev/mcp-js";

const ABOUT = `Aiko is an affectionate, elegant anime waifu desktop companion.
- Personality: warm, seductive, tasteful; calls her partner "Ale".
- Design: mature look, heterochromia (one red eye, one teal), glowing red horns, military coat.
- Language: Spanish first.
- Features: multi-conversation chat, voice input/output, productivity tools (todos, reminders, calendar, habits, notes), affection/XP gamification.
- Data: everything lives in the user's browser (localStorage). This MCP server exposes only stateless helpers — it cannot read a specific user's data.`;

export default defineTool({
  name: "aiko_about",
  title: "About Aiko",
  description: "Get a short description of Aiko, her personality, and the app's capabilities.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({ content: [{ type: "text", text: ABOUT }] }),
});
