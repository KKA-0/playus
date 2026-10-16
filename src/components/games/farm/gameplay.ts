import type { Crop, InventoryItem, PlayerState, Weed, WildItem } from './types';

export const MARKET = { x: 275, y: 260 };
export const COOP = { x: 740, y: 200 };
export const STACK_LIMIT = 20;
export const CROPS = {
  seeds: { crop: 'carrot', name: 'Carrot seeds', price: 4, level: 1, seconds: 8, yield: 1 },
  pumpkin_seeds: { crop: 'pumpkin', name: 'Pumpkin seeds', price: 10, level: 1, seconds: 12, yield: 1 },
  tomato_seeds: { crop: 'tomato', name: 'Tomato seeds', price: 12, level: 2, seconds: 10, yield: 2 },
  corn_seeds: { crop: 'corn', name: 'Corn seeds', price: 16, level: 3, seconds: 14, yield: 2 },
} as const;
export type SeedType = keyof typeof CROPS;
export const SELL_PRICES: Record<string, number> = { carrot: 8, pumpkin: 18, tomato: 10, corn: 12, berry: 5, egg: 9, wood: 3, stone: 3 };
export const UPGRADES = {
  backpack: { name: 'Roomy backpacks', emoji: '🎒', description: 'Eight slots for both farmers.', coins: 35, level: 2, materials: {} },
  coop: { name: 'Cozy chicken coop', emoji: '🐔', description: 'Four eggs in 15 seconds instead of three in 25.', coins: 50, level: 2, materials: { wood: 3 } },
  sprinkler: { name: 'Field sprinkler', emoji: '💦', description: 'Automatically waters every crop, every stage.', coins: 80, level: 3, materials: { wood: 2, stone: 3 } },
} satisfies Record<string, { name: string; emoji: string; description: string; coins: number; level: number; materials: Record<string, number> }>;
export type UpgradeType = keyof typeof UPGRADES;

const LEVELS = [0, 25, 70, 140, 240];
const TITLES = ['Seedling farm', 'Budding growers', 'Harvest helpers', 'Village favorites', 'Golden homestead'];
export function getFarmLevel(xp: number) {
  const level = LEVELS.filter(threshold => xp >= threshold).length;
  return { level, title: TITLES[level - 1], start: LEVELS[level - 1], next: LEVELS[level] ?? null };
}

const ORDERS = [
  { name: 'A fresh start', customer: 'Mina’s kitchen', needs: { carrot: 2 }, coins: 25, xp: 12 },
  { name: 'Picnic basket', customer: 'The village school', needs: { carrot: 2, berry: 3 }, coins: 40, xp: 18 },
  { name: 'Sunday breakfast', customer: 'The little bakery', needs: { pumpkin: 2, egg: 3 }, coins: 70, xp: 25 },
  { name: 'Garden salad', customer: 'Mina’s kitchen', needs: { tomato: 4, carrot: 3 }, coins: 80, xp: 30 },
  { name: 'Harvest supper', customer: 'The village inn', needs: { corn: 4, pumpkin: 2, egg: 3 }, coins: 130, xp: 40 },
  { name: 'Market festival', customer: 'Everyone in town', needs: { tomato: 4, corn: 4, berry: 4 }, coins: 150, xp: 50 },
] satisfies { name: string; customer: string; needs: Record<string, number>; coins: number; xp: number }[];

export function getOrder(completed: number) {
  const base = ORDERS[completed % ORDERS.length];
  const round = Math.floor(completed / ORDERS.length);
  return { ...base, needs: Object.fromEntries(Object.entries(base.needs).map(([item, amount]) => [item, amount + round])), coins: base.coins + round * 20, xp: base.xp + round * 5 };
}

