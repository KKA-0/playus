import { useEffect, useRef, useState } from 'react';
import type { FarmAction, FarmProgress, SeedType, UpgradeType } from './gameplay';
import { CROPS, SELL_PRICES, UPGRADES, getFarmLevel, getOrder, itemCount } from './gameplay';
import type { InventoryItem } from './types';
import { getItemEmoji, getItemName } from './utils';
import './farm.css';

interface Props {
  progress: FarmProgress;
  inventory: (InventoryItem | null)[];
  chest: (InventoryItem | null)[];
  notice: string;
  onAction: (action: FarmAction) => void;
  onClose: () => void;
}

export function FarmBoard({ progress, inventory, chest, notice, onAction, onClose }: Props) {
  const [tab, setTab] = useState<'orders' | 'market' | 'upgrades'>('orders');
  const dialogRef = useRef<HTMLDivElement>(null);
  const level = getFarmLevel(progress.xp);
  const order = getOrder(progress.ordersCompleted);
  const canContribute = Object.entries(order.needs).some(([type, count]) => (progress.delivered[type] ?? 0) < count && itemCount(inventory, type) > 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return;
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog?.addEventListener('keydown', trapFocus);
    return () => { dialog?.removeEventListener('keydown', trapFocus); };
  }, []);

  return <div className="farm-board-shade">
    <div className="farm-board" data-farm-menu="board" role="dialog" aria-modal="true" aria-labelledby="farm-board-title" ref={dialogRef}>
      <header className="farm-board-heading">
        <div><small>GROW SOMETHING GOOD, TOGETHER</small><h2 id="farm-board-title">🌻 The farm board</h2></div>
        <button onClick={onClose} aria-label="Close farm board">✕</button>
      </header>
      <div className="farm-board-stats">
        <strong>🪙 {progress.coins} shared coins</strong><span>Level {level.level} · {level.title}</span><span>{progress.xp} XP{level.next ? ` / ${level.next}` : ' · MAX LEVEL'}</span>
      </div>
      <div className="farm-xp-track"><div style={{ width: `${level.next ? Math.min(100, (progress.xp - level.start) / (level.next - level.start) * 100) : 100}%` }} /></div>
      <nav className="farm-board-tabs" aria-label="Farm board sections">
        {(['orders', 'market', 'upgrades'] as const).map(value => <button key={value} data-farm-tab={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'orders' ? '📋 Orders' : value === 'market' ? '🧺 Market' : '🛠 Upgrades'}</button>)}
      </nav>
      <div className="farm-board-body">
        {tab === 'orders' && <>
          <article className="farm-order-card">
            <small>ORDER #{progress.ordersCompleted + 1} · {order.customer}</small>
            <h3>{order.name}</h3>
            <p>Fill this basket together. Each delivery uses only what is still needed from your backpack.</p>
            <div className="farm-order-items">{Object.entries(order.needs).map(([type, count]) => <div key={type} className={(progress.delivered[type] ?? 0) >= count ? 'done' : ''}>
              <span>{getItemEmoji(type)}</span><strong>{getItemName(type)}</strong><b>{progress.delivered[type] ?? 0} / {count}</b><small>You have {itemCount(inventory, type)}</small>
            </div>)}</div>
            <div className="farm-order-reward"><span>Reward: <b>🪙 {order.coins} + ✨ {order.xp} XP</b></span><button className="farm-primary" disabled={!canContribute} onClick={() => onAction({ type: 'deliver', order: progress.ordersCompleted })}>Contribute items</button></div>
          </article>
          <div className="farm-guide-grid">
            <article><h4>🌱 Grow & trade</h4><p>Choose a seed slot, then Plant/Water (Space or A / ✕) on the field. Water at both growth stages. Interact (E or X / □) harvests.</p></article>
            <article><h4>🐔 Happy hens</h4><p>Interact with the coop northeast of the field to feed one carrot seed, then collect eggs after 25 seconds. Upgrade it for more eggs, faster.</p></article>
            <article><h4>🌧 A helping hand</h4><p>Showers arrive every two minutes and water your crops. Clear weeds for coins. Gather wood and stone to build shared upgrades.</p></article>
            <article><h4>🤝 Your homestead</h4><p>{progress.harvests} crops harvested · {progress.ordersCompleted} orders filled. Share supplies in the house chest. Progress lasts for this game session.</p></article>
          </div>
        </>}
        {tab === 'market' && <>
          <h3>Seed shop <small>Five seeds per packet</small></h3>
          <div className="farm-shop-grid">{(Object.entries(CROPS) as [SeedType, typeof CROPS[SeedType]][]).map(([seed, config]) => <article key={seed}>
            <span className="farm-item-icon">{getItemEmoji(config.crop)}</span><h4>{config.name}</h4><p>{config.seconds * 2}s watered growth · yields {config.yield}<br />Sells for {SELL_PRICES[config.crop]} coins each</p>
            <button disabled={level.level < config.level || progress.coins < config.price} onClick={() => onAction({ type: 'buy', seed })}>{level.level < config.level ? `🔒 Farm level ${config.level}` : `Buy 5 · 🪙 ${config.price}`}</button>
          </article>)}</div>
          <h3>Sell from your backpack</h3><p>Coins belong to both farmers. Keep what your order needs before selling!</p>
          <div className="farm-sell-list">{inventory.map((item, slot) => item && SELL_PRICES[item.type] ? <button key={slot} onClick={() => onAction({ type: 'sell', slot, itemType: item.type })}>{getItemEmoji(item.type)} {item.count} × {getItemName(item.type)} <b>+{item.count * SELL_PRICES[item.type]} 🪙</b></button> : null)}</div>
          {!inventory.some(item => item && SELL_PRICES[item.type]) && <p className="farm-empty">Your basket is empty. Harvest crops, collect eggs, or gather berries to start trading.</p>}
          <button className="farm-tool-button" disabled={itemCount(inventory, 'watering_can') > 0} onClick={() => onAction({ type: 'recover_can' })}>🪣 Replace watering can · free</button>
        </>}
        {tab === 'upgrades' && <>
          <p>Build once, enjoy together. Materials come from your backpack and the shared chest.</p>
          <div className="farm-upgrade-list">{(Object.entries(UPGRADES) as [UpgradeType, typeof UPGRADES[UpgradeType]][]).map(([id, upgrade]) => {
            const materials = Object.entries(upgrade.materials);
            const affordable = progress.coins >= upgrade.coins && materials.every(([type, count]) => itemCount(inventory, type) + itemCount(chest, type) >= count);
            return <article key={id}><span className="farm-item-icon">{upgrade.emoji}</span><div><h4>{upgrade.name}</h4><p>{upgrade.description}</p><small>🪙 {upgrade.coins}{materials.map(([type, count]) => ` · ${getItemEmoji(type)} ${itemCount(inventory, type) + itemCount(chest, type)}/${count}`).join('')}</small></div><button disabled={progress.upgrades[id] || level.level < upgrade.level || !affordable} onClick={() => onAction({ type: 'upgrade', upgrade: id })}>{progress.upgrades[id] ? '✓ Built' : level.level < upgrade.level ? `Level ${upgrade.level}` : 'Build together'}</button></article>;
          })}</div>
        </>}
      </div>
      <footer className="farm-board-footer"><span role="status">{notice || 'A little teamwork goes a long way.'}</span><small>Controller: D-pad browse · A / ✕ select · B / ○ back · LB/RB tabs. Keyboard: B / Esc closes.</small></footer>
    </div>
  </div>;
}
