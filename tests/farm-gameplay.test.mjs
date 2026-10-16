import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/games/farm/gameplay.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
const { CROPS, COOP, UPGRADES, createFarmProgress, createStarterInventory, applyFarmAction, tickFarm, getWeather, getFarmLevel, getOrder, itemCount, addItems, processFarmRequests } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const farmer = () => ({ x: 500, y: 350, gender: 'female', facingLeft: false, isMoving: false, inHouse: false, facingUp: false, inventory: createStarterInventory() });
const setup = () => ({ progress: createFarmProgress('test-farm'), crops: [], wildItems: [], weeds: [], chest: Array(10).fill(null), players: [farmer(), farmer()] });
const act = (world, action, player = world.players[0]) => applyFarmAction(world, player, action);
const grow = (world, seconds, elapsed = 0) => { for (let i = 0; i < seconds * 60; i++) tickFarm(world, 1 / 60, elapsed + i / 60); };
const fillBag = player => { player.inventory = Array.from({ length: 6 }, () => ({ type: 'stone', count: 20 })); };

test('new farms have six-slot backpacks, renewable seed money, and independent inventories', () => {
  const world = setup();
  assert.equal(world.progress.coins, 20);
  assert.equal(world.players[0].inventory.length, 6);
  world.players[0].inventory[0].count--;
  assert.equal(itemCount(world.players[1].inventory, 'seeds'), 8);
  assert.equal(getFarmLevel(0).level, 1);
  assert.equal(getFarmLevel(25).level, 2);
  assert.equal(getFarmLevel(240).next, null);
});

test('planting outside the field or on another crop never spends seeds', () => {
  const world = setup();
  const p = world.players[0];
  p.inHouse = true;
  assert.equal(act(world, { type: 'plant', slot: 0 }).ok, false);
  p.inHouse = false; p.x = 200;
  assert.equal(act(world, { type: 'plant', slot: 0 }).ok, false);
  assert.equal(itemCount(p.inventory, 'seeds'), 8);
  p.x = 500;
  assert.equal(act(world, { type: 'plant', slot: 0 }).ok, true);
  assert.equal(act(world, { type: 'plant', slot: 0 }).ok, false);
  assert.equal(itemCount(p.inventory, 'seeds'), 7);
  assert.equal(world.crops.length, 1);
});

test('all four crop varieties require two watered growth stages and award their own yield', () => {
  for (const [seed, config] of Object.entries(CROPS)) {
    const world = setup();
    world.players[0].inventory[0] = { type: seed, count: 5 };
    assert.equal(act(world, { type: 'plant', slot: 0 }).ok, true);
    const crop = world.crops[0];
    assert.equal(crop.type, config.crop);
    grow(world, 20);
    assert.equal(crop.stage, 0, 'dry seeds do not grow');
    for (const stage of [1, 2]) {
      assert.equal(act(world, { type: 'water', cropId: crop.id }).ok, true);
      grow(world, config.seconds + 1);
      assert.equal(crop.stage, stage);
      assert.equal(crop.watered, false);
    }
    assert.equal(act(world, { type: 'harvest', cropId: crop.id }).ok, true);
    assert.equal(itemCount(world.players[0].inventory, config.crop), config.yield);
    assert.equal(world.progress.harvests, 1);
    assert.equal(world.progress.xp, 4);
  }
});

test('full backpacks preserve crops, wild items, egg batches, and shared coins', () => {
  const world = setup();
  act(world, { type: 'plant', slot: 0 });
  world.crops[0].stage = 2;
  const id = world.crops[0].id;
  const p = world.players[0];
  fillBag(p);
  assert.equal(act(world, { type: 'harvest', cropId: id }).ok, false);
  assert.equal(world.crops.length, 1);
  world.wildItems.push({ id: 'berry', type: 'berry', x: 500, y: 350, active: true, respawnTimer: 0 });
  assert.equal(act(world, { type: 'pickup_item', id: 'berry' }).ok, false);
  assert.equal(world.wildItems[0].active, true);
  assert.equal(act(world, { type: 'buy', seed: 'seeds' }).ok, false);
  assert.equal(world.progress.coins, 20);
  Object.assign(p, COOP); world.progress.eggs = 3;
  assert.equal(act(world, { type: 'coop' }).ok, false);
  assert.equal(world.progress.eggs, 3);
});

test('two farmers cannot harvest, gather, or clear the same entity twice', () => {
  const world = setup();
  act(world, { type: 'plant', slot: 0 });
  world.crops[0].stage = 2;
  const action = { type: 'harvest', cropId: world.crops[0].id };
  assert.equal(act(world, action).ok, true);
  assert.equal(act(world, action, world.players[1]).ok, false);
  assert.equal(world.progress.harvests, 1);
  world.wildItems.push({ id: 'wood', type: 'wood', x: 500, y: 350, active: true, respawnTimer: 0 });
  world.weeds.push({ id: 'weed', x: 500, y: 350 });
  for (const action of [{ type: 'pickup_item', id: 'wood' }, { type: 'pluck_weed', id: 'weed' }]) {
    assert.equal(act(world, action).ok, true);
    assert.equal(act(world, action, world.players[1]).ok, false);
  }
  assert.equal(world.progress.coins, 22);
});

