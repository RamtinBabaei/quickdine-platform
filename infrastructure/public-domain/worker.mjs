/** Dedicated public domain gateway. The application and its persistent records stay at the configured origin. */
export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    let origin;
    try {
      origin = new URL(env.SOURCE_ORIGIN);
      if (origin.protocol !== 'https:' || origin.username || origin.password) throw new Error('Invalid origin');
    } catch {
      return new Response('Service configuration unavailable', { status: 503 });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const provided = request.headers.get('Origin');
      if (provided && provided !== incoming.origin) {
        return new Response('Cross-origin requests are not allowed', { status: 403 });
      }
    }
    const target = new URL(incoming.pathname + incoming.search, origin.origin);
    const headers = new Headers(request.headers);
    headers.delete('Host');
    for (const key of Array.from(headers.keys())) {
      if (/^(oai-authenticated-|x-openai-|x-oai-)/i.test(key)) headers.delete(key);
    }
    if (headers.has('Origin')) headers.set('Origin', origin.origin);
    const referer = headers.get('Referer');
    if (referer?.startsWith(incoming.origin + '/')) headers.set('Referer', origin.origin + referer.slice(incoming.origin.length));
    headers.set('X-Forwarded-Host', incoming.host);
    headers.set('X-Forwarded-Proto', 'https');
    const init = { method: request.method, headers, redirect: 'manual' };
    if (!['GET', 'HEAD'].includes(request.method)) init.body = request.body;
    try {
      const upstream = await fetch(target, init);
      const responseHeaders = new Headers(upstream.headers);
      const location = responseHeaders.get('Location');
      if (location) {
        const redirect = new URL(location, origin);
        if (redirect.origin === origin.origin) {
          responseHeaders.set('Location', incoming.origin + redirect.pathname + redirect.search + redirect.hash);
        }
      }
      // Keep the public response free of origin-specific infrastructure metadata.
      for (const key of Array.from(responseHeaders.keys())) {
        if (/^(x-openai-|x-oai-|x-powered-by)/i.test(key)) responseHeaders.delete(key);
      }
      responseHeaders.set('X-Content-Type-Options', 'nosniff');
      const cookies = upstream.headers.getSetCookie?.() ?? [];
      if (cookies.length) {
        responseHeaders.delete('Set-Cookie');
        for (const cookie of cookies) {
          if (/^(?:__cf_bm|_cfuvid|cf_clearance)=/.test(cookie)) continue;
          responseHeaders.append('Set-Cookie', cookie.replace(/;\s*domain=([^;]+)/ig, (full, domain) =>
            origin.hostname.toLowerCase() === domain.replace(/^\./, '').toLowerCase() || origin.hostname.toLowerCase().endsWith('.' + domain.replace(/^\./, '').toLowerCase()) ? '' : full));
        }
      }
      const response = new Response(request.method === 'HEAD' ? null : upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
      if (request.method !== 'HEAD' && responseHeaders.get('Content-Type')?.includes('text/html') && typeof HTMLRewriter !== 'undefined') {
        const rewrite = { element(element) {
          for (const attr of ['href', 'src', 'action', 'content']) {
            const value = element.getAttribute(attr);
            if (value?.startsWith(origin.origin + '/')) element.setAttribute(attr, incoming.origin + value.slice(origin.origin.length));
          }
        }};
        return new HTMLRewriter().on('a, link, script, form, meta', rewrite).transform(response);
      }
      return response;
    } catch {
      return new Response('The application is temporarily unavailable. Please retry.', {
        status: 502, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  },
};
