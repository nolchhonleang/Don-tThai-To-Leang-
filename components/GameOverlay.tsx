import React from 'react';
import { GameState } from '../types';

interface GameOverlayProps {
  gameState: GameState;
  score: number;
  highScore: number;
  cameraActive: boolean;
  onStartGame: (e?: React.MouseEvent) => void;
  onResume?: (e?: React.MouseEvent) => void;
}

export const GameOverlay: React.FC<GameOverlayProps> = ({
  gameState,
  score,
  highScore,
  cameraActive,
  onStartGame,
  onResume
}) => {
  if (gameState === GameState.MENU) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm px-4">
        <div className="bg-gray-900/90 p-8 rounded-2xl shadow-2xl border border-gray-700 max-w-lg w-full text-center">
          <h1 className="text-5xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-red-600 font-display mb-2 drop-shadow-md">
            Don'tThai<br/>to-Leang
          </h1>
          <p className="text-gray-400 font-mono text-sm tracking-widest mb-8">CREATED BY NOL CHHONLEANG</p>
          
          <div className="grid gap-4 mb-8 text-left">
             <div className="flex items-center gap-4 bg-gray-800 p-3 rounded-lg border border-gray-700">
                <span className="text-3xl">👌</span>
                <div>
                  <p className="font-bold text-white text-lg">PINCH TO CONTROL</p>
                  <p className="text-xs text-gray-400">Join Thumb & Index finger. Hold pinch to move.</p>
                </div>
             </div>
          </div>

          <button 
            onClick={onStartGame}
            disabled={!cameraActive}
            className={`w-full font-bold py-4 text-xl font-display rounded-xl transition-all shadow-lg 
              ${cameraActive 
                ? 'bg-red-600 hover:bg-red-500 text-white hover:shadow-red-500/50' 
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
          >
            {cameraActive ? "START GAME" : "INITIALIZING CAMERA..."}
          </button>
        </div>
      </div>
    );
  }

  if (gameState === GameState.PAUSED) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md px-4">
         <div className="bg-gray-900/90 p-8 rounded-2xl shadow-2xl border border-white/20 text-center">
            <h2 className="text-4xl text-white font-display mb-6 tracking-wider">PAUSED</h2>
            <div className="flex flex-col gap-4">
               <button 
                  onClick={onResume}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full text-lg transition-transform hover:scale-105"
               >
                  RESUME
               </button>
               <button 
                  onClick={onStartGame}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full text-lg transition-transform hover:scale-105"
               >
                  RESTART
               </button>
            </div>
         </div>
      </div>
    );
  }

  if (gameState === GameState.GAME_OVER) {
    return (
      <div 
        onClick={onStartGame}
        className="absolute inset-0 z-50 flex items-center justify-center bg-red-900/80 backdrop-blur-md px-4 cursor-pointer"
      >
        <div className="bg-black/80 p-6 md:p-10 rounded-2xl text-center border-2 border-red-500 shadow-[0_0_50px_rgba(255,0,0,0.5)] max-w-2xl w-full">
          <h1 className="text-5xl md:text-6xl text-white font-display mb-4 drop-shadow-[0_5px_0_#000] leading-tight">
             BOOM! <br/>
             <span className="text-red-500 text-3xl md:text-5xl">DON'T THAI TO LEANG</span>
          </h1>
          
          <div className="flex justify-center gap-8 mb-8 font-mono">
              <div className="text-center">
                  <div className="text-sm text-gray-400">SCORE</div>
                  <div className="text-3xl text-white font-bold">{score}</div>
              </div>
              <div className="text-center">
                  <div className="text-sm text-yellow-500">BEST</div>
                  <div className="text-3xl text-yellow-400 font-bold">{highScore}</div>
              </div>
          </div>

          <div className="bg-white hover:bg-gray-200 text-black font-black py-3 px-10 text-xl font-display rounded-full transition-transform hover:scale-105 inline-block">
            TAP SCREEN TO REPLAY
          </div>
        </div>
      </div>
    );
  }

  return null;
};