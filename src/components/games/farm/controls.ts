export interface MoveVector { x: number; y: number }
export type MenuDirection = 'up' | 'down' | 'left' | 'right';
export interface ControllerSample { index: number; axes: readonly number[]; buttons: readonly { pressed: boolean }[] }
export interface ControllerMemory { index: number | null; buttons: boolean[]; direction: MenuDirection | null; repeatAt: number }
export const idleController = (): ControllerMemory => ({ index: null, buttons: [], direction: null, repeatAt: 0 });

export function normalizeMovement(x: number, y: number, deadzone = 0): MoveVector {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };
  const strength = Math.min(1, (length - deadzone) / (1 - deadzone));
  return { x: x / length * strength, y: y / length * strength };
}

export function readController(pad: ControllerSample | null, previous: ControllerMemory, now: number) {
  if (!pad) return { move: { x: 0, y: 0 }, pressed: [] as number[], navigate: null as MenuDirection | null, memory: idleController() };
  const buttons = pad.buttons.map(button => button.pressed);
  // Discovering/reconnecting a controller while A is held must not buy or select anything.
  const samePad = previous.index === pad.index;
  const pressed = buttons.flatMap((down, index) => down && samePad && !previous.buttons[index] ? [index] : []);
  const dpadX = Number(!!buttons[15]) - Number(!!buttons[14]);
  const dpadY = Number(!!buttons[13]) - Number(!!buttons[12]);
  const move = dpadX || dpadY ? normalizeMovement(dpadX, dpadY) : normalizeMovement(pad.axes[0] ?? 0, pad.axes[1] ?? 0, .2);
  let direction: MenuDirection | null = null;
  if (Math.max(Math.abs(move.x), Math.abs(move.y)) > .45) direction = Math.abs(move.x) > Math.abs(move.y) ? (move.x > 0 ? 'right' : 'left') : (move.y > 0 ? 'down' : 'up');
  let navigate: MenuDirection | null = null;
  let repeatAt = previous.repeatAt;
  if (direction && (direction !== previous.direction || now >= repeatAt)) {
    navigate = direction;
    repeatAt = now + (direction === previous.direction ? 160 : 380);
  }
  return { move, pressed, navigate, memory: { index: pad.index, buttons, direction, repeatAt } };
}

export interface MenuRect { x: number; y: number; width: number; height: number }
export function nextMenuIndex(items: MenuRect[], current: number, direction: MenuDirection) {
  if (!items.length) return -1;
  if (current < 0 || current >= items.length) return 0;
  const center = (item: MenuRect) => ({ x: item.x + item.width / 2, y: item.y + item.height / 2 });
  const origin = center(items[current]);
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;
  let best = -1;
  let score = Infinity;
  items.forEach((item, index) => {
    if (index === current) return;
    const point = center(item);
    const forward = (horizontal ? point.x - origin.x : point.y - origin.y) * sign;
    const sideways = Math.abs(horizontal ? point.y - origin.y : point.x - origin.x);
    if (forward <= 4) return;
    const candidate = forward + sideways * 3;
    if (candidate < score) { score = candidate; best = index; }
  });
  // Wrap when there is no spatial neighbor, so every enabled control stays reachable.
  return best < 0 ? (current + sign + items.length) % items.length : best;
}

export function joystickMovement(clientX: number, clientY: number, centerX: number, centerY: number, radius: number) {
  if (radius <= 0) return { x: 0, y: 0 };
  return normalizeMovement((clientX - centerX) / radius, (clientY - centerY) / radius, .12);
}

export function cycleInventory(current: number, direction: number, count: number) {
  return count > 0 ? ((current + direction) % count + count) % count : 0;
}

export function controllerIntent(pressed: number[], inMenu: boolean) {
  const cycle = pressed.includes(5) ? 1 : pressed.includes(4) ? -1 : 0;
  if (pressed.includes(9)) return { action: 'menu' as const, cycle: 0 };
  if (pressed.includes(1)) return { action: 'back' as const, cycle: 0 };
  if (inMenu) return { action: pressed.includes(0) && !cycle ? 'confirm' as const : null, cycle };
  return { action: pressed.includes(3) ? 'board' as const : pressed.includes(2) ? 'interact' as const : pressed.includes(0) ? 'use' as const : null, cycle };
}
