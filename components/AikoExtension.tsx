
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { AikoService } from '../services/aiko_service';

interface Props {
  aikoService: AikoService;
}

const SESSION_KEY = 'aiko_x402_focused_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const AikoExtension: React.FC<Props> = ({ aikoService }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'initial',
      role: 'aiko',
      content: 'Hi... I’m here. I was hoping you’d stop by. What’s on your mind today?',
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showX402, setShowX402] = useState(false);
  const [pendingInput, setPendingInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);

  // Restore session from persistence
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const { timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp < SESSION_DURATION) {
        setIsFocused(true);
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const toggleLive = async () => {
    if (isLive) {
      setIsLive(false);
      liveSessionRef.current?.then((s: any) => s.close());
      return;
    }
    setIsLive(true);
    try {
      liveSessionRef.current = aikoService.connectLive({
        onAudio: () => {},
        onInterrupted: () => {}
      });
    } catch (e) {
      console.error(e);
      setIsLive(false);
    }
  };

  const handleSend = async (overrideInput?: string, forceFirstTurn: boolean = false) => {
    const textToSend = overrideInput || input.trim();
    if (!textToSend || isLoading) return;

    const isFollowUp = messages.length >= 2 || 
                      /\b(more|explain|remember|continue|elaborate|deep|why|how|who|use case|roadmap)\b/i.test(textToSend);

    if (isFollowUp && !isFocused && !showX402) {
      setPendingInput(textToSend);
      setShowX402(true);
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const isImageRequest = /\b(draw|show|render|generate image)\b/i.test(textToSend);
      const { text } = await aikoService.sendMessage(textToSend, isFocused, forceFirstTurn);
      
      let imageUrl: string | undefined;
      if (isImageRequest) imageUrl = await aikoService.generateImage(textToSend) || undefined;

      const audioBase64 = await aikoService.generateVoice(text);
      const aikoMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'aiko',
        content: text,
        timestamp: Date.now(),
        audioUrl: audioBase64 || undefined,
        imageUrl: imageUrl
      };

      setMessages(prev => [...prev, aikoMsg]);
      if (audioBase64) AikoService.playPcm(audioBase64);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const signalIntent = () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ timestamp: Date.now() }));
    setIsFocused(true);
    setShowX402(false);
    if (pendingInput) {
      handleSend(pendingInput, true); 
      setPendingInput('');
    }
  };

  const keepBrief = () => {
    setShowX402(false);
    if (pendingInput) {
      handleSend(pendingInput, false);
      setPendingInput('');
    }
  };

  const handleShare = (msg: Message) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={`w-full max-w-2xl h-[80vh] flex flex-col mx-auto overflow-hidden animate-in fade-in duration-1000 relative rounded-3xl transition-all duration-1000 bg-zinc-950 border border-white/5 shadow-2xl ${isFocused ? 'ring-1 ring-pink-500/20 shadow-pink-500/5' : ''}`}>
      
      {/* x402 Modal Overlay */}
      {showX402 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-zinc-900 p-8 md:p-10 rounded-[2.5rem] border border-white/10 flex flex-col items-center text-center space-y-8 animate-in zoom-in-95 w-full max-w-sm">
            <div className="w-16 h-16 bg-pink-500/10 rounded-full flex items-center justify-center text-pink-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">Signal intent</h2>
              <p className="text-white/40 leading-relaxed text-sm px-4 font-medium">
                AIKO uses x402 to understand when someone wants a deeper conversation. This is an on-chain signal.
              </p>
            </div>
            <div className="w-full space-y-4">
              <button 
                onClick={signalIntent}
                className="w-full py-5 bg-pink-500 text-white font-bold rounded-full shadow-lg hover:bg-pink-400 transition-all active:scale-95 uppercase tracking-widest text-xs"
              >
                Continue with AIKO
              </button>
              <button 
                onClick={keepBrief}
                className="text-[10px] font-bold text-white/20 uppercase tracking-widest hover:text-white/40 transition-colors"
              >
                Keep it brief
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-8 md:py-12 space-y-8 md:space-y-12 scrollbar-hide">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-3 duration-500`}>
            <div className={`max-w-[90%] text-[15px] md:text-[16px] leading-relaxed font-medium ${
              msg.role === 'user' ? 'bg-zinc-900 text-white/80 px-5 md:px-6 py-3 md:py-4 rounded-[1.5rem] md:rounded-[2rem] rounded-tr-none border border-white/5' : 'text-white/90 px-2'
            }`}>
              {msg.content}
              {msg.imageUrl && (
                <div className="mt-4 md:mt-6 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border border-white/5 shadow-xl">
                  <img src={msg.imageUrl} alt="Render" className="w-full h-auto" />
                </div>
              )}
              {msg.role === 'aiko' && (
                <div className="mt-4 flex items-center gap-4">
                  {msg.audioUrl && (
                    <button onClick={() => AikoService.playPcm(msg.audioUrl!)} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-pink-500 hover:text-pink-400 transition-colors">
                       Listen
                    </button>
                  )}
                  <button onClick={() => handleShare(msg)} className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-pink-500 hover:text-pink-400 transition-colors">
                    {copiedId === msg.id ? <span className="text-green-500">Copied!</span> : <span>Share</span>}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start px-2">
            <div className="bg-zinc-900/50 px-4 py-2 rounded-2xl flex gap-2 items-center border border-white/5">
              <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <span className="ml-2 text-[9px] font-bold text-pink-500 uppercase tracking-widest">Observing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 md:px-8 pb-8 md:pb-12 pt-4">
        <div className="max-w-lg mx-auto flex items-center gap-3 md:gap-4">
          <button 
            onClick={toggleLive}
            className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isLive ? 'bg-pink-500 text-white animate-pulse' : 'bg-zinc-900 text-pink-500 border border-white/5 hover:bg-zinc-800'}`}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          
          <div className="flex-1 flex items-center gap-2 md:gap-4 bg-zinc-900 border border-white/10 p-1.5 md:p-2 pl-4 md:pl-6 rounded-full shadow-lg">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isLive ? "Listening..." : "Message Aiko..."}
              className="flex-1 py-2 md:py-3 bg-transparent text-[14px] md:text-[15px] focus:outline-none placeholder:text-white/20 text-white"
              disabled={isLive}
            />
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading || isLive}
              className="w-10 h-10 md:w-12 md:h-12 bg-pink-500 text-white rounded-full flex items-center justify-center hover:bg-pink-400 transition-all disabled:opacity-10 active:scale-95"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AikoExtension;