test('seed shop enforces level gates and funds, and sales fund a renewable farm loop', () => {
  const world = setup();
  assert.equal(act(world, { type: 'buy', seed: 'tomato_seeds' }).ok, false);
  assert.equal(world.progress.coins, 20);
  world.progress.xp = 25;
  assert.equal(act(world, { type: 'buy', seed: 'tomato_seeds' }).ok, true);
  assert.equal(world.progress.coins, 8);
  assert.equal(act(world, { type: 'buy', seed: 'pumpkin_seeds' }).ok, false);
  assert.equal(act(world, { type: 'sell', slot: 1, itemType: 'watering_can' }).ok, false);
  addItems(world.players[0].inventory, 'carrot', 2);
  const slot = world.players[0].inventory.findIndex(item => item?.type === 'carrot');
  assert.equal(act(world, { type: 'sell', slot, itemType: 'carrot' }).ok, true);
  assert.equal(world.progress.coins, 24);
  assert.equal(act(world, { type: 'buy', seed: 'seeds' }).ok, true);
  assert.equal(itemCount(world.players[0].inventory, 'seeds'), 13);
});

test('orders accept partial co-op deliveries and pay exactly once without taking excess produce', () => {
  const world = setup();
  addItems(world.players[0].inventory, 'carrot', 1);
  addItems(world.players[1].inventory, 'carrot', 4);
  assert.equal(act(world, { type: 'deliver', order: 0 }).ok, true);
  assert.equal(world.progress.delivered.carrot, 1);
  assert.equal(world.progress.ordersCompleted, 0);
  assert.equal(act(world, { type: 'deliver', order: 0 }, world.players[1]).ok, true);
  assert.equal(world.progress.ordersCompleted, 1);
  assert.equal(world.progress.coins, 45);
  assert.equal(world.progress.xp, 12);
  assert.equal(itemCount(world.players[1].inventory, 'carrot'), 3);
  assert.equal(act(world, { type: 'deliver', order: 0 }, world.players[1]).ok, false);
  assert.equal(world.progress.coins, 45);
  assert.deepEqual(world.progress.delivered, {});
});

test('all six order types are completable and repeat with larger baskets after the festival', () => {
  const world = setup();
  for (let orderIndex = 0; orderIndex < 12; orderIndex++) {
    const order = getOrder(orderIndex);
    world.players[0].inventory = Array(8).fill(null);
    for (const [type, count] of Object.entries(order.needs)) addItems(world.players[0].inventory, type, count);
    assert.equal(act(world, { type: 'deliver', order: orderIndex }).ok, true);
    assert.equal(world.progress.ordersCompleted, orderIndex + 1);
  }
  assert.ok(getOrder(6).needs.carrot > getOrder(0).needs.carrot);
  assert.ok(getOrder(6).coins > getOrder(0).coins);
});

test('shared upgrades consume only the needed backpack/chest materials and cannot be bought twice', () => {
  const world = setup();
  world.progress.coins = 200;
  world.progress.xp = 70;
  addItems(world.players[0].inventory, 'wood', 1);
  world.chest[0] = { type: 'wood', count: 3 };
  world.chest[1] = { type: 'stone', count: 2 };
  const before = structuredClone(world);
  assert.equal(act(world, { type: 'upgrade', upgrade: 'sprinkler' }).ok, false);
  assert.deepEqual(world, before, 'failed build is atomic');
  world.chest[1].count = 3;
  assert.equal(act(world, { type: 'upgrade', upgrade: 'sprinkler' }).ok, true);
  assert.equal(world.progress.coins, 120);
  assert.equal(itemCount(world.chest, 'wood'), 2);
  assert.equal(itemCount(world.chest, 'stone'), 0);
  assert.equal(act(world, { type: 'upgrade', upgrade: 'sprinkler' }).ok, false);
  assert.equal(world.progress.coins, 120);
  assert.equal(act(world, { type: 'upgrade', upgrade: 'backpack' }).ok, true);
  assert.ok(world.players.every(player => player.inventory.length === 8));
});

