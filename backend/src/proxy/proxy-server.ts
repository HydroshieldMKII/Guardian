import httpProxy from 'http-proxy';
import http from 'http';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

const ip = process.env.PLEX_SERVER_IP;
const port = process.env.PLEX_SERVER_PORT;
const token = process.env.PLEX_TOKEN;
const proxyPort = process.env.PLEXGUARD_PROXY_PORT || '8080';

if (!ip || !port || !token) {
  throw new Error(
    'Missing required environment variables: PLEX_SERVER_IP, PLEX_SERVER_PORT, PLEX_TOKEN',
  );
}

const target = `https://${ip}:${port}`;

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  secure: false, // Ignore SSL cert errors for Plex
});

http
  .createServer((req, res) => {
    const hasQuery = req.url?.includes('?');
    if (!req.url) req.url = '/';
    if (hasQuery) {
      req.url = `${req.url}&X-Plex-Token=${encodeURIComponent(token)}`;
    } else {
      req.url = `${req.url}?X-Plex-Token=${encodeURIComponent(token)}`;
    }

    // console.log('Proxying:', req.url);
    proxy.web(req, res, { target });
  })
  .listen(proxyPort, () => {
    console.log(
      `Proxy server running on http://localhost:${proxyPort} -> ${target}`,
    );
  });
