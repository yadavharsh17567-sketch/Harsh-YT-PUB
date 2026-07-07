import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import { getDb, saveDb, addLog, isVideoAlreadyProcessed } from './src/db/db.js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { exec, execFile } from 'child_process';
import util from 'util';
import youtubedl from 'youtube-dl-exec';

dotenv.config();

let __filename = '';
let __dirname = '';

try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  // In CJS, these are globals
  __filename = (typeof __filename !== 'undefined') ? __filename : '';
  __dirname = (typeof __dirname !== 'undefined') ? __dirname : process.cwd();
}

const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(execFile);

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors());
app.use(express.json());

const authMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const token = req.headers['authorization'];
  const expectedToken = Buffer.from(`${process.env.APP_USERNAME}:${process.env.APP_PASSWORD}`).toString('base64');

  if (
    req.path === '/login' ||
    req.path === '/auth/status' ||
    req.path === '/auth/callback'
  ) {
    return next();
  }

  if (token === `Bearer ${expectedToken}`) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
};

// Apply auth middleware
app.use("/", authMiddleware);

// Auth Routes
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.APP_USERNAME && password === process.env.APP_PASSWORD) {
    const token = Buffer.from(`${username}:${password}`).toString('base64');
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/logout', (req, res) => {
  res.json({ success: true });
});

app.get('/auth/status', (req, res) => {
  const token = req.headers['authorization'];
  const expectedToken = Buffer.from(`${process.env.APP_USERNAME}:${process.env.APP_PASSWORD}`).toString('base64');
  
  if (token === `Bearer ${expectedToken}`) {
    res.json({ isAuthenticated: true });
  } else {
    res.json({ isAuthenticated: false });
  }
});

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
      prompt: 'consent select_account',
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

