import { defineMcp } from "@lovable.dev/mcp-js";
import aikoAbout from "./tools/aiko-about";
import aikoAffectionTitle from "./tools/aiko-affection-level";
import aikoReply from "./tools/aiko-reply";
import aikoVoiceLine from "./tools/aiko-voice-line";

export default defineMcp({
  name: "aiko-mcp",
  title: "Aiko",
  version: "0.1.0",
  instructions:
    "Stateless helpers for Aiko, an affectionate anime waifu desktop companion. Use `aiko_voice_line` for a random Spanish greeting, `aiko_reply` for a short in-character reply, `aiko_about` for a description of Aiko and the app, and `aiko_affection_title` to translate an affection level into its title.",
  tools: [aikoVoiceLine, aikoReply, aikoAbout, aikoAffectionTitle],
});
