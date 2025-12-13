import React, { useState, useEffect, useRef } from 'react';
import { GameState, DONT_THAI_TO_LEANG_BG_URL, Entity } from './types';
import { AudioEngine } from './systems/AudioSystem';
import { VisionSystem } from './systems/VisionSystem';
import { GameOverlay } from './components/GameOverlay';

// --- GAME CONSTANTS ---
// Base dimensions (will be scaled by screen height)
// REDUCED SIZES (~20% smaller than previous "Big" version)
const BASE_SOLDIER_WIDTH = 65; 
const BASE_SOLDIER_HEIGHT = 120; 
const BASE_BOMB_RADIUS = 28; 
const BASE_SPEED = 5; // Base speed reference (Normal speed)

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

// Instantiate systems outside component
const audio = new AudioEngine();
const vision = new VisionSystem();

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.LOADING);
  const gameStateRef = useRef<GameState>(GameState.LOADING);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isPinching, setIsPinching] = useState(false);

  // Refs for Game Loop
  const playerY = useRef(50); 
  const obstacles = useRef<Entity[]>([]);
  const particles = useRef<Particle[]>([]);
  const gameLoopRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastSpawnTime = useRef<number>(0);
  const speedRef = useRef(0); // Starts at 0, calculated in loop
  const scoreRef = useRef(0);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackingDotRef = useRef<HTMLDivElement>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const initSystems = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user', 
            width: { ideal: 640 }, 
            height: { ideal: 480 } 
          }, 
          audio: false 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
             videoRef.current?.play();
             setCameraActive(true);
          };
        }

        await vision.init();
        
        if (gameStateRef.current === GameState.LOADING) {
          setGameState(GameState.MENU);
          gameStateRef.current = GameState.MENU;
        }

      } catch (err) {
        console.error("System Init Error", err);
        alert("Camera permission denied.");
      }
    };

    initSystems();
  }, []);

  // --- VISION LOOP ---
  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      // Continue tracking even when paused
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const result = vision.processFrame(videoRef.current);
        if (result && result.isPinching) {
          setIsPinching(true);
          playerY.current = result.y * 100;
          
          if (trackingDotRef.current) {
            trackingDotRef.current.style.display = 'block';
            trackingDotRef.current.style.left = `${(1 - result.x) * 100}%`;
            trackingDotRef.current.style.top = `${result.y * 100}%`;
          }
        } else {
          setIsPinching(false);
          if (trackingDotRef.current) {
             trackingDotRef.current.style.display = 'none';
          }
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // --- DRAWING HELPERS ---
  const spawnExplosion = (x: number, y: number, scale: number) => {
    for (let i = 0; i < 40; i++) {
      particles.current.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 20 * scale,
        vy: (Math.random() - 0.5) * 20 * scale,
        life: 1.0,
        color: `hsl(${Math.random() * 40}, 100%, 50%)`, // More red/orange
        size: (Math.random() * 10 + 5) * scale
      });
    }
  };

  const drawSoldier = (ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, scale: number) => {
      ctx.save();
      // Translate to position (x, y is top-left in logic, but let's center for rotation)
      const scaledWidth = BASE_SOLDIER_WIDTH * scale;
      const scaledHeight = BASE_SOLDIER_HEIGHT * scale;
      
      ctx.translate(x + scaledWidth / 2, y + scaledHeight / 2);
      
      // VISUAL_SCALE: Shrink the detailed drawing to fit the new smaller dimensions
      const VISUAL_SCALE = 0.8; 
      ctx.scale(scale * VISUAL_SCALE, scale * VISUAL_SCALE);

      // --- ANIMATION CALCULATIONS ---
      // Allow slower animation for very slow speeds (0.02 min instead of 0.1)
      const animSpeed = Math.max(0.02, speedRef.current * 0.04);
      const cycle = frame * animSpeed;

      // Vertical Bobbing
      const bobY = Math.abs(Math.sin(cycle * 2)) * (3 + speedRef.current * 0.2);
      ctx.translate(0, -bobY);
      
      // Forward Lean
      const lean = 0.15 + Math.min(0.4, speedRef.current * 0.035); 
      ctx.rotate(lean);

      // --- COLORS ---
      const C_SKIN = '#eac096'; // Brighter skin
      const C_UNIFORM_DARK = '#253325'; // Slightly lighter for clarity
      const C_UNIFORM_LIGHT = '#4b5e46';
      const C_VEST = '#1a1a1a';
      const C_HELMET = '#3a4a39';
      const C_BOOTS = '#111';

      // --- LIMB GEOMETRY ---
      const legAmp = 1.2;
      const leftThigh = Math.sin(cycle) * legAmp;
      const rightThigh = Math.sin(cycle + Math.PI) * legAmp;
      const kneeBendAmp = 2.2;
      const leftCalf = Math.max(0, Math.sin(cycle + 1.5) * kneeBendAmp); 
      const rightCalf = Math.max(0, Math.sin(cycle + Math.PI + 1.5) * kneeBendAmp);
      const leftFoot = Math.max(0, Math.sin(cycle + 0.5)) * 0.6;
      const rightFoot = Math.max(0, Math.sin(cycle + Math.PI + 0.5)) * 0.6;
      const armAmp = 1.3;
      const rightArmUpper = Math.sin(cycle) * armAmp; 
      const rightArmLower = -1.5 + Math.sin(cycle) * 0.8; 
      const leftArmUpper = Math.sin(cycle + Math.PI) * 0.4 + 0.4; 
      const leftArmLower = -1.8 + Math.cos(cycle) * 0.1; 

      // --- DRAWING ---
      const drawLimb = (len: number, w: number, dark: boolean) => {
          ctx.fillStyle = dark ? '#1e2b1e' : C_UNIFORM_DARK;
          ctx.beginPath();
          ctx.roundRect(-w/2, 0, w, len, w/2);
          ctx.fill();
          
          // Add outline for clarity
          if (!dark) {
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.fillStyle = C_UNIFORM_LIGHT;
            ctx.beginPath(); ctx.arc(0, len*0.5, w/3, 0, Math.PI*2); ctx.fill();
          }
      };

      // Shadow
      ctx.save();
      ctx.rotate(-lean);
      ctx.translate(0, bobY + 65); // Adjusted for new height
      ctx.scale(1, 0.3);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      const shadowSize = 30 * (1 - bobY/50);
      ctx.arc(0, 0, Math.max(5, shadowSize), 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      // Right Leg (Back)
      ctx.save();
      ctx.translate(0, 10); 
      ctx.rotate(rightThigh);
      drawLimb(36, 16, true); 
      ctx.translate(0, 32);
      ctx.rotate(rightCalf);
      drawLimb(36, 14, true); 
      ctx.translate(0, 36);
      ctx.rotate(rightFoot);
      ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); // Boot
      ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.lineTo(8, 12); ctx.lineTo(-9, 12); ctx.fill();
      ctx.restore();

      // Right Arm (Back)
      ctx.save();
      ctx.translate(0, -32); 
      ctx.rotate(rightArmUpper);
      drawLimb(30, 14, true);
      ctx.translate(0, 26);
      ctx.rotate(rightArmLower);
      drawLimb(28, 13, true);
      ctx.translate(0, 28);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill(); // Hand
      ctx.restore();

      // Torso
      ctx.fillStyle = C_UNIFORM_DARK;
      ctx.beginPath(); ctx.roundRect(-15, -42, 30, 60, 8); ctx.fill();
      // Outline torso
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      
      // Vest
      ctx.fillStyle = C_VEST;
      ctx.beginPath(); ctx.roundRect(-16, -38, 32, 38, 6); ctx.fill();
      ctx.strokeStyle = '#444'; ctx.lineWidth = 2; // Molle Highlights
      ctx.beginPath(); ctx.moveTo(-14, -28); ctx.lineTo(14, -28); ctx.moveTo(-14, -18); ctx.lineTo(14, -18); ctx.stroke();
      
      // Scarf
      ctx.fillStyle = '#3a4a39';
      ctx.beginPath(); ctx.moveTo(-13, -38); ctx.quadraticCurveTo(0, -28, 13, -38); ctx.lineTo(10, -48); ctx.lineTo(-10, -48); ctx.fill();

      // Head
      ctx.save();
      ctx.translate(0, -48); 
      ctx.rotate(-0.1); 
      ctx.fillStyle = C_SKIN; ctx.fillRect(-7, -3, 14, 8); // Neck
      ctx.beginPath(); ctx.ellipse(0, -14, 11, 14, 0, 0, Math.PI*2); ctx.fill(); // Face
      
      // Helmet
      ctx.fillStyle = C_HELMET;
      ctx.beginPath(); ctx.moveTo(14, -13); ctx.arc(0, -17, 14, 0, Math.PI, true); 
      ctx.lineTo(-14, -13); ctx.bezierCurveTo(-14, -7, -10, -3, -5, -4); ctx.lineTo(5, -4); 
      ctx.bezierCurveTo(10, -3, 14, -7, 14, -13); ctx.fill();
      // Helmet Highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.stroke();
      
      // Goggles
      ctx.fillStyle = '#000'; ctx.fillRect(-12, -18, 24, 7);
      ctx.fillStyle = '#222'; ctx.fillRect(-10, -17, 20, 5);
      // Goggle Reflection
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(-6, -17); ctx.lineTo(-2, -12); ctx.lineTo(-8, -12); ctx.fill();
      ctx.restore();

      // Left Leg (Front)
      ctx.save();
      ctx.translate(0, 10);
      ctx.rotate(leftThigh);
      drawLimb(36, 16, false);
      ctx.translate(0, 32);
      ctx.rotate(leftCalf);
      drawLimb(36, 14, false);
      ctx.translate(0, 36);
      ctx.rotate(leftFoot);
      ctx.fillStyle = C_BOOTS; ctx.beginPath(); 
      ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.lineTo(8, 12); ctx.lineTo(-9, 12); ctx.fill();
      ctx.fillStyle = '#444'; ctx.fillRect(-6, 3, 10, 3); // Laces
      ctx.restore();

      // Left Arm & Gun (Front)
      ctx.save();
      ctx.translate(0, -32);
      ctx.rotate(leftArmUpper);
      drawLimb(30, 14, false);
      ctx.translate(0, 26);
      ctx.rotate(leftArmLower);
      drawLimb(28, 13, false);
      
      // Hand
      ctx.translate(0, 28);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();
      
      // Gun
      ctx.rotate(-Math.PI/2 + 0.2); 
      ctx.translate(0, -7);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-7, -6, 20, 11); // Receiver
      ctx.fillRect(-20, 0, 13, 6); // Stock tube
      ctx.beginPath(); ctx.moveTo(-26, -3); ctx.lineTo(-20, -3); ctx.lineTo(-20, 7); ctx.lineTo(-26, 10); ctx.fill(); // Stock Butt
      ctx.fillStyle = '#000'; ctx.fillRect(0, 5, 8, 10); // Mag
      ctx.fillStyle = '#222'; ctx.fillRect(13, -5, 20, 9); // Barrel
      ctx.fillStyle = '#111'; ctx.fillRect(33, -3, 6, 6); // Muzzle
      
      ctx.restore();

      ctx.restore();
  };

  const drawBomb = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      
      const radius = BASE_BOMB_RADIUS;

      // Stronger Glow
      const pulse = 15 + Math.sin(Date.now() / 80) * 8;
      ctx.shadowBlur = pulse;
      ctx.shadowColor = 'rgba(255, 30, 30, 0.9)';
      
      // Body - Dark Metal
      const gradient = ctx.createRadialGradient(-10, -10, 4, 0, 0, radius);
      gradient.addColorStop(0, '#666');
      gradient.addColorStop(0.3, '#333');
      gradient.addColorStop(0.9, '#111');
      gradient.addColorStop(1, '#000');
      
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
      
      // Hard rim light for clarity
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Spikes - Sharp and dark
      ctx.fillStyle = '#1a1a1a';
      for(let i=0; i<8; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / 8);
        ctx.beginPath();
        ctx.moveTo(-5, -radius + 2);
        ctx.lineTo(0, -radius - 12); // Longer spikes
        ctx.lineTo(5, -radius + 2);
        ctx.fill();
        ctx.restore();
      }

      // Skull - Larger and clearer
      ctx.save();
      ctx.fillStyle = '#e0e0e0';
      ctx.beginPath();
      // Cranium
      ctx.arc(0, -4, 12, 0, Math.PI * 2);
      ctx.fill();
      // Jaw
      ctx.fillRect(-8, 2, 16, 10);
      
      // Eyes
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(-5, -4, 4, 0, Math.PI * 2);
      ctx.arc(5, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Teeth
      ctx.fillStyle = '#111';
      ctx.fillRect(-5, 8, 2, 4);
      ctx.fillRect(-1, 8, 2, 4);
      ctx.fillRect(3, 8, 2, 4);
      ctx.restore();

      // Fuse
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -radius); ctx.quadraticCurveTo(8, -radius - 15, 18, -radius - 8); ctx.stroke();

      // Spark
      ctx.fillStyle = '#ffcc00'; ctx.shadowColor = '#ff5500'; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(18, -radius - 8, 6 + Math.random()*4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(18, -radius - 8, 3, 0, Math.PI*2); ctx.fill();

      ctx.restore();
  };

  // --- GAME LOGIC ---
  const startGame = (e?: React.MouseEvent) => {
    if(e) e.stopPropagation();

    audio.stopMusic();
    audio.startMusic();
    audio.setIntensity(1.0);
    
    setGameState(GameState.PLAYING);
    gameStateRef.current = GameState.PLAYING; 

    setScore(0);
    scoreRef.current = 0;
    obstacles.current = [];
    particles.current = [];
    speedRef.current = BASE_SPEED * 0.2; // START VERY SLOW (20% Speed)
    lastSpawnTime.current = Date.now();
    playerY.current = 50;
    frameCountRef.current = 0;
    
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    updateGame();
  };

  const togglePause = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (gameStateRef.current === GameState.PLAYING) {
      setGameState(GameState.PAUSED);
      gameStateRef.current = GameState.PAUSED;
      audio.stopMusic();
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    } else if (gameStateRef.current === GameState.PAUSED) {
      setGameState(GameState.PLAYING);
      gameStateRef.current = GameState.PLAYING;
      audio.startMusic();
      lastSpawnTime.current = Date.now(); 
      updateGame();
    }
  };

  const updateGame = () => {
    if (gameStateRef.current === GameState.PAUSED) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- RESPONSIVE SCALING ---
    // Calculate a scale factor based on screen height.
    const referenceHeight = canvas.height;
    const scale = Math.max(0.6, Math.min(2.5, referenceHeight / 550));
    
    // Scaled dimensions
    const sWidth = BASE_SOLDIER_WIDTH * scale;
    const sHeight = BASE_SOLDIER_HEIGHT * scale;
    const bRadius = BASE_BOMB_RADIUS * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameStateRef.current === GameState.GAME_OVER) {
       updateParticles(ctx, scale);
       gameLoopRef.current = requestAnimationFrame(updateGame);
       return;
    }

    frameCountRef.current++;
    const now = Date.now();

    // --- DIFFICULTY PROGRESSION ---
    let difficultyMultiplier = 1;
    const s = scoreRef.current;
    
    // MODIFIED: Extremely slow progression until score 10,000
    if (s < 10000) {
        // Phase 1: Training Wheels (Very Slow -> Normal)
        // Score 0: 0.2x speed
        // Score 10,000: 1.0x speed
        difficultyMultiplier = 0.2 + (s / 10000) * 0.8;
    } else if (s < 25000) {
        // Phase 2: Getting Serious (Normal -> Fast)
        // Score 10,000: 1.0x
        // Score 25,000: 1.5x
        difficultyMultiplier = 1.0 + ((s - 10000) / 15000) * 0.5;
    } else {
        // Phase 3: Survival Mode
        // Score 25,000+: > 1.5x
        difficultyMultiplier = 1.5 + ((s - 25000) / 10000);
    }

    // Apply scaling to speed so large screens don't feel slow
    const targetSpeed = (BASE_SPEED * difficultyMultiplier) * (scale * 0.8); 
    
    // Smooth speed transition
    speedRef.current += (targetSpeed - speedRef.current) * 0.05;
    audio.setIntensity(difficultyMultiplier);

    // Spawn Delay inverse to difficulty
    // Slower speed = longer delay to keep obstacle density somewhat consistent but manageable
    const spawnDelay = Math.max(250, 2000 / Math.pow(difficultyMultiplier, 0.9)); 

    if (now - lastSpawnTime.current > spawnDelay) {
      obstacles.current.push({
        x: canvas.width + 100,
        y: Math.random() * (canvas.height - sHeight - 50) + 50,
        width: bRadius * 2,
        height: bRadius * 2
      });
      lastSpawnTime.current = now;
    }

    obstacles.current.forEach(obs => obs.x -= speedRef.current);
    obstacles.current = obstacles.current.filter(obs => obs.x > -200);

    scoreRef.current += 1;
    setScore(Math.floor(scoreRef.current));
    if (Math.floor(scoreRef.current) % 100 === 0 && Math.floor(scoreRef.current) > 0) {
        audio.playScore();
    }

    // Player Position
    const pY = Math.max(0, Math.min(100, playerY.current));
    const playerScreenY = (pY / 100) * (canvas.height - sHeight);
    const playerX = canvas.width * 0.15; // Responsive X position (15% from left)

    // Hitbox
    const playerHitbox = {
        x: playerX + (sWidth * 0.2), 
        y: playerScreenY + (sHeight * 0.1), 
        w: sWidth * 0.6,
        h: sHeight * 0.8
    };

    let collision = false;
    obstacles.current.forEach(obs => {
        // Adjust obs center based on current responsive radius
        const cx = obs.x;
        const cy = obs.y;
        
        // Simple circle-rect collision
        const testX = Math.max(playerHitbox.x, Math.min(cx, playerHitbox.x + playerHitbox.w));
        const testY = Math.max(playerHitbox.y, Math.min(cy, playerHitbox.y + playerHitbox.h));
        const distX = cx - testX;
        const distY = cy - testY;
        const dist = Math.sqrt(distX*distX + distY*distY);

        if (dist <= bRadius) {
            collision = true;
        }
    });

    if (collision) {
      audio.stopMusic();
      audio.playExplosion();
      spawnExplosion(playerX + sWidth/2, playerScreenY + sHeight/2, scale);
      
      setGameState(GameState.GAME_OVER);
      gameStateRef.current = GameState.GAME_OVER;
      setHighScore(prev => Math.max(prev, Math.floor(scoreRef.current)));
    }

    if (!collision) {
        drawSoldier(ctx, playerX, playerScreenY, frameCountRef.current, scale);
    }
    obstacles.current.forEach(obs => drawBomb(ctx, obs.x, obs.y, scale));
    updateParticles(ctx, scale);

    ctx.fillStyle = 'white';
    ctx.font = `${Math.max(20, 30 * scale)}px "Black Ops One"`;
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.textAlign = 'center'; 
    ctx.fillText(`SCORE: ${Math.floor(scoreRef.current)}`, canvas.width / 2, canvas.height - (30 * scale));

    gameLoopRef.current = requestAnimationFrame(updateGame);
  };

  const updateParticles = (ctx: CanvasRenderingContext2D, scale: number) => {
      for (let i = particles.current.length - 1; i >= 0; i--) {
          const p = particles.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.02;
          p.size *= 0.95;
          if (p.life <= 0) {
              particles.current.splice(i, 1);
              continue;
          }
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
      }
  };

  useEffect(() => {
    const resize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  const toggleMute = () => {
     const muted = audio.toggleMute();
     setIsMuted(muted);
  };

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-gray-900 select-none touch-none">
      {/* Background - Fixed position */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${DONT_THAI_TO_LEANG_BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* --- CAMERA PREVIEW (TOP LEFT) --- */}
      <div className="absolute top-4 left-4 z-50 overflow-hidden rounded-xl border-2 border-white/30 shadow-[0_0_15px_rgba(0,0,0,0.5)] w-32 md:w-48 aspect-video bg-black relative">
         <video 
            ref={videoRef} 
            className="w-full h-full object-cover transform -scale-x-100" 
            muted 
            playsInline 
            autoPlay 
         />
         {/* TRACKING DOT OVERLAY */}
         <div 
            ref={trackingDotRef}
            className="absolute w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-[0_0_10px_rgba(0,255,0,0.8)] hidden pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
         />
         {!cameraActive && (
             <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 font-mono">
                 INIT...
             </div>
         )}
      </div>

      {/* --- CONTROLS (TOP RIGHT) --- */}
      <div className="absolute top-4 right-4 z-40 flex flex-col items-end gap-3 pointer-events-none">
          <div className="flex gap-2">
            {(gameState === GameState.PLAYING || gameState === GameState.PAUSED) && (
              <button 
                onClick={togglePause}
                className="pointer-events-auto bg-black/60 text-white p-3 rounded-full border border-white/20 backdrop-blur-sm hover:scale-110 transition shadow-xl"
              >
                {gameState === GameState.PAUSED ? '▶️' : '⏸️'}
              </button>
            )}

            <button 
              onClick={toggleMute}
              className="pointer-events-auto bg-black/60 text-white p-3 rounded-full border border-white/20 backdrop-blur-sm hover:scale-110 transition shadow-xl"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>

          <div className={`pointer-events-auto px-4 py-2 rounded-full border border-white/20 font-bold text-sm transition-all duration-300 backdrop-blur-md ${isPinching ? 'bg-green-500/80 text-black scale-105' : 'bg-black/60 text-white'}`}>
             PINCH 👌
          </div>
      </div>

      {/* GAME CANVAS */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 z-10 block"
      />

      {/* LOADING SCREEN */}
      {gameState === GameState.LOADING && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
            <div className="text-center">
              <div className="text-yellow-500 text-xl font-mono animate-pulse">LOADING AI VISION...</div>
              <p className="text-gray-500 text-sm mt-2">Loading MediaPipe Models</p>
            </div>
         </div>
      )}

      {/* MENUS */}
      <GameOverlay 
        gameState={gameState} 
        score={Math.floor(scoreRef.current)} 
        highScore={highScore}
        cameraActive={cameraActive}
        onStartGame={startGame}
        onResume={togglePause}
      />
    </div>
  );
}