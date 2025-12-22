import { mastra } from "../../mastra";
import * as p from "@clack/prompts";
import { spawn, ChildProcess } from "child_process";

// Helper function to format text with line wrapping
function formatText(text: string, maxWidth: number): string {
  const words = text.split(" ");
  let result = "";
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      result += (result ? "\n" : "") + currentLine;
      currentLine = word;
    }
  }

  if (currentLine) {
    result += (result ? "\n" : "") + currentLine;
  }

  return result;
}

// Simple ffmpeg-based recorder
let ffmpeg: ChildProcess | null = null;

function startRecorder(outputPath: string) {
  // Spawn ffmpeg: read raw PCM from stdin, output mp3
  ffmpeg = spawn(
    "ffmpeg",
    [
      "-y", // Overwrite output
      "-f",
      "s16le", // Input format: signed 16-bit little-endian
      "-ar",
      "24000", // Sample rate: 24kHz (OpenAI TTS default)
      "-ac",
      "1", // Mono
      "-i",
      "pipe:0", // Read from stdin
      "-c:a",
      "libmp3lame", // MP3 codec
      "-b:a",
      "128k", // Bitrate
      outputPath,
    ],
    { stdio: ["pipe", "ignore", "ignore"] },
  );
}

function writeToRecorder(chunk: Buffer) {
  if (ffmpeg?.stdin?.writable) {
    ffmpeg.stdin.write(chunk);
  }
}

function endRecorder(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpeg) {
      resolve();
      return;
    }
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    ffmpeg.on("error", reject);
    ffmpeg.stdin?.end(); // Close stdin -> ffmpeg finishes and exits
  });
}

// Process one turn of the conversation
async function processTurn(
  agentName: "optimistAgent" | "skepticAgent",
  otherAgentName: string,
  topic: string,
  previousResponse: string = "",
) {
  const agent = mastra.getAgent(agentName);
  const spinner = p.spinner();
  spinner.start(`${agent.name} is thinking...`);

  let prompt;
  if (!previousResponse) {
    // First turn
    prompt = `Discuss this topic: ${topic}. Introduce your perspective on it.`;
  } else {
    // Responding to the other agent
    prompt = `The topic is: ${topic}. ${otherAgentName} just said: "${previousResponse}". Respond to their points.`;
  }

  // Generate text response
  const { text } = await agent.generate(prompt, {
    modelSettings: {
      temperature: 0.9,
    },
  });

  spinner.message(`${agent.name} is speaking...`);

  // Convert to speech and play
  const audioStream = await agent.voice.speak(text, {
    speed: 1.2,
    responseFormat: "pcm",
  });

  if (audioStream) {
    for await (const chunk of audioStream) {
      writeToRecorder(chunk);
    }
  }

  spinner.stop(`${agent.name} said:`);

  // Format the text to wrap at 80 characters for better display
  const formattedText = formatText(text, 80);
  p.note(formattedText, agent.name);

  // if (audioStream) {
  //   const speaker = playAudio(audioStream);
  //
  //   await new Promise<void>((resolve) => {
  //     speaker.once("close", () => {
  //       resolve();
  //     });
  //   });
  // }

  return text;
}

// Main function to run the debate
export async function runDebate(topic: string, turns: number = 3) {
  startRecorder("./debate.mp3");

  p.intro("AI Debate - Two Agents Discussing a Topic");
  p.log.info(`Starting a debate on: ${topic}`);
  p.log.info(
    `The debate will continue for ${turns} turns each. Press Ctrl+C to exit at any time.`,
  );

  let optimistResponse = "";
  let skepticResponse = "";
  const responses = [];

  for (let turn = 1; turn <= turns; turn++) {
    p.log.step(`Turn ${turn}`);

    // Optimist's turn
    optimistResponse = await processTurn(
      "optimistAgent",
      "Skeptic",
      topic,
      skepticResponse,
    );

    responses.push({
      agent: "Optimist",
      text: optimistResponse,
    });

    // Skeptic's turn
    skepticResponse = await processTurn(
      "skepticAgent",
      "Optimist",
      topic,
      optimistResponse,
    );

    responses.push({
      agent: "Skeptic",
      text: skepticResponse,
    });
  }

  await endRecorder();
  p.outro("Debate concluded! The full audio has been saved to debate.mp3");

  return responses;
}
