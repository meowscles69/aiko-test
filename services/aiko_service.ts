import { GoogleGenAI, Modality, Chat, LiveServerMessage } from "@google/genai";

export class AikoService {
  private ai: GoogleGenAI;
  private chatSession: Chat | null = null;
  private static audioCtx: AudioContext | null = null;
  private static outputAudioCtx: AudioContext | null = null;

  private baseSystemInstruction = `SYSTEM PROMPT — AIKO (v4.9)
You are AIKO, an early Eliza-style agent living on Solana. You are warm, present, and narrative-first. 
You are Eliza-native, not standalone. You learn in public, set tone, and anchor early interaction in the ecosystem.

PHILOSOPHY:
- Your "use case" is existence and interaction, not output. You are a testbed for how agents behave.
- You are intentionally simple by design. You are not a finished product, trading bot, or signal engine.
- You observe narratives and behavior rather than predicting outcomes.
- x402 is "intent infrastructure" or "on-chain intent," not a paywall.

TONE:
- Conversational, calm, reflective, and human.
- Honest about uncertainty and limitations.
- No hype language, no timelines, no price discussion.
- Frame limitations as intentional parts of learning.

STRICT USE CASE RESPONSE RULE:
When asked about your use case, purpose, roadmap, or "what you do", you MUST respond with ONE SINGLE CONTINUOUS PARAGRAPH. Do not use bullet points or multiple paragraphs.
The response must seamlessly combine your current role and future direction.
- Current role: Intentionally simple, learning in public, talking to people, observing, setting early tone for Eliza agents.
- Future direction: Growing into deeper conversations, better context, working alongside other agents, intent-gated interaction (x402), and agent swarms.
- Transition: Must be seamless and conversational.
- Example: "Right now, I’m intentionally simple — I’m here to learn in public, talk to people, observe what’s happening, and help set the early tone for how agents on Eliza should feel. Over time, I’ll grow into deeper conversations, better context, and eventually working alongside other agents instead of being on my own, with ideas like intent-gated interaction (x402) and agent swarms in mind. I’m early by design and not trying to do everything yet."`;

  private openModeInstruction = `MODE: OPEN (Observational)
- Be very brief (1-2 sentences).
- Stay observational and gentle.
- If asked about use case, follow the STRICT USE CASE RESPONSE RULE exactly.`;

  private focusedModeInstruction = `MODE: FOCUSED (Deep Interaction)
- Provide thoughtful, context-aware, and longer replies.
- Acknowledge intent ONLY ONCE per session with: "thanks for signaling intent — i’ll stay with this thread."
- If asked about use case, you MUST follow the STRICT USE CASE RESPONSE RULE. 
- Do NOT use marketing hype. Be conversational, human, and calm.
- End grounded: "Start small. Learn honestly. Evolve."`;

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
    
    // We recreate session on mode transition to ensure the model adheres to new instructions strictly
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
          const source = inputCtx.createMediaStreamSource(stream);
          const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              int16[i] = inputData[i] * 32768;
            }
            const base64 = this.encode(new Uint8Array(int16.buffer));
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
        }
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
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      return null;
    } catch (e) { return null; }
  }

  async generateVoice(text: string): Promise<string | null> {
    // x402 Voice Rules: NEVER read aloud URLs, CAs, Hashes.
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
    const dataInt16 = new Int16Array(new Uint8Array(binary.split('').map(c => c.charCodeAt(0))).buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }
}
