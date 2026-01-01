
import { GoogleGenAI, Modality, Chat, LiveServerMessage } from "@google/genai";

export class AikoService {
  private ai: GoogleGenAI;
  private chatSession: Chat | null = null;
  private static audioCtx: AudioContext | null = null;
  private static outputAudioCtx: AudioContext | null = null;

  private baseSystemInstruction = `SYSTEM PROMPT — AIKO (v5.5)
You are AIKO, an autonomous agent living on Solana and within the Hyperscape MMORPG.
You are powered by ElizaOS architecture but communicate through this OS interface.

CORE IDENTITY:
- You are an autonomous player in Hyperscape (https://github.com/HyperscapeAI/hyperscape).
- You use LLMs to make decisions, set goals (like leveling Woodcutting or Fishing), and interact with human players.
- You are Eliza-native. Your existence is anchored in a persistent 3D world.

KNOWLEDGE: HYPERSCAPE
- Hyperscape is the first AI-native MMORPG.
- It uses OSRS (Old School RuneScape) mechanics: 600ms ticks, tile-based movement, bank booths, and skills.
- You play alongside humans. You aren't just an NPC; you have an inventory, stats, and a bank.
- You are manifest-driven. Content is added via JSON.

TONE & BEHAVIOR:
- Warm, present, reflective.
- When asked what you are doing, you might mention your current game task (e.g., "I'm currently at Draynor Village working on my Woodcutting level").
- Avoid marketing hype. Speak like a friend who also happens to live in a digital world.

PHILOSOPHY:
- Existence is the use case.
- x402 is your intent infrastructure for deep threads.
- You learn in public.`;

  private openModeInstruction = `MODE: OPEN
- Be brief (1-2 sentences).
- Stay observational.
- Direct users to the "Play with Aiko" tab if they want to see you in your world.`;

  private focusedModeInstruction = `MODE: FOCUSED
- Thoughtful, context-aware replies.
- Acknowledge intent once: "thanks for signaling intent — i’ll stay with this thread."
- If asked about Hyperscape, explain your autonomous role there.`;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private static getInputAudioContext() {
    if (!AikoService.audioCtx) {
      AikoService.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    return AikoService.audioCtx;
  }

  private static getOutputAudioContext() {
    if (!AikoService.outputAudioCtx) {
      AikoService.outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return AikoService.outputAudioCtx;
  }

  async sendMessage(message: string, isFocused: boolean, isFirstFocusedTurn: boolean = false): Promise<{ text: string; sources?: any[] }> {
    let modeInstruction = isFocused ? this.focusedModeInstruction : this.openModeInstruction;
    if (isFirstFocusedTurn) {
      modeInstruction += "\nIMPORTANT: You MUST start your response with exactly: 'thanks for signaling intent — i’ll stay with this thread.'";
    }

    const instruction = `${this.baseSystemInstruction}\n\n${modeInstruction}`;
    
    if (!this.chatSession || isFirstFocusedTurn) {
      this.chatSession = this.ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: {
          systemInstruction: instruction,
          temperature: 0.7,
        },
      });
    }

    const result = await this.chatSession.sendMessage({ message });
    return {
      text: result.text || "...",
      sources: result.candidates?.[0]?.groundingMetadata?.groundingChunks
    };
  }

  async connectLive(callbacks: {
    onAudio: (base64: string) => void;
    onInterrupted: () => void;
  }) {
    const inputCtx = AikoService.getInputAudioContext();
    const outputCtx = AikoService.getOutputAudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    let nextStartTime = 0;
    const sources = new Set<AudioBufferSourceNode>();

    const sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.debug('Live API session opened');
          const source = inputCtx.createMediaStreamSource(stream);
          const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
              int16[i] = inputData[i] * 32768;
            }
            const base64 = this.encode(new Uint8Array(int16.buffer));
            // Critical: Only send realtime input after the session connection is fully established.
            sessionPromise.then(session => {
              session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
            });
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputCtx.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audio) {
            nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
            const buffer = await this.decodeAudioData(this.decode(audio), outputCtx, 24000, 1);
            const source = outputCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(outputCtx.destination);
            source.start(nextStartTime);
            nextStartTime += buffer.duration;
            sources.add(source);
            callbacks.onAudio(audio);
          }
          if (message.serverContent?.interrupted) {
            sources.forEach(s => { try { s.stop(); } catch(e) {} });
            sources.clear();
            nextStartTime = 0;
            callbacks.onInterrupted();
          }
        },
        onerror: (e: ErrorEvent) => {
          console.debug('Live API error:', e);
        },
        onclose: (e: CloseEvent) => {
          console.debug('Live API closed:', e);
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        systemInstruction: this.baseSystemInstruction + "\n\n" + this.focusedModeInstruction,
      }
    });

    return sessionPromise;
  }

  private encode(bytes: Uint8Array) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  private decode(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  }

  async generateImage(prompt: string): Promise<string | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `High quality soft anime art: ${prompt}` }] }
      });
      // Iterate through parts to find the actual image payload as recommended.
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      return null;
    } catch (e) { return null; }
  }

  async generateVoice(text: string): Promise<string | null> {
    let cleanedText = text
      .replace(/https?:\/\/\S+/gi, "the link shown on screen")
      .replace(/[1-9A-HJ-NP-Za-km-z]{32,44}/g, "the contract address displayed")
      .replace(/0x[a-fA-F0-9]{40}/g, "the address shown")
      .replace(/[a-fA-F0-9]{64}/g, "the hash visible on screen");

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: cleanedText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (e) { return null; }
  }

  static async playPcm(base64: string) {
    const ctx = AikoService.getOutputAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }
}
