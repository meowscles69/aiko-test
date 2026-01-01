
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from "@solana/web3.js";
import { AikoService } from '../services/aiko_service';

// Using a valid Base58 string for the program ID to avoid "Invalid public key input" errors.
// This is a placeholder address. In a real deployment, replace with your actual Program ID.
const PROGRAM_ID_STR = "11111111111111111111111111111111"; 
const USDC_MINT_STR = "EPjFW3F29z6qa2qdxyFZGzG7LSZL38t1GN5nSptE7mP";

interface Market {
  id: string;
  question: string;
  totalYes: number;
  totalNo: number;
  endTime: number;
  isResolved: boolean;
  outcome: number; // 0: Open, 1: Yes, 2: No
  category: string;
}

const CATEGORIES = ["All", "Crypto", "Politics", "AI", "Sports"];

interface Props {
  onBack: () => void;
  aikoService: AikoService;
}

const PredictingPage: React.FC<Props> = ({ onBack, aikoService }) => {
  const [markets, setMarkets] = useState<Market[]>([
    {
      id: "m1",
      question: "Will Solana flip Ethereum in Market Cap by 2026?",
      totalYes: 150000,
      totalNo: 450000,
      endTime: Date.now() + 10000000,
      isResolved: false,
      outcome: 0,
      category: "Crypto"
    },
    {
      id: "m2",
      question: "Will a GPT-5 model be released by OpenAI in 2025?",
      totalYes: 850000,
      totalNo: 210000,
      endTime: Date.now() + 5000000,
      isResolved: false,
      outcome: 0,
      category: "AI"
    }
  ]);
  
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>("m1");
  const [betAmount, setBetAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const connection = new Connection("https://api.mainnet-beta.solana.com");

  const fetchBalance = useCallback(async (address: string) => {
    try {
      if (!address) return;
      const pubKey = new PublicKey(address);
      const balance = await connection.getBalance(pubKey);
      // Logic to fetch actual USDC token balance would use getParsedTokenAccountsByOwner
      setUsdcBalance(124.50); // Mocked for UI
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  }, [connection]);

  const handleConnect = async () => {
    const { solana } = window as any;
    if (!solana?.isPhantom) {
      alert("Please install Phantom wallet!");
      return;
    }
    try {
      const resp = await solana.connect();
      const address = resp.publicKey.toString();
      setWalletAddress(address);
      await fetchBalance(address);
    } catch (e) {
      console.error("Connection failed:", e);
    }
  };

  const handleBet = async (isYes: boolean) => {
    if (!walletAddress || !betAmount) return;
    setIsProcessing(true);
    try {
      const userPubKey = new PublicKey(walletAddress);
      // In a real app, you'd use the Anchor program here:
      // const program = new Program(idl, PROGRAM_ID, provider);
      // await program.methods.bet(isYes, new anchor.BN(betAmount)).accounts({...}).rpc();
      
      console.log(`Betting ${betAmount} USDC on ${isYes ? 'YES' : 'NO'} using program ${PROGRAM_ID_STR}`);
      await new Promise(r => setTimeout(r, 2000)); // Simulate tx delay
      
      alert("Bet placed successfully (Simulated)!");
      setBetAmount('');
    } catch (e) {
      console.error("Bet transaction failed:", e);
      alert("Transaction failed. Check console for details.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClaim = async () => {
    if (!walletAddress) return;
    setIsProcessing(true);
    try {
      console.log("Claiming winnings...");
      await new Promise(r => setTimeout(r, 2000));
      alert("Winnings claimed (Simulated)!");
    } catch (e) {
      console.error("Claim failed:", e);
      alert("Claim failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredMarkets = useMemo(() => {
    return markets.filter(m => selectedCategory === "All" || m.category === selectedCategory);
  }, [selectedCategory, markets]);

  const activeMarket = useMemo(() => {
    return markets.find(m => m.id === selectedMarketId) || markets[0];
  }, [selectedMarketId, markets]);

  const totalPool = activeMarket.totalYes + activeMarket.totalNo;
  const probYes = totalPool > 0 ? Math.round((activeMarket.totalYes / totalPool) * 100) : 50;

  return (
    <div className="min-h-screen bg-white text-[#4a3b3b] flex flex-col font-sans">
      <nav className="h-16 border-b border-pink-50 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-pink-50 rounded-full text-pink-300 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-pink-400 leading-none">AIKO PREDICT</span>
            <span className="text-[8px] font-mono text-pink-200 mt-1 uppercase">Solana Mainnet</span>
          </div>
        </div>
        <button 
          onClick={handleConnect}
          className="px-6 py-2 bg-pink-400 text-white font-bold rounded-full shadow-sm hover:bg-pink-500 transition-all text-sm"
        >
          {walletAddress ? `${walletAddress.slice(0,4)}...${walletAddress.slice(-4)}` : "Connect Wallet"}
        </button>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-pink-50 p-6 flex flex-col gap-6 bg-[#fafafa]/30">
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold text-pink-300 uppercase tracking-widest px-2">Categories</h3>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedCategory === cat ? 'bg-pink-50 text-pink-500 shadow-sm' : 'hover:bg-pink-50/50 text-[#4a3b3b]/60'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          {walletAddress && (
            <div className="mt-auto p-4 bg-pink-50/30 rounded-2xl border border-pink-100 animate-in fade-in slide-in-from-bottom-2">
              <div className="text-[9px] font-bold text-pink-300 uppercase tracking-wider mb-1">Your Balance</div>
              <div className="text-xl font-bold text-[#4a3b3b]">{usdcBalance.toFixed(2)} USDC</div>
            </div>
          )}
        </aside>

        {/* Market List */}
        <main className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-light">Open Predictions</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-pink-200 uppercase tracking-widest">Live Markets</span>
            </div>
          </div>
          <div className="grid gap-4">
            {filteredMarkets.map(m => (
              <div 
                key={m.id}
                onClick={() => setSelectedMarketId(m.id)}
                className={`p-6 rounded-[2.5rem] border transition-all cursor-pointer flex items-center justify-between group ${selectedMarketId === m.id ? 'border-pink-300 bg-white ring-4 ring-pink-50 shadow-xl' : 'border-pink-50 hover:border-pink-100 bg-white hover:shadow-md'}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-pink-300 uppercase px-2 py-0.5 bg-pink-50 rounded-full">{m.category}</span>
                    <span className="text-[10px] font-bold text-pink-100 uppercase">Ends in 4d</span>
                  </div>
                  <h3 className="text-lg font-medium group-hover:text-pink-400 transition-colors">{m.question}</h3>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-pink-400">{Math.round((m.totalYes / (m.totalYes + m.totalNo)) * 100)}%</div>
                  <div className="text-[10px] font-bold text-pink-200 uppercase tracking-tighter">Yes Probability</div>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Order Panel */}
        <aside className="w-[400px] border-l border-pink-50 p-8 space-y-8 bg-white overflow-y-auto scrollbar-hide">
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight leading-tight">{activeMarket.question}</h2>
              <div className="flex items-center gap-2 text-[10px] font-bold text-pink-200 uppercase">
                <span>Total Pool: ${(activeMarket.totalYes + activeMarket.totalNo).toLocaleString()}</span>
                <span>•</span>
                <span>USDC Only</span>
              </div>
            </div>

            <div className="p-6 bg-pink-50/10 rounded-[2rem] border border-pink-50 space-y-6">
              <div className="flex justify-between items-end">
                <div className="text-center">
                  <div className="text-[10px] font-bold text-pink-300 uppercase mb-1">Yes Pool</div>
                  <div className="font-bold text-[#4a3b3b]">${activeMarket.totalYes.toLocaleString()}</div>
                </div>
                <div className="h-2 flex-1 bg-pink-50 mx-6 mb-2 rounded-full overflow-hidden">
                  <div className="h-full bg-pink-400 transition-all duration-1000" style={{ width: `${probYes}%` }}></div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-bold text-pink-300 uppercase mb-1">No Pool</div>
                  <div className="font-bold text-[#4a3b3b]">${activeMarket.totalNo.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between px-2">
                <label className="text-[10px] font-bold text-pink-300 uppercase tracking-widest">Investment</label>
                <span className="text-[10px] font-bold text-pink-200 uppercase">Min 1.00 USDC</span>
              </div>
              <div className="relative">
                <input 
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-pink-50/10 border border-pink-50 rounded-[1.5rem] p-5 text-2xl font-mono focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all"
                />
                <span className="absolute right-6 top-6 text-xs font-bold text-pink-200">USDC</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleBet(true)}
                disabled={isProcessing || !walletAddress || !betAmount}
                className="py-5 bg-green-400 text-white font-bold rounded-[1.5rem] hover:bg-green-500 transition-all disabled:opacity-30 shadow-lg shadow-green-100 active:scale-95 flex flex-col items-center"
              >
                <span className="text-xs uppercase tracking-widest">Buy</span>
                <span className="text-lg">YES</span>
              </button>
              <button 
                onClick={() => handleBet(false)}
                disabled={isProcessing || !walletAddress || !betAmount}
                className="py-5 bg-red-400 text-white font-bold rounded-[1.5rem] hover:bg-red-500 transition-all disabled:opacity-30 shadow-lg shadow-red-100 active:scale-95 flex flex-col items-center"
              >
                <span className="text-xs uppercase tracking-widest">Buy</span>
                <span className="text-lg">NO</span>
              </button>
            </div>

            {activeMarket.isResolved && (
              <button 
                onClick={handleClaim}
                disabled={isProcessing}
                className="w-full py-5 bg-pink-400 text-white font-bold rounded-[1.5rem] shadow-lg shadow-pink-100 animate-pulse"
              >
                Claim Your Winnings
              </button>
            )}
          </div>

          <div className="bg-[#fcfafa] p-6 rounded-[2.5rem] border border-pink-50 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src="https://raw.githubusercontent.com/meowscles69/NeuraPay/main/aiko.png" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <span className="text-xs font-bold text-[#4a3b3b] block">Aiko's Real-time Insight</span>
                <span className="text-[10px] font-bold text-pink-300 uppercase tracking-widest">Active Node v4.9</span>
              </div>
            </div>
            <p className="text-xs italic text-[#6d5b5b] leading-relaxed bg-white p-4 rounded-2xl border border-pink-50/50">
              "My analysis of the order depth suggests a significant intent shift towards the YES outcome. 
              The on-chain volume is starting to peak, which usually precedes a decision point. Evolve honestly."
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PredictingPage;
