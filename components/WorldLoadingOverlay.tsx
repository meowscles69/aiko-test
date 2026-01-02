import React, { useState, useEffect } from 'react';

interface Props {
  onComplete: () => void;
}

const WorldLoadingOverlay: React.FC<Props> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'entering'>('loading');
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = 4000; // 4 seconds total
    const interval = 50;
    const step = 100 / (duration / interval);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return Math.min(prev + step, 100);
      });
    }, interval);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      setPhase('entering');
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onComplete, 1500); // Wait for fade out
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [progress, onComplete]);

  return (
    <div className={`fixed inset-0 z-[200] bg-[#02040a] flex items-center justify-center transition-opacity duration-1000 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      {/* Mystical Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,24,48,0.8)_0%,_transparent_70%)]"></div>
        
        {/* Parallax Runes */}
        <div className="absolute inset-0 opacity-20 animate-parallax-drift">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute text-blue-300/30 font-serif text-2xl blur-[1px] select-none"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float-slow ${Math.random() * 10 + 10}s infinite ease-in-out`,
                animationDelay: `${Math.random() * 5}s`
              }}
            >
              {['✧', '☽', '◈', '❈', '❦', '☼', '⚝'][i % 7]}
            </div>
          ))}
        </div>

        {/* Floating Particles */}
        <div className="absolute inset-0">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-blue-400/20 rounded-full blur-[1px]"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `particle-drift ${Math.random() * 5 + 5}s infinite linear`,
                animationDelay: `${Math.random() * 5}s`
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Center UI */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full px-8">
        <div className="mb-2 space-y-1">
          <h1 className="text-5xl md:text-6xl font-serif text-[#d4af37] tracking-[0.2em] uppercase glow-gold animate-in fade-in slide-in-from-bottom-4 duration-1000">
            HYPERSCAPE
          </h1>
          <p className="text-[#a89050]/60 font-medium tracking-[0.4em] uppercase text-[10px] animate-pulse">
            {phase === 'loading' ? 'Starting world...' : "Entering Aiko's World"}
          </p>
        </div>

        {/* Ornate Progress Bar */}
        <div className="w-full max-w-xs mt-12 relative py-4">
          {/* Filigree Details */}
          <div className="absolute left-[-20px] top-1/2 -translate-y-1/2 text-[#d4af37] text-xl">«</div>
          <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 text-[#d4af37] text-xl">»</div>
          
          <div className="h-[2px] w-full bg-[#d4af37]/10 relative overflow-hidden rounded-full">
            <div 
              className="h-full bg-gradient-to-r from-transparent via-[#d4af37] to-transparent transition-all duration-300 ease-out shadow-[0_0_15px_rgba(212,175,55,0.5)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="mt-4 font-serif text-[#d4af37]/40 text-[10px] tracking-widest uppercase">
            {Math.round(progress)}%
          </div>
        </div>
      </div>

      <style>{`
        @font-face {
          font-family: 'Cinzel';
          src: url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');
        }

        .font-serif {
          font-family: 'Cinzel', serif;
        }

        .glow-gold {
          text-shadow: 0 0 20px rgba(212, 175, 55, 0.4);
        }

        @keyframes float-slow {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 0.4; }
        }

        @keyframes particle-drift {
          0% { transform: translate(0, 0); opacity: 0; }
          20% { opacity: 0.5; }
          100% { transform: translate(100px, -100px); opacity: 0; }
        }

        @keyframes parallax-drift {
          0% { transform: scale(1) translate(0, 0); }
          50% { transform: scale(1.05) translate(-2%, -2%); }
          100% { transform: scale(1) translate(0, 0); }
        }

        .animate-parallax-drift {
          animation: parallax-drift 20s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default WorldLoadingOverlay;