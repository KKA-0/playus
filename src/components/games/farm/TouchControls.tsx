import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { InventoryItem } from './types';
import { getItemEmoji, getItemName } from './utils';
import { isSeed } from './gameplay';
import { joystickMovement } from './controls';
import type { MoveVector } from './controls';

interface Props {
  inventory: (InventoryItem | null)[];
  selected: number;
  blocked: boolean;
  onSelect: (slot: number) => void;
  onMove: (move: MoveVector) => void;
  onUse: () => void;
  onInteract: () => void;
  onBoard: () => void;
  onMenu: () => void;
}

export function TouchControls({ inventory, selected, blocked, onSelect, onMove, onUse, onInteract, onBoard, onMenu }: Props) {
  const padRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [stick, setStick] = useState<MoveVector>({ x: 0, y: 0 });
  const reset = () => {
    const id = pointer.current;
    pointer.current = null;
    if (id !== null && padRef.current?.hasPointerCapture(id)) padRef.current.releasePointerCapture(id);
    setStick({ x: 0, y: 0 }); onMove({ x: 0, y: 0 });
  };
  const resetFromEffect = useEffectEvent(reset);
  const stopFromEffect = useEffectEvent(() => onMove({ x: 0, y: 0 }));
  useEffect(() => {
    const release = () => resetFromEffect();
    window.addEventListener('blur', release);
    window.addEventListener('resize', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('blur', release); window.removeEventListener('resize', release);
      document.removeEventListener('visibilitychange', release); stopFromEffect();
    };
  }, []);
  // Opening a menu cancels an active captured touch, just like pointer cancellation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (blocked) resetFromEffect(); }, [blocked]);
  const update = (event: PointerEvent<HTMLDivElement>) => {
    if (blocked || event.pointerId !== pointer.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const value = joystickMovement(event.clientX, event.clientY, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width * .32);
    setStick(value); onMove(value);
  };
  const item = inventory[selected];
  const useLabel = item && isSeed(item.type) ? 'Plant' : item?.type === 'watering_can' ? 'Water' : 'Use item';
  return <div className={`farm-touch-controls ${blocked ? 'is-blocked' : ''}`} aria-label="Touch controls">
    <div className="farm-touch-inventory" aria-label="Select a backpack slot">
      {inventory.map((slot, index) => <button key={index} disabled={blocked} aria-label={`Slot ${index + 1}: ${slot ? `${getItemName(slot.type)}, ${slot.count}` : 'empty'}`} aria-pressed={selected === index} onClick={() => onSelect(index)}>
        <span>{slot ? getItemEmoji(slot.type) : '·'}</span>{slot && slot.type !== 'watering_can' && <small>{slot.count}</small>}
      </button>)}
    </div>
    <div className="farm-touch-actions">
      <div ref={padRef} className="farm-joystick" role="group" aria-label="Movement joystick: drag to walk" onContextMenu={event => event.preventDefault()}
        onPointerDown={event => { if (blocked || pointer.current !== null || event.button !== 0) return; event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); update(event); }}
        onPointerMove={update} onPointerUp={event => { if (event.pointerId === pointer.current) reset(); }} onPointerCancel={event => { if (event.pointerId === pointer.current) reset(); }} onLostPointerCapture={event => { if (event.pointerId === pointer.current) reset(); }}>
        <span className="farm-joystick-guides">＋</span><span className="farm-joystick-knob" style={{ transform: `translate(${stick.x * 32}px, ${stick.y * 32}px)` }} /><small>MOVE</small>
      </div>
      <div className="farm-touch-buttons">
        <button disabled={blocked || !item || (item.type !== 'watering_can' && !isSeed(item.type))} className="farm-touch-use" onClick={onUse}><span>{item ? getItemEmoji(item.type) : '🌱'}</span>{useLabel}</button>
        <button disabled={blocked} className="farm-touch-interact" onClick={onInteract}><span>✋</span>Interact</button>
        <button disabled={blocked} onClick={onBoard}>🌻 Board</button><button disabled={blocked} onClick={onMenu}>☰ Menu</button>
      </div>
    </div>
    <p className="farm-touch-hint">{getItemName(item?.type ?? null) || 'Tap a slot'} · Interact harvests, gathers, and opens the coop or chest.</p>
  </div>;
}
