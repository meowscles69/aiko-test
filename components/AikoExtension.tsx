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

    // x402 Intent Trigger Logic:
    // 1. Second message in same thread
    // 2. Specific depth-seeking keywords
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
      handleSend(pendingInput, true); // Trigger first focused turn with signal acknowledgment
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
    <div className={`w-full max-w-2xl h-[75vh] flex flex-col mx-auto overflow-hidden animate-in fade-in duration-1000 relative rounded-3xl transition-all duration-1000 ${isFocused ? 'bg-pink-50/10 ring-1 ring-pink-100/50 shadow-2xl' : ''}`}>
      
      {/* x402 Modal Overlay */}
      {showX402 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-white/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-pink-50 flex flex-col items-center text-center space-y-8 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center text-pink-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-[#4a3b3b] tracking-tight">Signal intent</h2>
              <p className="text-[#4a3b3b]/60 leading-relaxed text-sm px-4 font-medium">
                AIKO uses x402 to understand when someone wants a deeper conversation. 
                This is an on-chain signal — not a purchase.
              </p>
            </div>
            <div className="w-full space-y-4">
              <button 
                onClick={signalIntent}
                className="w-full py-5 bg-pink-400 text-white font-bold rounded-full shadow-lg shadow-pink-100 hover:bg-pink-500 transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-widest text-xs"
              >
                Continue with AIKO
              </button>
              <button 
                onClick={keepBrief}
                className="text-[10px] font-bold text-pink-200 uppercase tracking-widest hover:text-pink-300 transition-colors"
              >
                Keep it brief
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Mode Ripple Effects */}
      {isLive && (
        <div className="absolute inset-0 flex items-center justify-center -z-10 opacity-30 pointer-events-none">
          <div className="voice-ripple w-80 h-80"></div>
          <div className="voice-ripple w-80 h-80" style={{ animationDelay: '1.2s' }}></div>
        </div>
      )}

      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-12 space-y-12 scrollbar-hide">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-3 duration-500`}>
            <div className={`max-w-[88%] text-[16px] leading-relaxed font-medium ${
              msg.role === 'user' ? 'bg-[#f8f1f1] text-[#6d5b5b] px-6 py-4 rounded-[2rem] rounded-tr-none shadow-sm' : 'text-[#4a3b3b] px-2'
            }`}>
              {msg.content}
              {msg.imageUrl && (
                <div className="mt-6 rounded-[2rem] overflow-hidden shadow-md border border-pink-50">
                  <img src={msg.imageUrl} alt="Render" className="w-full h-auto" />
                </div>
              )}
              {msg.role === 'aiko' && (
                <div className="mt-5 flex items-center gap-4">
                  {msg.audioUrl && (
                    <button onClick={() => AikoService.playPcm(msg.audioUrl!)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-pink-300 hover:text-pink-400 transition-colors">
                      <span className="text-sm">♡</span> Listen
                    </button>
                  )}
                  <button onClick={() => handleShare(msg)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-pink-300 hover:text-pink-400 transition-colors">
                    {copiedId === msg.id ? <span className="text-green-400 animate-in zoom-in">Copied!</span> : <span>Share</span>}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start px-2">
            <div className="bg-pink-50/20 px-5 py-3 rounded-[1.5rem] rounded-tl-none flex gap-2 items-center border border-pink-50/50">
              <div className="w-1.5 h-1.5 bg-pink-200 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-pink-200 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <span className="ml-3 text-[10px] font-bold text-pink-300 uppercase tracking-widest">Observing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-8 pb-12 pt-6">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button 
            onClick={toggleLive}
            title={isLive ? "Stop Live" : "Start Live"}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm ${isLive ? 'bg-pink-500 text-white animate-pulse' : 'bg-white/70 text-pink-300 border border-pink-100 hover:bg-white'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          
          <div className="flex-1 flex items-center gap-4 bg-white/60 backdrop-blur-xl border border-pink-50 p-2 pl-6 rounded-full shadow-sm hover:shadow-md transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isLive ? "I'm listening..." : isFocused ? "I'm fully with you." : "Say anything..."}
              className="flex-1 py-3 bg-transparent text-[15px] focus:outline-none placeholder:text-pink-200 text-[#4a3b3b]"
              disabled={isLive}
            />
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading || isLive}
              className="w-12 h-12 bg-pink-400 text-white rounded-full flex items-center justify-center hover:bg-pink-500 transition-all disabled:opacity-20 active:scale-95"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
        {isFocused && (
          <div className="mt-4 text-center animate-in fade-in slide-in-from-top-1 duration-1000">
            <span className="text-[10px] font-bold text-pink-300/60 uppercase tracking-[0.4em]">Intent Signal Active</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AikoExtension;
