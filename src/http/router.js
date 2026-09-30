const { ApiError } = require('../services/errors');

/**
 * Tiny router: add(method, '/api/v2/players/:external_id', ...handlers).
 * A handler receives ctx and may return data (sent as 200 JSON), a { status, body }
 * object (legacy controllers) or nothing (if it wrote the response itself).
 * Middlewares are just handlers that return undefined and set fields on ctx.
 */
class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, ...handlers) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '\\/?$');
    this.routes.push({ method, re, keys, handlers, pattern });
    return this;
  }

  get(p, ...h) { return this.add('GET', p, ...h); }
  post(p, ...h) { return this.add('POST', p, ...h); }
  patch(p, ...h) { return this.add('PATCH', p, ...h); }
  delete(p, ...h) { return this.add('DELETE', p, ...h); }

  match(method, path) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = path.match(r.re);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }

  async handle(ctx) {
    const found = this.match(ctx.method, ctx.path);
    if (!found) return false;
    if (found.methodNotAllowed) throw new ApiError(405, 'METHOD_NOT_ALLOWED', `${ctx.method} is not allowed here`);
    ctx.params = found.params;
    let result;
    for (const h of found.route.handlers) {
      result = await h(ctx);
      if (ctx.res.writableEnded) return true;
    }
    if (result && typeof result === 'object' && 'status' in result && 'body' in result && typeof result.status === 'number') {
      ctx.send(result.status, result.body);
    } else {
      ctx.send(200, result === undefined ? { status: 'success' } : result);
    }
    return true;
  }
}

module.exports = { Router };
