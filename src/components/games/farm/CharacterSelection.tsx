import React from 'react';

interface CharacterSelectionProps {
  localGender: 'male' | 'female' | null;
  remoteGender: 'male' | 'female' | null;
  isConnected: boolean;
  onSelectGender: (gender: 'male' | 'female') => void;
}

export const CharacterSelection: React.FC<CharacterSelectionProps> = ({
  localGender,
  remoteGender,
  isConnected,
  onSelectGender,
}) => {
  return (
    <div className="canvas-overlay">
      <h2 className="overlay-title font-display text-yellow" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
        WHO WILL PLAY?
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>Select your GBA character sprite to start the farm</p>

      <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
        {/* Male option card */}
        <div
          className={`game-option-card farm ${localGender === 'male' ? 'selected' : ''}`}
          onClick={() => onSelectGender('male')}
          style={{ width: '180px', padding: '1rem', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/male.png" alt="Male Farmer" style={{ width: '60px', height: '60px', imageRendering: 'pixelated' }} />
          </div>
          <h3 className="font-display" style={{ fontSize: '1rem', margin: '0.75rem 0 0.25rem 0', color: 'var(--text-primary)' }}>MALE</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)' }}>GBA Sprite 1</span>
        </div>

        {/* Female option card */}
        <div
          className={`game-option-card farm ${localGender === 'female' ? 'selected' : ''}`}
          onClick={() => onSelectGender('female')}
          style={{ width: '180px', padding: '1rem', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/female.png" alt="Female Farmer" style={{ width: '60px', height: '60px', imageRendering: 'pixelated' }} />
          </div>
          <h3 className="font-display" style={{ fontSize: '1rem', margin: '0.75rem 0 0.25rem 0', color: 'var(--text-primary)' }}>FEMALE</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--neon-magenta)' }}>GBA Sprite 2</span>
        </div>
      </div>

      {/* Selection status messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
        <div style={{ color: localGender ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
          You: {localGender ? `Selected ${localGender.toUpperCase()}` : 'Choosing...'}
        </div>
        {isConnected && (
          <div style={{ color: remoteGender ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
            Partner: {remoteGender ? `Selected ${remoteGender.toUpperCase()}` : 'Choosing...'}
          </div>
        )}
      </div>
    </div>
  );
};
