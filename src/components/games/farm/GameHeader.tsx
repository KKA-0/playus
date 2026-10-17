import React from 'react';
import { Maximize, Minimize, Volume2, VolumeX, Gamepad2 } from 'lucide-react';

interface GameHeaderProps {
  volume: number;
  isFullscreen: boolean;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleFullscreen: () => void;
  onMenu: () => void;
  onExit: () => void;
  gamepadConnected?: boolean;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  volume,
  isFullscreen,
  onVolumeChange,
  onToggleFullscreen,
  onMenu,
  onExit,
  gamepadConnected,
}) => {
  return (
    <div className="game-header-bar glass-panel" style={{ width: '100%', maxWidth: '900px', flexWrap: 'wrap' }}>
      <h2 className="game-title-text font-display">
        FARM TOGETHER: <span className="text-yellow">HARVEST & HOME</span>
      </h2>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>

        {gamepadConnected && (
          <div className="peer-badge" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)', gap: '0.4rem', animation: 'pulse 1.5s infinite alternate', display: 'flex', alignItems: 'center' }}>
            <Gamepad2 size={14} />
            <span>Controller Connected</span>
          </div>
        )}

        {/* Volume Control Widget */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.3rem 0.6rem' }}>
          {volume === 0 ? <VolumeX size={14} className="text-muted" /> : <Volume2 size={14} style={{ color: 'var(--neon-yellow)' }} />}
          <input
            type="range"
            aria-label="Farm music volume"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={onVolumeChange}
            style={{
              width: '70px',
              height: '4px',
              accentColor: 'var(--neon-yellow)',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.1)'
            }}
          />
          <span style={{ fontSize: '0.75rem', minWidth: '24px', textAlign: 'right', fontFamily: 'var(--font-display)', opacity: 0.8 }}>
            {Math.round(volume * 100)}%
          </span>
        </div>

        <button className="copy-btn" onClick={onToggleFullscreen} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          <span>{isFullscreen ? 'Exit expanded view' : 'Expand'}</span>
        </button>
        <button className="copy-btn" onClick={onMenu} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
          ☰ Menu
        </button>
        <button className="glow-btn-magenta" onClick={onExit} style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}>
          Exit Game
        </button>
      </div>
    </div>
  );
};
