const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';

export const LOBBY_CODE_PATTERN = /^[A-Z]{3}\d{3}$/;

const randomIndex = (length: number) => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % length;
};

export const generateLobbyCode = () => {
  const letters = Array.from(
    { length: 3 },
    () => LETTERS[randomIndex(LETTERS.length)],
  ).join('');
  const numbers = Array.from(
    { length: 3 },
    () => NUMBERS[randomIndex(NUMBERS.length)],
  ).join('');

  return `${letters}${numbers}`;
};

export const normalizeLobbyCode = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export const getLobbyCodeFromUrl = (url: string) => {
  try {
    const code = normalizeLobbyCode(new URL(url).searchParams.get('join') ?? '');
    return LOBBY_CODE_PATTERN.test(code) ? code : '';
  } catch {
    return '';
  }
};

export const buildInviteLink = (url: string, code: string) => {
  const inviteUrl = new URL(url);
  inviteUrl.searchParams.set('join', code);
  inviteUrl.hash = '';
  return inviteUrl.toString();
};
