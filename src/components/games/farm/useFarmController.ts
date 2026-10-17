import { useEffect, useEffectEvent, useState } from 'react';
import type { RefObject } from 'react';
import { controllerIntent, idleController, nextMenuIndex, readController } from './controls';
import type { MoveVector } from './controls';

interface ControllerOptions {
  root: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  onMove: (move: MoveVector) => void;
  onUse: () => void;
  onInteract: () => void;
  onCycle: (direction: number) => void;
  onBoard: () => void;
  onBack: () => void;
  onMenu: () => void;
}

export function useFarmController(options: ControllerOptions) {
  const { root, enabled } = options;
  const [connected, setConnected] = useState(false);
  const move = useEffectEvent((value: MoveVector) => options.onMove(value));
  const dispatch = useEffectEvent((action: 'onUse' | 'onInteract' | 'onBoard' | 'onBack' | 'onMenu') => options[action]());
  const cycle = useEffectEvent((direction: number) => options.onCycle(direction));

  useEffect(() => {
    if (!enabled) return;
    let animation = 0;
    let memory = idleController();
    let wasConnected = false;
    let suspended = document.hidden;
    let lastMenu: Element | null = null;
    let lastFocus = 0;
    const reset = () => { memory = idleController(); move({ x: 0, y: 0 }); };
    const blur = () => { suspended = true; reset(); };
    const focus = () => { suspended = document.hidden; reset(); };
    const visibility = () => { suspended = document.hidden; reset(); };
    const removeFocusRing = () => root.current?.querySelectorAll('.farm-controller-focused').forEach(el => el.classList.remove('farm-controller-focused'));
    const focusButton = (button: HTMLButtonElement | undefined) => {
      if (!button) return;
      removeFocusRing();
      button.classList.add('farm-controller-focused');
      button.focus({ preventScroll: true });
      button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    const poll = (now: number) => {
      let pads: (Gamepad | null)[] = [];
      try { pads = Array.from(navigator.getGamepads?.() ?? []); } catch { /* Unsupported or disallowed by the browser. */ }
      const pad = pads.find(p => p?.connected) ?? null;
      if (!!pad !== wasConnected) { wasConnected = !!pad; setConnected(wasConnected); if (!pad) removeFocusRing(); }
      const frame = readController(suspended ? null : pad, memory, now);
      memory = frame.memory;
      const menus = root.current?.querySelectorAll<HTMLElement>('[data-farm-menu]');
      const menu = menus?.length ? menus[menus.length - 1] : null;
      const typing = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
      move(menu || typing ? { x: 0, y: 0 } : frame.move);
      const intent = controllerIntent(frame.pressed, !!menu);

      if (intent.action === 'menu') dispatch('onMenu');
      else if (intent.action === 'back') dispatch('onBack');
      else if (menu) {
        const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(button => button.getClientRects().length > 0);
        let index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (menu !== lastMenu) { lastFocus = 0; lastMenu = menu; }
        if (pad && !suspended && index < 0) { index = Math.min(lastFocus, buttons.length - 1); focusButton(buttons[index]); }
        if (frame.navigate) {
          index = nextMenuIndex(buttons.map(button => button.getBoundingClientRect()), index, frame.navigate);
          focusButton(buttons[index]);
        }
        if (intent.cycle) {
          const tabs = Array.from(menu.querySelectorAll<HTMLButtonElement>('[data-farm-tab]'));
          if (tabs.length) {
            const active = tabs.findIndex(tab => tab.getAttribute('aria-pressed') === 'true');
            const next = tabs[(active + intent.cycle + tabs.length) % tabs.length];
            next.click(); focusButton(next);
          }
        } else if (intent.action === 'confirm') buttons[index]?.click();
        lastFocus = Math.max(0, index);
      } else if (!typing) {
        lastMenu = null;
        if (intent.action === 'board') dispatch('onBoard');
        else if (intent.action === 'interact') dispatch('onInteract');
        else if (intent.action === 'use') dispatch('onUse');
        if (intent.cycle) cycle(intent.cycle);
      }
      animation = requestAnimationFrame(poll);
    };
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    animation = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(animation); reset(); removeFocusRing();
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled, root]);
  return connected;
}
