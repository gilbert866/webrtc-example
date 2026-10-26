/**
 * Cryptographically random identifier generator for rooms and peer IDs.
 */

export function generatePeerId(prefix = 'peer') {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz';
  let rand = '';
  const cryptoObj = window.crypto || window.msCrypto;
  const values = new Uint8Array(6);
  cryptoObj.getRandomValues(values);
  for (let i = 0; i < values.length; i++) {
    rand += chars[values[i] % chars.length];
  }
  return `${prefix}-${rand}`;
}

export function generateRoomId() {
  const words1 = ['blue', 'swift', 'hyper', 'orbit', 'zenith', 'pulse', 'amber', 'cyber', 'solar', 'aurora'];
  const words2 = ['nexus', 'stream', 'portal', 'wave', 'matrix', 'beacon', 'link', 'bridge', 'haven', 'spark'];
  const rand1 = words1[Math.floor(Math.random() * words1.length)];
  const rand2 = words2[Math.floor(Math.random() * words2.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${rand1}-${rand2}-${num}`;
}
