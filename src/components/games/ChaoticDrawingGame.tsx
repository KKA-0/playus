import React, { useEffect, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import { Download, Trash2, Palette, RotateCcw, Timer, Award, Maximize, Minimize, Paintbrush, PaintBucket, Undo, Redo } from 'lucide-react';

const WORDS_BANK = [
  'Dragon', 'Pikachu', 'Castle', 'Dinosaur', 'Car', 'Tree', 
  'Spaceship', 'Robot', 'Burger', 'Guitar', 'Cat', 'Dolphin', 
  'Shark', 'Sword', 'Sun', 'Moon', 'House', 'Airplane', 'Train', 
  'Spider', 'Flower', 'Cactus', 'Pizza', 'Donut', 'Ice Cream',
  'Octopus', 'Crown', 'Ghost', 'Alien', 'Wizard', 'Treasure Chest'
];

interface DrawPoint {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  color: string;
  size: number;
}

const BRUSH_COLORS = [
  '#00e1ff', // Neon Cyan
  '#ff00a0', // Neon Pink
  '#39ff14', // Neon Green
  '#ffea00', // Neon Yellow
  '#ffffff', // White
  '#1e1f29', // Dark background (Eraser)
];

// O(N) BFS Flood Fill helper
const floodFill = (canvas: HTMLCanvasElement, startX: number, startY: number, fillColorHex: string) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Clamp coordinates
  const sX = Math.max(0, Math.min(width - 1, Math.round(startX)));
  const sY = Math.max(0, Math.min(height - 1, Math.round(startY)));

  // Parse color hex
  const fillR = parseInt(fillColorHex.slice(1, 3), 16);
  const fillG = parseInt(fillColorHex.slice(3, 5), 16);
  const fillB = parseInt(fillColorHex.slice(5, 7), 16);
  const fillA = 255;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const startIdx = (sY * width + sX) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];

  if (
    targetR === fillR &&
    targetG === fillG &&
    targetB === fillB &&
    targetA === fillA
  ) {
    return;
  }

  const queue: number[] = [sY * width + sX];
  let head = 0;

  const visited = new Uint8Array(width * height);
  visited[sY * width + sX] = 1;

  while (head < queue.length) {
    const curr = queue[head++];
    const x = curr % width;
    const y = Math.floor(curr / width);

    const idx = curr * 4;
    data[idx] = fillR;
    data[idx + 1] = fillG;
    data[idx + 2] = fillB;
    data[idx + 3] = fillA;

    const neighbors = [
      { nx: x - 1, ny: y },
      { nx: x + 1, ny: y },
      { nx: x, ny: y - 1 },
      { nx: x, ny: y + 1 }
    ];

    for (let i = 0; i < 4; i++) {
      const { nx, ny } = neighbors[i];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (visited[nIdx] === 0) {
          const pixelIdx = nIdx * 4;
          if (
            data[pixelIdx] === targetR &&
            data[pixelIdx + 1] === targetG &&
            data[pixelIdx + 2] === targetB &&
            data[pixelIdx + 3] === targetA
          ) {
            visited[nIdx] = 1;
            queue.push(nIdx);
          }
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
};

export const ChaoticDrawingGame: React.FC = () => {
  const {
    isHost,
    gameData,
    sendGameData,
    stopGame
  } = usePeer();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const lastXRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);

  // Undo/Redo Stacks
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  // Game States
  const [phase, setPhase] = useState<'selection' | 'drawing' | 'round_end'>('selection');
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [selectedWord, setSelectedWord] = useState<string>('');
  const [activeDrawer, setActiveDrawer] = useState<'host' | 'client'>('client');
  const [timer, setTimer] = useState<number>(30); // 30s selection, 10s turns
  const [turnCount, setTurnCount] = useState<number>(0); // 0 to 5 (6 turns total)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Drawer options
  const [tool, setTool] = useState<'brush' | 'fill'>('brush');
  const [brushColor, setBrushColor] = useState<string>('#00e1ff');
  const [brushSize, setBrushSize] = useState<number>(5);
  const [isEraser, setIsEraser] = useState<boolean>(false);

  // Am I the active drawer?
  const myRole = isHost ? 'host' : 'client';
  const isMyTurn = phase === 'drawing' && activeDrawer === myRole;

  // Initialize canvas background once on mount
  useEffect(() => {
    clearCanvasLocal();
  }, []);

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

  // Keyboard shortcut listeners for Undo/Redo (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isMyTurn) return;

      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMyTurn, canUndo, canRedo]);

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Initialize word options (Host generates, Client waits)
  useEffect(() => {
    if (isHost && phase === 'selection') {
      const shuffled = [...WORDS_BANK].sort(() => Math.random() - 0.5);
      const chosen = shuffled.slice(0, 3);
      setWordOptions(chosen);
      setTimer(30);
      sendGameData({
        type: 'drawing_words_init',
        words: chosen
      });
    }
  }, [isHost, phase]);

  // Host-only Game Loop timer
  useEffect(() => {
    if (!isHost) return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        const next = prev - 1;

        if (phase === 'selection') {
          if (next <= 0) {
            // Timeout selection: auto-select first word, Host draws first
            const defaultWord = wordOptions[0] || 'Dragon';
            handleSelectWordLocal(defaultWord, 'timeout');
            return 30;
          }
        } else if (phase === 'drawing') {
          if (next <= 0) {
            // Turn timeout: transition to next turn
            setTurnCount((prevTurn) => {
              const nextTurn = prevTurn + 1;
              if (nextTurn >= 10) {
                // End game
                setPhase('round_end');
                sendGameData({ type: 'drawing_round_end' });
                return 10;
              } else {
                // Switch turn
                const nextDrawer = activeDrawer === 'host' ? 'client' : 'host';
                setActiveDrawer(nextDrawer);
                sendGameData({
                  type: 'drawing_next_turn',
                  turnCount: nextTurn,
                  activeDrawer: nextDrawer
                });
                return nextTurn;
              }
            });
            return 30;
          }
        }
        
        // Sync timer to peer
        sendGameData({
          type: 'drawing_tick',
          timer: next,
          phase,
          activeDrawer,
          turnCount
        });

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost, phase, wordOptions, activeDrawer, turnCount]);

  // Handle network updates
  useEffect(() => {
    if (!gameData) return;

    switch (gameData.type) {
      case 'drawing_words_init':
        setWordOptions(gameData.words);
        setPhase('selection');
        setTimer(30);
        break;

      case 'drawing_client_select':
        if (isHost) {
          handleSelectWordLocal(gameData.word, 'client');
        }
        break;

      case 'drawing_word_selected':
        setSelectedWord(gameData.word);
        setPhase('drawing');
        setTimer(30);
        setTurnCount(0);
        // Active drawer is the one who did NOT select
        if (gameData.selector === 'host') {
          setActiveDrawer('client');
        } else if (gameData.selector === 'client') {
          setActiveDrawer('host');
        } else {
          setActiveDrawer('host');
        }
        clearCanvasLocal();
        break;

      case 'drawing_tick':
        setTimer(gameData.timer);
        setPhase(gameData.phase);
        setActiveDrawer(gameData.activeDrawer);
        setTurnCount(gameData.turnCount);
        break;

      case 'drawing_next_turn':
        setTurnCount(gameData.turnCount);
        setActiveDrawer(gameData.activeDrawer);
        setTimer(30);
        break;

      case 'drawing_round_end':
        setPhase('round_end');
        break;

      case 'drawing_line':
        drawRemoteLine(gameData.line);
        break;

      case 'drawing_fill':
        floodFillLocal(gameData.fill.x, gameData.fill.y, gameData.fill.color);
        // Save state after remote fill
        saveStateLocal();
        break;

      case 'drawing_stroke_end':
        saveStateLocal();
        break;

      case 'drawing_undo':
        performUndoLocal();
        break;

      case 'drawing_redo':
        performRedoLocal();
        break;

      case 'drawing_clear':
        clearCanvasLocal();
        break;

      case 'drawing_client_restart':
        if (isHost) {
          triggerRestartLocal();
        }
        break;
    }
  }, [gameData, isHost]);

  // Word selection trigger
  const selectWord = (word: string) => {
    if (phase !== 'selection') return;
    if (isHost) {
      handleSelectWordLocal(word, 'host');
    } else {
      sendGameData({
        type: 'drawing_client_select',
        word
      });
    }
  };

  const handleSelectWordLocal = (word: string, selector: 'host' | 'client' | 'timeout') => {
    setSelectedWord(word);
    setPhase('drawing');
    setTimer(30);
    setTurnCount(0);

    let nextDrawer: 'host' | 'client' = 'host';
    if (selector === 'host') {
      nextDrawer = 'client';
    } else if (selector === 'client') {
      nextDrawer = 'host';
    }

    setActiveDrawer(nextDrawer);
    clearCanvasLocal();

    sendGameData({
      type: 'drawing_word_selected',
      word,
      selector
    });
  };

  const triggerRestart = () => {
    if (isHost) {
      triggerRestartLocal();
    } else {
      sendGameData({ type: 'drawing_client_restart' });
    }
  };

  const triggerRestartLocal = () => {
    setPhase('selection');
    setSelectedWord('');
    setTurnCount(0);
    setTimer(30);
    clearCanvasLocal();
  };

  // Canvas Actions
  const clearCanvas = () => {
    if (!isMyTurn) return;
    clearCanvasLocal();
    sendGameData({ type: 'drawing_clear' });
  };

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#1e1f29';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Initial state save in undo stack
    const state = canvas.toDataURL();
    undoStackRef.current = [state];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  };

  // State saving helpers
  const saveStateLocal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = canvas.toDataURL();
    undoStackRef.current.push(state);
    if (undoStackRef.current.length > 25) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(false);
  };

  const loadState = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  };

  const undo = () => {
    if (!isMyTurn || undoStackRef.current.length <= 1) return;
    performUndoLocal();
    sendGameData({ type: 'drawing_undo' });
  };

  const performUndoLocal = () => {
    if (undoStackRef.current.length <= 1) return;

    const current = undoStackRef.current.pop();
    if (current) {
      redoStackRef.current.push(current);
    }

    const prevState = undoStackRef.current[undoStackRef.current.length - 1];
    loadState(prevState);

    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(true);
  };

  const redo = () => {
    if (!isMyTurn || redoStackRef.current.length === 0) return;
    performRedoLocal();
    sendGameData({ type: 'drawing_redo' });
  };

  const performRedoLocal = () => {
    if (redoStackRef.current.length === 0) return;

    const nextState = redoStackRef.current.pop();
    if (nextState) {
      undoStackRef.current.push(nextState);
      loadState(nextState);
    }

    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  };

  // Local bucket fill
  const floodFillLocal = (startX: number, startY: number, color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    floodFill(canvas, startX, startY, color);
  };

  // Draw local lines
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMyTurn) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);

    const activeColor = isEraser ? '#1e1f29' : brushColor;

    if (tool === 'fill') {
      floodFillLocal(x, y, activeColor);
      saveStateLocal();
      sendGameData({
        type: 'drawing_fill',
        fill: { x, y, color: activeColor }
      });
      return;
    }

    isDrawingRef.current = true;
    lastXRef.current = x;
    lastYRef.current = y;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isMyTurn || tool === 'fill') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const activeColor = isEraser ? '#1e1f29' : brushColor;

    ctx.strokeStyle = activeColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastXRef.current, lastYRef.current);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Send line to peer
    sendGameData({
      type: 'drawing_line',
      line: {
        x,
        y,
        prevX: lastXRef.current,
        prevY: lastYRef.current,
        color: activeColor,
        size: brushSize
      }
    });

    lastXRef.current = x;
    lastYRef.current = y;
  };

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      saveStateLocal();
      sendGameData({ type: 'drawing_stroke_end' });
    }
  };

  // Draw peer lines
  const drawRemoteLine = (line: DrawPoint) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(line.prevX, line.prevY);
    ctx.lineTo(line.x, line.y);
    ctx.stroke();
  };

  // Download artwork
  const downloadDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `chaotic-drawing-${selectedWord.toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Turn schedule list helper (10 turns = 5 turns each)
  const turnSequence = [
    'client', 'host', 
    'client', 'host', 
    'client', 'host', 
    'client', 'host', 
    'client', 'host'
  ];

  return (
    <div className="game-main-content" ref={containerRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', height: isFullscreen ? '100vh' : 'auto', padding: isFullscreen ? '1.5rem' : '0', boxSizing: 'border-box', background: isFullscreen ? '#0a0b10' : 'transparent' }}>
      {/* Game Header Bar */}
      <div className="game-header-bar glass-panel" style={{ width: '100%', maxWidth: isFullscreen ? '100%' : '900px' }}>
        <h2 className="game-title-text font-display">
          Chaotic Drawing <span className="text-cyan">P2P Paint</span>
        </h2>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginLeft: 'auto' }}>
          {phase === 'drawing' && (
            <div className="peer-badge" style={{ borderColor: 'var(--neon-purple)', color: 'var(--neon-purple)', gap: '0.4rem' }}>
              <Palette size={14} />
              <span>Word: <strong>{selectedWord.toUpperCase()}</strong></span>
            </div>
          )}

          <div 
            className="peer-badge" 
            style={{ 
              borderColor: timer <= 3 ? 'var(--neon-magenta)' : 'var(--neon-cyan)', 
              color: timer <= 3 ? 'var(--neon-magenta)' : 'var(--neon-cyan)', 
              gap: '0.4rem',
              animation: timer <= 3 ? 'pulse 0.5s infinite alternate' : 'none'
            }}
          >
            <Timer size={14} />
            <span>
              {phase === 'selection' ? `Select: ${timer}s` : `Turn Time: ${timer}s`}
            </span>
          </div>

          <button className="copy-btn" onClick={toggleFullscreen} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          <button className="glow-btn-magenta" onClick={stopGame} style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}>
            Exit Game
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        className="glass-panel" 
        style={{ 
          width: '100%', 
          maxWidth: isFullscreen ? '100%' : '900px', 
          height: isFullscreen ? 'calc(100vh - 120px)' : '480px',
          minHeight: isFullscreen ? 'calc(100vh - 120px)' : '480px', 
          background: 'rgba(11, 12, 21, 0.6)', 
          border: '1px solid var(--glass-border)', 
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          flex: 1
        }}
      >
        {/* Phase 1: Word Selection Overlay */}
        {phase === 'selection' && (
          <div 
            style={{ 
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(11, 12, 21, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 30,
              padding: '2rem',
              textAlign: 'center'
            }}
          >
            <h3 className="font-display text-cyan" style={{ fontSize: '1.8rem', marginBottom: '0.5rem', textShadow: '0 0 10px rgba(0, 225, 255, 0.3)' }}>
              CHOOSE A WORD TO DRAW
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Any player can select. The other player will start drawing!
            </p>

            <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center' }}>
              {wordOptions.map((word) => (
                <button
                  key={word}
                  className="glow-btn-cyan font-display"
                  onClick={() => selectWord(word)}
                  style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', letterSpacing: '1px' }}
                >
                  {word}
                </button>
              ))}
            </div>

            {wordOptions.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Waiting for host to generate words...
              </p>
            )}
          </div>
        )}

        {/* Persistent Canvas and Layout Panel */}
        <div style={{ display: 'flex', width: '100%', height: isFullscreen ? '100%' : '480px', position: 'relative', flex: 1 }}>
          
          {/* Left panel (changes between Drawing Toolkit and Round End stats) */}
          <div 
            style={{ 
              width: '180px', 
              background: 'rgba(17, 18, 30, 0.9)', 
              borderRight: '1px solid var(--glass-border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '1.2rem 0.8rem',
              gap: '1.2rem',
              zIndex: 10
            }}
          >
            {phase === 'drawing' ? (
              <>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '1px', fontWeight: 'bold' }}>DRAW TOOL</span>
                <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
                  <button
                    onClick={() => {
                      setTool('brush');
                      setIsEraser(false);
                    }}
                    style={{
                      flex: 1,
                      height: '32px',
                      borderRadius: '4px',
                      background: tool === 'brush' && !isEraser ? 'rgba(0, 225, 255, 0.1)' : 'rgba(255,255,255,0.03)',
                      border: tool === 'brush' && !isEraser ? '1px solid var(--neon-cyan)' : '1px solid rgba(255,255,255,0.1)',
                      color: tool === 'brush' && !isEraser ? 'var(--neon-cyan)' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isMyTurn ? 'pointer' : 'default',
                      opacity: isMyTurn ? 1 : 0.4,
                      pointerEvents: isMyTurn ? 'auto' : 'none'
                    }}
                    title="Brush Tool"
                  >
                    <Paintbrush size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setTool('fill');
                      setIsEraser(false);
                    }}
                    style={{
                      flex: 1,
                      height: '32px',
                      borderRadius: '4px',
                      background: tool === 'fill' && !isEraser ? 'rgba(0, 225, 255, 0.1)' : 'rgba(255,255,255,0.03)',
                      border: tool === 'fill' && !isEraser ? '1px solid var(--neon-cyan)' : '1px solid rgba(255,255,255,0.1)',
                      color: tool === 'fill' && !isEraser ? 'var(--neon-cyan)' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isMyTurn ? 'pointer' : 'default',
                      opacity: isMyTurn ? 1 : 0.4,
                      pointerEvents: isMyTurn ? 'auto' : 'none'
                    }}
                    title="Flood Fill Bucket"
                  >
                    <PaintBucket size={16} />
                  </button>
                </div>

                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '1px', fontWeight: 'bold', marginTop: '0.5rem' }}>COLORS</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '100%', justifyItems: 'center' }}>
                  {BRUSH_COLORS.slice(0, 5).map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setBrushColor(color);
                        setIsEraser(false);
                      }}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: color,
                        border: brushColor === color && !isEraser ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                        cursor: isMyTurn ? 'pointer' : 'default',
                        boxShadow: brushColor === color && !isEraser ? `0 0 8px ${color}` : 'none',
                        opacity: isMyTurn ? 1 : 0.4,
                        pointerEvents: isMyTurn ? 'auto' : 'none'
                      }}
                    />
                  ))}
                  
                  {/* Eraser Button */}
                  <button
                    onClick={() => setIsEraser(true)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      background: '#11121e',
                      border: isEraser ? '2px solid var(--neon-magenta)' : '1px solid rgba(255,255,255,0.2)',
                      cursor: isMyTurn ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      color: isEraser ? 'var(--neon-magenta)' : '#fff',
                      boxShadow: isEraser ? '0 0 8px var(--neon-magenta)' : 'none',
                      opacity: isMyTurn ? 1 : 0.4,
                      pointerEvents: isMyTurn ? 'auto' : 'none'
                    }}
                    title="Eraser"
                  >
                    🧽
                  </button>

                  {/* Custom Color Picker Button */}
                  <div style={{ position: 'relative', width: '28px', height: '28px' }}>
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(e) => {
                        setBrushColor(e.target.value);
                        setIsEraser(false);
                      }}
                      disabled={!isMyTurn}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: isMyTurn ? 'pointer' : 'default',
                        pointerEvents: isMyTurn ? 'auto' : 'none',
                        zIndex: 2
                      }}
                    />
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'linear-gradient(45deg, red, orange, yellow, green, blue, purple)',
                        border: !BRUSH_COLORS.includes(brushColor) && !isEraser ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                        boxShadow: !BRUSH_COLORS.includes(brushColor) && !isEraser ? `0 0 8px ${brushColor}` : 'none',
                        opacity: isMyTurn ? 1 : 0.4,
                      }}
                      title="Custom Color"
                    />
                  </div>
                </div>

                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '1px', fontWeight: 'bold', marginTop: '0.5rem' }}>BRUSH SIZE</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                  {[3, 6, 12, 24].map((size) => (
                    <button
                      key={size}
                      onClick={() => setBrushSize(size)}
                      style={{
                        width: '100%',
                        height: '24px',
                        borderRadius: '4px',
                        background: 'rgba(255,255,255,0.05)',
                        border: brushSize === size ? '1px solid var(--neon-cyan)' : '1px solid transparent',
                        color: brushSize === size ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        cursor: isMyTurn ? 'pointer' : 'default',
                        opacity: isMyTurn ? 1 : 0.4,
                        pointerEvents: isMyTurn ? 'auto' : 'none'
                      }}
                    >
                      {size}px
                    </button>
                  ))}
                </div>

                {isMyTurn && (
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <button
                        className="copy-btn"
                        onClick={undo}
                        disabled={!canUndo}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: canUndo ? 1 : 0.4,
                          cursor: canUndo ? 'pointer' : 'not-allowed',
                          height: '32px'
                        }}
                        title="Undo"
                      >
                        <Undo size={14} />
                      </button>
                      <button
                        className="copy-btn"
                        onClick={redo}
                        disabled={!canRedo}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: canRedo ? 1 : 0.4,
                          cursor: canRedo ? 'pointer' : 'not-allowed',
                          height: '32px'
                        }}
                        title="Redo"
                      >
                        <Redo size={14} />
                      </button>
                    </div>

                    <button 
                      className="copy-btn" 
                      onClick={clearCanvas} 
                      style={{ 
                        padding: '0.6rem', 
                        width: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        borderColor: 'var(--neon-magenta)', 
                        color: 'var(--neon-magenta)',
                        gap: '0.3rem',
                        height: '32px'
                      }}
                    >
                      <Trash2 size={14} /> Clear
                    </button>
                  </div>
                )}
              </>
            ) : phase === 'round_end' ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={48} className="text-yellow" style={{ marginBottom: '0.5rem', filter: 'drop-shadow(0 0 8px var(--neon-yellow))' }} />
                <span className="font-display text-green" style={{ fontSize: '0.9rem', fontWeight: 'bold', letterSpacing: '1px', textAlign: 'center', marginBottom: '0.8rem' }}>
                  FINISHED!
                </span>
                
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>WORD</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--neon-yellow)', marginBottom: '1.5rem', wordBreak: 'break-all', textAlign: 'center' }}>
                  {selectedWord.toUpperCase()}
                </span>

                <button 
                  className="glow-btn-cyan font-display" 
                  onClick={downloadDrawing} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.4rem', 
                    padding: '0.6rem 1rem', 
                    fontSize: '0.75rem', 
                    width: '100%', 
                    justifyContent: 'center',
                    marginBottom: '1rem' 
                  }}
                >
                  <Download size={14} /> Save PNG
                </button>
                
                <button 
                  className="copy-btn font-display" 
                  onClick={triggerRestart} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.4rem', 
                    padding: '0.6rem 1rem', 
                    fontSize: '0.75rem', 
                    width: '100%', 
                    justifyContent: 'center', 
                    borderColor: 'var(--neon-purple)', 
                    color: 'var(--neon-purple)' 
                  }}
                >
                  <RotateCcw size={14} /> Play Again
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                Waiting...
              </div>
            )}
          </div>

          {/* Canvas Area */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {/* Turn Banner Overlay */}
            {phase === 'drawing' && (
              <div 
                style={{ 
                  position: 'absolute',
                  top: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '0.4rem 1.5rem',
                  borderRadius: '20px',
                  background: isMyTurn ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255, 0, 160, 0.1)',
                  border: isMyTurn ? '1px solid var(--neon-green)' : '1px solid var(--neon-magenta)',
                  color: isMyTurn ? 'var(--neon-green)' : 'var(--neon-magenta)',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  boxShadow: isMyTurn ? '0 0 10px rgba(57, 255, 20, 0.2)' : '0 0 10px rgba(255, 0, 160, 0.1)',
                  zIndex: 8,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontFamily: 'Orbitron, monospace'
                }}
              >
                <span className={`status-dot ${isMyTurn ? 'connected' : 'connecting'}`}></span>
                {isMyTurn ? 'YOUR TURN TO DRAW!' : "PARTNER'S TURN..."}
              </div>
            )}

            {/* Progress timeline bar */}
            {phase === 'drawing' && (
              <div 
                style={{ 
                  position: 'absolute',
                  bottom: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '6px',
                  zIndex: 8,
                  pointerEvents: 'none'
                }}
              >
                {turnSequence.map((role, idx) => {
                  const isPast = idx < turnCount;
                  const isActive = idx === turnCount;
                  
                  let borderCol = 'rgba(255, 255, 255, 0.1)';
                  let bgCol = 'rgba(0,0,0,0.4)';
                  let labelColor = 'rgba(255,255,255,0.3)';

                  if (isActive) {
                    borderCol = 'var(--neon-cyan)';
                    bgCol = 'rgba(0, 225, 255, 0.1)';
                    labelColor = 'var(--neon-cyan)';
                  } else if (isPast) {
                    borderCol = 'var(--neon-green)';
                    bgCol = 'rgba(57, 255, 20, 0.05)';
                    labelColor = 'var(--neon-green)';
                  }

                  return (
                    <div 
                      key={idx}
                      style={{
                        padding: '0.15rem 0.6rem',
                        fontSize: '0.65rem',
                        fontFamily: 'Orbitron',
                        fontWeight: 'bold',
                        borderRadius: '4px',
                        border: `1px solid ${borderCol}`,
                        background: bgCol,
                        color: labelColor,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        boxShadow: isActive ? '0 0 5px rgba(0, 225, 255, 0.3)' : 'none'
                      }}
                    >
                      {role === 'host' ? 'P1' : 'P2'}
                    </div>
                  );
                })}
              </div>
            )}

            <canvas
              ref={canvasRef}
              width={800}
              height={480}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                background: '#1e1f29',
                cursor: isMyTurn ? 'crosshair' : 'not-allowed'
              }}
            />
          </div>
        </div>
      </div>

      {/* Helper guide */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '900px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
        <div>
          <span>Draw: </span><span style={{ color: 'var(--text-primary)' }}>Left Click + Drag</span> | <span>Rules: </span><span style={{ color: 'var(--text-primary)' }}>Draw during your turn (30s)</span>
        </div>
        <div>
          <span>Chaotic Drawing: </span><span style={{ color: 'var(--neon-cyan)', fontWeight: 600 }}>Alternates P1 / P2 automatically</span>
        </div>
      </div>
    </div>
  );
};
