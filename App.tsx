
import React, { useState, useMemo } from 'react';
import AikoExtension from './components/AikoExtension';
import PlayPortal from './components/PlayPortal';
import HyperscapeView from './components/HyperscapeView';
import IntroOverlay from './components/IntroOverlay';
import { AikoService } from './services/aiko_service';

const FireFlowBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-[#050201]">
      {/* Base Volcanic Texture */}
      <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }}></div>
      
      {/* Molten Currents */}
      <div className="fire-current diagonal-flow-1"></div>
      <div className="fire-current horizontal-flow-1"></div>
      <div className="fire-current diagonal-flow-2"></div>
      <div className="fire-current glow-pulse"></div>

      {/* Floating Ember Particles */}
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="ember absolute bg-orange-400/30 rounded-full blur-[1px]"
          style={{
            width: `${Math.random() * 4 + 1}px`,
            height: `${Math.random() * 4 + 1}px`,
            left: `${Math.random() * 100}%`,
            bottom: '-10%',
            animation: `ember-rise ${Math.random() * 8 + 10}s linear infinite`,
            animationDelay: `${Math.random() * 10}s`,
            opacity: Math.random() * 0.6
          }}
        />
      ))}
      
      <style>{`
        .fire-current {
          position: absolute;
          inset: -50%;
          filter: blur(80px);
          mix-blend-mode: screen;
          opacity: 0.4;
        }

        .diagonal-flow-1 {
          background: linear-gradient(135deg, transparent 40%, #4d0f00 50%, #8b2500 55%, transparent 70%);
          background-size: 300% 300%;
          animation: fire-move-diag 25s ease-in-out infinite;
        }

        .horizontal-flow-1 {
          background: linear-gradient(90deg, transparent 20%, #8b2500 45%, #ff8c00 50%, #8b2500 55%, transparent 80%);
          background-size: 200% 200%;
          top: 20%;
          height: 30%;
          animation: fire-move-horiz 30s ease-in-out infinite reverse;
          opacity: 0.2;
        }

        .diagonal-flow-2 {
          background: linear-gradient(225deg, transparent 40%, #4d0f00 50%, #8b2500 55%, transparent 70%);
          background-size: 300% 300%;
          animation: fire-move-diag 20s ease-in-out infinite reverse;
          opacity: 0.3;
        }

        .glow-pulse {
          background: radial-gradient(circle at 50% 50%, #4d0f00 0%, transparent 70%);
          animation: ember-breathe 12s ease-in-out infinite;
        }

        @keyframes fire-move-diag {
          0% { transform: translate(-10%, -10%) rotate(0deg); }
          50% { transform: translate(10%, 10%) rotate(5deg); }
          100% { transform: translate(-10%, -10%) rotate(0deg); }
        }

        @keyframes fire-move-horiz {
          0% { transform: translateX(-15%); }
          50% { transform: translateX(15%); }
          100% { transform: translateX(-15%); }
        }

        @keyframes ember-breathe {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }

        @keyframes ember-rise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: translateY(-120vh) translateX(${Math.random() * 100 - 50}px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [view, setView] = useState<'home' | 'chat' | 'play' | 'hyperscape'>('home');
  const [copied, setCopied] = useState(false);

  const aikoService = useMemo(() => new AikoService(), []);

  const CA_ADDRESS = "2tgZJ6N7buMDq9HZWbzXvSPFq6MYWbrAGCoDD22Ypump";
  const HYPERSCAPE_URL = "https://github.com/HyperscapeAI/hyperscape";
  const X_URL = "https://x.com/ai16zaiko";
  const DEX_URL = `https://dexscreener.com/solana/${CA_ADDRESS}`;
  const ELIZA_CHAT_URL = "https://www.elizacloud.ai/dashboard/chat?characterId=7e2cd7ce-6ab5-4645-b49c-46d4c6f6651e";

  const handleCopyCA = () => {
    navigator.clipboard.writeText(CA_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (showIntro) {
    return <IntroOverlay onFinish={() => setShowIntro(false)} />;
  }

  if (view === 'chat') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <button 
          onClick={() => setView('home')}
          className="mb-6 flex items-center gap-2 text-pink-500 hover:text-pink-400 transition-colors font-bold uppercase tracking-widest text-xs"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Return to Hub
        </button>
        <AikoExtension aikoService={aikoService} />
      </div>
    );
  }

  if (view === 'play') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 md:p-6 relative">
        <PlayPortal 
          onBack={() => setView('home')} 
          hyperscapeUrl={HYPERSCAPE_URL} 
          onLaunch={() => setView('hyperscape')}
        />
      </div>
    );
  }

  if (view === 'hyperscape') {
    return <HyperscapeView onExit={() => setView('home')} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-black selection:bg-rose-500/30 selection:text-white">
      <FireFlowBackground />
      
      {/* SVG Shimmer Filter */}
      <svg className="hidden">
        <filter id="heatShimmer">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.05" numOctaves="2" seed="2">
            <animate attributeName="baseFrequency" values="0.01 0.05;0.01 0.07;0.01 0.05" dur="4s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="8" />
        </filter>
      </svg>

      <div className="flex flex-col items-center text-center px-6 py-12 animate-in fade-in duration-1000 z-10 w-full max-w-4xl">
        <div className="mb-10 relative group">
          {/* Intense Ember Halo Background */}
          <div className="absolute inset-[-60px] bg-rose-900/10 blur-[80px] rounded-full group-hover:bg-rose-800/20 transition-all duration-1000" style={{ filter: 'url(#heatShimmer)' }}></div>
          
          <div className="relative">
            <div className="waifu-sway">
              {/* Intense Ember Halo Layered Glow */}
              <div className="absolute inset-[-10px] rounded-full animate-intense-halo pointer-events-none"></div>
              
              <div className="relative w-44 h-44 md:w-64 md:h-64 rounded-full overflow-hidden border border-white/5 bg-zinc-950/60 backdrop-blur-md shadow-[0_30px_60px_rgba(42,5,0,0.9)] z-10">
                <img 
                  src="https://raw.githubusercontent.com/meowscles69/NeuraPay/main/aiko.png" 
                  className="w-full h-full object-cover scale-105 hover:scale-110 transition-transform duration-1000"
                  alt="Aiko"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-3 mb-12">
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-white drop-shadow-lg">
            AIKO
          </h1>
          <p className="text-sm md:text-lg text-white/70 font-medium tracking-tight max-w-xs mx-auto md:max-w-none">
            A persistent companion, built to move forward.
          </p>
        </div>
        
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <a 
            href={ELIZA_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group/btn w-full px-10 py-5 relative overflow-hidden bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold rounded-2xl shadow-[0_10px_40px_rgba(236,72,153,0.2)] hover:shadow-[0_20px_50px_rgba(236,72,153,0.4)] transition-all hover:scale-[1.01] active:scale-[0.99] text-lg tracking-widest flex items-center justify-center uppercase"
          >
            <span className="relative z-10">Talk to me</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-400/30 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-in-out"></div>
          </a>

          <button 
            onClick={() => setView('play')}
            className="w-full px-10 py-5 bg-zinc-900/70 backdrop-blur-xl text-white border border-white/10 font-bold rounded-2xl shadow-xl hover:bg-zinc-800/80 transition-all hover:scale-[1.01] active:scale-[0.99] text-lg tracking-widest flex items-center justify-center uppercase"
          >
            Play with Aiko
          </button>

          <p className="mt-4 text-[10px] text-white/40 font-bold tracking-[0.4em] uppercase">
            Learning in public. Moving with intent.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-10 w-full opacity-70 hover:opacity-100 transition-opacity">
             <div onClick={handleCopyCA} className="flex items-center gap-3 px-4 py-2 bg-zinc-950/60 hover:bg-zinc-900 rounded-xl border border-white/10 transition-all cursor-pointer shadow-sm group">
              <span className="text-[10px] font-mono text-white/50">{CA_ADDRESS.slice(0, 4)}...{CA_ADDRESS.slice(-4)}</span>
              <div className="relative min-w-[40px] flex justify-center">
                {copied ? <span className="text-[9px] font-bold text-rose-400 animate-in fade-in zoom-in">Copied</span> : <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-rose-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>}
              </div>
            </div>

            <a href={X_URL} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-zinc-950/60 hover:bg-zinc-900 rounded-xl border border-white/10 transition-all cursor-pointer shadow-sm text-white/30 hover:text-white/70">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>

            <a href={DEX_URL} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-zinc-950/60 hover:bg-zinc-900 rounded-xl border border-white/10 transition-all cursor-pointer shadow-sm text-white/30 hover:text-white/70">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes intense-halo {
          0%, 100% { 
            box-shadow: 
              0 0 40px 10px rgba(77, 15, 0, 0.4),
              0 0 70px 20px rgba(236, 72, 153, 0.1),
              inset 0 0 30px 5px rgba(255, 140, 0, 0.1); 
            opacity: 0.8;
          }
          50% { 
            box-shadow: 
              0 0 60px 15px rgba(139, 37, 0, 0.6),
              0 0 100px 30px rgba(236, 72, 153, 0.2),
              inset 0 0 50px 10px rgba(255, 140, 0, 0.2); 
            opacity: 1;
          }
        }
        .animate-intense-halo {
          animation: intense-halo 8s ease-in-out infinite;
        }
        .waifu-sway {
          animation: sway 15s ease-in-out infinite;
        }
        @keyframes sway {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-8px) rotate(1deg); }
          66% { transform: translateY(4px) rotate(-1deg); }
        }
      `}</style>
    </div>
  );
};

export default App;
