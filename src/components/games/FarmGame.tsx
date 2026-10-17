import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import type { PlayerState, Crop, WildItem, SmokeParticle, InventoryItem, Weed, ChickenState } from './farm/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, MAP_WIDTH, MAP_HEIGHT, PLAYER_SPEED, SPRITE_SIZE } from './farm/constants';
import { getGameClock, getAmbientColor, getItemEmoji, getItemName } from './farm/utils';
import { ChestOverlay } from './farm/ChestOverlay';
import { CharacterSelection } from './farm/CharacterSelection';
import { GameHeader } from './farm/GameHeader';
import { FarmBoard } from './farm/FarmBoard';
import { COOP, MARKET, applyFarmAction, createFarmProgress, createStarterInventory, getFarmLevel, getOrder, getWeather, isSeed, near, processFarmRequests, tickFarm } from './farm/gameplay';
import type { FarmAction, FarmRequest, FarmWorld } from './farm/gameplay';
import { drawFarmStations } from './farm/drawStations';
import { TouchControls } from './farm/TouchControls';
import { useFarmController } from './farm/useFarmController';
import { cycleInventory } from './farm/controls';
import type { MoveVector } from './farm/controls';
import { FarmMenu } from './farm/FarmMenu';

export const FarmGame: React.FC = () => {
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const touchMoveRef = useRef<MoveVector>({ x: 0, y: 0 });
  const controllerMoveRef = useRef<MoveVector>({ x: 0, y: 0 });

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMenuOpenRef = useRef(false);
  useEffect(() => { isMenuOpenRef.current = isMenuOpen; }, [isMenuOpen]);
  const [touchPreference, setTouchPreference] = useState<boolean | null>(null);
  const [autoTouch, setAutoTouch] = useState(() => window.matchMedia('(pointer: coarse), (max-width: 700px)').matches || navigator.maxTouchPoints > 0);
  const touchEnabled = touchPreference ?? autoTouch;
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse), (max-width: 700px)');
    const update = () => setAutoTouch(query.matches || navigator.maxTouchPoints > 0);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!isImmersive) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isImmersive]);

  // Character selection states
  const [localGender, setLocalGender] = useState<'male' | 'female' | null>(null);
  const [remoteGender, setRemoteGender] = useState<'male' | 'female' | null>(null);
  const selectionComplete = !!localGender && (!isConnected || !!remoteGender);

  // Game clock states
  const elapsedTimeRef = useRef<number>(0);
  const [initialProgress] = useState(() => createFarmProgress(crypto.randomUUID()));
  const farmRef = useRef(structuredClone(initialProgress));
  const hasHostStateRef = useRef(false);
  const pendingActionsRef = useRef<FarmRequest[]>([]);
  const nextActionIdRef = useRef(0);
  const guestAckRef = useRef(0);
  const guestNoticeRef = useRef('');
  const noticeRef = useRef({ message: '', until: 0 });
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const isBoardOpenRef = useRef(false);
  useEffect(() => { isBoardOpenRef.current = isBoardOpen; }, [isBoardOpen]);

  // Inventory selection state
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const selectedSlotRef = useRef<number>(0);
  useEffect(() => {
    selectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  // Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const homeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState<number>(0.5);

  // Initialize audio on mount
  useEffect(() => {
    const audio = new Audio('/music/farm.mp3');
    audio.loop = true;
    audio.volume = 0.5;

    const handleEnded = () => {
      audio.currentTime = 0;
      audio.play().catch((err) => {
        console.warn('Audio loop replay blocked:', err);
      });
    };

    audio.addEventListener('ended', handleEnded);
    audioRef.current = audio;

    const homeAudio = new Audio('/music/home.mp3');
    homeAudio.loop = true;
    homeAudio.volume = 0.5;

    const handleHomeEnded = () => {
      homeAudio.currentTime = 0;
      homeAudio.play().catch((err) => {
        console.warn('Home audio loop replay blocked:', err);
      });
    };

    homeAudio.addEventListener('ended', handleHomeEnded);
    homeAudioRef.current = homeAudio;

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (homeAudioRef.current) {
        homeAudioRef.current.removeEventListener('ended', handleHomeEnded);
        homeAudioRef.current.pause();
        homeAudioRef.current = null;
      }
    };
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
    if (homeAudioRef.current) {
      homeAudioRef.current.volume = newVol;
    }
  };

  // Fullscreen change listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const container = surfaceRef.current;
    if (!container) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (isImmersive) setIsImmersive(false);
    // Keep mobile expansion within the page, including browsers without element fullscreen.
    else if (touchEnabled) setIsImmersive(true);
    else if (container.requestFullscreen) void container.requestFullscreen().catch(() => setIsImmersive(true));
    else setIsImmersive(true);
  };

  // Asset preloading status
  const [assetsLoaded, setAssetsLoaded] = useState<boolean>(false);

  // Image references
  const maleImageRef = useRef<HTMLImageElement | null>(null);
  const femaleImageRef = useRef<HTMLImageElement | null>(null);
  const maleUpImageRef = useRef<HTMLImageElement | null>(null);
  const femaleUpImageRef = useRef<HTMLImageElement | null>(null);
  const bedImageRef = useRef<HTMLImageElement | null>(null);
  const sofaImageRef = useRef<HTMLImageElement | null>(null);
  const weed1ImageRef = useRef<HTMLImageElement | null>(null);
  const weed2ImageRef = useRef<HTMLImageElement | null>(null);
  const weed3ImageRef = useRef<HTMLImageElement | null>(null);
  const chickenImageRef = useRef<HTMLImageElement | null>(null);
  const chimneyGifRef = useRef<HTMLImageElement | null>(null);

  const outdoorBgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const indoorBgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep track of canvas CSS dimensions to avoid getBoundingClientRect layout thrashing
  const canvasRectRef = useRef<{ width: number; height: number }>({ width: 800, height: 480 });

  // Keyboard controls
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const closeFarmBoard = () => {
    setIsBoardOpen(false);
    keysRef.current = {};
    touchMoveRef.current = { x: 0, y: 0 };
    canvasRef.current?.focus({ preventScroll: true });
  };
  const selectSlot = (slot: number) => { selectedSlotRef.current = slot; setSelectedSlot(slot); };

  // Entity states
  const localPlayerRef = useRef<PlayerState>({
    x: 500,
    y: 400,
    gender: null,
    facingLeft: false,
    isMoving: false,
    inHouse: false,
    facingUp: false,
    inventory: createStarterInventory()
  });

  const remotePlayerRef = useRef<PlayerState>({
    x: 500,
    y: 400,
    gender: null,
    facingLeft: false,
    isMoving: false,
    inHouse: false,
    facingUp: false,
    inventory: createStarterInventory()
  });

  // Chest items ref (10 slots)
  const chestItemsRef = useRef<(InventoryItem | null)[]>([
    null, null, null, null, null,
    null, null, null, null, null
  ]);

  // Crops ref
  const cropsRef = useRef<Crop[]>([]);

  const wildItemsRef = useRef<WildItem[]>([
    { id: 'berry_1', x: 200, y: 300, type: 'berry', active: true, respawnTimer: 0 },
    { id: 'berry_2', x: 820, y: 365, type: 'berry', active: true, respawnTimer: 0 },
    { id: 'wood_1', x: 150, y: 600, type: 'wood', active: true, respawnTimer: 0 },
    { id: 'stone_1', x: 900, y: 200, type: 'stone', active: true, respawnTimer: 0 },
    { id: 'wood_2', x: 260, y: 480, type: 'wood', active: true, respawnTimer: 0 },
    { id: 'stone_2', x: 760, y: 470, type: 'stone', active: true, respawnTimer: 0 },
  ]);

  const generateInitialWeeds = (): Weed[] => {
    const list: Weed[] = [];
    const count = 60;
    let attempts = 0;
    while (list.length < count && attempts < 1000) {
      attempts++;
      const wx = 40 + Math.random() * (MAP_WIDTH - 80);
      const wy = 40 + Math.random() * (MAP_HEIGHT - 80);

      if (wx >= 395 && wx <= 605 && wy >= 55 && wy <= 215) continue;
      if (wx >= 330 && wx <= 670 && wy >= 230 && wy <= 470) continue;
      if (Math.hypot(wx - MARKET.x, wy - MARKET.y) < 75 || Math.hypot(wx - COOP.x, wy - COOP.y) < 75) continue;

      list.push({
        id: `weed_${Date.now()}_${list.length}_${Math.floor(Math.random() * 1000)}`,
        x: wx,
        y: wy,
        type: Math.floor(Math.random() * 3) + 1
      });
    }
    return list;
  };

  const [initialWeeds] = useState(generateInitialWeeds);
  const weedsRef = useRef<Weed[]>(structuredClone(initialWeeds));

  const generateInitialChickens = (): ChickenState[] => [
    {
      id: 'chicken_1',
      x: 705,
      y: 240,
      startX: 705,
      startY: 240,
      vx: 0,
      vy: 0,
      direction: 'down',
      state: 'idle',
      timer: 1 + Math.random() * 2,
      frameIndex: 0,
      animationTick: 0
    },
    {
      id: 'chicken_2',
      x: 780,
      y: 220,
      startX: 780,
      startY: 220,
      vx: 0,
      vy: 0,
      direction: 'down',
      state: 'idle',
      timer: 1 + Math.random() * 2,
      frameIndex: 0,
      animationTick: 0
    },
    {
      id: 'chicken_3',
      x: 740,
      y: 260,
      startX: 740,
      startY: 260,
      vx: 0,
      vy: 0,
      direction: 'down',
      state: 'idle',
      timer: 1 + Math.random() * 2,
      frameIndex: 0,
      animationTick: 0
    }
  ];

  const [initialChickens] = useState(generateInitialChickens);
  const chickensRef = useRef<ChickenState[]>(structuredClone(initialChickens));

  // React displays immutable snapshots; the canvas keeps its fast mutable simulation.
  const [farmUi, setFarmUi] = useState(() => ({ progress: structuredClone(initialProgress), inventory: createStarterInventory(), chest: Array<InventoryItem | null>(10).fill(null), notice: '' }));
  const refreshUi = () => setFarmUi({ progress: structuredClone(farmRef.current), inventory: structuredClone(localPlayerRef.current.inventory), chest: structuredClone(chestItemsRef.current), notice: noticeRef.current.message });
  const refreshUiFromEffect = useEffectEvent(refreshUi);

  // Chest UI open state
  const [isChestOpen, setIsChestOpen] = useState<boolean>(false);
  const isChestOpenRef = useRef<boolean>(false);
  useEffect(() => {
    isChestOpenRef.current = isChestOpen;
  }, [isChestOpen]);

  // Proximity indicator refs for keyboard event listeners
  const isNearChestRef = useRef<boolean>(false);
  const clearMovement = () => {
    keysRef.current = {};
    touchMoveRef.current = { x: 0, y: 0 };
    controllerMoveRef.current = { x: 0, y: 0 };
  };
  const closePanels = () => {
    setIsMenuOpen(false); setIsChestOpen(false); setIsBoardOpen(false);
    clearMovement(); canvasRef.current?.focus({ preventScroll: true });
  };
  const openBoard = () => {
    if (!selectionComplete) return;
    setIsMenuOpen(false); setIsChestOpen(false); setIsBoardOpen(true); clearMovement();
  };
  const toggleFarmMenu = () => {
    setIsMenuOpen(open => !open); setIsChestOpen(false); setIsBoardOpen(false); clearMovement();
  };

  const smokeParticlesRef = useRef<SmokeParticle[]>([]);
  const fireParticlesRef = useRef<SmokeParticle[]>([]);

  // Preload assets
  useEffect(() => {
    let loadedCount = 0;
    const totalAssets = 11;

    const onAssetLoad = () => {
      loadedCount++;
      if (loadedCount === totalAssets) {
        setAssetsLoaded(true);
      }
    };

    const maleImg = new Image();
    maleImg.src = '/male.png';
    maleImg.onload = onAssetLoad;
    maleImg.onerror = (e) => {
      console.error('Failed to load male image asset', e);
      onAssetLoad(); // fall back gracefully
    };
    maleImageRef.current = maleImg;

    const femaleImg = new Image();
    femaleImg.src = '/female.png';
    femaleImg.onload = onAssetLoad;
    femaleImg.onerror = (e) => {
      console.error('Failed to load female image asset', e);
      onAssetLoad(); // fall back gracefully
    };
    femaleImageRef.current = femaleImg;

    const maleUpImg = new Image();
    maleUpImg.src = '/male_up.png';
    maleUpImg.onload = onAssetLoad;
    maleUpImg.onerror = (e) => {
      console.error('Failed to load male_up image asset', e);
      onAssetLoad(); // fall back gracefully
    };
    maleUpImageRef.current = maleUpImg;

    const femaleUpImg = new Image();
    femaleUpImg.src = '/female_up.png';
    femaleUpImg.onload = onAssetLoad;
    femaleUpImg.onerror = (e) => {
      console.error('Failed to load female_up image asset', e);
      onAssetLoad(); // fall back gracefully
    };
    femaleUpImageRef.current = femaleUpImg;

    const bedImg = new Image();
    bedImg.src = '/bed.png';
    bedImg.onload = onAssetLoad;
    bedImg.onerror = (e) => {
      console.error('Failed to load bed image asset', e);
      onAssetLoad(); // fall back gracefully
    };
    bedImageRef.current = bedImg;

    const sofaImg = new Image();
    sofaImg.src = '/sofa.png';
    sofaImg.onload = onAssetLoad;
    sofaImg.onerror = (e) => {
      console.error('Failed to load sofa image asset', e);
      onAssetLoad(); // fall back gracefully
    };
    sofaImageRef.current = sofaImg;

    const chimneyImg = new Image();
    chimneyImg.src = '/chimni.gif';
    chimneyImg.onload = onAssetLoad;
    chimneyImg.onerror = (e) => {
      console.error('Failed to load chimney image asset', e);
      onAssetLoad(); // fall back gracefully
    };

    const weed1Img = new Image();
    weed1Img.src = '/weed1.png';
    weed1Img.onload = onAssetLoad;
    weed1Img.onerror = (e) => {
      console.error('Failed to load weed1 image asset', e);
      onAssetLoad();
    };
    weed1ImageRef.current = weed1Img;

    const weed2Img = new Image();
    weed2Img.src = '/weed2.png';
    weed2Img.onload = onAssetLoad;
    weed2Img.onerror = (e) => {
      console.error('Failed to load weed2 image asset', e);
      onAssetLoad();
    };
    weed2ImageRef.current = weed2Img;

    const weed3Img = new Image();
    weed3Img.src = '/weed3.png';
    weed3Img.onload = onAssetLoad;
    weed3Img.onerror = (e) => {
      console.error('Failed to load weed3 image asset', e);
      onAssetLoad();
    };
    weed3ImageRef.current = weed3Img;

    const chickenImg = new Image();
    chickenImg.src = '/farm/pets/chicken.png';
    chickenImg.onload = onAssetLoad;
    chickenImg.onerror = (e) => {
      console.error('Failed to load chicken image asset', e);
      onAssetLoad();
    };
    chickenImageRef.current = chickenImg;
  }, []);

  // Hide chimney gif overlay when selection is not complete
  useEffect(() => {
    if (!selectionComplete && chimneyGifRef.current) {
      chimneyGifRef.current.style.display = 'none';
    }
  }, [selectionComplete]);

  // Keep track of canvas CSS dimensions to avoid getBoundingClientRect layout thrashing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvasRectRef.current = {
          width: entry.contentRect.width || canvas.clientWidth || 800,
          height: entry.contentRect.height || canvas.clientHeight || 480
        };
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(canvasRectRef.current.width * pixelRatio);
        canvas.height = Math.round(canvasRectRef.current.height * pixelRatio);
      }
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [assetsLoaded]);

  // Create offscreen canvases once assets are loaded
  useEffect(() => {
    if (!assetsLoaded) return;

    // 1. Create Outdoor Background Canvas
    const outCanvas = document.createElement('canvas');
    outCanvas.width = MAP_WIDTH;
    outCanvas.height = MAP_HEIGHT;
    const outCtx = outCanvas.getContext('2d');
    if (outCtx) {
      // Draw Grass Base
      outCtx.fillStyle = '#2d6a4f';
      outCtx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

      // Draw Grass Details
      outCtx.fillStyle = '#40916c';
      for (let tx = 0; tx < MAP_WIDTH; tx += 64) {
        for (let ty = 0; ty < MAP_HEIGHT; ty += 64) {
          if ((tx + ty) % 128 === 0) {
            outCtx.fillRect(tx + 16, ty + 16, 4, 8);
            outCtx.fillRect(tx + 20, ty + 20, 4, 12);
            outCtx.fillRect(tx + 12, ty + 24, 4, 6);
          } else if ((tx + ty) % 96 === 0) {
            outCtx.fillRect(tx + 40, ty + 40, 4, 6);
            outCtx.fillRect(tx + 44, ty + 36, 4, 10);
          }
        }
      }

      // Draw warm dirt path
      outCtx.fillStyle = '#d8b18a';
      outCtx.fillRect(480, 190, 40, 60);
      outCtx.fillRect(275, 265, 75, 20);
      outCtx.fillRect(650, 235, 90, 18);
      outCtx.fillRect(725, 200, 20, 45);

      // Draw Soil Plot
      outCtx.fillStyle = '#5c4033';
      outCtx.fillRect(350, 250, 300, 200);
      outCtx.strokeStyle = '#3e2723';
      outCtx.lineWidth = 6;
      outCtx.strokeRect(350, 250, 300, 200);

      // Draw tilled furrow lines
      outCtx.strokeStyle = '#4e3629';
      outCtx.lineWidth = 3;
      for (let px = 380; px < 650; px += 30) {
        outCtx.beginPath();
        outCtx.moveTo(px, 255);
        outCtx.lineTo(px, 445);
        outCtx.stroke();
      }

      // Draw Farmhouse
      outCtx.fillStyle = '#f5ebe0';
      outCtx.fillRect(420, 120, 160, 70);

      // Wall wood details
      outCtx.fillStyle = '#d5c4b1';
      outCtx.fillRect(420, 185, 160, 5);

      // Roof (red tiled GBA polygon)
      outCtx.fillStyle = '#e63946';
      outCtx.beginPath();
      outCtx.moveTo(410, 120);
      outCtx.lineTo(430, 80);
      outCtx.lineTo(570, 80);
      outCtx.lineTo(590, 120);
      outCtx.closePath();
      outCtx.fill();

      // Roof details
      outCtx.strokeStyle = '#c1121f';
      outCtx.lineWidth = 2;
      outCtx.strokeRect(430, 80, 140, 40);
      outCtx.beginPath();
      outCtx.moveTo(465, 80); outCtx.lineTo(465, 120);
      outCtx.moveTo(500, 80); outCtx.lineTo(500, 120);
      outCtx.moveTo(535, 80); outCtx.lineTo(535, 120);
      outCtx.stroke();

      // Window (glowing cozy warm yellow)
      outCtx.fillStyle = '#ffea00';
      outCtx.fillRect(445, 140, 25, 20);
      outCtx.strokeStyle = '#4e3629';
      outCtx.lineWidth = 2;
      outCtx.strokeRect(445, 140, 25, 20);
      outCtx.beginPath();
      outCtx.moveTo(457.5, 140); outCtx.lineTo(457.5, 160);
      outCtx.moveTo(445, 150); outCtx.lineTo(470, 150);
      outCtx.stroke();

      // Door (dark brown wooden door)
      outCtx.fillStyle = '#5c4033';
      outCtx.fillRect(485, 150, 30, 40);
      outCtx.strokeStyle = '#3e2723';
      outCtx.strokeRect(485, 150, 30, 40);
      // Door knob
      outCtx.fillStyle = '#ffea00';
      outCtx.beginPath();
      outCtx.arc(510, 170, 2.5, 0, Math.PI * 2);
      outCtx.fill();

      // Fences and Decorative Elements
      outCtx.fillStyle = '#8d6e63';
      for (let fx = 100; fx < MAP_WIDTH - 100; fx += 120) {
        if (fx < 320 || fx > 680) {
          outCtx.fillRect(fx, 220, 6, 20);
          outCtx.fillRect(fx + 40, 220, 6, 20);
          outCtx.fillStyle = '#a1887f';
          outCtx.fillRect(fx, 224, 46, 4);
          outCtx.fillRect(fx, 232, 46, 4);
          outCtx.fillStyle = '#8d6e63';
        }
      }

      // Cozy Flowers
      const drawFlower = (x: number, y: number, color: string) => {
        outCtx.fillStyle = color;
        outCtx.beginPath();
        outCtx.arc(x, y, 4, 0, Math.PI * 2);
        outCtx.fill();
        outCtx.fillStyle = '#ffea00';
        outCtx.fillRect(x - 1, y - 1, 2, 2);
      };
      drawFlower(200, 300, '#ff007f');
      drawFlower(215, 290, '#00f0ff');
      drawFlower(230, 310, '#ff007f');
      drawFlower(800, 350, '#ffea00');
      drawFlower(820, 365, '#e63946');
      drawFlower(790, 380, '#9d4edd');
    }
    outdoorBgCanvasRef.current = outCanvas;

    // 2. Create Indoor Background Canvas
    const inCanvas = document.createElement('canvas');
    inCanvas.width = CANVAS_WIDTH;
    inCanvas.height = CANVAS_HEIGHT;
    const inCtx = inCanvas.getContext('2d');
    if (inCtx) {
      // Cozy black margins
      inCtx.fillStyle = '#090a10';
      inCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Wooden floor
      inCtx.fillStyle = '#b76e39';
      inCtx.fillRect(180, 100, 440, 300);

      // Floorboard lines
      inCtx.strokeStyle = '#9c5a2b';
      inCtx.lineWidth = 1.5;
      for (let wy = 120; wy < 400; wy += 24) {
        inCtx.beginPath();
        inCtx.moveTo(180, wy);
        inCtx.lineTo(620, wy);
        inCtx.stroke();
      }

      // Stone walls
      inCtx.fillStyle = '#546e7a';
      inCtx.fillRect(170, 80, 460, 20);
      inCtx.fillRect(170, 80, 10, 320);
      inCtx.fillRect(620, 80, 10, 320);
      inCtx.fillRect(170, 400, 200, 10);
      inCtx.fillRect(430, 400, 200, 10);

      // Exit sill
      inCtx.fillStyle = '#8d6e63';
      inCtx.fillRect(370, 400, 60, 10);

      // Furniture
      if (bedImageRef.current) {
        inCtx.drawImage(bedImageRef.current, 175, 75, 140, 140);
      } else {
        inCtx.fillStyle = '#5c4033';
        inCtx.fillRect(190, 100, 120, 110);
        inCtx.fillStyle = '#eceff1';
        inCtx.fillRect(198, 108, 104, 25);
        inCtx.fillStyle = '#b30000';
        inCtx.fillRect(190, 133, 120, 77);
        inCtx.fillStyle = '#e60000';
        inCtx.fillRect(190, 133, 120, 12);
      }

      if (sofaImageRef.current) {
        inCtx.drawImage(sofaImageRef.current, 465, 235, 150, 100);
      } else {
        inCtx.fillStyle = '#0d47a1';
        inCtx.fillRect(480, 250, 80, 15);
        inCtx.fillStyle = '#1976d2';
        inCtx.fillRect(480, 265, 80, 35);
        inCtx.fillStyle = '#0d47a1';
        inCtx.fillRect(472, 253, 10, 47);
        inCtx.fillRect(558, 253, 10, 47);
      }
    }
    indoorBgCanvasRef.current = inCanvas;
  }, [assetsLoaded]);

  const getWorld = (): FarmWorld => ({ progress: farmRef.current, crops: cropsRef.current, wildItems: wildItemsRef.current, weeds: weedsRef.current, chest: chestItemsRef.current, players: [localPlayerRef.current, remotePlayerRef.current] });
  const showNotice = (message: string) => {
    noticeRef.current = { message, until: Date.now() + 3500 };
    refreshUi();
  };
  const performGameAction = (action: FarmAction) => {
    if (!selectionComplete) return;
    const p = localPlayerRef.current;
    if (!isHost && isConnected) {
      if (!hasHostStateRef.current) { showNotice('Waiting for your partner’s farm…'); return; }
      if (pendingActionsRef.current.length >= 32) { showNotice('Waiting for your partner to catch up…'); return; }
      pendingActionsRef.current.push({ id: ++nextActionIdRef.current, sessionId: farmRef.current.sessionId, action, position: { x: p.x, y: p.y, inHouse: p.inHouse } });
      return;
    }
    const previousLevel = getFarmLevel(farmRef.current.xp).level;
    const result = applyFarmAction(getWorld(), p, action);
    const nextLevel = getFarmLevel(farmRef.current.xp).level;
    showNotice(nextLevel > previousLevel ? `Farm level ${nextLevel}! ${result.message}` : result.message);
  };

  const spawnPluckParticles = (x: number, y: number) => {
    for (let i = 0; i < 8; i++) {
      smokeParticlesRef.current.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        size: 3 + Math.random() * 4,
        opacity: 0.7 + Math.random() * 0.3,
        maxLife: 30 + Math.random() * 20,
        life: 0
      });
    }
  };

  const triggerInteract = () => {
    if (!selectionComplete || isBoardOpenRef.current || isMenuOpenRef.current) return;
    if (isNearChestRef.current) {
      setIsChestOpen((prev) => !prev);
      return;
    }
    if (isChestOpenRef.current) {
      setIsChestOpen(false);
      return;
    }

    const p = localPlayerRef.current;
    if (!p.inHouse) {
      if (near(p, MARKET, 60)) { openBoard(); return; }
      if (near(p, COOP, 60)) { performGameAction({ type: 'coop' }); return; }
      // 1. Check crop harvesting
      let closestCropIdx = -1;
      let minDist = 35;
      cropsRef.current.forEach((crop, idx) => {
        const dist = Math.hypot(p.x - crop.x, p.y - crop.y);
        if (dist < minDist) {
          minDist = dist;
          closestCropIdx = idx;
        }
      });

      if (closestCropIdx !== -1 && cropsRef.current[closestCropIdx].stage === 2) {
        performGameAction({ type: 'harvest', cropId: cropsRef.current[closestCropIdx].id });
        return;
      }

      // 2. Check wild item gathering
      let closestItem: WildItem | null = null;
      let minItemDist = 35;
      wildItemsRef.current.forEach((item) => {
        if (item.active) {
          const dist = Math.hypot(p.x - item.x, p.y - item.y);
          if (dist < minItemDist) {
            minItemDist = dist;
            closestItem = item;
          }
        }
      });

      if (closestItem) {
        performGameAction({ type: 'pickup_item', id: (closestItem as WildItem).id });
        return;
      }

      // 3. Check weed plucking
      let closestWeed: Weed | null = null;
      let minWeedDist = 25;
      for (const weed of weedsRef.current) {
        const dist = Math.hypot(p.x - weed.x, p.y - weed.y);
        if (dist < minWeedDist) {
          minWeedDist = dist;
          closestWeed = weed;
        }
      }

      if (closestWeed) {
        spawnPluckParticles(closestWeed.x, closestWeed.y);
        performGameAction({ type: 'pluck_weed', id: closestWeed.id });
        return;
      }
    }
  };

  const triggerUseHeldItem = () => {
    if (!selectionComplete || isChestOpenRef.current || isBoardOpenRef.current || isMenuOpenRef.current) return;

    const p = localPlayerRef.current;
    if (!p.inHouse) {
      const selectedSlotIdx = selectedSlotRef.current;
      const heldItem = p.inventory[selectedSlotIdx];

      if (heldItem && isSeed(heldItem.type)) {
        performGameAction({ type: 'plant', slot: selectedSlotIdx });
      } else if (heldItem && heldItem.type === 'watering_can') {
        // Water crop
        let closestCropIdx = -1;
        let minDist = 35;
        cropsRef.current.forEach((crop, idx) => {
          const dist = Math.hypot(p.x - crop.x, p.y - crop.y);
          if (dist < minDist) {
            minDist = dist;
            closestCropIdx = idx;
          }
        });
        if (closestCropIdx !== -1 && !cropsRef.current[closestCropIdx].watered) {
          performGameAction({ type: 'water', cropId: cropsRef.current[closestCropIdx].id });
        }
      }
    }
  };

  const gamepadConnected = useFarmController({
    root: rootRef, enabled: assetsLoaded,
    onMove: value => { controllerMoveRef.current = value; },
    onUse: triggerUseHeldItem, onInteract: triggerInteract,
    onCycle: direction => selectSlot(cycleInventory(selectedSlotRef.current, direction, localPlayerRef.current.inventory.length)),
    onBoard: openBoard, onBack: closePanels, onMenu: toggleFarmMenu,
  });
  const sendSnapshot = useEffectEvent(sendGameData);
  const handleShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (key === 'escape') {
      if (isBoardOpen || isChestOpen || isMenuOpen) closePanels(); else toggleFarmMenu();
      return;
    }
    if (!selectionComplete) return;
    if (key === 'b') { if (isBoardOpen) closePanels(); else openBoard(); return; }
    if (isBoardOpen || isMenuOpen) return;
    const slot = Number(e.key) - 1;
    if (Number.isInteger(slot) && slot >= 0 && slot < localPlayerRef.current.inventory.length) selectSlot(slot);
    if (key === 'e') triggerInteract();
    if (e.key === ' ' && (e.target as HTMLElement)?.tagName !== 'BUTTON') triggerUseHeldItem();
  });

  // Set up local keyboard listeners
  useEffect(() => {
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
      if (!isBoardOpenRef.current && !isMenuOpenRef.current && activeEl?.tagName !== 'BUTTON' && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(keyLower)) {
        e.preventDefault();
      }

      keysRef.current[e.key] = true;
      keysRef.current[keyLower] = true;
      keysRef.current[e.code] = true;

      handleShortcut(e);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyLower = e.key.toLowerCase();
      keysRef.current[e.key] = false;
      keysRef.current[keyLower] = false;
      keysRef.current[e.code] = false;
    };

    const handleBlur = () => {
      keysRef.current = {};
      touchMoveRef.current = { x: 0, y: 0 };
      controllerMoveRef.current = { x: 0, y: 0 };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleBlur);
    };
  }, []);

  // Synchronize character selections and starting states
  const receiveGameData = useEffectEvent(() => {
    if (!gameData || gameData.game !== 'farm') return;

    if (gameData.type === 'selection') {
      setRemoteGender(gameData.gender);
    } else if (gameData.type === 'movement') {
      if (gameData.player) {
        remotePlayerRef.current.x = gameData.player.x;
        remotePlayerRef.current.y = gameData.player.y;
        remotePlayerRef.current.facingLeft = gameData.player.facingLeft;
        remotePlayerRef.current.isMoving = gameData.player.isMoving;
        remotePlayerRef.current.gender = gameData.player.gender;
        remotePlayerRef.current.inHouse = gameData.player.inHouse;
        remotePlayerRef.current.facingUp = gameData.player.facingUp;
        if (!isHost && gameData.player.inventory) {
          remotePlayerRef.current.inventory = gameData.player.inventory;
        }
      }
      if (!isHost) {
        // Client receives master state from Host
        if (gameData.chest) chestItemsRef.current = gameData.chest;
        if (gameData.farm) { farmRef.current = gameData.farm; hasHostStateRef.current = true; }
        if (gameData.guestInventory) localPlayerRef.current.inventory = gameData.guestInventory;
        if (typeof gameData.ack === 'number') {
          if (gameData.ack > guestAckRef.current && gameData.notice) showNotice(gameData.notice);
          guestAckRef.current = gameData.ack;
          pendingActionsRef.current = pendingActionsRef.current.filter(request => request.id > gameData.ack);
        }
        if (gameData.crops) cropsRef.current = [...gameData.crops];
        if (gameData.wildItems) wildItemsRef.current = [...gameData.wildItems];
        if (gameData.weeds) weedsRef.current = [...gameData.weeds];
        if (gameData.chickens) chickensRef.current = [...gameData.chickens];
        if (gameData.elapsedTime !== undefined) {
          elapsedTimeRef.current = gameData.elapsedTime;
        }
      } else if (Array.isArray(gameData.actions)) {
        const result = processFarmRequests(getWorld(), remotePlayerRef.current, gameData.actions, guestAckRef.current);
        guestAckRef.current = result.lastId;
        if (result.message) guestNoticeRef.current = result.message;
      }
    }
  });
  // The peer context exposes incoming network packets as state; apply each packet once.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { receiveGameData(); }, [gameData]);

  // Refresh the lightweight board/HUD without restarting physics on every packet.
  useEffect(() => {
    if (!selectionComplete) return;
    const timer = window.setInterval(() => refreshUiFromEffect(), 250);
    return () => window.clearInterval(timer);
  }, [selectionComplete]);

  // Sync selection events
  const sendSelection = useEffectEvent(() => {
    if (localGender) {
      sendGameData({ game: 'farm', type: 'selection', gender: localGender });
      localPlayerRef.current.gender = localGender;
    }
  });
  useEffect(() => {
    sendSelection();
    if (!localGender || selectionComplete) return;
    const timer = window.setInterval(() => sendSelection(), 500);
    return () => window.clearInterval(timer);
  }, [localGender, selectionComplete]);

  const handleRestartLocal = () => {
    setLocalGender(null);
    setRemoteGender(null);
    setSelectedSlot(0);
    setIsBoardOpen(false);
    setIsChestOpen(false);
    setIsMenuOpen(false);
    touchMoveRef.current = { x: 0, y: 0 };
    keysRef.current = {};
    localPlayerRef.current = {
      x: isHost ? 480 : 520,
      y: 350,
      gender: null,
      facingLeft: false,
      isMoving: false,
      inHouse: false,
      facingUp: false,
      inventory: localPlayerRef.current.inventory
    };
    remotePlayerRef.current = {
      x: isHost ? 520 : 480,
      y: 350,
      gender: null,
      facingLeft: false,
      isMoving: false,
      inHouse: false,
      facingUp: false,
      inventory: remotePlayerRef.current.inventory
    };
    smokeParticlesRef.current = [];
    fireParticlesRef.current = [];
    // Changing characters keeps crops, inventories and shared farm progress intact.
  };

  // Restart/Action trigger from peer
  const receiveGameEvent = useEffectEvent(() => {
    if (gameEvent?.type === 'restart_farm') {
      handleRestartLocal();
      resetGameEvent();
    }
  });
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Apply a received peer command.
  useEffect(() => { receiveGameEvent(); }, [gameEvent]);

  const triggerRestart = () => {
    handleRestartLocal();
    if (isConnected) {
      sendGameEvent({ type: 'restart_farm' });
    }
  };

  // Main game physics and drawing loop
  useEffect(() => {
    if (!selectionComplete || !assetsLoaded) return;

    // Reset spawning positions in the plot center
    localPlayerRef.current.x = isHost ? 480 : 520;
    localPlayerRef.current.y = 350;
    localPlayerRef.current.gender = localGender;
    localPlayerRef.current.inHouse = false;
    localPlayerRef.current.facingUp = false;

    remotePlayerRef.current.x = isHost ? 520 : 480;
    remotePlayerRef.current.y = 350;
    remotePlayerRef.current.gender = remoteGender;
    remotePlayerRef.current.inHouse = false;
    remotePlayerRef.current.facingUp = false;

    let animationId: number;

    const checkHouseCollision = (x: number, y: number): boolean => {
      // House bounding box: x in [420, 580], y in [80, 190]
      // Add margin for character size
      const padding = 16;
      const hLeft = 420 - padding;
      const hRight = 580 + padding;
      const hTop = 80 - padding;
      const hBottom = 190 + padding;

      return (x > hLeft && x < hRight && y > hTop && y < hBottom)
        || (x > MARKET.x - 46 && x < MARKET.x + 46 && y > MARKET.y - 76 && y < MARKET.y - 8)
        || (x > COOP.x - 44 && x < COOP.x + 44 && y > COOP.y - 66 && y < COOP.y - 6);
    };

    const checkHouseInteriorCollision = (x: number, y: number): boolean => {
      const margin = 14;
      const fLeft = 180 + margin;
      const fRight = 620 - margin;
      const fTop = 100 + margin;
      const fBottom = 400 - margin;

      // Allow passing boundary at the doorway exit
      const isAtExit = x >= 370 && x <= 430 && y >= fBottom;
      if (isAtExit) return false;

      // Floor borders
      if (x < fLeft || x > fRight || y < fTop || y > fBottom) return true;

      // Sofa collision: x in [470, 570], y in [240, 310]
      if (x > 470 - margin && x < 570 + margin && y > 240 - margin && y < 310 + margin) return true;

      // Bed collision: x in [190, 310], y in [100, 210]
      if (x > 190 - margin && x < 310 + margin && y > 100 - margin && y < 210 + margin) return true;

      // Chimney collision: x in [368, 432], y in [100, 136]
      if (x > 368 - margin && x < 432 + margin && y > 100 && y < 136 + margin) return true;

      // Chest collision: x in [532, 568], y in [100, 120]
      if (x > 532 - margin && x < 568 + margin && y > 100 && y < 120 + margin) return true;

      return false;
    };

    let syncTicks = 0;
    const updatePhysics = () => {
      const p = localPlayerRef.current;

      // Proximity check for chest
      const distToChest = Math.hypot(p.x - 550, p.y - 120);
      isNearChestRef.current = p.inHouse && distToChest < 45;

      // Host or single-player ticks crop growth and wild items respawn
      if (isHost || !isConnected) {
        tickFarm({ progress: farmRef.current, crops: cropsRef.current }, 1 / 60, elapsedTimeRef.current);

        // Wild item respawn logic
        wildItemsRef.current.forEach((item) => {
          if (!item.active) {
            item.respawnTimer += 1 / 60;
            if (item.respawnTimer >= 20) { // 20 seconds respawn timer
              item.active = true;
              item.respawnTimer = 0;
            }
          }
        });

        // Wild weed random spawning logic (Day 4 onwards, check every 20 seconds)
        if (elapsedTimeRef.current >= 6300) {
          const currentSpTime = Math.floor(elapsedTimeRef.current);
          if (currentSpTime > 0 && currentSpTime % 20 === 0) {
            const hasSpawnedThisTick = weedsRef.current.some(w => w.id.startsWith(`spawn_${currentSpTime}`));
            if (!hasSpawnedThisTick) {
              if (Math.random() < 0.4 && weedsRef.current.length < 90) {
                let spawned = false;
                let attempts = 0;
                while (!spawned && attempts < 100) {
                  attempts++;
                  const wx = 40 + Math.random() * (MAP_WIDTH - 80);
                  const wy = 40 + Math.random() * (MAP_HEIGHT - 80);

                  if (wx >= 395 && wx <= 605 && wy >= 55 && wy <= 215) continue;
                  if (wx >= 330 && wx <= 670 && wy >= 230 && wy <= 470) continue;
                  if (Math.hypot(wx - MARKET.x, wy - MARKET.y) < 75 || Math.hypot(wx - COOP.x, wy - COOP.y) < 75) continue;

                  weedsRef.current.push({
                    id: `spawn_${currentSpTime}_${Math.floor(Math.random() * 1000)}`,
                    x: wx,
                    y: wy,
                    type: Math.floor(Math.random() * 3) + 1
                  });
                  spawned = true;
                  refreshUiFromEffect();
                }
              }
            }
          }
        }

        // Chickens wandering & animation update
        chickensRef.current.forEach((ch) => {
          ch.timer -= 1 / 60;
          if (ch.timer <= 0) {
            if (ch.state === 'idle') {
              ch.state = 'walking';
              const dirs: ('down' | 'left' | 'right' | 'up')[] = ['down', 'left', 'right', 'up'];
              ch.direction = dirs[Math.floor(Math.random() * dirs.length)];
              const speed = 0.5 + Math.random() * 0.4;
              if (ch.direction === 'left') { ch.vx = -speed; ch.vy = 0; }
              else if (ch.direction === 'right') { ch.vx = speed; ch.vy = 0; }
              else if (ch.direction === 'up') { ch.vx = 0; ch.vy = -speed; }
              else { ch.vx = 0; ch.vy = speed; }
              ch.timer = 1.5 + Math.random() * 2;
            } else {
              ch.state = 'idle';
              ch.vx = 0;
              ch.vy = 0;
              ch.timer = 1 + Math.random() * 2;
            }
          }

          if (ch.state === 'walking') {
            const nextX = ch.x + ch.vx;
            const nextY = ch.y + ch.vy;

            // Constrain wandering area: near their starting coordinates (up to 120px)
            const maxWander = 120;
            const withinBoundaries = 
              nextX >= Math.max(40, ch.startX - maxWander) && 
              nextX <= Math.min(MAP_WIDTH - 40, ch.startX + maxWander) &&
              nextY >= Math.max(40, ch.startY - maxWander) && 
              nextY <= Math.min(MAP_HEIGHT - 40, ch.startY + maxWander);

            // Check boundaries and house collision
            if (withinBoundaries && !checkHouseCollision(nextX, nextY)) {
              ch.x = nextX;
              ch.y = nextY;
            } else {
              // Bounced or hit boundary: turn around
              ch.vx = -ch.vx;
              ch.vy = -ch.vy;
              if (ch.direction === 'left') ch.direction = 'right';
              else if (ch.direction === 'right') ch.direction = 'left';
              else if (ch.direction === 'up') ch.direction = 'down';
              else ch.direction = 'up';
            }

            // Animate walking frames (4 frames per row, 8 ticks per frame)
            ch.animationTick++;
            if (ch.animationTick >= 8) {
              ch.frameIndex = (ch.frameIndex + 1) % 4;
              ch.animationTick = 0;
            }
          } else {
            // Idle frame animation: slower blinking/pecking
            ch.animationTick++;
            if (ch.animationTick >= 16) {
              ch.frameIndex = (ch.frameIndex + 1) % 4;
              ch.animationTick = 0;
            }
          }
        });
      }

      if (isChestOpenRef.current || isBoardOpenRef.current || isMenuOpenRef.current) {
        p.isMoving = false;
      } else {
        let dx = 0;
        let dy = 0;

        const touch = touchMoveRef.current;
        const controller = controllerMoveRef.current;
        if (touch.x || touch.y) {
          dx = touch.x; dy = touch.y;
        } else if (controller.x || controller.y) {
          dx = controller.x; dy = controller.y;
        } else {
          if (keysRef.current['a'] || keysRef.current['A'] || keysRef.current['ArrowLeft']) dx = -1;
          if (keysRef.current['d'] || keysRef.current['D'] || keysRef.current['ArrowRight']) dx = 1;
          if (keysRef.current['w'] || keysRef.current['W'] || keysRef.current['ArrowUp']) dy = -1;
          if (keysRef.current['s'] || keysRef.current['S'] || keysRef.current['ArrowDown']) dy = 1;

          // Normalization
          if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
          }
        }

        const vx = dx * PLAYER_SPEED;
        const vy = dy * PLAYER_SPEED;

        p.isMoving = vx !== 0 || vy !== 0;

        if (vx < 0) {
          p.facingLeft = true;
        } else if (vx > 0) {
          p.facingLeft = false;
        }

        if (dy < 0) {
          p.facingUp = true;
        } else if (dy > 0) {
          p.facingUp = false;
        } else if (dx !== 0) {
          p.facingUp = false;
        }

        // Propose new positions
        const nextX = p.x + vx;
        const nextY = p.y + vy;

        if (!p.inHouse) {
          // --- OUTDOORS MOVEMENT ---
          // Enter house door trigger: door is at y=190, x in [480, 520]
          if (nextY < 206 && p.y >= 195 && nextX >= 480 && nextX <= 520) {
            p.inHouse = true;
            p.x = 400; // spawn inside house
            p.y = 370;
          } else {
            // Normal collisions
            if (!checkHouseCollision(nextX, p.y)) {
              p.x = Math.max(20, Math.min(MAP_WIDTH - 20, nextX));
            }
            if (!checkHouseCollision(p.x, nextY)) {
              p.y = Math.max(20, Math.min(MAP_HEIGHT - 20, nextY));
            }
          }
        } else {
          // --- INDOORS MOVEMENT ---
          // Exit house door trigger: bottom sill at y=400, x in [370, 430]
          if (nextY > 400 && nextX >= 370 && nextX <= 430) {
            p.inHouse = false;
            p.x = 500; // spawn outside door
            p.y = 205;
          } else {
            if (!checkHouseInteriorCollision(nextX, p.y)) {
              p.x = nextX;
            }
            if (!checkHouseInteriorCollision(p.x, nextY)) {
              p.y = nextY;
            }
          }
        }
      }

      if (isHost || !isConnected) {
        elapsedTimeRef.current += 1 / 60;
      }

      // Ten snapshots per second; queued requests are resent until host acknowledgement.
      syncTicks++;
      if (isConnected && syncTicks % 6 === 0 && isHost) {
        sendSnapshot({
          game: 'farm',
          type: 'movement',
          player: {
            x: p.x,
            y: p.y,
            facingLeft: p.facingLeft,
            isMoving: p.isMoving,
            gender: p.gender,
            inHouse: p.inHouse,
            facingUp: p.facingUp,
            inventory: p.inventory
          },
          chest: chestItemsRef.current,
          crops: cropsRef.current,
          wildItems: wildItemsRef.current,
          weeds: weedsRef.current,
          chickens: chickensRef.current,
          elapsedTime: elapsedTimeRef.current,
          farm: farmRef.current,
          guestInventory: remotePlayerRef.current.inventory,
          ack: guestAckRef.current,
          notice: guestNoticeRef.current
        });
      } else if (isConnected && syncTicks % 6 === 0) {
        // Client only sends player state
        sendSnapshot({
          game: 'farm',
          type: 'movement',
          player: {
            x: p.x,
            y: p.y,
            facingLeft: p.facingLeft,
            isMoving: p.isMoving,
            gender: p.gender,
            inHouse: p.inHouse,
            facingUp: p.facingUp,
          },
          actions: pendingActionsRef.current
        });
      }



      // Play music if local player is standing on the crop plot (x: [350, 650], y: [250, 450]) outdoors
      const isOnPlot = !p.inHouse && p.x >= 350 && p.x <= 650 && p.y >= 250 && p.y <= 450;
      if (audioRef.current) {
        if (isOnPlot && selectionComplete) {
          if (audioRef.current.paused) {
            audioRef.current.play().catch((err) => {
              console.warn('Audio play blocked or failed:', err);
            });
          }
        } else {
          if (!audioRef.current.paused) {
            audioRef.current.pause();
          }
        }
      }

      // Play home music if local player is inside the house
      if (homeAudioRef.current) {
        if (p.inHouse && selectionComplete) {
          if (homeAudioRef.current.paused) {
            homeAudioRef.current.play().catch((err) => {
              console.warn('Home audio play blocked or failed:', err);
            });
          }
        } else {
          if (!homeAudioRef.current.paused) {
            homeAudioRef.current.pause();
          }
        }
      }

      // Update chimney smoke particles (outdoors)
      if (!p.inHouse) {
        const chimneyX = 560;
        const chimneyY = 70;
        if (Math.random() < 0.15) {
          smokeParticlesRef.current.push({
            x: chimneyX,
            y: chimneyY,
            vx: -0.2 - Math.random() * 0.4,
            vy: -0.5 - Math.random() * 0.8,
            size: 4 + Math.random() * 5,
            opacity: 0.6 + Math.random() * 0.3,
            maxLife: 80 + Math.random() * 40,
            life: 0
          });
        }
      }

      // Tick particles
      smokeParticlesRef.current.forEach((part) => {
        part.x += part.vx;
        part.y += part.vy;
        part.life++;
        part.opacity = Math.max(0, 1 - part.life / part.maxLife);
      });
      smokeParticlesRef.current = smokeParticlesRef.current.filter((part) => part.life < part.maxLife);

      fireParticlesRef.current.forEach((part) => {
        part.x += part.vx;
        part.y += part.vy;
        part.life++;
      });
      fireParticlesRef.current = fireParticlesRef.current.filter((part) => part.life < part.maxLife);
    };

    const drawGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const currentWidth = canvas.width;
      const currentHeight = canvas.height;
      const p1 = localPlayerRef.current;
      const p2 = remotePlayerRef.current;
      // Outdoors fills the available screen. Portrait phones see a closer, taller
      // slice of the farm instead of a tiny landscape image between black bars.
      const scale = p1.inHouse
        ? Math.min(currentWidth / CANVAS_WIDTH, currentHeight / CANVAS_HEIGHT)
        : Math.max(currentWidth / MAP_WIDTH, currentHeight / MAP_HEIGHT, Math.min(currentWidth / 480, currentHeight / 480));
      const viewWidth = p1.inHouse ? CANVAS_WIDTH : currentWidth / scale;
      const viewHeight = p1.inHouse ? CANVAS_HEIGHT : currentHeight / scale;
      const offsetX = (currentWidth - viewWidth * scale) / 2;
      const offsetY = (currentHeight - viewHeight * scale) / 2;

      // Black background for letterbox borders
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, currentWidth, currentHeight);

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      const drawChest = (cCtx: CanvasRenderingContext2D, cx: number, cy: number) => {
        const width = 36;
        const height = 28;
        const rx = cx - width / 2;
        const ry = cy - height;

        // Wooden body
        cCtx.fillStyle = '#8B5A2B';
        cCtx.fillRect(rx, ry, width, height);

        // Seams and detail lines (dark brown)
        cCtx.fillStyle = '#5C3A21';
        cCtx.fillRect(rx, ry + height - 4, width, 4); // bottom shadow
        cCtx.fillRect(rx + 3, ry + 12, width - 6, 2); // middle seam

        // Gold trim bands
        cCtx.fillStyle = '#FFD700';
        cCtx.fillRect(rx, ry, 3, height); // left border
        cCtx.fillRect(rx + width - 3, ry, 3, height); // right border
        cCtx.fillRect(rx + 3, ry, width - 6, 3); // top border

        // Lock plate
        cCtx.fillStyle = '#DAA520';
        cCtx.fillRect(rx + width / 2 - 4, ry + 10, 8, 7);
        cCtx.fillStyle = '#000000';
        cCtx.fillRect(rx + width / 2 - 1, ry + 12, 2, 4); // lock keyhole
      };

      const drawTooltip = (tCtx: CanvasRenderingContext2D, text: string, subtext: string, tx: number, ty: number) => {
        tCtx.save();
        tCtx.font = 'bold 9px Orbitron';
        const textWidth = tCtx.measureText(text).width;
        tCtx.font = '7px Orbitron';
        const subtextWidth = tCtx.measureText(subtext).width;
        const w = Math.max(textWidth, subtextWidth) + 16;
        const h = 26;
        const bx = tx - w / 2;
        const by = ty - h - 10;

        // Bubble background
        tCtx.fillStyle = 'rgba(11, 12, 21, 0.9)';
        tCtx.strokeStyle = 'rgba(255, 234, 0, 0.8)';
        tCtx.lineWidth = 1;
        tCtx.beginPath();
        if (tCtx.roundRect) {
          tCtx.roundRect(bx, by, w, h, 6);
        } else {
          tCtx.rect(bx, by, w, h);
        }
        tCtx.fill();
        tCtx.stroke();

        // Arrow pointer pointing down
        tCtx.fillStyle = 'rgba(11, 12, 21, 0.9)';
        tCtx.beginPath();
        tCtx.moveTo(tx - 4, by + h);
        tCtx.lineTo(tx, by + h + 4);
        tCtx.lineTo(tx + 4, by + h);
        tCtx.closePath();
        tCtx.fill();
        tCtx.strokeStyle = 'rgba(255, 234, 0, 0.8)';
        tCtx.beginPath();
        tCtx.moveTo(tx - 4, by + h);
        tCtx.lineTo(tx, by + h + 4);
        tCtx.lineTo(tx + 4, by + h);
        tCtx.stroke();

        // Text
        tCtx.fillStyle = '#ffea00';
        tCtx.font = 'bold 9px Orbitron';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'top';
        tCtx.fillText(text, tx, by + 4);

        // Subtext
        tCtx.fillStyle = '#ffffff';
        tCtx.font = '7px Orbitron';
        tCtx.fillText(subtext, tx, by + 15);
        tCtx.restore();
      };

      const drawPlayer = (player: PlayerState, isMe: boolean) => {
        if (!player.gender) return;

        const img = player.gender === 'male'
          ? (player.facingUp ? maleUpImageRef.current : maleImageRef.current)
          : (player.facingUp ? femaleUpImageRef.current : femaleImageRef.current);
        if (!img) return;

        ctx.save();
        // Move to player coordinate
        ctx.translate(player.x, player.y);

        // Flip image horizontally if facing left
        if (player.facingLeft) {
          ctx.scale(-1, 1);
        }

        // Draw character sprite centered at coordinate
        // (x, y) acts as the center-bottom pivot of the character feet
        ctx.drawImage(
          img,
          -SPRITE_SIZE / 2,
          -SPRITE_SIZE + 4, // Draw slightly upwards so pivot aligns with feet
          SPRITE_SIZE,
          SPRITE_SIZE
        );

        ctx.restore();

        // Draw Label Tag above player
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 3;
        ctx.fillText(
          `${isMe ? 'YOU' : 'PARTNER'} (${player.gender.toUpperCase()})`,
          player.x,
          player.y - SPRITE_SIZE - 2
        );
        ctx.shadowBlur = 0; // Reset
      };

      if (p1.inHouse) {
        // --- DRAW HOUSE INTERIOR ---
        if (indoorBgCanvasRef.current) {
          ctx.drawImage(indoorBgCanvasRef.current, 0, 0);
        } else {
          // Fallback if not cached yet
          ctx.fillStyle = '#090a10';
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          ctx.fillStyle = '#b76e39';
          ctx.fillRect(180, 100, 440, 300);
          ctx.strokeStyle = '#9c5a2b';
          ctx.lineWidth = 1.5;
          for (let wy = 120; wy < 400; wy += 24) {
            ctx.beginPath();
            ctx.moveTo(180, wy);
            ctx.lineTo(620, wy);
            ctx.stroke();
          }
          ctx.fillStyle = '#546e7a';
          ctx.fillRect(170, 80, 460, 20);
          ctx.fillRect(170, 80, 10, 320);
          ctx.fillRect(620, 80, 10, 320);
          ctx.fillRect(170, 400, 200, 10);
          ctx.fillRect(430, 400, 200, 10);
          ctx.fillStyle = '#8d6e63';
          ctx.fillRect(370, 400, 60, 10);
          if (bedImageRef.current) {
            ctx.drawImage(bedImageRef.current, 175, 75, 140, 140);
          }
          if (sofaImageRef.current) {
            ctx.drawImage(sofaImageRef.current, 465, 235, 150, 100);
          }
        }

        // Draw Chest in house (at top right, x=550, y=120)
        drawChest(ctx, 550, 120);

        // Position and display animated Chimney GIF inside the house
        if (chimneyGifRef.current) {
          const chimneyWidth = 64;
          const chimneyHeight = 64;
          const worldX = 400;
          const worldY = 144; // bottom of chimney

          const rect = canvasRectRef.current;
          const cssScaleX = rect.width / canvas.width;
          const cssScaleY = rect.height / canvas.height;

          // Inside the house, the viewport is fixed (no camera scroll)
          const canvasX = (worldX - chimneyWidth / 2) * scale + offsetX;
          const canvasY = (worldY - chimneyHeight) * scale + offsetY;
          const canvasW = chimneyWidth * scale;
          const canvasH = chimneyHeight * scale;

          chimneyGifRef.current.style.display = 'block';
          chimneyGifRef.current.style.left = `${canvasX * cssScaleX}px`;
          chimneyGifRef.current.style.top = `${canvasY * cssScaleY}px`;
          chimneyGifRef.current.style.width = `${canvasW * cssScaleX}px`;
          chimneyGifRef.current.style.height = `${canvasH * cssScaleY}px`;
        }

        // Cozy fireplace glow inside the house
        const gradFireplace = ctx.createRadialGradient(400, 120, 2, 400, 120, 90);
        gradFireplace.addColorStop(0, 'rgba(255, 120, 0, 0.35)');
        gradFireplace.addColorStop(1, 'rgba(255, 120, 0, 0)');
        ctx.fillStyle = gradFireplace;
        ctx.beginPath();
        ctx.arc(400, 120, 90, 0, Math.PI * 2);
        ctx.fill();

        // 5. Draw Y-Sorted Players in House (only draw remote if they are in the house too)
        if (p2.gender && p2.inHouse) {
          if (p1.y < p2.y) {
            drawPlayer(p1, true);
            drawPlayer(p2, false);
          } else {
            drawPlayer(p2, false);
            drawPlayer(p1, true);
          }
        } else {
          drawPlayer(p1, true);
        }

        // Chest Tooltip Proximity Check
        if (isNearChestRef.current) {
          drawTooltip(ctx, 'CHEST', 'Interact to open', 550, 120 - 15);
        }

        // 6. Night shade inside the house (no campfire glow)
        const clockInfo = getGameClock(elapsedTimeRef.current);
        if (clockInfo.isNight) {
          ctx.fillStyle = 'rgba(10, 14, 42, 0.22)'; // soft night shade inside house
          ctx.fillRect(180, 100, 440, 300);
        }
      } else {
        // --- DRAW OUTDOOR FARM ---
        // Each farmer keeps their own character in view, even when exploring apart.
        const midX = p1.x;
        const midY = p1.y;

        let cameraX = midX - viewWidth / 2;
        let cameraY = midY - viewHeight / 2;

        cameraX = Math.max(0, Math.min(MAP_WIDTH - viewWidth, cameraX));
        cameraY = Math.max(0, Math.min(MAP_HEIGHT - viewHeight, cameraY));

        ctx.save();
        ctx.translate(-cameraX, -cameraY);

        // 1. Draw Map Background (Cached / Pre-rendered)
        if (outdoorBgCanvasRef.current) {
          ctx.drawImage(outdoorBgCanvasRef.current, 0, 0);
        } else {
          // Fallback if not cached yet
          ctx.fillStyle = '#2d6a4f';
          ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
        }

        // Hide chimney GIF overlay when outdoors
        if (chimneyGifRef.current) {
          chimneyGifRef.current.style.display = 'none';
        }
        drawFarmStations(ctx, farmRef.current, elapsedTimeRef.current);

        // 2. Draw Planted Crops on soil plot
        cropsRef.current.forEach((crop) => {
          // Draw dirt mound
          ctx.fillStyle = '#4E3629';
          ctx.beginPath();
          ctx.ellipse(crop.x, crop.y - 2, 10, 5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Blue outline ring if watered
          if (crop.watered) {
            ctx.strokeStyle = '#29b6f6';
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

          if (crop.stage === 0) {
            // Seedling sprout (tiny green dot)
            ctx.fillStyle = '#a1e9a4';
            ctx.fillRect(crop.x - 1, crop.y - 6, 2, 4);
            ctx.fillStyle = '#81c784';
            ctx.beginPath();
            ctx.arc(crop.x, crop.y - 6, 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (crop.stage === 1) {
            // Medium sprout (small double leaves)
            ctx.fillStyle = '#4caf50';
            ctx.fillRect(crop.x - 1, crop.y - 8, 2, 6);
            ctx.beginPath();
            ctx.arc(crop.x - 3, crop.y - 8, 2.5, 0, Math.PI * 2);
            ctx.arc(crop.x + 3, crop.y - 8, 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (crop.stage === 2) {
            // Fully Grown Veggie
            ctx.font = '15px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const cropEmoji = getItemEmoji(crop.type);
            ctx.fillText(cropEmoji, crop.x, crop.y + 2);
          }
          if (crop.stage < 2 && !crop.watered) {
            ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('💧', crop.x, crop.y - 16);
          }
        });

        // 3. Draw Wild Collectibles
        wildItemsRef.current.forEach((item) => {
          if (item.active) {
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath();
            ctx.ellipse(item.x, item.y - 1, 9, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = '15px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            let emoji = '🪵';
            if (item.type === 'berry') emoji = '🍓';
            else if (item.type === 'stone') emoji = '🪨';
            ctx.fillText(emoji, item.x, item.y + 2);
          }
        });

        // 3.5 Draw Wild Weeds
        weedsRef.current.forEach((weed) => {
          const type = weed.type || (parseInt(weed.id.split('_')[2] || '0') % 3) + 1;
          let img: HTMLImageElement | null;
          let w: number;
          let h: number;
          let shadowW: number;
          let shadowH: number;

          if (type === 1) {
            img = weed1ImageRef.current;
            w = 12;
            h = 12;
            shadowW = 4;
            shadowH = 1.5;
          } else if (type === 3) {
            img = weed3ImageRef.current;
            w = 26;
            h = 26;
            shadowW = 9;
            shadowH = 3;
          } else {
            img = weed2ImageRef.current;
            w = 18;
            h = 18;
            shadowW = 6;
            shadowH = 2;
          }

          // Draw shadow
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.beginPath();
          ctx.ellipse(weed.x, weed.y - 1, shadowW, shadowH, 0, 0, Math.PI * 2);
          ctx.fill();

          // Draw image
          if (img) {
            ctx.drawImage(img, weed.x - w / 2, weed.y - h, w, h);
          }
        });

        // 3.8 Draw Chickens
        chickensRef.current.forEach((ch) => {
          // Draw shadow
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.beginPath();
          ctx.ellipse(ch.x, ch.y - 1, 6, 2, 0, 0, Math.PI * 2);
          ctx.fill();

          if (chickenImageRef.current) {
            let row = 0;
            if (ch.direction === 'left') row = 1;
            else if (ch.direction === 'right') row = 2;
            else if (ch.direction === 'up') row = 3;

            const size = 32;
            const sx = ch.frameIndex * size;
            const sy = row * size;

            ctx.drawImage(
              chickenImageRef.current,
              sx,
              sy,
              size,
              size,
              ch.x - 12,
              ch.y - 22,
              24,
              24
            );
          }
        });

        // 4. Draw Chimney Smoke Particles
        ctx.fillStyle = 'rgba(230, 230, 230, 0.4)';
        smokeParticlesRef.current.forEach((part) => {
          ctx.save();
          ctx.globalAlpha = part.opacity;
          ctx.beginPath();
          ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // 6. Draw Y-Sorted Players Outdoors (only draw remote if they are outdoors too)
        if (p2.gender && !p2.inHouse) {
          if (p1.y < p2.y) {
            drawPlayer(p1, true);
            drawPlayer(p2, false);
          } else {
            drawPlayer(p2, false);
            drawPlayer(p1, true);
          }
        } else {
          drawPlayer(p1, true);
        }

        // 7. Draw Interaction Tooltips (relative to camera position)
        let closestCropIdx = -1;
        let minDist = 35;
        cropsRef.current.forEach((crop, idx) => {
          const dist = Math.hypot(p1.x - crop.x, p1.y - crop.y);
          if (dist < minDist) {
            minDist = dist;
            closestCropIdx = idx;
          }
        });
        const closestCrop = closestCropIdx !== -1 ? cropsRef.current[closestCropIdx] : null;

        if (near(p1, MARKET, 60)) {
          drawTooltip(ctx, 'VILLAGE MARKET', 'Interact for orders & upgrades', MARKET.x, MARKET.y - 80);
        } else if (near(p1, COOP, 60)) {
          drawTooltip(ctx, 'CHICKEN COOP', farmRef.current.eggs ? 'Interact to collect eggs' : farmRef.current.coopSeconds > 0 ? 'Happy hens are nesting…' : 'Interact: feed 1 carrot seed', COOP.x, COOP.y - 70);
        } else if (closestCrop && closestCrop.stage === 2) {
          drawTooltip(ctx, 'READY CROP', 'Interact to harvest', closestCrop.x, closestCrop.y - 12);
        } else {
          // Check proximity to wild items
          let closestItem: WildItem | null = null;
          let minItemDist = 35;
          wildItemsRef.current.forEach((item) => {
            if (item.active) {
              const dist = Math.hypot(p1.x - item.x, p1.y - item.y);
              if (dist < minItemDist) {
                minItemDist = dist;
                closestItem = item;
              }
            }
          });

          if (closestItem) {
            drawTooltip(ctx, (closestItem as WildItem).type.toUpperCase(), 'Interact to gather', (closestItem as WildItem).x, (closestItem as WildItem).y - 12);
          } else {
            // Check weed proximity
            let closestWeed: Weed | null = null;
            let minWeedDist = 25;
            for (const weed of weedsRef.current) {
              const dist = Math.hypot(p1.x - weed.x, p1.y - weed.y);
              if (dist < minWeedDist) {
                minWeedDist = dist;
                closestWeed = weed;
              }
            }

            if (closestWeed) {
              drawTooltip(ctx, 'WILD WEED', 'Interact to clear', closestWeed.x, closestWeed.y - 10);
            } else {
              // Plot tools hints
              const isOnPlot = p1.x >= 350 && p1.x <= 650 && p1.y >= 250 && p1.y <= 450;
              if (isOnPlot) {
                const heldItem = p1.inventory[selectedSlotRef.current];
                if (heldItem && isSeed(heldItem.type)) {
                  drawTooltip(ctx, 'SOIL PLOT', 'Use seeds to plant', p1.x, p1.y - 45);
                } else if (heldItem && heldItem.type === 'watering_can' && closestCrop && !closestCrop.watered) {
                  drawTooltip(ctx, 'DRY CROP', 'Use watering can', closestCrop.x, closestCrop.y - 12);
                }
              }
            }
          }
        }

        // Draw Day/Night Ambient Tint Overlay
        const clockInfo = getGameClock(elapsedTimeRef.current);
        const ambientColor = getAmbientColor(clockInfo.cycleSeconds);
        if (ambientColor) {
          ctx.fillStyle = ambientColor;
          ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

          // Window glow and Player lantern glows at sunset/night
          const isNight = clockInfo.isNight;
          const cycleSeconds = clockInfo.cycleSeconds;
          const intensity = isNight ? 0.35 : 0.2 * ((cycleSeconds - 1320) / 180);

          // Farmhouse window glow
          const gradWindow = ctx.createRadialGradient(457, 150, 2, 457, 150, 40);
          gradWindow.addColorStop(0, `rgba(255, 234, 0, ${intensity * 1.5})`);
          gradWindow.addColorStop(1, 'rgba(255, 234, 0, 0)');
          ctx.fillStyle = gradWindow;
          ctx.beginPath();
          ctx.arc(457, 150, 40, 0, Math.PI * 2);
          ctx.fill();

          // Player 1 (local) glow
          if (p1.gender) {
            const gradP1 = ctx.createRadialGradient(p1.x, p1.y - 12, 5, p1.x, p1.y - 12, 60);
            gradP1.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.8})`);
            gradP1.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradP1;
            ctx.beginPath();
            ctx.arc(p1.x, p1.y - 12, 60, 0, Math.PI * 2);
            ctx.fill();
          }

          // Player 2 (remote) glow
          if (p2.gender && !p2.inHouse) {
            const gradP2 = ctx.createRadialGradient(p2.x, p2.y - 12, 5, p2.x, p2.y - 12, 60);
            gradP2.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.8})`);
            gradP2.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradP2;
            ctx.beginPath();
            ctx.arc(p2.x, p2.y - 12, 60, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore(); // Restores camera translate
        if (getWeather(elapsedTimeRef.current) === 'rain') {
          ctx.fillStyle = '#294f711a'; ctx.fillRect(0, 0, viewWidth, viewHeight);
          ctx.strokeStyle = '#d1eef180'; ctx.lineWidth = 1;
          for (let i = 0; i < 70; i++) {
            const x = (i * 137 + elapsedTimeRef.current * 50) % viewWidth;
            const y = (i * 89 + elapsedTimeRef.current * 270) % viewHeight;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 10); ctx.stroke();
          }
        }
      }

      // Draw Retro GBA Clock Widget in top right (virtual screen space)
      ctx.save();
      ctx.translate(viewWidth - CANVAS_WIDTH, 0);
      const clockInfo = getGameClock(elapsedTimeRef.current);
      ctx.fillStyle = 'rgba(11, 12, 21, 0.8)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(645, 15, 140, 38, 8);
      } else {
        ctx.rect(645, 15, 140, 38);
      }
      ctx.fill();
      ctx.stroke();

      // Sun/Moon icon inside widget
      if (!clockInfo.isNight) {
        // Yellow glowing sun
        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.arc(665, 34, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffea00';
        ctx.lineWidth = 1.5;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          ctx.beginPath();
          ctx.moveTo(665 + Math.cos(a) * 8, 34 + Math.sin(a) * 8);
          ctx.lineTo(665 + Math.cos(a) * 11, 34 + Math.sin(a) * 11);
          ctx.stroke();
        }
      } else {
        // Soft blue crescent moon
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(665, 34, 6, -Math.PI / 2, Math.PI / 2);
        ctx.bezierCurveTo(668, 40, 668, 28, 665, 28);
        ctx.closePath();
        ctx.fill();
      }

      // Draw clock digital text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // Draw Day count
      ctx.fillStyle = '#ffea00';
      ctx.font = 'bold 8px Orbitron';
      ctx.fillText(`DAY ${clockInfo.virtualDay}`, 688, 25);

      // Draw Time string
      ctx.fillStyle = '#f8f9fa';
      ctx.font = 'bold 9px Orbitron';
      ctx.fillText(clockInfo.timeStr, 688, 37);
      ctx.font = '10px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#f2f6d5';
      ctx.fillText(getWeather(elapsedTimeRef.current) === 'rain' ? 'RAIN · Crops watered' : 'SUNNY · Rain every 2 min', 782, 67);
      ctx.restore();

      // Draw Retro GBA Inventory HUD in bottom middle (virtual screen space)
      // Touch players already have a larger, tappable backpack below the world.
      if (!surfaceRef.current?.classList.contains('farm-touch-enabled')) {
      const slotCount = p1.inventory.length;
      const hudW = slotCount * 38 + 16;
      const hudH = 44;
      const hudX = (viewWidth - hudW) / 2;
      const hudY = viewHeight - hudH - 15;

      ctx.fillStyle = 'rgba(11, 12, 21, 0.85)';
      ctx.strokeStyle = 'rgba(255, 234, 0, 0.25)'; // matching retro neon yellow
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(hudX, hudY, hudW, hudH, 8);
      } else {
        ctx.rect(hudX, hudY, hudW, hudH);
      }
      ctx.fill();
      ctx.stroke();

      // Backpack grows from six to eight slots with the shared upgrade.
      const slotSize = 30;
      const slotGap = 8;
      const totalSlotsWidth = slotCount * slotSize + (slotCount - 1) * slotGap;
      const startSlotX = hudX + (hudW - totalSlotsWidth) / 2;
      const slotY = hudY + (hudH - slotSize) / 2;

      const curSelected = selectedSlotRef.current;
      for (let i = 0; i < slotCount; i++) {
        const sx = startSlotX + i * (slotSize + slotGap);

        // Slot background
        ctx.fillStyle = 'rgba(20, 22, 37, 0.9)';

        // Use gold outline and glow if this slot is selected
        const isSelected = i === curSelected;
        ctx.strokeStyle = isSelected ? 'rgba(255, 234, 0, 0.95)' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = isSelected ? 2 : 1;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(sx, slotY, slotSize, slotSize, 4);
        } else {
          ctx.rect(sx, slotY, slotSize, slotSize);
        }
        ctx.fill();
        ctx.stroke();

        // Draw hotkey number (1, 2, 3) in top-left corner of slot
        ctx.fillStyle = isSelected ? 'rgba(255, 234, 0, 0.8)' : 'rgba(255, 255, 255, 0.35)';
        ctx.font = '7px Orbitron';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(i + 1), sx + 3, slotY + 3);

        // Draw the item emoji inside the slot
        const item = p1.inventory[i];
        if (item) {
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(getItemEmoji(item.type), sx + slotSize / 2, slotY + slotSize / 2 + 1);

          // Draw stack count inside the slot circle
          if (item.type !== 'watering_can') {
            ctx.fillStyle = '#ffea00';
            ctx.font = 'bold 8px Orbitron';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(String(item.count), sx + slotSize - 3, slotY + slotSize - 2);
          }
          if (isSeed(item.type)) {
            ctx.fillStyle = '#a6df8d'; ctx.fillRect(sx + 2, slotY + slotSize - 5, 4, 3);
          }
        }
      }

      ctx.fillStyle = '#f7f2df'; ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(getItemName(p1.inventory[curSelected]?.type ?? null) || 'Empty slot', viewWidth / 2, hudY - 5);
      }
      const order = getOrder(farmRef.current.ordersCompleted);
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff4d3'; ctx.font = '10px monospace';
      ctx.fillText(`ORDER: ${order.name} · ${Object.entries(order.needs).map(([item, amount]) => `${farmRef.current.delivered[item] ?? 0}/${amount} ${item}`).join('  ')}`, 16, 91, viewWidth - 32);
      if (Date.now() < noticeRef.current.until && !isBoardOpenRef.current) {
        ctx.font = 'bold 11px monospace';
        const textWidth = Math.min(viewWidth - 48, ctx.measureText(noticeRef.current.message).width);
        ctx.fillStyle = '#11251aeb';
        ctx.fillRect((viewWidth - textWidth) / 2 - 14, 104, textWidth + 28, 30);
        ctx.fillStyle = '#f8e8ad';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(noticeRef.current.message, viewWidth / 2, 119, textWidth);
      }

      ctx.restore(); // Restores viewport scale & letterbox offset
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

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [selectionComplete, assetsLoaded, isHost, isConnected, localGender, remoteGender]);

  const transferToChest = (playerSlotIdx: number) => {
    const item = farmUi.inventory[playerSlotIdx];
    if (!item) return;
    performGameAction({ type: 'chest', direction: 'deposit', slot: playerSlotIdx, itemType: item.type });
  };

  const transferToPlayer = (chestSlotIdx: number) => {
    const item = farmUi.chest[chestSlotIdx];
    if (!item) return;
    performGameAction({ type: 'chest', direction: 'withdraw', slot: chestSlotIdx, itemType: item.type });
  };

  if (!assetsLoaded) {
    return (
      <div className="connecting-container glass-panel">
        <div className="spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <h2 className="font-display text-cyan">Loading Assets...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Preloading farm graphics sheets...</p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="game-main-content farm-game">
      {/* Game Header Bar */}
      <GameHeader
        volume={volume}
        isFullscreen={isFullscreen || isImmersive}
        onVolumeChange={handleVolumeChange}
        onToggleFullscreen={toggleFullscreen}
        onMenu={toggleFarmMenu}
        onExit={stopGame}
        gamepadConnected={gamepadConnected}
      />

      {/* Canvas container */}
      <div ref={surfaceRef} className={`farm-play-surface ${selectionComplete ? 'farm-playing' : ''} ${touchEnabled ? 'farm-touch-enabled' : ''} ${isImmersive ? 'farm-immersive' : ''}`}>
        <div className="canvas-container farm-viewport">
        <canvas ref={canvasRef} tabIndex={0} aria-label="Farm world. Use touch controls, a controller, or WASD with Space and E." width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
        {selectionComplete && <button className="farm-board-launch" onClick={openBoard}>
          <strong>🪙 {farmUi.progress.coins} · Farm level {getFarmLevel(farmUi.progress.xp).level}</strong>
          <small>🌻 Farm board [B] · Orders, shop & upgrades</small>
        </button>}
        <button className="farm-surface-menu" onClick={toggleFarmMenu} aria-label="Open farm menu">☰</button>

        {/* Animated Chimney GIF overlay */}
        <img
          ref={chimneyGifRef}
          src="/chimni.gif"
          alt="Chimney"
          style={{
            position: 'absolute',
            display: 'none',
            imageRendering: 'pixelated',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
        </div>
        {selectionComplete && touchEnabled && <TouchControls inventory={farmUi.inventory} selected={selectedSlot} blocked={isBoardOpen || isChestOpen || isMenuOpen} onSelect={selectSlot} onMove={value => { touchMoveRef.current = value; }} onUse={triggerUseHeldItem} onInteract={triggerInteract} onBoard={openBoard} onMenu={toggleFarmMenu} />}
        {selectionComplete && isBoardOpen && <FarmBoard progress={farmUi.progress} inventory={farmUi.inventory} chest={farmUi.chest} notice={farmUi.notice} onAction={performGameAction} onClose={closeFarmBoard} />}

        {/* Character Selection Screen Overlay */}
        {!selectionComplete && (
          <CharacterSelection
            localGender={localGender}
            remoteGender={remoteGender}
            isConnected={isConnected}
            onSelectGender={setLocalGender}
          />
        )}

        {/* Storage Chest UI Overlay */}
        <ChestOverlay
          isOpen={isChestOpen}
          notice={farmUi.notice}
          chestItems={farmUi.chest}
          playerInventory={farmUi.inventory}
          onClose={closePanels}
          onTransferToPlayer={transferToPlayer}
          onTransferToChest={transferToChest}
        />
        {isMenuOpen && <FarmMenu playing={selectionComplete} expanded={isFullscreen || isImmersive} touchEnabled={touchEnabled} muted={volume === 0} onClose={closePanels} onBoard={openBoard} onExpand={toggleFullscreen} onTouchToggle={() => { setTouchPreference(!touchEnabled); clearMovement(); }} onMute={() => { const nextVolume = volume === 0 ? .5 : 0; setVolume(nextVolume); if (audioRef.current) audioRef.current.volume = nextVolume; if (homeAudioRef.current) homeAudioRef.current.volume = nextVolume; }} onCharacters={triggerRestart} onExit={stopGame} />}
      </div>

      <div className="farm-controls-guide" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '900px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <div>
          <span>Walk: </span><span style={{ color: 'var(--text-primary)' }}>WASD / Arrows</span> · <span style={{ color: 'var(--text-primary)' }}>1–{farmUi.inventory.length} Select · Space Plant/Water · E Harvest/Interact · B Farm board</span><br />
          <span>Controller: Stick/D-pad move · A/✕ use or confirm · X/□ interact · Y/△ board · B/○ back · LB/RB slots or tabs · Start/Options menu.</span><br />
          <span>Touch: drag the thumbstick, tap a slot, then Plant/Water or Interact. Enable touch controls in Menu if needed.</span>
        </div>
        <div>
          <span style={{ color: 'var(--neon-yellow)', fontWeight: 600 }}>Grow · Trade · Build together</span>
        </div>
      </div>
    </div>
  );
};
