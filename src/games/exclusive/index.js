/**
 * SpinKit Exclusive — in-house games that are not slots (stateful rounds, own client).
 * Lobby category `exclusive`; played through POST /api/v1/rgs/action (src/services/exclusive-service.js).
 * Each entry: kind 'exclusive', its own `mechanic` (src/engine/mechanics) and `client`
 * (public/games/<client>/index.html, served at /games/<id>/).
 */
module.exports = [
  require('./apple_shooter'),
  require('./fruit_slash'),
  require('./hill_climb')
];
