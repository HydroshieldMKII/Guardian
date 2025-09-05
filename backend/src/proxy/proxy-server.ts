import httpProxy from 'http-proxy';
import http from 'http';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables - try current directory first, then parent
const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '../.env')
];

for (const envPath of envPaths) {
  try {
    dotenv.config({ path: envPath });
    break;
  } catch (error) {
    // Continue trying next path
  }
}

const ip = process.env.PLEX_SERVER_IP;
const port = process.env.PLEX_SERVER_PORT;
const token = process.env.PLEX_TOKEN;
const proxyPort = process.env.PLEXGUARD_PROXY_PORT || '8080';
const useSSL = process.env.USE_SSL === 'true';

if (!ip || !port || !token) {
  throw new Error(
    'Missing required environment variables: PLEX_SERVER_IP, PLEX_SERVER_PORT, PLEX_TOKEN',
  );
}

const target = `${useSSL ? 'https' : 'http'}://${ip}:${port}`;

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  secure: false, // Ignore self signed SSL cert errors for Plex
});

http
  .createServer((req, res) => {
    // Basic check to prevent misconfiguration - only allow requests from localhost
    const clientIP = req.socket.remoteAddress;
    const isLocalhost = clientIP === '127.0.0.1' || clientIP === '::1';
    
    if (!isLocalhost) {
      console.log(`Blocked proxy request from unknown IP: ${clientIP}`);
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden: Proxy only accessible from internal network');
      return;
    }

    const hasQuery = req.url?.includes('?');
    if (!req.url) req.url = '/';
    if (hasQuery) {
      req.url = `${req.url}&X-Plex-Token=${encodeURIComponent(token)}`;
    } else {
      req.url = `${req.url}?X-Plex-Token=${encodeURIComponent(token)}`;
    }

    proxy.web(req, res, { target });
  })
  .listen(parseInt(proxyPort, 10), 'localhost', () => {
    console.log(
      `Proxy server running on http://localhost:${proxyPort} -> ${target}`,
    );
  });
