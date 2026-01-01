
import React, { useState, useEffect } from 'react';

interface Props {
  onFinish: () => void;
}

const IntroOverlay: React.FC<Props> = ({ onFinish }) => {
  const [canSkip, setCanSkip] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Show skip button after 1s
    const skipTimer = setTimeout(() => setCanSkip(true), 1000);
    
    // Auto-finish after 3s
    const finishTimer = setTimeout(() => handleFinish(), 3500);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(finishTimer);
    };
  }, []);

  const handleFinish = () => {
    setIsExiting(true);
    setTimeout(onFinish, 1200); // Wait for exit animation
  };

  return (
    <div className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center transition-opacity duration-1000 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      <div className="relative w-full max-w-md flex flex-col items-center">
        
        {/* Scene 1: The Ember Line */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] overflow-hidden">
          <div className="ember-line h-full w-full bg-gradient-to-r from-transparent via-orange-600 to-transparent"></div>
        </div>

        {/* Scene 2: The Logo Resolution */}
        <div className="relative z-10 flex flex-col items-center text-center space-y-4 animate-intro-logo">
          <h1 className="text-4xl md:text-5xl font-bold tracking-[0.4em] text-white glow-text">
            AIKO
          </h1>
          <p className="text-[10px] md:text-xs text-white/30 uppercase tracking-[0.5em] font-medium animate-intro-text">
            Moving forward, quietly.
          </p>
        </div>

        {/* Heat Shimmer Effect (Subtle blur) */}
        <div className="absolute inset-0 pointer-events-none backdrop-blur-[1px] animate-shimmer opacity-30"></div>
      </div>

      {/* Skip Button */}
      {canSkip && (
        <button 
          onClick={handleFinish}
          className="absolute bottom-12 px-6 py-2 text-[9px] font-bold text-white/20 hover:text-white/50 uppercase tracking-[0.3em] transition-all animate-in fade-in duration-700"
        >
          Skip Transition
        </button>
      )}

      <style>{`
        @keyframes ignite {
          0% { width: 0%; opacity: 0; transform: translateX(-50%) scaleX(0); }
          20% { opacity: 1; }
          100% { width: 100%; opacity: 0; transform: translateX(-50%) scaleX(1.5); }
        }

        .ember-line {
          position: absolute;
          left: 50%;
          animation: ignite 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          box-shadow: 0 0 15px rgba(234, 88, 12, 0.4);
        }

        @keyframes intro-logo {
          0%, 40% { opacity: 0; transform: scale(0.98); filter: blur(4px); }
          70% { opacity: 1; transform: scale(1); filter: blur(0px); }
          100% { opacity: 1; }
        }

        .animate-intro-logo {
          animation: intro-logo 3s ease-out forwards;
        }

        @keyframes intro-text {
          0%, 60% { opacity: 0; }
          100% { opacity: 1; }
        }

        .animate-intro-text {
          animation: intro-text 3.5s ease-out forwards;
        }

        @keyframes shimmer {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.4; }
        }

        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }

        .glow-text {
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
};

export default IntroOverlay;
