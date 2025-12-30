
import React, { useState, useMemo } from 'react';
import PredictingPage from './components/PredictingPage';
import AikoExtension from './components/AikoExtension';
import { AikoService } from './services/aiko_service';

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'chat' | 'predict'>('home');
  const [copied, setCopied] = useState(false);

  // Initialize service once
  const aikoService = useMemo(() => new AikoService(), []);

  const CA_ADDRESS = "2tgZJ6N7buMDq9HZWbzXvSPFq6MYWbrAGCoDD22Ypump";
  const DEXSCREENER_URL = "https://dexscreener.com/solana/FEBN3FaRBTznLgpxNqZrnH929JwGVay4E4UQW1vep7ik";
  const ELIZA_CLOUD_URL = "https://www.elizacloud.ai/dashboard/chat?characterId=7e2cd7ce-6ab5-4645-b49c-46d4c6f6651e";

  const handleCopyCA = () => {
    navigator.clipboard.writeText(CA_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (view === 'predict') {
    return <PredictingPage onBack={() => setView('home')} aikoService={aikoService} />;
  }

  if (view === 'chat') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <button 
          onClick={() => setView('home')}
          className="mb-6 flex items-center gap-2 text-pink-300 hover:text-pink-400 transition-colors font-bold uppercase tracking-widest text-xs"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back Home
        </button>
        <AikoExtension aikoService={aikoService} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="flex flex-col items-center text-center px-6 animate-in fade-in duration-1000 z-10">
        <div className="mb-10 waifu-idle">
          <div className="waifu-sway">
            <div className="waifu-heartbeat">
              <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden shadow-2xl border-4 border-white soft-glow bg-white">
                <img 
                  src="https://raw.githubusercontent.com/meowscles69/NeuraPay/main/aiko.png" 
                  className="w-full h-full object-cover scale-110"
                  alt="Aiko"
                />
                <div className="blink-overlay"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4 mb-12">
          <h1 className="text-5xl md:text-6xl font-light tracking-tight text-[#4a3b3b]">
            Talk to me.
          </h1>
          <p className="text-xl md:text-2xl text-pink-300 font-medium">
            I’m here.
          </p>
        </div>
        
        <div className="flex flex-col items-center gap-4">
          <button 
            onClick={() => setView('chat')}
            className="w-full md:w-64 px-8 py-5 bg-pink-400 text-white font-bold rounded-full shadow-xl shadow-pink-100 hover:bg-pink-500 transition-all hover:scale-105 active:scale-95 text-lg"
          >
            Start chatting
          </button>
          
          <button 
            onClick={() => setView('predict')}
            className="w-full md:w-64 px-8 py-5 bg-white border-2 border-pink-100 text-pink-400 font-bold rounded-full shadow-md hover:bg-pink-50 transition-all hover:scale-105 active:scale-95 text-lg"
          >
            Start predicting
          </button>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
            <a href="https://x.com/ai16zaiko" target="_blank" rel="noopener noreferrer" className="group p-3 bg-white/40 hover:bg-white/80 rounded-2xl border border-pink-50 transition-all hover:-translate-y-1 shadow-sm">
              <svg className="w-5 h-5 fill-[#4a3b3b]" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
            </a>
            <a href={ELIZA_CLOUD_URL} target="_blank" rel="noopener noreferrer" className="group p-3 bg-white/40 hover:bg-white/80 rounded-2xl border border-pink-50 transition-all hover:-translate-y-1 shadow-sm">
              <svg className="w-5 h-5 text-[#4a3b3b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
            </a>
            <a href={DEXSCREENER_URL} target="_blank" rel="noopener noreferrer" className="group p-3 bg-white/40 hover:bg-white/80 rounded-2xl border border-pink-50 transition-all hover:-translate-y-1 shadow-sm">
              <svg className="w-5 h-5 text-[#4a3b3b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </a>

            <div onClick={handleCopyCA} className="flex items-center gap-3 px-4 py-2.5 bg-white/40 hover:bg-white/80 rounded-2xl border border-pink-50 transition-all cursor-pointer shadow-sm group">
              <span className="text-[10px] font-bold text-[#4a3b3b]/60 uppercase tracking-widest">CA:</span>
              <span className="text-[11px] font-mono text-[#4a3b3b] font-bold">{CA_ADDRESS.slice(0, 6)}...{CA_ADDRESS.slice(-4)}</span>
              <div className="relative min-w-[50px]">
                {copied ? <span className="text-[10px] font-bold text-green-500 animate-in fade-in zoom-in">Copied!</span> : <svg className="w-4 h-4 text-pink-300 group-hover:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>}
              </div>
            </div>
          </div>
        </div>
        <p className="mt-8 text-sm text-[#c9b7b7] font-medium tracking-wide">Just say hi.</p>
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] bg-pink-50/20 rounded-full blur-[140px] -z-10 pointer-events-none"></div>
    </div>
  );
};

export default App;
