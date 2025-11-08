import { createClient } from "@deepgram/sdk";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

if (!DEEPGRAM_API_KEY) {
  throw new Error("DEEPGRAM_API_KEY environment variable is required");
}

const deepgram = createClient(DEEPGRAM_API_KEY);

export interface TextToSpeechOptions {
  text: string;
  model?: string;
  voice?: string;
}

export async function generateAudioFromText(options: TextToSpeechOptions): Promise<Buffer> {
  const { text, model = "aura-asteria-en", voice } = options;

  try {
    const response = await deepgram.speak.request(
      { text },
      {
        model,
        encoding: "mp3",
        container: "mp3",
      }
    );

    const stream = await response.getStream();
    if (!stream) {
      throw new Error("Failed to get audio stream from Deepgram");
    }

    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const audioBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audioBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    return Buffer.from(audioBuffer);
  } catch (error) {
    console.error("Error generating audio from text:", error);
    throw new Error("Failed to generate audio with Deepgram");
  }
}
