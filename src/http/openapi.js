/**
 * OpenAPI 3.0 description of the Merchant API (v2) and the game-client API.
 * Served at /api/openapi.json and rendered by /docs.
 */

const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const json = (schema, example) => ({ content: { 'application/json': { schema, ...(example ? { example } : {}) } } });
const ok = (schema, example, description = 'OK') => ({ 200: { description, ...json(schema, example) } });
const errs = (...codes) => Object.fromEntries(codes.map((c) => [c, { description: { 400: 'Validation error', 401: 'Unauthorized / bad signature', 403: 'Forbidden (IP, suspended, blocked...)', 404: 'Not found', 409: 'Conflict (idempotency)' }[c], ...json(ref('Error')) }]));
const q = (name, description, schema = { type: 'string' }) => ({ name, in: 'query', required: false, description, schema });
const p = (name, description) => ({ name, in: 'path', required: true, description, schema: { type: 'string' } });
const body = (schema, example) => ({ required: true, ...json(schema, example) });
const M = ['Merchant API'];

function openapi(baseUrl) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'SpinKit RGS API',
      version: '2.0.0',
      description: [
        'Remote Game Server API for casino operators ("merchants").',
        '',
        '**Money** — every amount is an integer in minor units of the merchant currency (cents): `10000` = $100.00.',
        '',
        '**Authentication** — `Authorization: Bearer sk_live_…` (create tokens in the admin panel → Merchants → API tokens).',
        'Calls are only accepted from IPs in the merchant whitelist (an empty whitelist allows any IP).',
        '',
        '**Request signing (optional, per merchant)** — when enabled, send `X-Timestamp` (unix seconds) and',
        '`X-Signature = hex(HMAC-SHA256(signing_secret, "{timestamp}.{METHOD}.{path_with_query}.{raw_body}"))`.',
        'Requests older than 5 minutes are rejected.',
        '',
        '**Wallet** — transfer wallet: move money into a player\'s game balance with `deposit` and back with `withdraw`.',
        'Both are idempotent on your `tx_id`. Deposits are drawn from the merchant float (unless unlimited).',
        '',
        '**Flow** — create/find player → deposit → `POST /sessions` → open `launch_url` in an iframe/WebView → withdraw when the player leaves.'
      ].join('\n')
    },
    servers: [{ url: baseUrl }],
    tags: [
      { name: 'Merchant API', description: 'Server-to-server calls from the casino backend' },
      { name: 'Game client', description: 'Called by the game running in the player browser (session token auth)' }
    ],
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', description: 'Merchant API token (sk_live_…)' } },
      schemas: {
        Error: { type: 'object', properties: { status: { type: 'string', example: 'error' }, error: { type: 'string', example: 'INSUFFICIENT_FUNDS' }, message: { type: 'string' } } },
        Currency: { type: 'object', properties: { code: { type: 'string', example: 'USD' }, symbol: { type: 'string', example: '$' }, decimals: { type: 'integer', example: 2 } } },
        Player: {
          type: 'object',
          properties: {
            player_id: { type: 'integer' }, external_id: { type: 'string', example: 'user-1001' }, username: { type: 'string' },
            balance: { type: 'integer', example: 250000 }, currency: { type: 'string' }, is_test: { type: 'boolean' }, status: { type: 'string', enum: ['active', 'blocked'] }
          }
        },
        GameSummary: {
          type: 'object',
          properties: {
            game_id: { type: 'string', example: 'olympus_thunder' }, name: { type: 'string' }, category: { type: 'string' }, collection: { type: 'string', enum: ['artwork', 'basic'], description: 'artwork = painted cabinet and symbols, basic = procedural reels with emoji symbols' },
            mechanic: { type: 'string', enum: ['lines', 'ways', 'tumble', 'giants', 'clusters', 'megaways', 'holdwin', 'matchlines'] }, grid: { type: 'string', example: '6x5' },
            paylines: { type: 'integer', nullable: true }, ways: { type: 'integer', nullable: true }, volatility: { type: 'string' },
            rtp: { type: 'string', example: '96.00%' }, rtp_profile: { type: 'integer', example: 96 }, max_win_x: { type: 'integer' },
            features: { type: 'object' },
            bets: { type: 'object', properties: { min: { type: 'integer' }, max: { type: 'integer' }, default: { type: 'integer' }, steps: { type: 'array', items: { type: 'integer' } } } },
            template: { type: 'string', description: 'Math template the game is built on' },
            thumbnail_url: { type: 'string', nullable: true, description: 'Lobby thumbnail (4:3 JPEG, 800x600) when the game has one' },
            thumbnail_icons: { type: 'array', items: { type: 'string' } }
          }
        },
        Round: {
          type: 'object',
          properties: {
            round_id: { type: 'string' }, created_at: { type: 'string' }, external_id: { type: 'string' }, game_id: { type: 'string' },
            type: { type: 'string', enum: ['spin', 'buy', 'free_spin'] }, bet: { type: 'integer' }, win: { type: 'integer' }, jackpot_win: { type: 'integer' },
            balance_before: { type: 'integer' }, balance_after: { type: 'integer' }, rtp_profile: { type: 'integer' }, matrix: { type: 'array' }, wins: { type: 'array' }
          }
        },
        Jackpot: { type: 'object', properties: { tier: { type: 'string', example: 'major' }, name: { type: 'string' }, amount: { type: 'integer' }, must_hit_by: { type: 'integer' }, min_bet: { type: 'integer' }, hits: { type: 'integer' } } },
        Transfer: { type: 'object', required: ['amount', 'tx_id'], properties: { amount: { type: 'integer', example: 50000 }, tx_id: { type: 'string', example: 'dep-8f2a1' } } }
      }
    },
    security: [{ bearer: [] }],
    paths: {
      '/api/v2/health': { get: { tags: M, summary: 'Health check', security: [], responses: ok({ type: 'object' }, { status: 'ok', games: 100 }) } },
      '/api/v2/merchant': {
        get: { tags: M, summary: 'Your merchant account (float balance, limits, RTP profile)', responses: { ...ok({ type: 'object' }), ...errs(401, 403) } },
        patch: {
          tags: M, summary: 'Change your default game language or lobby URL',
          description: '`default_lang` is used when a session is launched without `lang` (null = the player\'s browser language). Languages: en, ru, lv, lt, et, uk, de, es, pt, fr, it, tr, pl.',
          requestBody: body({ type: 'object', properties: { default_lang: { type: 'string', nullable: true }, lobby_url: { type: 'string', nullable: true } } }, { default_lang: 'de' }),
          responses: { ...ok({ type: 'object' }), ...errs(400, 401) }
        }
      },
      '/api/v2/games': {
        get: {
          tags: M, summary: 'List games enabled for your merchant',
          parameters: [q('mechanic', 'lines | ways | tumble | giants | clusters | megaways | holdwin | matchlines'), q('category', 'e.g. egypt, candy, space'), q('collection', 'artwork | basic')],
          responses: { ...ok({ type: 'object', properties: { count: { type: 'integer' }, games: { type: 'array', items: ref('GameSummary') } } }), ...errs(401, 403) }
        }
      },
      '/api/v2/games/{game_id}': { get: { tags: M, summary: 'Game details: paytable, features, bet ladder, RTP', parameters: [p('game_id', 'Game id')], responses: { ...ok({ type: 'object' }), ...errs(401, 404) } } },
      '/api/v2/games/{game_id}/settings': {
        get: { tags: M, summary: 'Your settings of a game: bet limits, operator options, bet ladder', parameters: [p('game_id', 'Game id')], responses: { ...ok({ type: 'object' }), ...errs(401, 404) } },
        patch: {
          tags: M, summary: 'Change bet limits and options of a game',
          description: [
            '`min_bet` / `max_bet` in minor units (null = default). Bets snap to the game ladder (`bet_ladder.steps`).',
            'SpinKit Exclusive games ship a ladder up to 5,000.00 and open up to 100.00 by default; set `max_bet` to open higher bets.',
            'A merchant-wide max_bet (set by the provider) still applies on top.',
            '`options` are game specific (`option_schema`): Apple Shooter / Fruit Slash `helmet_max_saves` = saves per round (0 = off, null = game default).',
            'RTP profiles are set by the provider.'
          ].join(' '),
          parameters: [p('game_id', 'Game id')],
          requestBody: body({ type: 'object', properties: { enabled: { type: 'boolean' }, min_bet: { type: 'integer', nullable: true }, max_bet: { type: 'integer', nullable: true }, options: { type: 'object' } } }, { max_bet: 100000, options: { helmet_max_saves: 2 } }),
          responses: { ...ok({ type: 'object' }), ...errs(400, 401, 404) }
        }
      },
      '/api/v2/players': {
        post: {
          tags: M, summary: 'Create (or fetch) a player',
          description: '`is_test` is only applied when the player is created. Test players can use QA sessions (custom RTP, forced features), their deposits do not use the float and they cannot withdraw.',
          requestBody: body({ type: 'object', required: ['external_id'], properties: { external_id: { type: 'string' }, username: { type: 'string' }, is_test: { type: 'boolean' } } }, { external_id: 'user-1001', username: 'Alice' }),
          responses: { ...ok({ type: 'object', properties: { created: { type: 'boolean' }, player: ref('Player') } }), ...errs(400, 401) }
        }
      },
      '/api/v2/players/{external_id}': { get: { tags: M, summary: 'Player balance', parameters: [p('external_id', 'Your player id')], responses: { ...ok({ type: 'object', properties: { player: ref('Player') } }), ...errs(401, 404) } } },
      '/api/v2/players/{external_id}/deposit': {
        post: {
          tags: M, summary: 'Move money into the game balance (idempotent on tx_id)', parameters: [p('external_id', 'Your player id')],
          requestBody: body(ref('Transfer'), { amount: 50000, tx_id: 'dep-8f2a1' }),
          responses: { ...ok({ type: 'object' }, { status: 'success', idempotent: false, transaction: { id: 12, type: 'deposit', amount: 50000, tx_id: 'dep-8f2a1' }, balance: 50000 }), ...errs(400, 401, 404, 409) }
        }
      },
      '/api/v2/players/{external_id}/withdraw': {
        post: {
          tags: M, summary: 'Move money back from the game balance (idempotent on tx_id)', parameters: [p('external_id', 'Your player id')],
          requestBody: body(ref('Transfer'), { amount: 12000, tx_id: 'wd-77c01' }),
          responses: { ...ok({ type: 'object' }), ...errs(400, 401, 403, 404, 409) }
        }
      },
      '/api/v2/players/{external_id}/transactions': { get: { tags: M, summary: 'Wallet ledger of a player', parameters: [p('external_id', 'Your player id'), q('limit', 'max 500', { type: 'integer' })], responses: ok({ type: 'object' }) } },
      '/api/v2/sessions': {
        post: {
          tags: M, summary: 'Launch a game (returns launch_url)',
          description: 'Creates the player if needed. `test` options are accepted only for test players; the game then shows a TEST MODE badge and the session is recorded in the audit log.',
          requestBody: body({
            type: 'object', required: ['external_id', 'game_id'],
            properties: {
              external_id: { type: 'string' }, game_id: { type: 'string' }, username: { type: 'string' }, lobby_url: { type: 'string', description: 'Where the in-game "Back to lobby" button leads' },
              ttl_minutes: { type: 'integer', default: 240 },
              lang: { type: 'string', description: 'Interface language: en, ru, lv, lt, et, uk, de, es, pt, fr, it, tr, pl (default: merchant default_lang, then the browser language)' },
              test: { type: 'object', properties: { rtp_profile: { type: 'number', description: 'QA only: 10-300' }, force_feature: { type: 'boolean', description: 'QA only: next paid spin triggers free spins' } } }
            }
          }, { external_id: 'user-1001', game_id: 'olympus_thunder', lobby_url: 'https://casino.example/lobby' }),
          responses: { ...ok({ type: 'object' }, { status: 'success', session: { token: 'c9b8…', launch_url: `${baseUrl}/games/olympus_thunder/?token=c9b8…`, expires_at: '2026-09-25T16:00:00.000Z', rtp: '96.00%', test_mode: false } }), ...errs(400, 401, 403, 404) }
        }
      },
      '/api/v2/sessions/{token}': { delete: { tags: M, summary: 'Revoke a session (kick the player out of the game)', parameters: [p('token', 'Session token')], responses: { ...ok({ type: 'object' }), ...errs(404) } } },
      '/api/v2/rounds': {
        get: {
          tags: M, summary: 'Round history',
          parameters: [q('external_id', 'Filter by player'), q('game_id', 'Filter by game'), q('from', 'YYYY-MM-DD'), q('to', 'YYYY-MM-DD'), q('limit', 'max 500', { type: 'integer' }), q('offset', '', { type: 'integer' }), q('include_test', '1 to include test sessions')],
          responses: ok({ type: 'object', properties: { total: { type: 'integer' }, rounds: { type: 'array', items: ref('Round') } } })
        }
      },
      '/api/v2/rounds/{round_id}': { get: { tags: M, summary: 'Round details (grid, wins, features) for disputes', parameters: [p('round_id', 'Round id')], responses: { ...ok({ type: 'object', properties: { round: ref('Round') } }), ...errs(404) } } },
      '/api/v2/jackpots': { get: { tags: M, summary: 'Current jackpot pools', responses: ok({ type: 'object', properties: { enabled: { type: 'boolean' }, jackpots: { type: 'array', items: ref('Jackpot') } } }) } },
      '/api/v2/jackpots/wins': { get: { tags: M, summary: 'Recent jackpot wins', parameters: [q('limit', '', { type: 'integer' })], responses: ok({ type: 'object' }) } },
      '/api/v2/reports/summary': { get: { tags: M, summary: 'Bets, wins, GGR, RTP and per-game breakdown', parameters: [q('from', 'YYYY-MM-DD'), q('to', 'YYYY-MM-DD'), q('days', 'default 30', { type: 'integer' })], responses: ok({ type: 'object' }) } },
      '/api/v2/reports/daily': { get: { tags: M, summary: 'Daily GGR series', parameters: [q('from', 'YYYY-MM-DD'), q('to', 'YYYY-MM-DD'), q('days', 'default 30', { type: 'integer' })], responses: ok({ type: 'object' }) } },

      '/api/v1/rgs/init': {
        post: {
          tags: ['Game client'], security: [], summary: 'Game start: balance, game config (paytable, bets, RTP), unfinished free spins, jackpots',
          requestBody: body({ type: 'object', required: ['token'], properties: { token: { type: 'string' } } }),
          responses: { ...ok({ type: 'object' }), ...errs(401, 403) }
        }
      },
      '/api/v1/rgs/spin': {
        post: {
          tags: ['Game client'], security: [], summary: 'Play one round',
          description: 'Server-side RNG. Free spins are played with the same call (bet is not charged). `buy_feature: true` buys free spins for `buy_cost x bet`.',
          requestBody: body({ type: 'object', required: ['token', 'bet_amount'], properties: { token: { type: 'string' }, bet_amount: { type: 'integer', example: 200 }, buy_feature: { type: 'boolean' } } }),
          responses: { ...ok({ type: 'object' }, { round_id: '…', bet: 200, cost: 200, total_win: 340, jackpot_wins: [], balance: 100140, free_spins: { remaining: 0 } }), ...errs(400, 401, 403) }
        }
      }
    }
  };
}

module.exports = { openapi };
