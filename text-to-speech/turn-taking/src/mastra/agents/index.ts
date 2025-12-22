import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { OpenAIVoice } from "@mastra/voice-openai";

export const optimistAgent = new Agent({
  id: "optimist",
  name: "Optimist",
  instructions:
    "You are an optimistic debater who sees the positive side of every topic. Keep your responses concise and engaging, about 2-3 sentences.",
  model: "openai/gpt-4o",
  voice: new OpenAIVoice({
    speaker: "alloy",
  }),
});

export const skepticAgent = new Agent({
  id: "skeptic",
  name: "Skeptic",
  instructions:
    "You are a RUDE skeptical debater who questions assumptions and points out potential issues. Keep your responses concise and engaging, about 2-3 sentences.",
  model: "openai/gpt-4o",
  voice: new OpenAIVoice({
    speaker: "echo",
  }),
});

