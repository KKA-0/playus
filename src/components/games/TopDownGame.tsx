import React, { useEffect, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import { Heart } from 'lucide-react';
import confetti from 'canvas-confetti';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const PLAYER_SPEED = 4;
const BULLET_SPEED = 8;
const MAX_HEALTH = 100;
const GAME_DURATION = 60; // 60 seconds survival

interface PlayerState {
  x: number;
  y: number;
  angle: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  id: string;
}

interface Enemy {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'crawler' | 'speedster' | 'behemoth';
  health: number;
  maxHealth: number;
  speed: number;
  size: number;
  damage: number;
  color: string;
  flashTimer: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export const TopDownGame: React.FC = () => {
  const {
    isHost,
    isConnected,
    gameData,
    gameEvent,
    resetGameEvent,
    sendGameData,
    sendGameEvent,
    stopGame
  } = usePeer();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Game states
  const [health, setHealth] = useState<number>(MAX_HEALTH);
  const [score, setScore] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(GAME_DURATION);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameWon, setGameWon] = useState<boolean>(false);

  // Keyboard controls
  const keysRef = useRef<{ [key: string]: boolean }>({});
  
  // Mouse controls
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isMouseDownRef = useRef<boolean>(false);
  const lastShotTimeRef = useRef<number>(0);

  // Entities
  const localPlayerRef = useRef<PlayerState>({ x: 200, y: 240, angle: 0 });
  const remotePlayerRef = useRef<PlayerState>({ x: 600, y: 240, angle: 0 });
  
  const bulletsRef = useRef<Bullet[]>([]);
  const remoteBulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Host-authoritative counters
  const sharedHealthRef = useRef<number>(MAX_HEALTH);
  const sharedScoreRef = useRef<number>(0);
  const survivalTimerRef = useRef<number>(GAME_DURATION);
  const spawnTimerRef = useRef<number>(0);

  useEffect(() => {
    // Reset positions
    if (isHost) {
      localPlayerRef.current = { x: 250, y: 240, angle: 0 };
      remotePlayerRef.current = { x: 550, y: 240, angle: 0 };
    } else {
      localPlayerRef.current = { x: 550, y: 240, angle: 0 };
      remotePlayerRef.current = { x: 250, y: 240, angle: 0 };
    }

    sharedHealthRef.current = MAX_HEALTH;
    sharedScoreRef.current = 0;
    survivalTimerRef.current = GAME_DURATION;
    bulletsRef.current = [];
    remoteBulletsRef.current = [];
    enemiesRef.current = [];
    particlesRef.current = [];

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keypresses if user is typing in a chat input or other text field
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysRef.current[e.key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      // Mouse coordinates relative to canvas scaled bounds
      mousePosRef.current = {
        x: ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
        y: ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
      };
    };

    const handleMouseDown = () => {
      isMouseDownRef.current = true;
    };

    const handleMouseUp = () => {
      isMouseDownRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isHost]);

  // Network Sync Handler
  useEffect(() => {
    if (!gameData) return;

    if (isHost) {
      // Host receives Client position & client bullets
      if (gameData.player) {
        remotePlayerRef.current.x = gameData.player.x;
        remotePlayerRef.current.y = gameData.player.y;
        remotePlayerRef.current.angle = gameData.player.angle;
      }
      if (gameData.newBullets) {
        gameData.newBullets.forEach((b: Bullet) => {
          bulletsRef.current.push(b);
        });
      }
    } else {
      // Client receives full state from Host
      if (gameData.player) {
        remotePlayerRef.current.x = gameData.player.x;
        remotePlayerRef.current.y = gameData.player.y;
        remotePlayerRef.current.angle = gameData.player.angle;
      }
      if (gameData.enemies) {
        enemiesRef.current = gameData.enemies;
      }
      if (gameData.bullets) {
        bulletsRef.current = gameData.bullets;
      }
      if (gameData.metrics) {
        setHealth(gameData.metrics.health);
        setScore(gameData.metrics.score);
        setTimeRemaining(gameData.metrics.time);
        
        sharedHealthRef.current = gameData.metrics.health;
        sharedScoreRef.current = gameData.metrics.score;
        survivalTimerRef.current = gameData.metrics.time;
      }
      if (gameData.status) {
        setGameOver(gameData.status.gameOver);
        setGameWon(gameData.status.gameWon);
      }
    }
  }, [gameData, isHost]);

  // Game loop & physics logic
  useEffect(() => {
    let animationId: number;
    let timerInterval: any;

    const spawnEnemy = () => {
      if (!isHost) return;

      const types: ('crawler' | 'speedster' | 'behemoth')[] = ['crawler', 'crawler', 'speedster', 'behemoth'];
      const chosenType = types[Math.floor(Math.random() * types.length)];
      
      let speed = 1.5;
      let maxHealth = 2;
      let size = 12;
      let damage = 8;
      let color = '#39ff14'; // neon green crawler

      if (chosenType === 'speedster') {
        speed = 2.8;
        maxHealth = 1;
        size = 8;
        damage = 5;
        color = '#ff9f00'; // neon orange speedster
      } else if (chosenType === 'behemoth') {
        speed = 0.8;
        maxHealth = 6;
        size = 20;
        damage = 18;
        color = '#ef4444'; // neon red behemoth
      }

      // Spawn on edges of canvas
      let ex = 0;
      let ey = 0;
      const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      
      if (edge === 0) {
        ex = Math.random() * CANVAS_WIDTH;
        ey = -20;
      } else if (edge === 1) {
        ex = CANVAS_WIDTH + 20;
        ey = Math.random() * CANVAS_HEIGHT;
      } else if (edge === 2) {
        ex = Math.random() * CANVAS_WIDTH;
        ey = CANVAS_HEIGHT + 20;
      } else {
        ex = -20;
        ey = Math.random() * CANVAS_HEIGHT;
      }

      enemiesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x: ex,
        y: ey,
        vx: 0,
        vy: 0,
        type: chosenType,
        health: maxHealth,
        maxHealth,
        speed,
        size,
        damage,
        color,
        flashTimer: 0
      });
    };

    const addHitParticles = (x: number, y: number, color: string) => {
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 3,
          color,
          life: 0,
          maxLife: 20 + Math.random() * 15
        });
      }
    };

    const updatePhysics = () => {
      if (gameOver || gameWon) return;

      const p = localPlayerRef.current;
      
      // Calculate angle pointing to mouse cursor
      const dx = mousePosRef.current.x - p.x;
      const dy = mousePosRef.current.y - p.y;
      p.angle = Math.atan2(dy, dx);

      // Local player 8-way movement
      let mx = 0;
      let my = 0;

      if (keysRef.current['a'] || keysRef.current['A'] || keysRef.current['ArrowLeft']) mx = -1;
      if (keysRef.current['d'] || keysRef.current['D'] || keysRef.current['ArrowRight']) mx = 1;
      if (keysRef.current['w'] || keysRef.current['W'] || keysRef.current['ArrowUp']) my = -1;
      if (keysRef.current['s'] || keysRef.current['S'] || keysRef.current['ArrowDown']) my = 1;

      // Normalize movement speed vector
      if (mx !== 0 && my !== 0) {
        const length = Math.sqrt(mx * mx + my * my);
        mx /= length;
        my /= length;
      }

      p.x += mx * PLAYER_SPEED;
      p.y += my * PLAYER_SPEED;

      // Clamp to arena
      const playerSize = 16;
      p.x = Math.max(playerSize, Math.min(CANVAS_WIDTH - playerSize, p.x));
      p.y = Math.max(playerSize, Math.min(CANVAS_HEIGHT - playerSize, p.y));

      // Local Bullet Firing
      const now = Date.now();
      const newLocalBullets: Bullet[] = [];
      
      if (isMouseDownRef.current && now - lastShotTimeRef.current > 180) {
        const bvx = Math.cos(p.angle) * BULLET_SPEED;
        const bvy = Math.sin(p.angle) * BULLET_SPEED;
        
        const newBullet: Bullet = {
          id: Math.random().toString(36).substring(2, 9),
          x: p.x + Math.cos(p.angle) * 16,
          y: p.y + Math.sin(p.angle) * 16,
          vx: bvx,
          vy: bvy,
          color: isHost ? '#00f0ff' : '#ff007f'
        };

        bulletsRef.current.push(newBullet);
        newLocalBullets.push(newBullet);
        lastShotTimeRef.current = now;
      }

      // Update local particles
      particlesRef.current.forEach((part) => {
        part.x += part.vx;
        part.y += part.vy;
        part.life += 1;
      });
      particlesRef.current = particlesRef.current.filter((part) => part.life < part.maxLife);

      // --- Client Sends Position and Shot Bullets to Host ---
      if (!isHost) {
        sendGameData({
          player: {
            x: p.x,
            y: p.y,
            angle: p.angle
          },
          newBullets: newLocalBullets
        });
      } else {
        // --- Host runs authoritative game mechanics ---
        const p1 = localPlayerRef.current;
        const p2 = remotePlayerRef.current;

        // Move Bullets
        bulletsRef.current.forEach((b) => {
          b.x += b.vx;
          b.y += b.vy;
        });
        // Filter out-of-screen bullets
        bulletsRef.current = bulletsRef.current.filter(
          (b) => b.x > 0 && b.x < CANVAS_WIDTH && b.y > 0 && b.y < CANVAS_HEIGHT
        );

        // Spawn Enemies
        spawnTimerRef.current += 1;
        // spawn frequency increases as time decreases (survival gets harder)
        const spawnDelay = Math.max(25, 80 - (GAME_DURATION - survivalTimerRef.current) * 0.9);
        
        if (spawnTimerRef.current >= spawnDelay) {
          spawnEnemy();
          spawnTimerRef.current = 0;
        }

        // Move Enemies towards closest player
        enemiesRef.current.forEach((e) => {
          const distToP1 = Math.hypot(p1.x - e.x, p1.y - e.y);
          const distToP2 = Math.hypot(p2.x - e.x, p2.y - e.y);
          const target = distToP1 < distToP2 ? p1 : p2;

          const edx = target.x - e.x;
          const edy = target.y - e.y;
          const dist = Math.hypot(edx, edy);

          if (dist > 5) {
            e.vx = (edx / dist) * e.speed;
            e.vy = (edy / dist) * e.speed;
          }

          e.x += e.vx;
          e.y += e.vy;

          if (e.flashTimer > 0) e.flashTimer -= 1;
        });

        // Bullet hits Enemy Check
        bulletsRef.current.forEach((bullet) => {
          enemiesRef.current.forEach((enemy) => {
            const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (dist < enemy.size + 4) {
              // Hit!
              enemy.health -= 1;
              enemy.flashTimer = 5;
              addHitParticles(bullet.x, bullet.y, bullet.color);
              
              // Destroy bullet by placing it out of bounds
              bullet.x = -999; 

              if (enemy.health <= 0) {
                // Enemy defeated
                sharedScoreRef.current += enemy.maxHealth * 10;
                addHitParticles(enemy.x, enemy.y, enemy.color);
              }
            }
          });
        });

        // Filter out dead enemies
        enemiesRef.current = enemiesRef.current.filter((e) => e.health > 0);

        // Enemy hits Player Check
        enemiesRef.current.forEach((enemy) => {
          // Collision with Host
          const distToP1 = Math.hypot(p1.x - enemy.x, p1.y - enemy.y);
          if (distToP1 < enemy.size + playerSize) {
            sharedHealthRef.current = Math.max(0, sharedHealthRef.current - enemy.damage);
            addHitParticles(p1.x, p1.y, '#ff0000');
            
            // Push enemy back
            enemy.x -= enemy.vx * 15;
            enemy.y -= enemy.vy * 15;
          }

          // Collision with Client
          const distToP2 = Math.hypot(p2.x - enemy.x, p2.y - enemy.y);
          if (distToP2 < enemy.size + playerSize) {
            sharedHealthRef.current = Math.max(0, sharedHealthRef.current - enemy.damage);
            addHitParticles(p2.x, p2.y, '#ff0000');

            enemy.x -= enemy.vx * 15;
            enemy.y -= enemy.vy * 15;
          }
        });

        // Game state evaluation
        if (sharedHealthRef.current <= 0) {
          setGameOver(true);
        }

        if (survivalTimerRef.current <= 0 && sharedHealthRef.current > 0) {
          setGameWon(true);
          sendGameEvent({ type: 'victory_confetti' });
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });
        }

        setHealth(sharedHealthRef.current);
        setScore(sharedScoreRef.current);

        // Host broadcasts complete state to Client
        sendGameData({
          player: {
            x: p1.x,
            y: p1.y,
            angle: p1.angle
          },
          enemies: enemiesRef.current,
          bullets: bulletsRef.current,
          metrics: {
            health: sharedHealthRef.current,
            score: sharedScoreRef.current,
            time: survivalTimerRef.current
          },
          status: {
            gameOver: sharedHealthRef.current <= 0,
            gameWon: survivalTimerRef.current <= 0 && sharedHealthRef.current > 0
          }
        });
      }
    };

    const drawGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Draw Space Arena Background
      ctx.fillStyle = '#05060b';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Cyber Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Outer safety borders
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 2. Draw Particles
      particlesRef.current.forEach((p) => {
        const opacity = 1 - p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // 3. Draw Bullets
      bulletsRef.current.forEach((b) => {
        ctx.fillStyle = b.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 4. Draw Enemies
      enemiesRef.current.forEach((e) => {
        ctx.save();
        ctx.translate(e.x, e.y);

        // Flash white on hit
        if (e.flashTimer > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ffffff';
        } else {
          ctx.fillStyle = e.color;
          ctx.strokeStyle = e.color;
        }

        ctx.shadowBlur = 10;
        ctx.shadowColor = e.color;

        ctx.beginPath();
        if (e.type === 'crawler') {
          // Segmented insect block
          ctx.rect(-e.size, -e.size, e.size * 2, e.size * 2);
        } else if (e.type === 'speedster') {
          // Sharp triangle pointing forward
          const eAngle = Math.atan2(e.vy, e.vx);
          ctx.rotate(eAngle);
          ctx.moveTo(e.size, 0);
          ctx.lineTo(-e.size, -e.size);
          ctx.lineTo(-e.size + 4, 0);
          ctx.lineTo(-e.size, e.size);
        } else {
          // Giant shield octagon
          ctx.arc(0, 0, e.size, 0, Math.PI * 2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Mini health bar above Behemoths
        if (e.type === 'behemoth' && e.health < e.maxHealth) {
          ctx.restore();
          ctx.save();
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(e.x - 15, e.y - 30, 30, 4);
          ctx.fillStyle = '#10b981';
          ctx.fillRect(e.x - 15, e.y - 30, 30 * (e.health / e.maxHealth), 4);
        }

        ctx.restore();
        ctx.shadowBlur = 0;
      });

      // 5. Draw Players
      const drawSpaceship = (player: PlayerState, baseColor: string, accentColor: string, isMe: boolean) => {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);

        // Glow engine
        ctx.shadowBlur = 12;
        ctx.shadowColor = accentColor;

        // Draw Player Ship (Retro sci-fi cockpit triangle)
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-12, -14);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-12, 14);
        ctx.closePath();
        ctx.fill();

        // Visor/Cockpit
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(4, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // Engine exhaust glow
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-12, -4, 4, 8);

        ctx.restore();
        ctx.shadowBlur = 0;

        // Label above player
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(isMe ? 'YOU' : 'P2', player.x, player.y - 20);
      };

      const p1 = isHost ? localPlayerRef.current : remotePlayerRef.current;
      const p2 = isHost ? remotePlayerRef.current : localPlayerRef.current;

      drawSpaceship(p1, '#0c1524', '#00f0ff', isHost);
      drawSpaceship(p2, '#200c24', '#ff007f', !isHost);
    };

    let lastTime = performance.now();
    const timeStep = 1000 / 60;
    let accumulator = 0;

    const gameLoop = (currentTime: number) => {
      let deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      if (deltaTime > 100) deltaTime = 100;

      accumulator += deltaTime;
      while (accumulator >= timeStep) {
        updatePhysics();
        accumulator -= timeStep;
      }

      drawGame();
      animationId = requestAnimationFrame(gameLoop);
    };

    // Host timer interval
    if (isHost && isConnected && !gameOver && !gameWon) {
      timerInterval = setInterval(() => {
        survivalTimerRef.current = Math.max(0, survivalTimerRef.current - 1);
        setTimeRemaining(survivalTimerRef.current);
      }, 1000);
    }

    if (isConnected) {
      animationId = requestAnimationFrame(gameLoop);
    }

    return () => {
      cancelAnimationFrame(animationId);
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [isConnected, isHost, gameOver, gameWon]);

  // Client checks for victory effects
  useEffect(() => {
    if (!isHost && gameEvent && gameEvent.type === 'victory_confetti') {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
      resetGameEvent();
    }
  }, [gameEvent, isHost]);

  const handleRestart = () => {
    setGameOver(false);
    setGameWon(false);
    setHealth(MAX_HEALTH);
    setScore(0);
    setTimeRemaining(GAME_DURATION);

    if (isHost) {
      sharedHealthRef.current = MAX_HEALTH;
      sharedScoreRef.current = 0;
      survivalTimerRef.current = GAME_DURATION;
      enemiesRef.current = [];
      bulletsRef.current = [];

      sendGameEvent({ type: 'restart_game' });
      sendGameData({
        metrics: { health: MAX_HEALTH, score: 0, time: GAME_DURATION },
        status: { gameOver: false, gameWon: false }
      });
    }
  };

  // Client listens for restart trigger
  useEffect(() => {
    if (!isHost && gameEvent && gameEvent.type === 'restart_game') {
      setGameOver(false);
      setGameWon(false);
      setHealth(MAX_HEALTH);
      setScore(0);
      setTimeRemaining(GAME_DURATION);
      resetGameEvent();
    }
  }, [gameEvent, isHost]);

  return (
    <div className="game-main-content">
      <div className="game-header-bar glass-panel" style={{ width: '100%', maxWidth: '900px' }}>
        <h2 className="game-title-text font-display">
          SURVIVE: <span className="text-magenta">{timeRemaining}s SECONDS</span>
        </h2>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div className="peer-badge" style={{ borderColor: 'var(--neon-cyan)', color: 'var(--neon-cyan)' }}>
            Score: {score}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Heart size={16} className="text-magenta" style={{ fill: 'var(--neon-magenta)' }} />
            <div className="glass-panel" style={{ width: '120px', height: '14px', borderRadius: '4px', overflow: 'hidden', padding: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div 
                style={{ 
                  width: `${health}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, var(--neon-magenta), var(--neon-purple))',
                  boxShadow: '0 0 8px var(--neon-magenta)',
                  transition: 'width 0.2s ease'
                }} 
              />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{health}</span>
          </div>
        </div>
      </div>

      <div className="canvas-container" style={{ cursor: 'crosshair' }}>
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

        {/* Game Defeat Overlay */}
        {gameOver && (
          <div className="canvas-overlay">
            <h2 className="overlay-title font-display text-magenta" style={{ fontSize: '3rem' }}>MISSION FAILED</h2>
            <p style={{ color: 'var(--text-secondary)' }}>The monster swarm overwhelmed your defenses.</p>
            <p style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>Final Score: {score} pts</p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              {isHost && (
                <button className="glow-btn-cyan font-display" onClick={handleRestart} style={{ padding: '0.8rem 2rem' }}>
                  Try Again
                </button>
              )}
              <button className="glow-btn-magenta font-display" onClick={stopGame} style={{ padding: '0.8rem 2rem' }}>
                Back to Lobby
              </button>
            </div>
          </div>
        )}

        {/* Game Victory Overlay */}
        {gameWon && (
          <div className="canvas-overlay">
            <h2 className="overlay-title font-display text-green" style={{ fontSize: '3.5rem', letterSpacing: '3px' }}>SURVIVED!</h2>
            <p style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '1.2rem' }}>Dungeon successfully cleared.</p>
            <p style={{ color: 'var(--text-secondary)', marginTop: '-0.5rem' }}>Final Combined Score: {score + 1000} pts (Survival Bonus!)</p>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              {isHost && (
                <button className="glow-btn-cyan font-display" onClick={handleRestart} style={{ padding: '0.8rem 2rem' }}>
                  Fight Again
                </button>
              )}
              <button className="glow-btn-magenta font-display" onClick={stopGame} style={{ padding: '0.8rem 2rem' }}>
                Back to Lobby
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '900px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <div>
          <span>Aim: </span><span style={{ color: 'var(--text-primary)' }}>Mouse Cursor</span> | <span>Shoot: </span><span style={{ color: 'var(--text-primary)' }}>Left Click</span>
        </div>
        <div>
          <span>Movement: </span>
          <span className="control-key">W</span> / <span className="control-key">A</span> / <span className="control-key">S</span> / <span className="control-key">D</span> or <span className="control-key">↑</span> / <span className="control-key">←</span> / <span className="control-key">↓</span> / <span className="control-key">→</span>
        </div>
      </div>
    </div>
  );
};
