import React, { useEffect, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import { Heart } from 'lucide-react';
import confetti from 'canvas-confetti';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const PLAYER_SPEED = 4;
const BULLET_SPEED = 8;
const MAX_HEALTH = 100;
const GAME_DURATION = 120; // 120 seconds survival per level

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

interface SafeCircleState {
  x: number;
  y: number;
  radius: number;
  active: boolean;
  warning: boolean;
  timeLeft: number;
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
    stopGame,
    level,
    setLevel
  } = usePeer();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current) {
        containerRef.current.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  // Game states
  const [health, setHealth] = useState<number>(MAX_HEALTH);
  const [timeRemaining, setTimeRemaining] = useState<number>(GAME_DURATION);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameWon, setGameWon] = useState<boolean>(false);
  const currentLevelRef = useRef<number>(1);

  // Level 2 Ready states
  const [waitingForLevel2Ready, setWaitingForLevel2Ready] = useState<boolean>(false);
  const [waitingForLevel3Ready, setWaitingForLevel3Ready] = useState<boolean>(false);
  const [hostReady, setHostReady] = useState<boolean>(false);
  const [clientReady, setClientReady] = useState<boolean>(false);

  const waitingForLevel2ReadyRef = useRef<boolean>(false);
  const waitingForLevel3ReadyRef = useRef<boolean>(false);
  const hostReadyRef = useRef<boolean>(false);
  const clientReadyRef = useRef<boolean>(false);

  const setWaitingForLevel2ReadyVal = (val: boolean) => {
    setWaitingForLevel2Ready(val);
    waitingForLevel2ReadyRef.current = val;
  };
  const setWaitingForLevel3ReadyVal = (val: boolean) => {
    setWaitingForLevel3Ready(val);
    waitingForLevel3ReadyRef.current = val;
  };
  const setHostReadyVal = (val: boolean) => {
    setHostReady(val);
    hostReadyRef.current = val;
  };
  const setClientReadyVal = (val: boolean) => {
    setClientReady(val);
    clientReadyRef.current = val;
  };



  const [safeCircle, setSafeCircle] = useState<SafeCircleState | null>(null);
  const safeCircleRef = useRef<SafeCircleState | null>(null);
  const setSafeCircleVal = (val: SafeCircleState | null) => {
    setSafeCircle(val);
    safeCircleRef.current = val;
  };

  const circleSpawnTimerRef = useRef<number>(0);
  const circleActiveFramesRef = useRef<number>(0);

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
  const survivalTimerRef = useRef<number>(GAME_DURATION);
  const spawnTimerRef = useRef<number>(0);

  const startLevel2 = () => {
    setWaitingForLevel2ReadyVal(false);
    setWaitingForLevel3ReadyVal(false);
    setHostReadyVal(false);
    setClientReadyVal(false);
    currentLevelRef.current = 2;
    setLevel(2);
    survivalTimerRef.current = GAME_DURATION;
    setTimeRemaining(GAME_DURATION);

    const p1 = isHost ? localPlayerRef.current : remotePlayerRef.current;
    const p2 = isHost ? remotePlayerRef.current : localPlayerRef.current;
    p1.y = CANVAS_HEIGHT - 60;
    p2.y = CANVAS_HEIGHT - 60;
    
    sendGameEvent({ type: 'start_level_2' });
    sendGameData({
      metrics: {
        health: sharedHealthRef.current,
        time: GAME_DURATION,
        level: 2,
        waitingForLevel2Ready: false,
        hostReady: false,
        clientReady: false
      },
      status: {
        gameOver: false,
        gameWon: false
      }
    });
  };


    const startLevel3 = () => {
    setWaitingForLevel3ReadyVal(false);
    setHostReadyVal(false);
    setClientReadyVal(false);
    currentLevelRef.current = 3;
    setLevel(3);
    survivalTimerRef.current = GAME_DURATION;
    setTimeRemaining(GAME_DURATION);

    const p1 = isHost ? localPlayerRef.current : remotePlayerRef.current;
    const p2 = isHost ? remotePlayerRef.current : localPlayerRef.current;
    p1.x = CANVAS_WIDTH / 2 + 150;
    p1.y = CANVAS_HEIGHT / 2;
    p2.x = CANVAS_WIDTH / 2 - 150;
    p2.y = CANVAS_HEIGHT / 2;
    
    sendGameEvent({ type: 'start_level_3' });
    sendGameData({
      metrics: {
        health: sharedHealthRef.current,
        time: GAME_DURATION,
        level: 3,
        waitingForLevel2Ready: false,
        waitingForLevel3Ready: false,
        hostReady: false,
        clientReady: false
      },
      status: {
        gameOver: false,
        gameWon: false
      }
    });
  };

  const handleHostReady = () => {
    setHostReadyVal(true);
    const readyToStart = !isConnected || (clientReadyRef.current && (waitingForLevel2ReadyRef.current || waitingForLevel3ReadyRef.current));
    if (readyToStart) {
      if (waitingForLevel2ReadyRef.current) {
        startLevel2();
      } else if (waitingForLevel3ReadyRef.current) {
        startLevel3();
      }
    } else {
      sendGameData({
        metrics: {
          health: sharedHealthRef.current,
            time: survivalTimerRef.current,
          level: currentLevelRef.current,
          waitingForLevel2Ready: waitingForLevel2ReadyRef.current,
          waitingForLevel3Ready: waitingForLevel3ReadyRef.current,
          hostReady: true,
          clientReady: clientReadyRef.current
        }
      });
    }
  };

  const handleClientReady = () => {
    setClientReadyVal(true);
    sendGameData({ clientReady: true });
  };

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
    survivalTimerRef.current = GAME_DURATION;
    setLevel(1);
    currentLevelRef.current = 1;
    setWaitingForLevel2ReadyVal(false);
    setWaitingForLevel3ReadyVal(false);
    setHostReadyVal(false);
    setClientReadyVal(false);
    setSafeCircleVal(null);
    circleSpawnTimerRef.current = 0;
    circleActiveFramesRef.current = 0;
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

      const keyLower = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(keyLower)) {
        e.preventDefault();
      }
      keysRef.current[e.key] = true;
      keysRef.current[keyLower] = true;
      keysRef.current[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyLower = e.key.toLowerCase();
      keysRef.current[e.key] = false;
      keysRef.current[keyLower] = false;
      keysRef.current[e.code] = false;
    };

    const handleBlur = () => {
      keysRef.current = {};
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
    window.addEventListener('blur', handleBlur);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isHost]);

  // Network Sync Handler
  useEffect(() => {
    if (!gameData) return;

    if (isHost) {
      // Host receives Client position & client bullets & client readiness
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
      if (gameData.clientReady !== undefined) {
        setClientReadyVal(gameData.clientReady);
        // If client is ready, host is ready, and we are waiting, start level 2 or 3
        if (gameData.clientReady && hostReadyRef.current) {
          if (waitingForLevel2ReadyRef.current) {
            startLevel2();
          } else if (waitingForLevel3ReadyRef.current) {
            startLevel3();
          }
        }
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
        setTimeRemaining(gameData.metrics.time);
        if (gameData.metrics.level) {
          setLevel(gameData.metrics.level);
          currentLevelRef.current = gameData.metrics.level;
        }
        if (gameData.metrics.waitingForLevel2Ready !== undefined) {
          setWaitingForLevel2ReadyVal(gameData.metrics.waitingForLevel2Ready);
        }
        if (gameData.metrics.waitingForLevel3Ready !== undefined) {
          setWaitingForLevel3ReadyVal(gameData.metrics.waitingForLevel3Ready);
        }
        if (gameData.metrics.hostReady !== undefined) {
          setHostReadyVal(gameData.metrics.hostReady);
        }
        if (gameData.metrics.clientReady !== undefined) {
          setClientReadyVal(gameData.metrics.clientReady);
        }
        if (gameData.metrics.safeCircle !== undefined) {
          setSafeCircleVal(gameData.metrics.safeCircle);
        }
        
        sharedHealthRef.current = gameData.metrics.health;
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

      const MAP_WIDTH = CANVAS_WIDTH;
      const MAP_HEIGHT = CANVAS_HEIGHT;

      // Spawn on edges of canvas
      let ex = 0;
      let ey = 0;
      let edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      if (currentLevelRef.current === 2) {
        edge = 0; // only spawn from top in Level 2
      }
      
      if (edge === 0) {
        ex = Math.random() * MAP_WIDTH;
        ey = -20;
      } else if (edge === 1) {
        ex = MAP_WIDTH + 20;
        ey = Math.random() * MAP_HEIGHT;
      } else if (edge === 2) {
        ex = Math.random() * MAP_WIDTH;
        ey = MAP_HEIGHT + 20;
      } else {
        ex = -20;
        ey = Math.random() * MAP_HEIGHT;
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
      
      const MAP_WIDTH = CANVAS_WIDTH;
      const MAP_HEIGHT = CANVAS_HEIGHT;

      // Calculate angle pointing to mouse cursor in world space
      let camX = 0;
      let camY = 0;
      const worldMouseX = mousePosRef.current.x + camX;
      const worldMouseY = mousePosRef.current.y + camY;
      const dx = worldMouseX - p.x;
      const dy = worldMouseY - p.y;
      p.angle = Math.atan2(dy, dx);

      // Local player movement
      let mx = 0;
      let my = 0;

      if (keysRef.current['a'] || keysRef.current['A'] || keysRef.current['ArrowLeft']) mx = -1;
      if (keysRef.current['d'] || keysRef.current['D'] || keysRef.current['ArrowRight']) mx = 1;
      
      // In level 2, or when waiting for level 2, player can only move horizontally
      if (currentLevelRef.current !== 2 && !waitingForLevel2ReadyRef.current) {
        if (keysRef.current['w'] || keysRef.current['W'] || keysRef.current['ArrowUp']) my = -1;
        if (keysRef.current['s'] || keysRef.current['S'] || keysRef.current['ArrowDown']) my = 1;
      }

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
      p.x = Math.max(playerSize, Math.min(MAP_WIDTH - playerSize, p.x));
      if (currentLevelRef.current === 2 || waitingForLevel2ReadyRef.current) {
        p.y = CANVAS_HEIGHT - 60; // Keep players fixed horizontally on bottom track
      } else {
        p.y = Math.max(playerSize, Math.min(MAP_HEIGHT - playerSize, p.y));
      }

      // If waiting for level 2 or 3 ready check, don't fire bullets, spawn enemies, or run physics
      const isWaitingForReady = waitingForLevel2ReadyRef.current || waitingForLevel3ReadyRef.current;
      if (isWaitingForReady) {
        if (!isHost) {
          sendGameData({
            player: { x: p.x, y: p.y, angle: p.angle },
            clientReady: clientReadyRef.current,
            newBullets: []
          });
        } else {
          // Host broadcasts complete state to Client during ready check pause
          const p1 = localPlayerRef.current;
          sendGameData({
            player: { x: p1.x, y: p1.y, angle: p1.angle },
            enemies: [],
            bullets: [],
            metrics: {
              health: sharedHealthRef.current,
                    time: survivalTimerRef.current,
              level: currentLevelRef.current,
              waitingForLevel2Ready: waitingForLevel2ReadyRef.current,
              waitingForLevel3Ready: waitingForLevel3ReadyRef.current,
              hostReady: hostReadyRef.current,
              clientReady: clientReadyRef.current,
              safeCircle: safeCircleRef.current
            },
            status: {
              gameOver: false,
              gameWon: false
            }
          });
        }
        return;
      }

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
          (b) => b.x > 0 && b.x < MAP_WIDTH && b.y > 0 && b.y < MAP_HEIGHT
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

        // Level 3 Circle Hazard logic
        if (currentLevelRef.current === 3) {
          if (!safeCircleRef.current || !safeCircleRef.current.active) {
            circleSpawnTimerRef.current += 1;
            if (circleSpawnTimerRef.current >= 1800) { // 30 seconds period
              const cx = Math.random() * (CANVAS_WIDTH - 200) + 100;
              const cy = Math.random() * (CANVAS_HEIGHT - 200) + 100;
              setSafeCircleVal({
                x: cx,
                y: cy,
                radius: 100, // Not too big
                active: true,
                warning: true, // Start in warning state
                timeLeft: 5
              });
              circleActiveFramesRef.current = 900; // 5s warning (300) + 10s active (600) = 900 total frames
              circleSpawnTimerRef.current = 0;
            }
          } else {
            // Circle is spawning/active, decrement frames
            circleActiveFramesRef.current -= 1;
            
            const circle = safeCircleRef.current;
            
            if (circleActiveFramesRef.current > 600) {
              // Warning phase (5s warning)
              circle.warning = true;
              circle.timeLeft = Math.ceil((circleActiveFramesRef.current - 600) / 60);
            } else {
              // Active phase (10s active)
              circle.warning = false;
              circle.timeLeft = Math.ceil(circleActiveFramesRef.current / 60);
              
              // Apply damage ONLY during active phase if player is outside the circle
              const distP1 = Math.hypot(p1.x - circle.x, p1.y - circle.y);
              const distP2 = Math.hypot(p2.x - circle.x, p2.y - circle.y);
              
              if (distP1 > circle.radius) {
                sharedHealthRef.current = Math.max(0, sharedHealthRef.current - 0.35); // heavy damage per frame if outside
                addHitParticles(p1.x, p1.y, '#ff0000');
              }
              if (isConnected && distP2 > circle.radius) {
                sharedHealthRef.current = Math.max(0, sharedHealthRef.current - 0.35);
                addHitParticles(p2.x, p2.y, '#ff0000');
              }
            }
            
            // Sync with client
            setSafeCircle({ ...circle });
            
            if (circleActiveFramesRef.current <= 0) {
              setSafeCircleVal(null);
            }
          }
        }

        // Game state evaluation
        if (sharedHealthRef.current <= 0) {
          setGameOver(true);
        }

        if (survivalTimerRef.current <= 0 && sharedHealthRef.current > 0) {
          if (currentLevelRef.current === 1) {
            // Transition to Level 2 ready check
            setWaitingForLevel2ReadyVal(true);
            setHostReadyVal(false);
            setClientReadyVal(false);
            
            // Clear current enemies and bullets
            enemiesRef.current = [];
            bulletsRef.current = [];
            
            // Position players at the bottom track for Level 2
            p1.y = CANVAS_HEIGHT - 60;
            p2.y = CANVAS_HEIGHT - 60;
            p1.x = 250;
            p2.x = 550;
            
            sendGameEvent({ type: 'transition_to_level_2_ready' });
          } else if (currentLevelRef.current === 2) {
            // Transition to Level 3 ready check
            setWaitingForLevel3ReadyVal(true);
            setHostReadyVal(false);
            setClientReadyVal(false);
            
            // Clear current enemies and bullets
            enemiesRef.current = [];
            bulletsRef.current = [];
            
            sendGameEvent({ type: 'transition_to_level_3_ready' });
          } else if (currentLevelRef.current === 3) {
            // Level 3 cleared - Game Won!
            setGameWon(true);
            sendGameEvent({ type: 'victory_confetti' });
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 }
            });
          }
        }

        setHealth(sharedHealthRef.current);

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
                time: survivalTimerRef.current,
            level: currentLevelRef.current,
            safeCircle: safeCircleRef.current
          },
          status: {
            gameOver: sharedHealthRef.current <= 0,
            gameWon: currentLevelRef.current === 3 && survivalTimerRef.current <= 0 && sharedHealthRef.current > 0
          }
        });
      }
    };

    const drawGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const MAP_WIDTH = CANVAS_WIDTH;
      const MAP_HEIGHT = CANVAS_HEIGHT;

      // 1. Draw Space Arena Background (Full screen)
      ctx.fillStyle = '#05060b';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Camera centering calculations
      let cameraX = 0;
      let cameraY = 0;

      // Save context and apply camera translation for world space drawing
      ctx.save();
      ctx.translate(-cameraX, -cameraY);

      // Cyber Grid (drawn to MAP size)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      for (let x = 0; x < MAP_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, MAP_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < MAP_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(MAP_WIDTH, y);
        ctx.stroke();
      }

      // Outer safety borders
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

      // Draw Safe Zone Circle in world space
      if (safeCircle && safeCircle.active) {
        ctx.save();
        const glowColor = safeCircle.warning ? '#ffaa00' : '#00a2ff';
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = glowColor;
        ctx.beginPath();
        ctx.arc(safeCircle.x, safeCircle.y, safeCircle.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = safeCircle.warning ? 'rgba(255, 170, 0, 0.05)' : 'rgba(0, 162, 255, 0.08)';
        ctx.fill();
        ctx.restore();
        
        ctx.fillStyle = glowColor;
        ctx.font = 'bold 10px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(
          safeCircle.warning ? `SAFE ZONE INCOMING (${safeCircle.timeLeft}s)` : `SAFE ZONE ACTIVE (${safeCircle.timeLeft}s)`,
          safeCircle.x,
          safeCircle.y - safeCircle.radius - 8
        );
      }

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
          ctx.rect(-e.size, -e.size, e.size * 2, e.size * 2);
        } else if (e.type === 'speedster') {
          const eAngle = Math.atan2(e.vy, e.vx);
          ctx.rotate(eAngle);
          ctx.moveTo(e.size, 0);
          ctx.lineTo(-e.size, -e.size);
          ctx.lineTo(-e.size + 4, 0);
          ctx.lineTo(-e.size, e.size);
        } else {
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

      // Draw compass arrow guiding local player to safe circle (if off-screen)
      if (safeCircle && safeCircle.active) {
        const lp = localPlayerRef.current;
        const dist = Math.hypot(safeCircle.x - lp.x, safeCircle.y - lp.y);
        if (dist > 300) {
          const angle = Math.atan2(safeCircle.y - lp.y, safeCircle.x - lp.x);
          ctx.save();
          ctx.translate(lp.x, lp.y);
          ctx.rotate(angle);
          const arrowColor = safeCircle.warning ? '#ffaa00' : '#00a2ff';
          ctx.fillStyle = arrowColor;
          ctx.shadowBlur = 10;
          ctx.shadowColor = arrowColor;
          ctx.beginPath();
          ctx.moveTo(35, 0);
          ctx.lineTo(25, -6);
          ctx.lineTo(28, 0);
          ctx.lineTo(25, 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // Restore camera translation context for screen-space drawing
      ctx.restore();

      // Screen space: safe zone warning text
      if (safeCircle && safeCircle.active) {
        const lp = localPlayerRef.current;
        const myDist = Math.hypot(lp.x - safeCircle.x, lp.y - safeCircle.y);
        if (safeCircle.warning) {
          ctx.fillStyle = '#ffaa00';
          ctx.font = 'bold 14px Orbitron';
          ctx.textAlign = 'center';
          ctx.fillText(`SAFE ZONE INCOMING IN ${safeCircle.timeLeft}s - HASTEN!`, CANVAS_WIDTH / 2, 80);
        } else if (myDist > safeCircle.radius) {
          ctx.fillStyle = '#ff0055';
          ctx.font = 'bold 16px Orbitron';
          ctx.textAlign = 'center';
          ctx.fillText('DANGER: OUTSIDE SAFE ZONE - TAKING HEAVY DAMAGE!', CANVAS_WIDTH / 2, 80);
        }
      }

      // 6. Draw Level Announcement Banners (in screen space)
      if (currentLevelRef.current === 2 && survivalTimerRef.current > GAME_DURATION - 4) {
        ctx.fillStyle = 'rgba(5, 6, 11, 0.85)';
        ctx.fillRect(0, CANVAS_HEIGHT / 2 - 50, CANVAS_WIDTH, 100);

        ctx.strokeStyle = 'var(--neon-magenta)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_HEIGHT / 2 - 50);
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2 - 50);
        ctx.moveTo(0, CANVAS_HEIGHT / 2 + 50);
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2 + 50);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LEVEL 2: HORIZONTAL LOCK', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 12);
        
        ctx.fillStyle = 'var(--neon-cyan)';
        ctx.font = '12px Orbitron';
        ctx.fillText('MOVE HORIZONTALLY ONLY. ENEMIES SPAWN ONLY AT TOP.', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
      } else if (currentLevelRef.current === 3 && survivalTimerRef.current > GAME_DURATION - 4) {
        ctx.fillStyle = 'rgba(5, 6, 11, 0.85)';
        ctx.fillRect(0, CANVAS_HEIGHT / 2 - 50, CANVAS_WIDTH, 100);

        ctx.strokeStyle = 'var(--neon-magenta)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_HEIGHT / 2 - 50);
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2 - 50);
        ctx.moveTo(0, CANVAS_HEIGHT / 2 + 50);
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2 + 50);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LEVEL 3: THE SAFE ZONE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 12);
        
        ctx.fillStyle = 'var(--neon-cyan)';
        ctx.font = '12px Orbitron';
        ctx.fillText('STAY INSIDE THE SAFE CIRCLES TO SURVIVE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
      }


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

  // Client checks for level 2 ready transition
  useEffect(() => {
    if (!isHost && gameEvent && gameEvent.type === 'transition_to_level_2_ready') {
      setWaitingForLevel2ReadyVal(true);
      setHostReadyVal(false);
      setClientReadyVal(false);
      
      bulletsRef.current = [];
      remoteBulletsRef.current = [];
      enemiesRef.current = [];
      
      localPlayerRef.current.y = CANVAS_HEIGHT - 60;
      localPlayerRef.current.x = 550;
      remotePlayerRef.current.y = CANVAS_HEIGHT - 60;
      remotePlayerRef.current.x = 250;
      
      resetGameEvent();
    }
  }, [gameEvent, isHost]);

  // Client listens for start level 2 event
  useEffect(() => {
    if (!isHost && gameEvent && gameEvent.type === 'start_level_2') {
      setWaitingForLevel2ReadyVal(false);
    setWaitingForLevel3ReadyVal(false);
      setHostReadyVal(false);
      setClientReadyVal(false);
      setLevel(2);
      currentLevelRef.current = 2;
      setTimeRemaining(GAME_DURATION);
      resetGameEvent();
    }
  }, [gameEvent, isHost]);

  // Client checks for level 3 ready transition
  useEffect(() => {
    if (!isHost && gameEvent && gameEvent.type === 'transition_to_level_3_ready') {
      setHostReadyVal(false);
      setClientReadyVal(false);
      
      bulletsRef.current = [];
      remoteBulletsRef.current = [];
      enemiesRef.current = [];
      
      localPlayerRef.current.x = CANVAS_WIDTH / 2 + 150;
      localPlayerRef.current.y = CANVAS_HEIGHT / 2;
      remotePlayerRef.current.x = CANVAS_WIDTH / 2 - 150;
      remotePlayerRef.current.y = CANVAS_HEIGHT / 2;
      
      resetGameEvent();
    }
  }, [gameEvent, isHost]);

  // Client listens for start level 3 event
  useEffect(() => {
    if (!isHost && gameEvent && gameEvent.type === 'start_level_3') {
      setHostReadyVal(false);
      setClientReadyVal(false);
      setLevel(3);
      currentLevelRef.current = 3;
      setTimeRemaining(GAME_DURATION);
      setSafeCircleVal(null);
      resetGameEvent();
    }
  }, [gameEvent, isHost]);

  const handleRestart = () => {
    setGameOver(false);
    setGameWon(false);
    setHealth(MAX_HEALTH);
    setTimeRemaining(GAME_DURATION);
    setLevel(1);
    currentLevelRef.current = 1;
    setWaitingForLevel2ReadyVal(false);
    setWaitingForLevel3ReadyVal(false);
    setHostReadyVal(false);
    setClientReadyVal(false);
    setSafeCircleVal(null);
    circleSpawnTimerRef.current = 0;
    circleActiveFramesRef.current = 0;

    if (isHost) {
      sharedHealthRef.current = MAX_HEALTH;
        survivalTimerRef.current = GAME_DURATION;
      enemiesRef.current = [];
      bulletsRef.current = [];

      sendGameEvent({ type: 'restart_game' });
      sendGameData({
        metrics: { health: MAX_HEALTH, time: GAME_DURATION, level: 1 },
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
        setTimeRemaining(GAME_DURATION);
      setLevel(1);
      currentLevelRef.current = 1;
      setWaitingForLevel2ReadyVal(false);
    setWaitingForLevel3ReadyVal(false);

      setHostReadyVal(false);
      setClientReadyVal(false);
      setSafeCircleVal(null);
      circleSpawnTimerRef.current = 0;
      circleActiveFramesRef.current = 0;
      resetGameEvent();
    }
  }, [gameEvent, isHost]);

  return (
    <div className={`game-main-content ${isFullscreen ? 'fullscreen-mode' : ''}`} ref={containerRef}>
      <div className="game-header-bar glass-panel" style={{ width: '100%', maxWidth: '900px' }}>
        <h2 className="game-title-text font-display">
          LEVEL {level} - SURVIVE: <span className="text-magenta">{timeRemaining}s SECONDS</span>
        </h2>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>


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

          {isHost && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Level:</span>
              <select 
                value={level}
                onChange={(e) => {
                  const selectedLvl = parseInt(e.target.value);
                  if (selectedLvl === 1) {
                    handleRestart();
                  } else if (selectedLvl === 2) {
                    startLevel2();
                  } else if (selectedLvl === 3) {
                    startLevel3();
                  }
                }}
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.75rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="1">Lvl 1 - Normal</option>
                <option value="2">Lvl 2 - Horizontal</option>
                <option value="3">Lvl 3 - Expanded</option>
              </select>
            </div>
          )}

          <button className="glow-btn-cyan" onClick={toggleFullScreen} style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
          <button className="glow-btn-magenta" onClick={stopGame} style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}>
            Exit Game
          </button>
        </div>
      </div>

      <div className="canvas-container" style={{ cursor: 'crosshair' }}>
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

        {/* Game Defeat Overlay */}
        {gameOver && (
          <div className="canvas-overlay">
            <h2 className="overlay-title font-display text-magenta" style={{ fontSize: '3rem' }}>MISSION FAILED</h2>
            <p style={{ color: 'var(--text-secondary)' }}>The monster swarm overwhelmed your defenses.</p>
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

        {/* Level 2 Ready Check Overlay */}
        {waitingForLevel3Ready && (
          <div className="canvas-overlay">
            <h2 className="overlay-title font-display text-cyan" style={{ fontSize: '2.5rem' }}>LEVEL 2 CLEARED!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Are you ready for Level 3: Expanded Map?</p>
            
            <div style={{ display: 'flex', gap: '1.5rem', margin: '1rem 0', alignItems: 'center' }}>
              <div className="peer-badge" style={{ borderColor: hostReady ? 'var(--neon-green)' : 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem 1rem' }}>
                Host: <span style={{ color: hostReady ? 'var(--neon-green)' : 'var(--text-muted)', fontWeight: 'bold' }}>{hostReady ? 'READY' : 'NOT READY'}</span>
              </div>
              {isConnected && (
                <div className="peer-badge" style={{ borderColor: clientReady ? 'var(--neon-green)' : 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem 1rem' }}>
                  Client: <span style={{ color: clientReady ? 'var(--neon-green)' : 'var(--text-muted)', fontWeight: 'bold' }}>{clientReady ? 'READY' : 'NOT READY'}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button 
                className="glow-btn-magenta font-display" 
                onClick={stopGame} 
                style={{ padding: '0.8rem 2rem' }}
              >
                Exit to Lobby
              </button>
              
              {isHost && (
                <button 
                  className="glow-btn-cyan font-display" 
                  onClick={handleRestart} 
                  style={{ padding: '0.8rem 2rem' }}
                >
                  Retry Level
                </button>
              )}

              {isHost ? (
                <button 
                  className={hostReady ? "glow-btn-magenta font-display" : "glow-btn-cyan font-display"}
                  disabled={hostReady}
                  onClick={handleHostReady} 
                  style={{ padding: '0.8rem 2rem', pointerEvents: hostReady ? 'none' : 'auto' }}
                >
                  {hostReady ? "Waiting for Client..." : "Next Level"}
                </button>
              ) : (
                <button 
                  className={clientReady ? "glow-btn-magenta font-display" : "glow-btn-cyan font-display"}
                  disabled={clientReady}
                  onClick={handleClientReady} 
                  style={{ padding: '0.8rem 2rem', pointerEvents: clientReady ? 'none' : 'auto' }}
                >
                  {clientReady ? "Waiting for Host..." : "Ready for Next Level"}
                </button>
              )}
            </div>
          </div>
        )}

        {waitingForLevel2Ready && (
          <div className="canvas-overlay">
            <h2 className="overlay-title font-display text-cyan" style={{ fontSize: '2.5rem' }}>LEVEL 1 CLEARED!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Are you ready for Level 2: Horizontal Defense?</p>
            
            <div style={{ display: 'flex', gap: '1.5rem', margin: '1rem 0', alignItems: 'center' }}>
              <div className="peer-badge" style={{ borderColor: hostReady ? 'var(--neon-green)' : 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem 1rem' }}>
                Host: <span style={{ color: hostReady ? 'var(--neon-green)' : 'var(--text-muted)', fontWeight: 'bold' }}>{hostReady ? 'READY' : 'NOT READY'}</span>
              </div>
              {isConnected && (
                <div className="peer-badge" style={{ borderColor: clientReady ? 'var(--neon-green)' : 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem 1rem' }}>
                  Client: <span style={{ color: clientReady ? 'var(--neon-green)' : 'var(--text-muted)', fontWeight: 'bold' }}>{clientReady ? 'READY' : 'NOT READY'}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button 
                className="glow-btn-magenta font-display" 
                onClick={stopGame} 
                style={{ padding: '0.8rem 2rem' }}
              >
                Exit to Lobby
              </button>
              
              {isHost && (
                <button 
                  className="glow-btn-cyan font-display" 
                  onClick={handleRestart} 
                  style={{ padding: '0.8rem 2rem' }}
                >
                  Retry Level
                </button>
              )}

              {isHost ? (
                <button 
                  className={hostReady ? "glow-btn-magenta font-display" : "glow-btn-cyan font-display"}
                  disabled={hostReady}
                  onClick={handleHostReady} 
                  style={{ padding: '0.8rem 2rem', pointerEvents: hostReady ? 'none' : 'auto' }}
                >
                  {hostReady ? "Waiting for Client..." : "Next Level"}
                </button>
              ) : (
                <button 
                  className={clientReady ? "glow-btn-magenta font-display" : "glow-btn-cyan font-display"}
                  disabled={clientReady}
                  onClick={handleClientReady} 
                  style={{ padding: '0.8rem 2rem', pointerEvents: clientReady ? 'none' : 'auto' }}
                >
                  {clientReady ? "Waiting for Host..." : "Ready for Next Level"}
                </button>
              )}
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
          {level === 2 ? (
            <>
              <span className="control-key">A</span> / <span className="control-key">D</span> or <span className="control-key">←</span> / <span className="control-key">→</span> <span style={{ color: 'var(--neon-magenta)', marginLeft: '0.5rem' }}>(Horizontal Lock)</span>
            </>
          ) : (
            <>
              <span className="control-key">W</span> / <span className="control-key">A</span> / <span className="control-key">S</span> / <span className="control-key">D</span> or <span className="control-key">↑</span> / <span className="control-key">←</span> / <span className="control-key">↓</span> / <span className="control-key">→</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
