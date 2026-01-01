
import React, { useState, useEffect } from 'react';

interface Props {
  onBack: () => void;
  onLaunch: () => void;
  hyperscapeUrl: string;
}

const PlayPortal: React.FC<Props> = ({ onBack, onLaunch, hyperscapeUrl }) => {
  const [loadingStep, setLoadingStep] = useState(0);
  const steps = [
    "Cloning repository: hyperscape.git",
    "Installing dependencies (Bun v1.1.38+)",
    "Configuring Privy Authentication",
    "Starting PostgreSQL & CDN Docker containers",
    "Spinning up ElizaOS Agent Core",
    "Reality Sync Successful."
  ];

  useEffect(() => {
    if (loadingStep < steps.length - 1) {
      const timer = setTimeout(() => setLoadingStep(prev => prev + 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [loadingStep]);

  return (
    <div className="w-full max-w-4xl min-h-[70vh] flex flex-col items-center justify-center p-6 md:p-8 bg-zinc-950/80 backdrop-blur-2xl rounded-[2.5rem] md:rounded-[3rem] border border-white/10 shadow-2xl animate-in fade-in zoom-in duration-700 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-br from-pink-900/20 via-black to-blue-900/20 animate-pulse"></div>
      </div>

      <div className="text-center space-y-6 md:space-y-8 z-10 w-full max-w-lg">
        <div className="relative inline-block">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-pink-500 rotate-12 flex items-center justify-center shadow-2xl shadow-pink-500/20 animate-bounce">
            <span className="text-3xl md:text-4xl -rotate-12">🎮</span>
          </div>
        </div>

        <div className="space-y-3 md:space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">AIKO × HYPERSCAPE</h1>
          <p className="text-white/50 leading-relaxed text-sm font-medium px-4">
            Deploying the first AI-native MMORPG. You are entering a persistent world where Aiko lives as an autonomous ElizaOS agent.
          </p>
        </div>

        <div className="w-full space-y-4 bg-white/5 p-5 md:p-6 rounded-3xl border border-white/5">
          <div className="flex justify-between text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-2">
            <span className="truncate mr-2">{steps[loadingStep]}</span>
            <span>{Math.round((loadingStep / (steps.length - 1)) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-pink-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(236,72,153,0.5)]" 
              style={{ width: `${(loadingStep / (steps.length - 1)) * 100}%` }}
            ></div>
          </div>
          <div className="flex flex-col gap-1.5 mt-4">
            {steps.slice(0, loadingStep + 1).map((s, i) => (
              <div key={i} className="text-[10px] font-mono text-white/30 text-left flex gap-2">
                <span className="text-green-500">✔</span> {s}
              </div>
            ))}
          </div>
        </div>

        {loadingStep === steps.length - 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <button 
              onClick={onLaunch}
              className="block w-full py-4 md:py-5 bg-pink-500 text-white font-bold rounded-2xl shadow-xl shadow-pink-500/20 hover:bg-pink-400 transition-all hover:scale-[1.02] active:scale-95 text-base md:text-lg tracking-widest uppercase"
            >
              Enter World
            </button>
            <div className="flex justify-center gap-8">
              <a href={hyperscapeUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-pink-400/60 hover:text-pink-400 transition-colors uppercase tracking-widest">
                Repository
              </a>
              <button onClick={onBack} className="text-[10px] font-bold text-white/20 hover:text-white/40 transition-colors uppercase tracking-widest">
                Exit Shell
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 md:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 opacity-30 w-full max-w-sm">
        {['ECS', 'OSRS', 'Postgres', 'ElizaOS'].map(t => (
          <div key={t} className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-widest border border-white/10 px-2 py-1.5 rounded-lg">{t}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayPortal;
