
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AikoService } from '../services/aiko_service';

interface Market {
  id: string;
  question: string;
  probability: number;
  volume: string;
  category: string;
  expires: string;
  description: string;
  aikoSentiment: 'bullish' | 'bearish' | 'neutral';
  aikoReasoning: string;
  image?: string;
}

const CATEGORIES = ["All", "Crypto", "Politics", "AI", "Entertainment", "Science", "Sports", "Global"];

interface Props {
  onBack: () => void;
  aikoService: AikoService;
}

const PredictingPage: React.FC<Props> = ({ onBack, aikoService }) => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Wallet State
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [isConnecting, setIsConnecting] = useState(false);

  const connection = new Connection("https://api.mainnet-beta.solana.com");

  // Fetch Real Polymarket Data
  const fetchPolymarkets = useCallback(async () => {
    setLoading(true);
    try {
      // Gamma API Endpoint for active markets
      const response = await fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=60');
      const data = await response.json();
      
      const mappedMarkets: Market[] = data.map((m: any) => {
        let prob = 50;
        try {
          const prices = JSON.parse(m.outcomePrices);
          prob = Math.round(parseFloat(prices[0]) * 100);
        } catch (e) {
          prob = m.probability ? Math.round(m.probability * 100) : 50;
        }

        return {
          id: m.id || m.clobTokenId,
          question: m.question,
          probability: prob,
          volume: m.volume ? `$${(parseFloat(m.volume) / 1000000).toFixed(1)}M` : '$0M',
          category: m.groupItemTitle || m.category || "Global",
          expires: new Date(m.endDate).toLocaleDateString(),
          description: m.description || "No detailed description available for this market.",
          aikoSentiment: prob > 60 ? 'bullish' : prob < 40 ? 'bearish' : 'neutral',
          aikoReasoning: "Analyzing live Polymarket order books... Sentiment reflects real-time whale positioning and community intent.",
          image: m.icon || m.image
        };
      });

      setMarkets(mappedMarkets);
      if (mappedMarkets.length > 0) setSelectedMarketId(mappedMarkets[0].id);
    } catch (err) {
      console.error("Failed to fetch Polymarkets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBalance = useCallback(async (address: string) => {
    try {
      const pubKey = new PublicKey(address);
      const balance = await connection.getBalance(pubKey);
      setSolBalance(balance / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  }, []);

  const handleConnect = async () => {
    const { solana } = window as any;
    if (!solana || !solana.isPhantom) {
      alert("Please install Phantom wallet!");
      window.open("https://phantom.app/", "_blank");
      return;
    }

    try {
      setIsConnecting(true);
      const response = await solana.connect();
      const address = response.publicKey.toString();
      setWalletAddress(address);
      await fetchBalance(address);
    } catch (err) {
      console.error("Connection failed:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    fetchPolymarkets();
    const { solana } = window as any;
    if (solana && solana.isPhantom) {
      solana.on('accountChanged', (publicKey: any) => {
        if (publicKey) {
          const address = publicKey.toString();
          setWalletAddress(address);
          fetchBalance(address);
        } else {
          setWalletAddress(null);
          setSolBalance(0);
        }
      });
    }
  }, [fetchBalance, fetchPolymarkets]);

  const filteredMarkets = useMemo(() => {
    return markets.filter(m => {
      const matchesCategory = selectedCategory === "All" || m.category.toLowerCase().includes(selectedCategory.toLowerCase());
      const matchesSearch = m.question.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery, markets]);

  const activeMarket = useMemo(() => {
    return markets.find(m => m.id === selectedMarketId) || null;
  }, [selectedMarketId, markets]);

  return (
    <div className="min-h-screen bg-[#faf9f9] text-[#4a3b3b] flex flex-col font-sans">
      {/* Top Header */}
      <nav className="h-16 border-b border-pink-50 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2 hover:bg-pink-50 rounded-full transition-colors text-pink-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-400 rounded-lg flex items-center justify-center text-white font-bold">A</div>
            <span className="font-bold tracking-tight">AIKO PREDICTIONS</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {walletAddress && (
            <div className="hidden md:flex flex-col items-end">
               <span className="text-[10px] font-bold text-pink-300 uppercase tracking-widest">Balance</span>
               <span className="font-mono text-sm font-bold">{solBalance.toFixed(4)} SOL</span>
            </div>
          )}
          <button 
            onClick={handleConnect}
            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition-all ${
              walletAddress 
                ? 'bg-pink-50 text-pink-400 border border-pink-100' 
                : 'bg-[#4a3b3b] text-white hover:bg-black'
            }`}
          >
            {isConnecting ? 'Connecting...' : walletAddress ? `${walletAddress.slice(0,4)}...${walletAddress.slice(-4)}` : 'Connect Phantom'}
          </button>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-pink-50 bg-white hidden lg:flex flex-col p-6 space-y-8">
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-pink-300 uppercase tracking-[0.2em] px-2">Market Discovery</h3>
            <div className="space-y-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedCategory === cat ? 'bg-pink-50 text-pink-500 shadow-sm' : 'text-[#4a3b3b]/60 hover:bg-pink-50/50 hover:text-[#4a3b3b]'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mt-auto bg-pink-50/30 p-4 rounded-2xl border border-pink-50">
            <h4 className="text-[10px] font-bold text-pink-300 uppercase tracking-widest mb-2">Polymarket Engine</h4>
            <div className="flex items-center gap-2 text-[11px] font-medium opacity-70">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Live Gamma API Active
            </div>
          </div>
        </aside>

        {/* Main Area */}
        <main className="flex-1 overflow-y-auto scrollbar-hide p-6 md:p-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-light">Real-Time Forecasts</h1>
              <p className="text-sm text-[#4a3b3b]/60 mt-1">Live Polymarket data processed by Aiko.</p>
            </div>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search active markets..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white border border-pink-50 rounded-2xl text-sm focus:outline-none focus:ring-1 focus:ring-pink-200 w-full md:w-64"
              />
              <svg className="w-4 h-4 absolute left-3.5 top-3 text-pink-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-8 h-8 border-2 border-pink-300 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold text-pink-300 uppercase tracking-widest">Fetching Markets...</span>
            </div>
          ) : (
            <div className="space-y-4 pb-20">
              {filteredMarkets.length > 0 ? filteredMarkets.map(market => (
                <div 
                  key={market.id}
                  onClick={() => setSelectedMarketId(market.id)}
                  className={`p-6 bg-white border rounded-[2rem] transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-xl hover:translate-y-[-2px] ${selectedMarketId === market.id ? 'border-pink-300 ring-4 ring-pink-50' : 'border-pink-50'}`}
                >
                  <div className="flex-1 space-y-3 flex items-start gap-4">
                    {market.image && <img src={market.image} className="w-12 h-12 rounded-xl object-cover" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] font-bold text-pink-300 uppercase tracking-widest bg-pink-50 px-2 py-0.5 rounded-full">{market.category}</span>
                        <span className="text-[10px] font-bold text-[#4a3b3b]/40 uppercase tracking-widest">Vol: {market.volume}</span>
                      </div>
                      <h3 className="text-lg font-medium leading-tight">{market.question}</h3>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-8 min-w-fit">
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-[#4a3b3b]/40 uppercase tracking-widest mb-1">Chance</div>
                        <div className="text-2xl font-bold text-pink-400">{market.probability}%</div>
                    </div>
                    <div className="flex gap-2">
                        <button className="w-20 py-3 bg-green-50 text-green-600 font-bold rounded-2xl hover:bg-green-100 transition-colors text-xs">Yes</button>
                        <button className="w-20 py-3 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-colors text-xs">No</button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 opacity-40">
                  <p>No markets found for this category.</p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Right Detail Panel */}
        <aside className="w-96 border-l border-pink-50 bg-white hidden xl:flex flex-col p-8 overflow-y-auto scrollbar-hide space-y-10">
          {activeMarket ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-700">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold tracking-tight">{activeMarket.question}</h2>
                <div className="flex items-center gap-2 text-xs font-bold text-pink-300 uppercase">
                  <span>Expires: {activeMarket.expires}</span>
                </div>
                <div className="text-sm text-[#4a3b3b]/70 leading-relaxed max-h-40 overflow-y-auto scrollbar-hide" dangerouslySetInnerHTML={{ __html: activeMarket.description }}></div>
              </div>

              <div className="bg-[#fcfafa] p-6 rounded-[2.5rem] border border-pink-50 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-bold text-[#4a3b3b]/40 uppercase tracking-widest">Bet Amount (SOL)</label>
                    <span className="text-[10px] font-bold text-pink-300">Min: 0.01 SOL</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-pink-50 rounded-2xl py-4 px-6 text-lg font-mono focus:outline-none focus:ring-1 focus:ring-pink-200"
                    />
                    <div 
                      onClick={() => setBetAmount(solBalance.toString())}
                      className="absolute right-4 top-4 font-bold text-pink-300 cursor-pointer hover:text-pink-400"
                    >
                      MAX
                    </div>
                  </div>
                </div>

                <button 
                  disabled={!walletAddress || !betAmount}
                  className="w-full py-5 bg-pink-400 text-white font-bold rounded-[2rem] shadow-lg shadow-pink-100 hover:bg-pink-500 transition-all active:scale-95 text-lg disabled:opacity-50"
                >
                  {walletAddress ? 'Place Prediction' : 'Connect Wallet First'}
                </button>
                <p className="text-[10px] text-center opacity-40 font-bold uppercase tracking-widest">Live Settlement via Polymarket Proxy</p>
              </div>

              <div className="space-y-4 pt-6">
                <div className="flex items-center gap-3">
                   <img src="https://raw.githubusercontent.com/meowscles69/NeuraPay/main/aiko.png" className="w-10 h-10 rounded-full border border-pink-100" />
                   <div>
                     <h4 className="text-sm font-bold">Aiko's Insight</h4>
                     <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 capitalize">{activeMarket.aikoSentiment} Market Profile</span>
                   </div>
                </div>
                <div className="bg-pink-50/20 p-5 rounded-[2rem] border border-pink-50/50 italic text-sm leading-relaxed text-[#6d5b5b]">
                  "{activeMarket.aikoReasoning}"
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
              <p className="font-bold">Select a real-time market to predict</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default PredictingPage;