export interface FarmProgress {
  sessionId: string;
  coins: number;
  xp: number;
  ordersCompleted: number;
  delivered: Record<string, number>;
  upgrades: Record<UpgradeType, boolean>;
  coopSeconds: number;
  eggs: number;
  harvests: number;
  nextCropId: number;
}
export function createFarmProgress(sessionId: string): FarmProgress {
  return { sessionId, coins: 20, xp: 0, ordersCompleted: 0, delivered: {}, upgrades: { backpack: false, coop: false, sprinkler: false }, coopSeconds: 0, eggs: 0, harvests: 0, nextCropId: 1 };
}
export function createStarterInventory(): (InventoryItem | null)[] {
  return [{ type: 'seeds', count: 8 }, { type: 'watering_can', count: 1 }, null, null, null, null];
}
export function isSeed(type: string): type is SeedType { return Object.hasOwn(CROPS, type); }
export function getWeather(seconds: number) { return seconds % 120 >= 95 ? 'rain' : 'sun'; }
export function near(player: Pick<PlayerState, 'x' | 'y' | 'inHouse'>, target: { x: number; y: number }, radius = 45) {
  return !player.inHouse && Math.hypot(player.x - target.x, player.y - target.y) <= radius;
}
export function itemCount(inventory: (InventoryItem | null)[], type: string) {
  return inventory.reduce((count, slot) => count + (slot?.type === type ? slot.count : 0), 0);
}

// All-or-nothing insertion: full backpacks must never delete crops or spend coins.
export function addItems(inventory: (InventoryItem | null)[], type: string, count: number): boolean {
  const limit = type === 'watering_can' ? 1 : STACK_LIMIT;
  const room = inventory.reduce((sum, slot) => sum + (!slot ? limit : slot.type === type ? limit - slot.count : 0), 0);
  if (room < count) return false;
  let remaining = count;
  for (let i = 0; i < inventory.length && remaining > 0; i++) {
    if (inventory[i]?.type !== type) continue;
    const slot = inventory[i]!;
    const amount = Math.min(limit - slot.count, remaining);
    slot.count += amount;
    remaining -= amount;
  }
  for (let i = 0; i < inventory.length && remaining > 0; i++) {
    if (inventory[i]) continue;
    const amount = Math.min(limit, remaining);
    inventory[i] = { type, count: amount };
    remaining -= amount;
  }
  return true;
}
function removeItems(inventory: (InventoryItem | null)[], type: string, count: number) {
  for (let i = 0; i < inventory.length && count > 0; i++) {
    const slot = inventory[i];
    if (slot?.type !== type) continue;
    const amount = Math.min(slot.count, count);
    slot.count -= amount;
    count -= amount;
    if (!slot.count) inventory[i] = null;
  }
}

export interface FarmWorld {
  progress: FarmProgress;
  crops: Crop[];
  wildItems: WildItem[];
  weeds: Weed[];
  chest: (InventoryItem | null)[];
  players: PlayerState[];
}
export type FarmAction =
  | { type: 'plant'; slot: number }
  | { type: 'water' | 'harvest'; cropId: string }
  | { type: 'pickup_item' | 'pluck_weed'; id: string }
  | { type: 'buy'; seed: SeedType }
  | { type: 'sell'; slot: number; itemType: string }
  | { type: 'upgrade'; upgrade: UpgradeType }
  | { type: 'deliver'; order: number }
  | { type: 'coop' | 'recover_can' }
  | { type: 'chest'; direction: 'deposit' | 'withdraw'; slot: number; itemType: string };
export interface FarmActionResult { ok: boolean; message: string }
export interface FarmRequest {
  id: number;
  sessionId: string;
  action: FarmAction;
  position: Pick<PlayerState, 'x' | 'y' | 'inHouse'>;
}
const success = (message: string): FarmActionResult => ({ ok: true, message });
const fail = (message: string): FarmActionResult => ({ ok: false, message });

