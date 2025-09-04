import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

const proxyPort = process.env.PLEXGUARD_PROXY_PORT || '8080';

async function getActiveSessions() {
  // Build the proxy URL
  const proxyUrl = `http://localhost:${proxyPort}/status/sessions`;
  console.log(`Fetching sessions from proxy: ${proxyUrl}`);
  
  try {
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Plex-Client-Identifier': 'plex-guard'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    return data;
  } catch (error: any) {
    throw error;
  }
}

export { getActiveSessions };