test('coop consumes one carrot seed, has a real wait, produces one batch, and upgrades improve it', () => {
  for (const upgraded of [false, true]) {
    const world = setup();
    const p = world.players[0];
    assert.equal(act(world, { type: 'coop' }).ok, false, 'must visit the coop');
    Object.assign(p, COOP);
    world.progress.upgrades.coop = upgraded;
    assert.equal(act(world, { type: 'coop' }).ok, true);
    assert.equal(itemCount(p.inventory, 'seeds'), 7);
    assert.equal(act(world, { type: 'coop' }).ok, false);
    grow(world, upgraded ? 16 : 26);
    assert.equal(world.progress.eggs, upgraded ? 4 : 3);
    grow(world, 30);
    assert.equal(world.progress.eggs, upgraded ? 4 : 3, 'uncollected eggs do not multiply');
    assert.equal(act(world, { type: 'coop' }).ok, true);
    assert.equal(itemCount(p.inventory, 'egg'), upgraded ? 4 : 3);
    assert.equal(world.progress.eggs, 0);
  }
});

test('rain and sprinklers water both stages automatically, with deterministic co-op weather', () => {
  assert.equal(getWeather(94.9), 'sun');
  assert.equal(getWeather(95), 'rain');
  assert.equal(getWeather(119.9), 'rain');
  assert.equal(getWeather(120), 'sun');
  for (const sprinkler of [false, true]) {
    const world = setup();
    world.progress.upgrades.sprinkler = sprinkler;
    act(world, { type: 'plant', slot: 0 });
    grow(world, 18, sprinkler ? 0 : 96);
    assert.equal(world.crops[0].stage, 2);
  }
});

test('chest transactions reject duplicate/stale withdrawals and preserve full stacks', () => {
  const world = setup();
  world.players.forEach(p => Object.assign(p, { inHouse: true, x: 550, y: 150 }));
  assert.equal(act(world, { type: 'chest', direction: 'deposit', slot: 0, itemType: 'seeds' }).ok, true);
  assert.equal(itemCount(world.chest, 'seeds'), 8);
  const withdraw = { type: 'chest', direction: 'withdraw', slot: 0, itemType: 'seeds' };
  assert.equal(act(world, withdraw, world.players[1]).ok, true);
  assert.equal(act(world, withdraw).ok, false);
  assert.equal(itemCount(world.players[1].inventory, 'seeds'), 16);
  world.chest[0] = { type: 'berry', count: 20 };
  fillBag(world.players[0]);
  assert.equal(act(world, { ...withdraw, itemType: 'berry' }).ok, false);
  assert.equal(itemCount(world.chest, 'berry'), 20);
});

test('stack overflow does not partially add items and upgrades have valid definitions', () => {
  const bag = [{ type: 'carrot', count: 19 }, null];
  assert.equal(addItems(bag, 'carrot', 22), false);
  assert.deepEqual(bag, [{ type: 'carrot', count: 19 }, null]);
  assert.equal(addItems(bag, 'carrot', 21), true);
  assert.ok(bag.every(item => item.count === 20));
  assert.equal(Object.keys(UPGRADES).length, 3);
});

test('guest retransmissions are acknowledged once and requests from other sessions are ignored', () => {
  const world = setup();
  const guest = world.players[1];
  const requests = [1, 2].map(id => ({ id, sessionId: world.progress.sessionId, action: { type: 'buy', seed: 'seeds' }, position: { x: 500, y: 350, inHouse: false } }));
  const first = processFarmRequests(world, guest, requests, 0);
  assert.equal(first.lastId, 2);
  assert.equal(world.progress.coins, 12);
  assert.equal(itemCount(guest.inventory, 'seeds'), 18);
  assert.equal(processFarmRequests(world, guest, requests, first.lastId).lastId, 2);
  assert.equal(world.progress.coins, 12);
  processFarmRequests(world, guest, [{ ...requests[0], id: 3, sessionId: 'old-farm' }], 2);
  assert.equal(world.progress.coins, 12);
});

test('guest actions use their interaction-time location and recover skipped intermediate packets', () => {
  const world = setup();
  const guest = world.players[1];
  guest.x = 900;
  const pending = [
    { id: 1, sessionId: world.progress.sessionId, action: { type: 'plant', slot: 0 }, position: { x: 500, y: 350, inHouse: false } },
    { id: 2, sessionId: world.progress.sessionId, action: { type: 'plant', slot: 0 }, position: { x: 540, y: 350, inHouse: false } },
  ];
  assert.equal(processFarmRequests(world, guest, pending, 0).lastId, 2);
  assert.deepEqual(world.crops.map(crop => crop.x), [500, 540]);
  assert.equal(guest.x, 900, 'action processing must not rewind movement');
  assert.equal(itemCount(guest.inventory, 'seeds'), 6);
});

test('guest backpack upgrade grows both real inventories, not a temporary actor copy', () => {
  const world = setup();
  world.progress.xp = 70; world.progress.coins = 100;
  processFarmRequests(world, world.players[1], [{ id: 1, sessionId: world.progress.sessionId, action: { type: 'upgrade', upgrade: 'backpack' }, position: { x: 500, y: 350, inHouse: false } }], 0);
  assert.ok(world.players.every(p => p.inventory.length === 8));
});
