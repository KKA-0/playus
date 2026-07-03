export const getGameClock = (elapsedSeconds: number) => {
  const cycleSeconds = elapsedSeconds % 2100;
  let isNight = false;
  let virtualHour = 6;
  let virtualMinute = 0;

  if (cycleSeconds < 1500) {
    // Day: 06:00 AM to 08:00 PM (14 hours = 840 mins)
    const pct = cycleSeconds / 1500;
    const totalVirtualMinutes = pct * 840;
    virtualHour = Math.floor(6 + totalVirtualMinutes / 60);
    virtualMinute = Math.floor(totalVirtualMinutes % 60);
  } else {
    // Night: 08:00 PM to 06:00 AM (10 hours = 600 mins)
    isNight = true;
    const pct = (cycleSeconds - 1500) / 600;
    const totalVirtualMinutes = pct * 600;
    virtualHour = Math.floor(20 + totalVirtualMinutes / 60) % 24;
    virtualMinute = Math.floor(totalVirtualMinutes % 60);
  }

  const ampm = virtualHour >= 12 ? 'PM' : 'AM';
  const displayHour = virtualHour % 12 === 0 ? 12 : virtualHour % 12;
  const displayMinute = String(virtualMinute).padStart(2, '0');
  const timeStr = `${displayHour}:${displayMinute} ${ampm}`;
  const virtualDay = Math.floor(elapsedSeconds / 2100) + 1;

  return { timeStr, isNight, cycleSeconds, virtualDay };
};

export const getAmbientColor = (cycleSeconds: number) => {
  if (cycleSeconds < 1320) {
    // 0 to 22 mins: Broad daylight -> transparent
    return null;
  } else if (cycleSeconds < 1500) {
    // 22 to 25 mins: Sunset transition -> warm orange overlay fading in
    const progress = (cycleSeconds - 1320) / 180;
    const r = Math.floor(200 * progress);
    const g = Math.floor(90 * progress);
    const b = Math.floor(40 * progress);
    const a = progress * 0.38;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  } else if (cycleSeconds < 1980) {
    // 25 to 33 mins: Deep night -> dark blue overlay
    return 'rgba(10, 14, 42, 0.45)';
  } else {
    // 33 to 35 mins: Sunrise transition -> soft pink/yellow dawn fading out
    const progress = (cycleSeconds - 1980) / 120;
    const r = Math.floor(200 * (1 - progress));
    const g = Math.floor(90 * (1 - progress));
    const b = Math.floor(40 * (1 - progress));
    const a = (1 - progress) * 0.38;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
};

export const getItemEmoji = (item: string | null) => {
  if (!item) return '';
  switch (item) {
    case 'seeds': return '🌱';
    case 'watering_can': return '🪣';
    case 'carrot': return '🥕';
    case 'pumpkin': return '🎃';
    case 'berry': return '🍓';
    case 'wood': return '🪵';
    case 'stone': return '🪨';
    default: return '❓';
  }
};

export const getItemName = (item: string | null) => {
  if (!item) return '';
  switch (item) {
    case 'seeds': return 'Seeds';
    case 'watering_can': return 'Can';
    case 'carrot': return 'Carrot';
    case 'pumpkin': return 'Pumpkin';
    case 'berry': return 'Berry';
    case 'wood': return 'Wood';
    case 'stone': return 'Stone';
    default: return item;
  }
};