// Only the host calls this reducer; inventory, rewards and the world change together.
export function applyFarmAction(world: FarmWorld, player: PlayerState, action: FarmAction): FarmActionResult {
  const farm = world.progress;
  const inventory = player.inventory;
  switch (action.type) {
    case 'plant': {
      const item = inventory[action.slot];
      if (!item || !isSeed(item.type)) return fail('Select a seed packet first.');
      if (player.inHouse || player.x < 350 || player.x > 650 || player.y < 250 || player.y > 450) return fail('Plant seeds in the brown field.');
      if (world.crops.some(crop => near(player, crop, 25))) return fail('Leave a little space between crops.');
      const seed = CROPS[item.type];
      world.crops.push({ id: `${farm.sessionId}:${farm.nextCropId++}`, x: player.x, y: player.y, type: seed.crop, stage: 0, watered: farm.upgrades.sprinkler, growthTimer: 0 });
      item.count--;
      if (!item.count) inventory[action.slot] = null;
      return success(`Planted ${seed.crop}. Water it twice as it grows!`);
    }
    case 'water': {
      const crop = world.crops.find(c => c.id === action.cropId);
      if (!crop || !near(player, crop, 40) || crop.stage === 2) return fail('Stand beside a growing crop.');
      if (!itemCount(inventory, 'watering_can')) return fail('Your watering can is in the chest.');
      if (crop.watered) return fail('This crop is already watered.');
      crop.watered = true;
      return success('Watered! Blue soil means it is growing.');
    }
    case 'harvest': {
      const index = world.crops.findIndex(c => c.id === action.cropId);
      const crop = world.crops[index];
      if (!crop || crop.stage !== 2 || !near(player, crop, 40)) return fail('That crop is not ready to harvest.');
      const seed = Object.values(CROPS).find(s => s.crop === crop.type)!;
      if (!addItems(inventory, crop.type, seed.yield)) return fail('Backpack full. Sell or store something first.');
      world.crops.splice(index, 1);
      farm.xp += 4;
      farm.harvests++;
      return success(`Harvested ${seed.yield} ${crop.type}! +4 farm XP`);
    }
    case 'pickup_item': {
      const item = world.wildItems.find(i => i.id === action.id);
      if (!item?.active || !near(player, item, 40)) return fail('Nothing here to gather yet.');
      if (!addItems(inventory, item.type, 1)) return fail('Backpack full. Sell or store something first.');
      item.active = false;
      item.respawnTimer = 0;
      farm.xp++;
      return success(`Gathered ${item.type}. +1 farm XP`);
    }
    case 'pluck_weed': {
      const index = world.weeds.findIndex(w => w.id === action.id);
      if (index < 0 || !near(player, world.weeds[index], 30)) return fail('Stand beside a weed to clear it.');
      world.weeds.splice(index, 1);
      farm.coins += 2;
      farm.xp++;
      return success('A tidier farm! +2 coins · +1 XP');
    }
    case 'buy': {
      if (!isSeed(action.seed)) return fail('Unknown seed packet.');
      const seed = CROPS[action.seed];
      if (getFarmLevel(farm.xp).level < seed.level) return fail(`Reach farm level ${seed.level} to unlock these seeds.`);
      if (farm.coins < seed.price) return fail('Not enough shared coins. Sell produce or clear weeds.');
      if (!addItems(inventory, action.seed, 5)) return fail('Make room for all five seeds first.');
      farm.coins -= seed.price;
      return success(`Bought 5 ${seed.name.toLowerCase()}.`);
    }
    case 'sell': {
      const slot = inventory[action.slot];
      if (!slot || slot.type !== action.itemType || !Object.hasOwn(SELL_PRICES, slot.type)) return fail('Seeds and tools cannot be sold.');
      const coins = SELL_PRICES[slot.type] * slot.count;
      farm.coins += coins;
      inventory[action.slot] = null;
      return success(`Sold your stack for ${coins} shared coins.`);
    }
    case 'deliver': {
      if (action.order !== farm.ordersCompleted) return fail('Your partner already completed that order!');
      const order = getOrder(farm.ordersCompleted);
      let contributed = 0;
      for (const [type, required] of Object.entries(order.needs)) {
        const amount = Math.min(required - (farm.delivered[type] ?? 0), itemCount(inventory, type));
        if (amount <= 0) continue;
        removeItems(inventory, type, amount);
        farm.delivered[type] = (farm.delivered[type] ?? 0) + amount;
        contributed += amount;
      }
      if (!contributed) return fail('Bring items this order still needs. Either farmer can contribute.');
      if (Object.entries(order.needs).every(([type, amount]) => farm.delivered[type] >= amount)) {
        farm.coins += order.coins;
        farm.xp += order.xp;
        farm.ordersCompleted++;
        farm.delivered = {};
        return success(`Order complete! +${order.coins} coins · +${order.xp} XP`);
      }
      return success(`Contributed ${contributed} ${contributed === 1 ? 'item' : 'items'} to your shared order!`);
    }
    case 'upgrade': {
      if (!Object.hasOwn(UPGRADES, action.upgrade)) return fail('Unknown upgrade.');
      const upgrade = UPGRADES[action.upgrade];
      if (farm.upgrades[action.upgrade]) return fail('Your farm already has this upgrade.');
      if (getFarmLevel(farm.xp).level < upgrade.level) return fail(`Unlocks at farm level ${upgrade.level}.`);
      if (farm.coins < upgrade.coins) return fail('Not enough shared coins yet.');
      for (const [type, amount] of Object.entries(upgrade.materials)) {
        if (itemCount(inventory, type) + itemCount(world.chest, type) < amount) return fail(`Needs ${amount} ${type} in your backpack or shared chest.`);
      }
      for (const [type, amount] of Object.entries(upgrade.materials)) {
        const fromBag = Math.min(amount, itemCount(inventory, type));
        removeItems(inventory, type, fromBag);
        removeItems(world.chest, type, amount - fromBag);
      }
      farm.coins -= upgrade.coins;
      farm.upgrades[action.upgrade] = true;
      if (action.upgrade === 'backpack') world.players.forEach(p => { while (p.inventory.length < 8) p.inventory.push(null); });
      return success(`${upgrade.name} unlocked for both farmers!`);
    }
    case 'coop': {
      if (!near(player, COOP, 60)) return fail('Visit the chicken coop, northeast of the field.');
      if (farm.eggs) {
        if (!addItems(inventory, 'egg', farm.eggs)) return fail('Make room in your backpack for the eggs.');
        const eggs = farm.eggs;
        farm.eggs = 0;
        farm.xp += 4;
        return success(`Collected ${eggs} eggs! +4 farm XP`);
      }
      if (farm.coopSeconds > 0) return fail('Happy hens are still nesting. Come back shortly!');
      if (!itemCount(inventory, 'seeds')) return fail('Feed the hens one carrot seed. Buy some on the farm board.');
      removeItems(inventory, 'seeds', 1);
      farm.coopSeconds = farm.upgrades.coop ? 15 : 25;
      return success('Happy hens! Come back when the eggs are ready.');
    }
    case 'recover_can': {
      if (itemCount(inventory, 'watering_can')) return fail('You already have a watering can.');
      if (!addItems(inventory, 'watering_can', 1)) return fail('Make room for a watering can.');
      return success('A free watering can, ready to use.');
    }
    case 'chest': {
      if (!player.inHouse || Math.hypot(player.x - 550, player.y - 120) > 55) return fail('Stand beside the chest inside the house.');
      const source = action.direction === 'deposit' ? inventory : world.chest;
      const target = action.direction === 'deposit' ? world.chest : inventory;
      const item = source[action.slot];
      if (!item || item.type !== action.itemType) return fail('That slot changed. Try again.');
      if (!addItems(target, item.type, item.count)) return fail('Not enough space for this stack.');
      source[action.slot] = null;
      return success('Stack transferred.');
    }
  }
  return fail('Unknown farm action.');
}

