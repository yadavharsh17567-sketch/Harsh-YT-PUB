import fs from 'fs';
import { google } from 'googleapis';

const dbPath = 'db.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const clientId = db.settings.googleClientId;
const clientSecret = db.settings.googleClientSecret;

async function run() {
  for (const user of db.users) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken
    });
    
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    try {
      const channelResponse = await youtube.channels.list({ part: ['snippet'], mine: true });
      if (channelResponse.data.items && channelResponse.data.items.length > 0) {
        user.name = channelResponse.data.items[0].snippet?.title || user.name;
        user.avatarUrl = channelResponse.data.items[0].snippet?.thumbnails?.default?.url || user.avatarUrl;
        console.log('Updated user:', user.name);
      } else {
        console.log('No channel found for:', user.name);
      }
    } catch (e) {
      console.log('Error for', user.name, e.message);
    }
  }
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

run();
