import React from 'react';
import type { InventoryItem } from './types';
import { getItemEmoji, getItemName } from './utils';

interface ChestOverlayProps {
  isOpen: boolean;
  uiVersion: number;
  chestItems: (InventoryItem | null)[];
  playerInventory: (InventoryItem | null)[];
  onClose: () => void;
  onTransferToPlayer: (idx: number) => void;
  onTransferToChest: (idx: number) => void;
}

export const ChestOverlay: React.FC<ChestOverlayProps> = ({
  isOpen,
  uiVersion,
  chestItems,
  playerInventory,
  onClose,
  onTransferToPlayer,
  onTransferToChest,
}) => {
  if (!isOpen) return null;

  return (
    <div key={`chest-overlay-${uiVersion}`} className="chest-overlay glass-panel" style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '420px',
      background: 'rgba(11, 12, 21, 0.95)',
      border: '2px solid var(--neon-yellow)',
      borderRadius: '12px',
      padding: '1.5rem',
      color: '#fff',
      zIndex: 100,
      fontFamily: 'Orbitron, monospace',
      boxShadow: '0 0 20px rgba(255, 234, 0, 0.2)'
    }}>
      {/* Chest Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.6rem' }}>
        <h3 style={{ margin: 0, color: 'var(--neon-yellow)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🧰 CO-OP STORAGE CHEST
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            fontSize: '1.1rem',
            padding: '0.2rem 0.5rem',
            fontFamily: 'sans-serif'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4a4a')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
        >
          ✕
        </button>
      </div>

      {/* Chest slots (10 slots) */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.6rem', letterSpacing: '1px' }}>
          CHEST CONTENTS (10 SLOTS)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
          {chestItems.map((item, idx) => (
            <div
              key={`chest-${idx}`}
              onClick={() => onTransferToPlayer(idx)}
              style={{
                width: '64px',
                height: '64px',
                background: 'rgba(20, 22, 37, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: item ? 'pointer' : 'default',
                position: 'relative',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (item) {
                  e.currentTarget.style.borderColor = 'var(--neon-yellow)';
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(255, 234, 0, 0.25)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {item ? (
                <>
                  <div style={{ fontSize: '2rem' }}>{getItemEmoji(item.type)}</div>
                  {item.type !== 'watering_can' && (
                    <span style={{
                      position: 'absolute',
                      top: '4px',
                      right: '6px',
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      color: 'var(--neon-yellow)',
                      background: 'rgba(11, 12, 21, 0.85)',
                      padding: '1px 3px',
                      borderRadius: '3px',
                      lineHeight: '1'
                    }}>
                      {item.count}
                    </span>
                  )}
                </>
              ) : (
                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.1)' }}>{idx + 1}</span>
              )}
              {item && (
                <span style={{ position: 'absolute', bottom: '2px', left: '0', right: '0', fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                  {getItemName(item.type)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Player slots (3 slots) */}
      <div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.6rem', letterSpacing: '1px' }}>
          YOUR BACKPACK (3 SLOTS)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {playerInventory.map((item, idx) => (
            <div
              key={`player-${idx}`}
              onClick={() => onTransferToChest(idx)}
              style={{
                width: '64px',
                height: '64px',
                background: 'rgba(20, 22, 37, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: item ? 'pointer' : 'default',
                position: 'relative',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (item) {
                  e.currentTarget.style.borderColor = 'var(--neon-cyan)';
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 240, 255, 0.25)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {item ? (
                <>
                  <div style={{ fontSize: '2rem' }}>{getItemEmoji(item.type)}</div>
                  {item.type !== 'watering_can' && (
                    <span style={{
                      position: 'absolute',
                      top: '4px',
                      right: '6px',
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      color: 'var(--neon-cyan)',
                      background: 'rgba(11, 12, 21, 0.85)',
                      padding: '1px 3px',
                      borderRadius: '3px',
                      lineHeight: '1'
                    }}>
                      {item.count}
                    </span>
                  )}
                </>
              ) : (
                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.1)' }}>{idx + 1}</span>
              )}
              {item && (
                <span style={{ position: 'absolute', bottom: '2px', left: '0', right: '0', fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                  {getItemName(item.type)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom hint */}
      <div style={{ marginTop: '1.2rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
        Click items to transfer them. Press [E] or Close to return.
      </div>
    </div>
  );
};
