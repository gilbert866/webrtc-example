/**
 * Signaling Protocol Message Types
 */

export const SignalingMessageType = {
  JOIN: 'join',
  JOINED: 'joined',
  PEER_JOINED: 'peer-joined',
  PEER_LEFT: 'peer-left',
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice-candidate',
  MEDIA_STATE: 'media-state',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error'
};
