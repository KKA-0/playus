import { COOP, MARKET } from './gameplay';
import type { FarmProgress } from './gameplay';

export function drawFarmStations(ctx: CanvasRenderingContext2D, farm: FarmProgress, seconds: number) {
  ctx.save();
  const box = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const label = (text: string, x: number, y: number, color = '#fff2c4') => {
    ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const width = ctx.measureText(text).width + 14;
    box(x - width / 2, y - 9, width, 18, '#203b2cee');
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  };
  const mx = MARKET.x;
  const my = MARKET.y;
  // Striped village stall, produce crates and a little hanging sign.
  box(mx - 44, my - 8, 88, 14, '#193f3055');
  box(mx - 38, my - 62, 5, 58, '#805331');
  box(mx + 33, my - 62, 5, 58, '#805331');
  box(mx - 43, my - 70, 86, 25, '#f1d99b');
  for (let i = 0; i < 6; i++) box(mx - 43 + i * 15, my - 70, 8, 25, '#cf7554');
  box(mx - 43, my - 48, 86, 5, '#914c37');
  box(mx - 38, my - 25, 76, 22, '#c99a5c');
  box(mx - 38, my - 7, 76, 4, '#956b3e');
  for (let i = 0; i < 4; i++) box(mx - 30 + i * 19, my - 21, 2, 13, '#a77842');
  ctx.font = '17px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('🥕 🍅 🌽', mx, my - 22);
  label('VILLAGE MARKET', mx, my + 17);

  const cx = COOP.x;
  const cy = COOP.y;
  box(cx - 43, cy - 5, 86, 14, '#193f3055');
  box(cx - 36, cy - 48, 72, 44, farm.upgrades.coop ? '#e3c888' : '#bd9562');
  for (let i = 0; i < 4; i++) box(cx - 36, cy - 44 + i * 10, 72, 2, '#967043');
  box(cx - 42, cy - 57, 84, 15, farm.upgrades.coop ? '#65968a' : '#aa5d43');
  box(cx - 34, cy - 64, 68, 9, farm.upgrades.coop ? '#83b59b' : '#c97c55');
  box(cx - 11, cy - 30, 22, 26, '#59432d');
  box(cx - 16, cy - 4, 32, 6, '#d9bc82');
  box(cx + 20, cy - 34, 10, 12, '#fff2bc');
  ctx.font = '18px sans-serif'; ctx.fillText(farm.eggs ? '🥚' : farm.coopSeconds > 0 ? '♥' : '🌱', cx - 25, cy - 10);
  const status = farm.eggs ? `${farm.eggs} EGGS READY` : farm.coopSeconds > 0 ? `NESTING · ${Math.ceil(farm.coopSeconds)}s` : 'FEED HENS';
  label(status, cx, cy + 22, farm.eggs ? '#ffee82' : '#fff2c4');

  if (farm.upgrades.sprinkler) {
    for (const x of [355, 645]) {
      box(x - 2, 328, 4, 15, '#a8cad0');
      box(x - 6, 327, 12, 4, '#e5f0ec');
      ctx.strokeStyle = '#a7e7f777'; ctx.lineWidth = 1;
      for (let n = 0; n < 3; n++) {
        const radius = (seconds * 20 + n * 17) % 50;
        ctx.beginPath(); ctx.ellipse(x, 338, radius, radius * .5, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
  ctx.restore();
}
