interface CharacterSelectionProps {
  localGender: 'male' | 'female' | null;
  remoteGender: 'male' | 'female' | null;
  isConnected: boolean;
  onSelectGender: (gender: 'male' | 'female') => void;
}

export function CharacterSelection({ localGender, remoteGender, isConnected, onSelectGender }: CharacterSelectionProps) {
  return <div className="canvas-overlay farm-character-select" data-farm-menu="characters" role="dialog" aria-label="Choose your farmer">
    <h2 className="overlay-title font-display text-yellow">WHO WILL PLAY?</h2>
    <p>Grow crops, raise happy hens, and build your shared homestead.</p>
    <div className="farm-character-options">
      {(['male', 'female'] as const).map(gender => <button key={gender} className={`game-option-card farm ${localGender === gender ? 'selected' : ''}`} aria-pressed={localGender === gender} onClick={() => onSelectGender(gender)}>
        <img src={`/${gender}.png`} alt="" />
        <strong>{gender === 'male' ? 'Male farmer' : 'Female farmer'}</strong>
        <small>{localGender === gender ? '✓ Ready to grow' : 'Ready for the harvest'}</small>
      </button>)}
    </div>
    <p className="farm-character-status">You: {localGender ? `${localGender} selected` : 'choosing…'}{isConnected && <><br />Partner: {remoteGender ? `${remoteGender} selected` : 'choosing…'}</>}</p>
    <small>Tap a farmer, or use stick / D-pad + A / ✕.<br />8 starter seeds · Shared goals · Session-only progress</small>
  </div>;
}