// Helper to fetch latest video URL from a channel
async function fetchLatestVideoUrl(channelUrl: string, settings?: any) {
  const ytDlpPath = path.resolve(process.cwd(), 'node_modules/youtube-dl-exec/bin/yt-dlp');
  let cookiePath = null;
  try {
    const args = ['--get-id', '--playlist-items', '1', '--no-warnings', '--no-check-certificates', '--js-runtimes', 'node'];
    if (settings) {
      cookiePath = prepareCookies(settings, `fetch_${Date.now()}`);
      if (cookiePath) args.push('--cookies', cookiePath);
      if (settings.youtubePoToken || settings.youtubeVisitorData) {
        const parts = [];
        if (settings.youtubeVisitorData) parts.push(`visitor_data=${settings.youtubeVisitorData}`);
        if (settings.youtubePoToken) parts.push(`po_token=web+${settings.youtubePoToken}`);
        args.push('--extractor-args', `youtube:${parts.join(',')}`);
      }
    }
    
    // Ensure we are looking at the /videos tab for latest content
    const targetUrl = channelUrl.includes('/videos') ? channelUrl : channelUrl.replace(/\/+$/, '') + '/videos';
    
    const { stdout } = await execFilePromise(ytDlpPath, [...args, targetUrl]);
    const videoId = stdout.trim();
    if (cookiePath && fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
    
    if (videoId) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return null;
  } catch (err: any) {
    if (cookiePath && fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
    console.error("Failed to fetch latest video ID:", err.message);
    return null;
  }
}

app.post('/api/rules/:id/run', async (req, res) => {
  try {
    const db = getDb();
    const rule = db.scheduleRules.find(r => r.id === req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    rule.lastCheckedAt = new Date().toISOString();
    let sourceUrl = req.body.sourceUrl;

    if (!sourceUrl) {
      addLog('info', `Rule "${rule.name}" is fetching latest video from ${rule.sourceChannelUrl}...`);
      sourceUrl = await fetchLatestVideoUrl(rule.sourceChannelUrl, db.settings);
    }

    if (!sourceUrl) {
      addLog('warn', `Rule "${rule.name}" failed to fetch a real video URL. Skipping.`);
      return res.json({ success: false, message: 'Could not find a video on the source channel.' });
    }

    const videoId = sourceUrl.split('v=')[1] || Math.random().toString(36).substring(2, 7);
    const titlePrefix = rule.titlePrefix ? rule.titlePrefix + ' ' : '';
    const titleSuffix = rule.titleSuffix ? ' ' + rule.titleSuffix : '';
    const title = req.body.sourceUrl ? `Processing: ${videoId}` : `${titlePrefix}Auto Fetched Video ${videoId}${titleSuffix}`.trim();
    const description = `${rule.descriptionTemplate || 'Auto fetched description.'}\n\nProcessed by Nexus Scheduler Rule: ${rule.name}`;

    if (!isVideoAlreadyProcessed(sourceUrl, title)) {
      const newVideo = {
        id: (req.body.sourceUrl ? 'real_' : 'auto_') + Date.now() + '_' + videoId,
        targetUserId: rule.targetUserId,
        sourceUrl: sourceUrl,
        title: title,
        description: description,
        thumbnailUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=300',
        status: 'queued' as const,
        progress: 0,
        retryCount: 0,
        maxRetries: db.settings.maxRetries || 3,
        queuedAt: new Date().toISOString(),
        privacyStatus: rule.privacyStatus || 'private',
        tags: rule.tags || [],
        scheduleRuleId: rule.id,
        isRewritten: false,
        autoOptimizeSeo: rule.autoOptimizeSeo || false,
        needsMetadataFetch: true
      };

      db.videos.push(newVideo);
      addLog('success', `Rule "${rule.name}" added real video to queue: ${sourceUrl}`, { videoTitle: title });
      saveDb(db);
      res.json({ success: true, video: newVideo });
    } else {
      res.json({ success: true, message: 'This video has already been processed.' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/videos', (req, res) => {
  try {
    const db = getDb();
    const { title, sourceUrl, targetUserId, privacyStatus, description, tags, autoOptimizeSeo } = req.body;

    if (!sourceUrl || !targetUserId) {
      return res.status(400).json({ error: 'Source URL and Target Channel are required' });
    }

    const hasCustomTitle = !!(title && title.trim());
    const videoTitle = hasCustomTitle ? title.trim() : 'Fetching Title...';
    const needsMetadataFetch = !hasCustomTitle;
    const shouldOptimize = needsMetadataFetch ? true : !!autoOptimizeSeo;

    const newVideo = {
      id: 'man_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      targetUserId,
      sourceUrl,
      title: videoTitle,
      description: description || (needsMetadataFetch ? 'Generating SEO description using AI...' : 'Manually added video.'),
      thumbnailUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=300',
      status: 'queued' as const,
      progress: 0,
      retryCount: 0,
      maxRetries: db.settings.maxRetries || 3,
      queuedAt: new Date().toISOString(),
      privacyStatus: privacyStatus || 'private',
      tags: tags || [],
      isRewritten: false,
      autoOptimizeSeo: shouldOptimize,
      needsMetadataFetch
    };

    db.videos.push(newVideo);
    addLog('success', needsMetadataFetch 
      ? `Manually added video to queue (Pending AI SEO Title generation from video)`
      : `Manually added video to queue: "${videoTitle}"`, 
      { videoTitle }
    );
    saveDb(db);
    res.json(newVideo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



app.post('/api/settings', (req, res) => {
  const db = getDb();
  db.settings = { ...db.settings, ...req.body };
  saveDb(db);
  addLog('info', 'Updated system settings');
  res.json(db.settings);
});

app.delete('/api/users/:id', (req, res) => {
  try {
    const db = getDb();
    const idx = db.users.findIndex(u => u.id === req.params.id);
    if (idx >= 0) {
      const userName = db.users[idx].name;
      db.users.splice(idx, 1);
      saveDb(db);
      addLog('success', `Disconnected YouTube account: ${userName}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Retry/Re-queue Video Endpoint
app.post('/api/videos/:id/retry', (req, res) => {
  try {
    const db = getDb();
    const video = db.videos.find(v => v.id === req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    video.status = 'queued';
    video.progress = 0;
    video.error = undefined;
    video.retryCount = (video.retryCount || 0) + 1;
    saveDb(db);
    addLog('info', `Manually triggered processing retry for: "${video.title}"`);
    res.json(video);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Video Endpoint
app.delete('/api/videos/:id', (req, res) => {
  try {
    const db = getDb();
    const idx = db.videos.findIndex(v => v.id === req.params.id);
    if (idx >= 0) {
      const title = db.videos[idx].title;
      db.videos.splice(idx, 1);
      saveDb(db);
      addLog('info', `Removed video from queue: "${title}"`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Video not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Gemini SEO Optimization
app.post('/api/videos/:id/optimize', async (req, res) => {
  const db = getDb();
  const video = db.videos.find(v => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  
  let apiKey = db.settings.geminiApiKey;
  if (!apiKey || !apiKey.startsWith('AIzaSy')) {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.startsWith('AIzaSy')) {
      apiKey = process.env.GEMINI_API_KEY;
    }
  }
  
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API Key is not configured. Please configure a valid API Key in Settings.' });
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey });
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
      model: 'gemini-3.5-flash',
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
    if (result.tagsSuggestions) {
      video.tags = Array.from(new Set([...(video.tags || []), ...result.tagsSuggestions]));
    }
    video.isRewritten = true;
    
    saveDb(db);
    addLog('success', `Optimized video SEO: ${video.title}`, { score: video.cpsPrediction.score });
    res.json(video);
  } catch (error: any) {
    addLog('error', `SEO optimization failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Helper to prepare cookies file
function prepareCookies(settings: any, id: string) {
  const cookiePath = path.resolve(process.cwd(), `cookies_${id}.txt`);
  if (settings.youtubeCookies) {
    const formattedCookies = settings.youtubeCookies
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r');
    fs.writeFileSync(cookiePath, formattedCookies, 'utf8');
    return cookiePath;
  }
  return null;
}

// Helper to fetch original video metadata from YouTube URL using yt-dlp -j
async function getOriginalVideoMetadata(url: string, settings?: any) {
  let cookiePath = null;
  const ytDlpPath = path.resolve(process.cwd(), 'node_modules/youtube-dl-exec/bin/yt-dlp');
  
  try {
    const args = ['-j', '--no-warnings', '--no-check-certificates', '--js-runtimes', 'node'];
    if (settings) {
      cookiePath = prepareCookies(settings, `meta_${Date.now()}`);
      if (cookiePath) {
        args.push('--cookies', cookiePath);
      }
      if (settings.youtubePoToken || settings.youtubeVisitorData) {
        const parts = [];
        if (settings.youtubeVisitorData) parts.push(`visitor_data=${settings.youtubeVisitorData}`);
        if (settings.youtubePoToken) parts.push(`po_token=web+${settings.youtubePoToken}`);
        args.push('--extractor-args', `youtube:${parts.join(',')}`);
      }
    }
    
    const { stdout } = await execFilePromise(ytDlpPath, [...args, url]);
    const data = JSON.parse(stdout);
    if (cookiePath && fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
    
    return {
      title: data.title || '',
      description: data.description || '',
      tags: data.tags || []
    };
  } catch (err: any) {
    if (cookiePath && fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
    console.error("Failed to get video metadata via yt-dlp -j:", err.message);
    throw err;
  }
}

// Background processor
async function processVideo(video: any) {
  let db = getDb();
  
  // 0. Fetch original video metadata from YouTube
  if (video.needsMetadataFetch) {
    addLog('info', `Fetching original video details for: ${video.sourceUrl}`);
    try {
      const metadata = await getOriginalVideoMetadata(video.sourceUrl, db.settings);
      video.title = metadata.title || video.title;
      video.description = metadata.description || video.description;
      if (metadata.tags && metadata.tags.length > 0) {
        video.tags = Array.from(new Set([...(video.tags || []), ...metadata.tags]));
      }
      video.needsMetadataFetch = false;

      // Sync to DB
      let freshDb = getDb();
      let freshVideo = freshDb.videos.find(v => v.id === video.id);
      if (freshVideo) {
        freshVideo.
