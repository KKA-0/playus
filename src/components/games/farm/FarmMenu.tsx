import { useEffect, useRef } from 'react';

interface Props {
  playing: boolean;
  expanded: boolean;
  touchEnabled: boolean;
  muted: boolean;
  onClose: () => void;
  onBoard: () => void;
  onExpand: () => void;
  onTouchToggle: () => void;
  onMute: () => void;
  onCharacters: () => void;
  onExit: () => void;
}
export function FarmMenu(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector('button')?.focus(); }, []);
  return <div className="farm-board-shade farm-menu-shade">
    <div className="farm-menu" ref={ref} data-farm-menu="settings" role="dialog" aria-modal="true" aria-label="Farm menu">
      <h2>🌻 Make yourself at home</h2>
      <p>The farm keeps growing while you’re here.</p>
      <div className="farm-menu-buttons">
        <button onClick={props.onClose}>▶ {props.playing ? 'Back to the farm' : 'Choose your farmer'}</button>
        <button onClick={props.onBoard} disabled={!props.playing}>📋 Orders, market & upgrades</button>
        <button onClick={props.onExpand}>{props.expanded ? '↙ Exit expanded view' : '↗ Expand game view'}</button>
        <button onClick={props.onTouchToggle}>👆 Touch controls: {props.touchEnabled ? 'On' : 'Off'}</button>
        <button onClick={props.onMute}>♫ Music: {props.muted ? 'Off' : 'On'}</button>
        <button onClick={props.onCharacters}>🧑‍🌾 Change farmer · keep progress</button>
        <button onClick={props.onExit}>↩ Exit to lobby</button>
      </div>
      <p className="farm-controller-help">Controller: stick / D-pad to browse · A / ✕ select · B / ○ back · Start / Options opens this menu.</p>
      <p className="farm-controller-help">Touch: drag the thumbstick, tap a backpack slot, then Plant/Water or Interact. Expand for more room.</p>
    </div>
  </div>;
}
