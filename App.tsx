
import React, { useState, useEffect } from 'react';
import ARGame from './components/ARGame';

type GameState = 'LOADING' | 'MENU' | 'TUTORIAL' | 'PLAYING' | 'WIN';
type TutorialStep = 'WAITING' | 'PISTOL' | 'TRIGGER' | 'COMPLETE';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('LOADING');
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [level, setLevel] = useState(1);
  const [showLevelUp, setShowLevelUp] = useState(false);
  
  // Tutorial State
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('WAITING');
  const [handState, setHandState] = useState({ isPistol: false, isTrigger: false, isPresent: false });
  const [waitingTime, setWaitingTime] = useState(0);

  // Level thresholds and emojis
  const levelIcons = ["🎯", "⚡", "🔥", "💎", "👑"];

  useEffect(() => {
    const newLevel = Math.min(5, Math.floor(score / 400) + 1);
    if (newLevel > level) {
      setLevel(newLevel);
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 3000);
    }
    if (score >= 2000 && gameState === 'PLAYING') {
      setGameState('WIN');
    }
  }, [score, level, gameState]);

  useEffect(() => {
    let interval: any;
    if (gameState === 'TUTORIAL' && tutorialStep === 'WAITING') {
      interval = setInterval(() => setWaitingTime(prev => prev + 1), 1000);
    } else {
      setWaitingTime(0);
    }
    return () => clearInterval(interval);
  }, [gameState, tutorialStep]);

  const handleLoaded = () => setGameState('MENU');
  const handleError = (msg: string) => { setError(msg); setGameState('LOADING'); };

  const startEngagement = () => {
    const hasSeenTutorial = sessionStorage.getItem('pistol_palms_tutorial');
    if (hasSeenTutorial) {
      resetGame();
      setGameState('PLAYING');
    } else {
      setGameState('TUTORIAL');
      setTutorialStep('WAITING');
    }
  };

  const resetGame = () => {
    setScore(0);
    setCombo(0);
    setLevel(1);
  };

  const skipTutorial = () => {
    sessionStorage.setItem('pistol_palms_tutorial', 'true');
    resetGame();
    setGameState('PLAYING');
  };

  const handleHandStatus = (status: { isPistol: boolean, isTrigger: boolean, isPresent: boolean }) => {
    setHandState(status);
    
    if (gameState === 'TUTORIAL') {
      if (tutorialStep === 'WAITING' && status.isPresent) {
        setTutorialStep('PISTOL');
      } else if (tutorialStep === 'PISTOL' && status.isPistol) {
        setTutorialStep('TRIGGER');
      } else if (tutorialStep === 'TRIGGER' && status.isTrigger) {
        setTutorialStep('COMPLETE');
        sessionStorage.setItem('pistol_palms_tutorial', 'true');
        setTimeout(() => {
          resetGame();
          setGameState('PLAYING');
        }, 1500);
      }
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#020617] text-white font-sans overflow-hidden select-none">
      {/* Playful Scanline Overlay */}
      <div className="absolute inset-0 z-[100] pointer-events-none opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,255,0.05),rgba(0,255,0,0.02),rgba(0,255,255,0.05))] bg-[length:100%_3px,4px_100%]"></div>
      
      {/* Loading Screen */}
      {gameState === 'LOADING' && !error && (
        <div className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-slate-950">
          <div className="relative flex items-center justify-center">
            <div className="w-24 h-24 border-b-4 border-magenta-500 rounded-full animate-spin absolute" style={{ borderColor: '#d946ef transparent' }}></div>
            <div className="w-16 h-16 border-t-4 border-cyan-400 rounded-full animate-spin-reverse" style={{ borderColor: 'transparent #22d3ee' }}></div>
            <span className="text-2xl">👉</span>
          </div>
          <h2 className="text-2xl font-black mt-12 tracking-[0.3em] uppercase bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-fuchsia-500">PISTOL PALMS</h2>
          <p className="text-slate-500 mt-2 text-[10px] font-bold tracking-widest uppercase animate-pulse">Warming up the finger-blasters...</p>
        </div>
      )}

      {/* Main Menu */}
      {gameState === 'MENU' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#020617]/80 backdrop-blur-md">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,70,239,0.15),transparent_70%)] animate-pulse"></div>
          
          <div className="relative z-10 text-center px-4">
             <div className="mb-4 flex items-center justify-center gap-3">
                <span className="text-fuchsia-500 text-xl">✨</span>
                <span className="text-cyan-400 font-black tracking-[0.4em] text-[10px] uppercase">Neural Pop Experience</span>
                <span className="text-fuchsia-500 text-xl">✨</span>
             </div>
             <h1 className="text-8xl md:text-9xl font-black mb-6 tracking-tighter leading-[0.85] text-white italic">
                PISTOL<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-yellow-300 drop-shadow-[0_0_20px_rgba(217,70,239,0.4)]">PALMS</span>
             </h1>
             
             <div className="flex flex-col gap-6 mt-12 items-center">
                <button 
                  onClick={startEngagement} 
                  className="group relative px-16 py-5 overflow-hidden bg-white text-black text-2xl font-black rounded-2xl transition-all hover:scale-110 active:scale-95 shadow-[0_15px_40px_rgba(255,255,255,0.2)]"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    PLAY NOW <span className="text-3xl group-hover:translate-x-2 transition-transform">👉</span>
                  </span>
                </button>
                
                <div className="flex gap-4 mt-8">
                   <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10 text-[9px] font-black tracking-widest uppercase text-slate-400">
                      High Score: 2000
                   </div>
                   <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10 text-[9px] font-black tracking-widest uppercase text-slate-400">
                      Latency: Ultra Low
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Win Screen */}
      {gameState === 'WIN' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/98 backdrop-blur-3xl animate-in zoom-in fade-in duration-700">
          <div className="text-center p-8">
             <div className="text-yellow-400 text-7xl mb-6 animate-bounce">🏆</div>
             <h2 className="text-6xl font-black text-white uppercase tracking-tighter mb-2 italic">POPPING CHAMP!</h2>
             <p className="text-fuchsia-400 font-bold tracking-[0.3em] uppercase text-xs mb-12">Target Population: Zeroed</p>
             
             <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-12">
                <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                   <div className="text-[10px] text-slate-500 font-black uppercase mb-1">Total Pop Score</div>
                   <div className="text-5xl font-black text-white tabular-nums">{score}</div>
                </div>
                <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                   <div className="text-[10px] text-slate-500 font-black uppercase mb-1">Finger Rank</div>
                   <div className="text-5xl font-black text-yellow-400 italic">S+</div>
                </div>
             </div>

             <button 
               onClick={() => setGameState('MENU')} 
               className="px-12 py-5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white font-black text-xl rounded-2xl transition-all hover:scale-110"
             >
               TRY AGAIN?
             </button>
          </div>
        </div>
      )}

      {/* Level Up Splash */}
      {showLevelUp && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-500">
           <div className="bg-gradient-to-r from-fuchsia-600/20 via-white/10 to-cyan-600/20 backdrop-blur-lg border-y-2 border-white/20 w-full py-10 text-center shadow-[0_0_100px_rgba(217,70,239,0.4)]">
              <h3 className="text-9xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]">LEVEL UP!</h3>
              <p className="text-white font-black tracking-[0.5em] text-lg mt-2 flex items-center justify-center gap-4">
                 <span>{levelIcons[level-2]}</span> 
                 REACHED LEVEL {level} 
                 <span>{levelIcons[level-2]}</span>
              </p>
           </div>
        </div>
      )}

      {/* Tutorial Overlay */}
      {gameState === 'TUTORIAL' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-end pb-24 px-12 text-center pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/20 p-10 rounded-[2.5rem] max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.6)] pointer-events-auto animate-in slide-in-from-bottom-20 duration-500">
            {tutorialStep === 'WAITING' && (
              <div className="space-y-6">
                <div className="text-4xl">👋</div>
                <h3 className="text-2xl font-black text-white uppercase italic">High Five!</h3>
                <p className="text-slate-300 font-medium">Show your hand to the camera so we can sync the neural blasters.</p>
                <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
                   <div className={`h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-700 ${handState.isPresent ? 'w-full' : 'w-0'}`}></div>
                </div>
                <button onClick={skipTutorial} className="text-[10px] text-slate-500 font-bold uppercase tracking-widest hover:text-white underline">Skip Intro</button>
              </div>
            )}
            
            {tutorialStep === 'PISTOL' && (
              <div className="space-y-6">
                <div className="text-4xl">👉</div>
                <h3 className="text-2xl font-black text-white uppercase italic">The Finger Gun</h3>
                <p className="text-slate-300 font-medium">Point your index finger like a pistol. Keep your other fingers tucked in tight!</p>
                <div className={`py-3 rounded-2xl border-2 transition-all ${handState.isPistol ? 'bg-fuchsia-500/20 border-fuchsia-500 scale-105' : 'bg-white/5 border-white/10'}`}>
                   <span className="text-[10px] font-black uppercase tracking-widest">{handState.isPistol ? 'LOCKED & LOADED ✓' : 'WAITING FOR POSE...'}</span>
                </div>
              </div>
            )}

            {tutorialStep === 'TRIGGER' && (
              <div className="space-y-6">
                <div className="text-4xl animate-bounce">💥</div>
                <h3 className="text-2xl font-black text-white uppercase italic">Fire Away!</h3>
                <p className="text-slate-300 font-medium">Pull your thumb down to the side of your hand to fire. Give it a try!</p>
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                   <div className={`absolute inset-0 rounded-full border-4 border-cyan-400/30 ${handState.isTrigger ? 'animate-ping' : ''}`}></div>
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${handState.isTrigger ? 'bg-cyan-400 scale-150 shadow-[0_0_20px_rgba(34,211,238,0.8)]' : 'bg-white/10'}`}>
                      <span className="text-xl">🎯</span>
                   </div>
                </div>
              </div>
            )}

            {tutorialStep === 'COMPLETE' && (
              <div className="py-6 space-y-2">
                <h3 className="text-4xl font-black text-green-400 uppercase italic tracking-tighter">LET'S POP!</h3>
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Starting Simulation...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Playful HUD */}
      {(gameState === 'PLAYING' || gameState === 'TUTORIAL') && (
        <>
          {/* Rounded Corner HUDs */}
          <div className="absolute top-8 left-8 z-30 pointer-events-none flex items-center gap-6">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-5 rounded-[2rem] flex flex-col gap-0 shadow-2xl">
              <span className="text-[9px] font-black text-fuchsia-400 uppercase tracking-widest ml-1">Pop Score</span>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tracking-tighter tabular-nums text-white leading-none">{score.toLocaleString()}</span>
                <span className="text-slate-500 font-bold text-xs">/ 2000</span>
              </div>
              <div className="mt-3 w-40 h-2 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min(100, (score / 2000) * 100)}%` }}
                ></div>
              </div>
            </div>

            {combo > 1 && (
              <div className="bg-yellow-400 text-black px-6 py-4 rounded-[1.5rem] shadow-[0_10px_30px_rgba(250,204,21,0.4)] animate-bounce-short">
                <div className="text-[9px] font-black uppercase leading-none opacity-60">Mega Pop Chain</div>
                <div className="text-3xl font-black italic leading-none mt-1">x{combo}</div>
              </div>
            )}
          </div>

          <div className="absolute top-8 right-8 z-30 pointer-events-none">
             <div className="bg-white text-black px-8 py-4 rounded-[2rem] font-black italic flex items-center gap-3 shadow-2xl">
                <span className="text-2xl">{levelIcons[level-1]}</span>
                <span className="tracking-widest uppercase">LVL {level}</span>
             </div>
          </div>

          {/* Bottom Feed */}
          <div className="absolute bottom-8 left-12 z-30 pointer-events-none opacity-50 flex items-center gap-4">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <div className="font-mono text-[9px] text-cyan-400 font-bold uppercase tracking-widest">
                Neural Link: Stable // Ready for Pop
             </div>
          </div>
        </>
      )}

      <ARGame 
        onLoaded={handleLoaded} 
        onError={handleError} 
        isActive={gameState === 'PLAYING'}
        onScoreUpdate={(s) => setScore(prev => {
          const inc = s * (combo > 0 ? combo : 1);
          return Math.min(2000, prev + inc);
        })}
        onComboUpdate={setCombo}
        onHandStatus={handleHandStatus}
        comboCount={combo}
      />
    </div>
  );
};

export default App;
