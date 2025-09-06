import * as dotenv from 'dotenv';
import * as path from 'path';
import { PlexClient } from './plex-client';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

async function getActiveSessions() {
  console.log('Fetching sessions directly from Plex server...');
  
  try {
    const plexClient = new PlexClient();
    const data = await plexClient.getSessions();
    
    return data;
  } catch (error: any) {
    throw error;
  }
}

export { getActiveSessions };