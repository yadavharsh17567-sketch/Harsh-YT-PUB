import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import { getDb, saveDb, addLog, isVideoAlreadyProcessed } from './src/db/db.js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { exec } from 'child_process';
import util from 'util';
import youtubedl from 'youtube-dl-exec';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execPromise = util.promisify(exec);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// YouTube OAuth Setup
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const REDIRECT_URI = `${APP_URL}/api/auth/callback`;

function getOAuth2Client(req?: express.Request) {
  const db = getDb();
  const clientId = db.settings.googleClientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = db.settings.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
  
  // Dynamically determine redirect URI based on request if available
  let redirectUri = `${process.env.APP_URL || `http://localhost:${PORT}`}/api/auth/callback`;
  if (req) {
    let protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    if (host && host.includes('.run.app')) {
      protocol = 'https';
    }
    redirectUri = `${protocol}://${host}/api/auth/callback`;
  }
  
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}

// Routes
app.get('/api/auth/url', (req, res) => {
  try {
    const oauth2Client = getOAuth2Client(req);
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    });
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).send('No code provided');
    }
    const oauth2Client = getOAuth2Client(req);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    // Try to get YouTube channel info
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    let channelTitle = '';
    let channelThumbnail = '';
    try {
      const channelResponse = await youtube.channels.list({
        part: ['snippet'],
        mine: true
      });
      if (channelResponse.data.items && channelResponse.data.items.length > 0) {
        channelTitle = channelResponse.data.items[0].snippet?.title || '';
        channelThumbnail = channelResponse.data.items[0].snippet?.thumbnails?.default?.url || '';
      }
    } catch (err) {
      console.error('Failed to get YouTube channel info', err);
    }
    
    const db = getDb();
    
    const existingUserIndex = db.users.findIndex(u => u.email === userInfo.data.email);
    const user = {
      id: userInfo.data.id || Date.now().toString(),
      name: channelTitle || userInfo.data.name || 'Unknown',
      email: userInfo.data.email || '',
      avatarUrl: channelThumbnail || userInfo.data.picture || '',
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || '',
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : new Date().toISOString()
    };

    if (existingUserIndex >= 0) {
      db.users[existingUserIndex] = { ...db.users[existingUserIndex], ...user };
    } else {
      db.users.push(user);
    }
    
    saveDb(db);
    addLog('success', `Linked YouTube Account: ${user.name}`);
    
    res.send(`
      <html>
        <body>
          <script>
            window.opener.location.reload();
            window.close();
          </script>
          <p>Authentication successful! You can close this window.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    addLog('error', `OAuth Callback Failed: ${error.message}`);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

app.get('/api/state', (req, res) => {
  res.json(getDb());
});

app.post('/api/rules', (req, res) => {
  const db = getDb();
  const rule = { ...req.body, id: Date.now().toString(), lastCheckedAt: null };
  db.scheduleRules.push(rule);
  saveDb(db);
  addLog('success', `Created new auto-publish rule: ${rule.name}`);
  res.json(rule);
});

app.put('/api/rules/:id', (req, res) => {
  const db = getDb();
  const idx = db.scheduleRules.findIndex(r => r.id === req.params.id);
  if (idx >= 0) {
    db.scheduleRules[idx] = { ...db.scheduleRules[idx], ...req.body };
    saveDb(db);
    addLog('info', `Updated auto-publish rule: ${db.scheduleRules[idx].name}`);
    res.json(db.scheduleRules[idx]);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.delete('/api/rules/:id', (req, res) => {
  const db = getDb();
  const idx = db.scheduleRules.findIndex(r => r.id === req.params.id);
  if (idx >= 0) {
    const name = db.scheduleRules[idx].name;
    db.scheduleRules.splice(idx, 1);
    saveDb(db);
    addLog('info', `Deleted auto-publish rule: ${name}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.post('/api/settings', (req, res) => {
  const db = getDb();
  db.settings = { ...db.settings, ...req.body };
  saveDb(db);
  addLog('info', 'Updated system settings');
  res.json(db.settings);
});

// Gemini SEO Optimization
app.post('/api/videos/:id/optimize', async (req, res) => {
  const db = getDb();
  const video = db.videos.find(v => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  
  if (!db.settings.geminiApiKey) {
    return res.status(400).json({ error: 'Gemini API Key is not configured.' });
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey: db.settings.geminiApiKey });
    const prompt = `Act as an expert YouTube SEO optimizer. 
Given this video title: "${video.title}"
And this description: "${video.description}"
Rewrite the title to be highly engaging and click-worthy for a YouTube Short.
Rewrite the description to be optimized for search, adding strong keywords.
Also predict the Click-Through Rate (CTR, out of 100) and provide a score.
Suggest 5-10 tags.
Respond ONLY in JSON format:
{
  "newTitle": "...",
  "newDescription": "...",
  "cpsScore": 85,
  "predictedCtr": 8.5,
  "tagsSuggestions": ["tag1", "tag2"]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });
    
    const resultText = response.text || "{}";
    const result = JSON.parse(resultText);
    
    video.title = result.newTitle || video.title;
    video.description = result.newDescription || video.description;
    video.cpsPrediction = {
      score: result.cpsScore || 80,
      ctr: result.predictedCtr || 8.0,
      tagsSuggestions: result.tagsSuggestions || []
    };
    video.isRewritten = true;
    
    saveDb(db);
    addLog('success', `Optimized video SEO: ${video.title}`, { score: video.cpsPrediction.score });
    res.json(video);
  } catch (error: any) {
    addLog('error', `SEO optimization failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Background processor mock integration
// In a real app we would use youtube-dl and googleapis to download/upload
// For this applet, since downloading real YT videos in this container might have rate limits or binary issues,
// We will simulate the downloading and uploading process for demonstration.
async function processVideo(video: any) {
  const db = getDb();
  const settings = db.settings;
  
  try {
    // 1. Prepare cookies if available
    let cookieArgs = {};
    const cookiePath = path.resolve(process.cwd(), `cookies_${video.id}.txt`);
    if (settings.youtubeCookies) {
      fs.writeFileSync(cookiePath, settings.youtubeCookies, 'utf8');
      cookieArgs = { cookies: cookiePath };
    }
    
    // Extractor args for PO Token
    let extractorArgs = '';
    if (settings.youtubePoToken || settings.youtubeVisitorData) {
      const parts = [];
      if (settings.youtubeVisitorData) parts.push(`visitor_data=${settings.youtubeVisitorData}`);
      if (settings.youtubePoToken) parts.push(`po_token=web+${settings.youtubePoToken}`);
      extractorArgs = `youtube:${parts.join(',')}`;
    }

    addLog('info', `Starting download for ${video.title}`);
    video.status = 'downloading';
    video.progress = 10;
    saveDb(getDb()); // reload db and save

    const outPath = path.resolve(process.cwd(), `tmp_${video.id}.mp4`);
    
    const dlArgs: any = {
      ...cookieArgs,
      noCheckCertificates: true,
      noWarnings: true,
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      output: outPath,
    };
    
    if (extractorArgs) {
      dlArgs.extractorArgs = extractorArgs;
    }

    await youtubedl(video.sourceUrl, dlArgs);
    
    let freshDb = getDb();
    let freshVideo = freshDb.videos.find(v => v.id === video.id);
    if(freshVideo) {
       freshVideo.status = 'downloaded';
       freshVideo.progress = 50;
       saveDb(freshDb);
    }
    
    addLog('success', `Downloaded ${video.title}, starting mock upload`);
    
    // Simulate upload (in a real app this would use googleapis and pipe the stream)
    await new Promise(r => setTimeout(r, 2000));
    
    freshDb = getDb();
    freshVideo = freshDb.videos.find(v => v.id === video.id);
    if(freshVideo) {
       freshVideo.status = 'uploading';
       freshVideo.progress = 80;
       saveDb(freshDb);
    }
    
    await new Promise(r => setTimeout(r, 2000));
    
    freshDb = getDb();
    freshVideo = freshDb.videos.find(v => v.id === video.id);
    if(freshVideo) {
       freshVideo.status = 'completed';
       freshVideo.progress = 100;
       freshVideo.completedAt = new Date().toISOString();
       if (!freshDb.processedVideoIds.includes(video.id)) {
         freshDb.processedVideoIds.push(video.id);
       }
       saveDb(freshDb);
    }
    addLog('success', `Completed pipeline for ${video.title}`);

    // cleanup
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    if (fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
    
  } catch (err) {
    addLog('error', `Processing failed for ${video.title}: ${err.message}`);
    let freshDb = getDb();
    let freshVideo = freshDb.videos.find(v => v.id === video.id);
    if(freshVideo) {
       freshVideo.status = 'failed';
       freshVideo.error = err.message;
       saveDb(freshDb);
    }
  }
}

let isProcessing = false;
setInterval(async () => {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const db = getDb();
    const queued = db.videos.find(v => v.status === 'queued');
    if (queued) {
      await processVideo(queued);
    }
  } finally {
    isProcessing = false;
  }
}, 5000);


// Vite integration
let vite: any;
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    addLog('info', 'System initialized and server started.');
  });
}

startServer();
