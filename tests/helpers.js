'use strict';
// Keep-alive HTTP client against one listening server. supertest(app) opens a new
// socket per request, which exhausts ephemeral ports under property/fuzz load.
const { createApp } = require('../src/server');

async function startApp() {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, contentType = 'application/json') => {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? {} : { 'content-type': contentType },
      body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: res.status, body: json, text };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b, ct) => call('POST', p, b, ct),
    close: () => { server.closeAllConnections(); return new Promise((r) => server.close(r)); },
  };
}
module.exports = { startApp };