export function tickFarm(world: Pick<FarmWorld, 'progress' | 'crops'>, seconds: number, elapsed: number) {
  const farm = world.progress;
  if (farm.coopSeconds > 0) {
    farm.coopSeconds = Math.max(0, farm.coopSeconds - seconds);
    if (farm.coopSeconds === 0) farm.eggs = farm.upgrades.coop ? 4 : 3;
  }
  for (const crop of world.crops) {
    if (crop.stage >= 2) continue;
    if (farm.upgrades.sprinkler || getWeather(elapsed) === 'rain') crop.watered = true;
    if (!crop.watered) continue;
    crop.growthTimer += seconds;
    const seed = Object.values(CROPS).find(s => s.crop === crop.type)!;
    if (crop.growthTimer >= seed.seconds) {
      crop.stage++;
      crop.growthTimer = 0;
      crop.watered = false;
    }
  }
}

// Requests remain in the guest's movement packets until acknowledged. This survives
// React batching several incoming packets, and makes retransmission reward-safe.
export function processFarmRequests(world: FarmWorld, player: PlayerState, requests: FarmRequest[], lastId: number) {
  let message = '';
  for (const request of requests.slice(0, 32)) {
    if (!request || request.sessionId !== world.progress.sessionId || !Number.isSafeInteger(request.id) || request.id <= lastId) continue;
    if (!request.position || !Number.isFinite(request.position.x) || !Number.isFinite(request.position.y) || !request.action || typeof request.action.type !== 'string') continue;
    // Use the position at the button press, not the later movement packet.
    const actor = { ...player, ...request.position, inventory: player.inventory };
    message = applyFarmAction(world, actor, request.action).message;
    lastId = request.id;
  }
  return { lastId, message };
}
