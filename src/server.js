try { if (typeof process.loadEnvFile === 'function') process.loadEnvFile(); } catch {}
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { HubController } = require('./api/hub-controller');
const { RgsController } = require('./api/rgs-controller');
const { Router } = require('./http/router');
const merchantApi = require('./http/merchant-api');
const adminApi = require('./http/admin-api');
const { openapi } = require('./http/openapi');
const { clientIp } = require('./services/security');
const { ApiError } = require('./services/errors');
const admin = require('./services/admin');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '../public');
const QUIET = process.env.SPINKIT_QUIET === '1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8'
};

// ------------------------------------------------------------------ routes
const router = new Router();

// Public demo lobby + game client (v1, kept for compatibility)
router.post('/api/v1/games/launch', (ctx) => HubController.handleLaunch(ctx.body, ctx.req.headers.host));
router.get('/api/v1/games', () => HubController.handleGetGames());
router.post('/api/v1/user/refill', (ctx) => HubController.handleRefill(ctx.body));
router.get('/api/v1/user/balance', (ctx) => HubController.handleGetBalance(ctx.query.user_id));
router.get('/api/v1/transactions', (ctx) => HubController.handleGetTransactions(ctx.query.user_id, ctx.query.limit ? Number(ctx.query.limit) : 30));
router.post('/api/v1/rgs/init', (ctx) => RgsController.handleInit(ctx.body));
router.post('/api/v1/rgs/spin', (ctx) => RgsController.handleSpin(ctx.body));
router.post('/api/v1/rgs/refill', (ctx) => RgsController.handleRefill(ctx.body));

merchantApi.register(router);
adminApi.register(router);
router.get('/api/openapi.json', (ctx) => openapi(ctx.baseUrl));

// ------------------------------------------------------------------ helpers
function sendJson(res, status, data, cors = true) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (cors) {
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Timestamp, X-Signature';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

function baseUrlOf(req) {
  if (process.env.SPINKIT_PUBLIC_URL) return process.env.SPINKIT_PUBLIC_URL.replace(/\/$/, '');
  const host = req.headers.host || `localhost:${PORT}`;
  let proto = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  if (process.env.SPINKIT_TRUST_PROXY === '1' && req.headers['x-forwarded-proto']) proto = String(req.headers['x-forwarded-proto']).split(',')[0];
  return `${proto}://${host}`;
}

function serveStatic(res, filePath, extraHeaders = {}) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Content-Security-Policy': "frame-ancestors 'self' *;",
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
      ...extraHeaders
    };
    // byte ranges (videos: Safari only plays media served with Range support)
    const range = /^bytes=(\d*)-(\d*)$/.exec((res.req && res.req.headers.range) || '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : stats.size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : stats.size - 1;
      start = Math.max(0, start);
      end = Math.min(end, stats.size - 1);
      if (start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
        res.end();
        return;
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stats.size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': stats.size });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ------------------------------------------------------------------ server
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, 'http://local');
  const pathname = urlObj.pathname;
  const method = req.method;
  const isAdminApi = pathname.startsWith('/api/admin/');
  if (!QUIET) console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

  if (method === 'OPTIONS') {
    if (isAdminApi) { res.writeHead(204); res.end(); return; }
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Timestamp, X-Signature',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    const ctx = {
      req, res, method, path: pathname,
      pathWithQuery: pathname + urlObj.search,
      query: Object.fromEntries(urlObj.searchParams),
      ip: clientIp(req),
      baseUrl: baseUrlOf(req),
      body: {},
      rawBody: '',
      send: (status, data) => sendJson(res, status, data, !isAdminApi)
    };
    try {
      if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
        ctx.rawBody = await readBody(req);
        if (ctx.rawBody) {
          try {
            ctx.body = JSON.parse(ctx.rawBody);
          } catch {
            if (pathname.startsWith('/api/v1/')) ctx.body = {}; // legacy: tolerant
            else throw new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON');
          }
          if (!ctx.body || typeof ctx.body !== 'object') ctx.body = {};
        }
      }
      const handled = await router.handle(ctx);
      if (!handled) throw new ApiError(404, 'NOT_FOUND', `No endpoint ${method} ${pathname}`);
    } catch (e) {
      if (res.writableEnded) return;
      if (e instanceof ApiError) return ctx.send(e.status, e.toBody());
      console.error(e);
      ctx.send(500, { status: 'error', error: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
    return;
  }

  // Game client: every game shares one client, the theme comes from /rgs/init
  if (/^\/games\/[a-zA-Z0-9_-]+\/?$/.test(pathname)) {
    return serveStatic(res, path.join(PUBLIC_DIR, 'games/common/slot.html'));
  }
  if (pathname === '/admin' || pathname === '/admin/') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'admin/index.html'), { 'Content-Security-Policy': "frame-ancestors 'none'", 'X-Frame-Options': 'DENY' });
  }
  if (pathname === '/docs' || pathname === '/docs/') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'docs/index.html'));
  }

  let rel = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return serveStatic(res, filePath);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Page Not Found');
});

function startServer(port = PORT) {
  admin.bootstrap();
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`🎰 SpinKit RGS running at http://localhost:${port}`);
      console.log(`   Lobby  http://localhost:${port}/   Admin  http://localhost:${port}/admin   API docs  http://localhost:${port}/docs`);
      resolve(server);
    });
  });
}

if (require.main === module) startServer();

module.exports = { server, startServer, router };
