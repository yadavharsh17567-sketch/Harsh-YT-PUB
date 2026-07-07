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

// ===== Simple App Authentication =====
const APP_USERNAME = process.env.APP_USERNAME || "";
const APP_PASSWORD = process.env.APP_PASSWORD || "";

function requireAppAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = req.headers["x-app-username"];
  const pass = req.headers["x-app-password"];

  if (user === APP_USERNAME && pass === APP_PASSWORD) {
    return next();
  }
  return res.status(401).json({ error: "Authentication required" });
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === APP_USERNAME && password === APP_PASSWORD) {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, error: "Invalid credentials" });
});

app.get("/api/auth/status", (_req, res) => {
  res.json({ configured: !!APP_USERNAME && !!APP_PASSWORD });
});

app.post("/api/logout", (_req, res) => {
  res.json({ success: true });
});
// ===== End Authentication =====



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
        freshVideo.title = video.title;
        freshVideo.description = video.description;
        freshVideo.tags = video.tags;
        freshVideo.needsMetadataFetch = false;
        saveDb(freshDb);
      }
      addLog('success', `Fetched real metadata: "${video.title}"`);
    } catch (metaErr: any) {
      addLog('error', `Failed to fetch metadata for ${video.sourceUrl}: ${metaErr.message}`);
      // If we can't get metadata, we can't really process it well, but we'll try to continue if it's not a simulation
      video.needsMetadataFetch = false;
    }
  }

  // Refresh DB reference
  db = getDb();
  
  // 1. Auto-optimize SEO if enabled and not already optimized
  if (video.autoOptimizeSeo && !video.isRewritten) {
    addLog('info', `Auto-optimizing SEO using AI for "${video.title}" before download and upload.`);
    try {
      const geminiApiKey = (db.settings.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
      const openaiApiKey = (db.settings.openaiApiKey || process.env.OPENAI_API_KEY || '').trim();

      if (!geminiApiKey && !openaiApiKey) {
        addLog('warn', `Auto-optimization skipped: No API keys configured in settings.`);
        return;
      }

      const prompt = `Act as an expert YouTube SEO optimizer and viral growth strategist.
Given the following original video title and description:
Title: "${video.title}"
Description: "${video.description}"

Your goal is to generate a highly engaging, click-worthy, and SEO-optimized title and description specifically tailored for a YouTube Short.
1. The newTitle MUST be highly engaging, punchy, and SIMILAR to the original concept but NOT identical. It should be optimized for maximum YouTube search and viral click-through rates (CTR).
2. The newDescription should be a comprehensive, keyword-dense description optimized for search algorithms. It MUST feature multiple relevant hashtags (e.g. #Shorts #Viral #YouTube), compelling copy, and clear calls-to-action.
3. Suggest 5-10 highly relevant high-traffic tags.
4. Predict the click-through rate (CTR, out of 100) and provide a performance score (0-100).

Respond ONLY in JSON format:
{
  "newTitle": "...",
  "newDescription": "...",
  "cpsScore": 85,
  "predictedCtr": 8.5,
  "tagsSuggestions": ["tag1", "tag2"]
}
If the provided title is generic (like "YouTube Video ID"), use your best judgment based on any keywords in the description or common high-performing Short patterns.`;

      let result: any = null;
      let lastError = "";

      // Try Gemini first
      if (geminiApiKey) {
        if (!geminiApiKey.startsWith('AIzaSy')) {
          addLog('warn', `Gemini API key found but does not start with expected prefix "AIzaSy". Found: ${geminiApiKey.substring(0, 4)}...`);
        }
        try {
          const ai = new GoogleGenAI({ 
            apiKey: geminiApiKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
          });
          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
          });
          const resultText = response.text || "{}";
          result = JSON.parse(resultText);
          addLog('info', 'SEO optimization completed successfully using Gemini.');
        } catch (geminiErr: any) {
          lastError = `Gemini Error: ${geminiErr.message}`;
          addLog('warn', `Gemini optimization failed: ${geminiErr.message}`);
        }
      }

      // Try OpenAI fallback or primary
      if (!result && openaiApiKey) {
        if (!openaiApiKey.startsWith('sk-')) {
          addLog('warn', `OpenAI API key found but does not start with expected prefix "sk-". Found: ${openaiApiKey.substring(0, 3)}...`);
        }
        try {
          const openai = new OpenAI({ apiKey: openaiApiKey });
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a YouTube SEO expert." },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
          });
          const resultText = completion.choices[0].message.content || "{}";
          result = JSON.parse(resultText);
          addLog('info', 'SEO optimization completed successfully using OpenAI GPT.');
        } catch (openaiErr: any) {
          lastError = lastError ? `${lastError} | OpenAI Error: ${openaiErr.message}` : `OpenAI Error: ${openaiErr.message}`;
          addLog('error', `OpenAI optimization failed: ${openaiErr.message}`);
        }
      }

      if (result) {
        let freshDb = getDb();
        let freshVideo = freshDb.videos.find(v => v.id === video.id);
        if (freshVideo) {
          freshVideo.title = result.newTitle || freshVideo.title;
          freshVideo.description = result.newDescription || freshVideo.description;
          freshVideo.cpsPrediction = {
            score: result.cpsScore || 80,
            ctr: result.predictedCtr || 8.0,
            tagsSuggestions: result.tagsSuggestions || []
          };
          if (result.tagsSuggestions) {
            freshVideo.tags = Array.from(new Set([...(freshVideo.tags || []), ...result.tagsSuggestions]));
          }
          freshVideo.isRewritten = true;
          saveDb(freshDb);
          
          // Sync current function parameter scope
          video.title = freshVideo.title;
          video.description = freshVideo.description;
          video.tags = freshVideo.tags;
          video.isRewritten = true;
          
          addLog('success', `AI SEO optimized title: "${video.title}"`, { score: freshVideo.cpsPrediction.score });
        }
      } else {
        addLog('warn', `Auto-optimization skipped: ${lastError || "No valid API keys found in settings or environment."}`);
      }
    } catch (seoErr: any) {
      addLog('error', `Auto SEO optimization failed for "${video.title}": ${seoErr.message}`);
    }
  }

  db = getDb();
  const settings = db.settings;
  const targetUser = db.users.find(u => u.id === video.targetUserId);
  if (!targetUser) {
    throw new Error(`Target YouTube channel not found for ID: ${video.targetUserId}`);
  }

  const isMockToken = !targetUser.accessToken || targetUser.accessToken.startsWith('mock_');
  
  if (isMockToken) {
    addLog('warn', `Simulated Channel detected for "${targetUser.name}". Real upload is disabled for mock accounts.`);
    // We'll mark it as failed or complete simulation if you want, but user wants real.
    throw new Error('Real upload requires a connected YouTube account (not a mock account).');
  }

  const cookiePath = path.resolve(process.cwd(), `cookies_${video.id}.txt`);
  const outPath = path.resolve(process.cwd(), `tmp_${video.id}.mp4`);

  try {
    // --- REAL PIPELINE PATHWAY ---
    addLog('info', `Starting real download for video: "${video.title}" using local yt-dlp`);

    let downloadSucceeded = true;

    // Prepare cookies if available
    if (settings.youtubeCookies) {
      const formattedCookies = settings.youtubeCookies
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r');
      fs.writeFileSync(cookiePath, formattedCookies, 'utf8');
    }

    // Update status to 'downloading'
    let freshDb = getDb();
    let freshVideo = freshDb.videos.find(v => v.id === video.id);
    if (freshVideo) {
      freshVideo.status = 'downloading';
      freshVideo.progress = 15;
      saveDb(freshDb);
    }

    // Execute real yt-dlp download
    try {
      const dlArgsArr: string[] = [];
      if (settings.youtubeCookies) {
        dlArgsArr.push('--cookies', cookiePath);
      }
      if (settings.youtubePoToken || settings.youtubeVisitorData) {
        const parts = [];
        if (settings.youtubeVisitorData) parts.push(`visitor_data=${settings.youtubeVisitorData}`);
        if (settings.youtubePoToken) parts.push(`po_token=web+${settings.youtubePoToken}`);
        dlArgsArr.push('--extractor-args', `youtube:${parts.join(',')}`);
      }
      dlArgsArr.push('--no-check-certificates');
      dlArgsArr.push('--no-warnings');
      dlArgsArr.push('--js-runtimes', 'node');
      dlArgsArr.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
      dlArgsArr.push('-o', outPath);
      dlArgsArr.push(video.sourceUrl);

      addLog('info', `Executing local yt-dlp binary for download: ${video.title}`);
      
      const ytDlpPath = path.resolve(process.cwd(), 'node_modules/youtube-dl-exec/bin/yt-dlp');
      const dlPromise = execFilePromise(ytDlpPath, dlArgsArr);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Download timeout (300s exceeded)')), 300000)
      );
      await Promise.race([dlPromise, timeoutPromise]);

      if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
        throw new Error('Downloaded file is empty or does not exist on disk.');
      }
      addLog('success', `Successfully downloaded "${video.title}" video file.`);
    } catch (ytErr: any) {
      downloadSucceeded = false;
      const errorMsg = ytErr.message || String(ytErr);
      addLog('error', `Download failed: ${errorMsg}`);
      throw new Error(`Could not download video. YouTube might be blocking the request or the URL is invalid. Error: ${errorMsg}`);
    }

    // Update status to 'downloaded' (Processing)
    freshDb = getDb();
    freshVideo = freshDb.videos.find(v => v.id === video.id);
    if (freshVideo) {
      freshVideo.status = 'downloaded';
      freshVideo.progress = 50;
      saveDb(freshDb);
    }

    // Update status to 'uploading'
    freshDb = getDb();
    freshVideo = freshDb.videos.find(v => v.id === video.id);
    if (freshVideo) {
      freshVideo.status = 'uploading';
      freshVideo.progress = 75;
      saveDb(freshDb);
    }

    addLog('info', `Starting Real YouTube API upload to channel "${targetUser.name}"`);

    // Real YouTube API upload
    const oauth2Client = getOAuth2Client();

    // Set up automatically listening to refreshed tokens
    oauth2Client.on('tokens', (tokens) => {
      if (tokens.access_token) {
        const freshDb = getDb();
        const u = freshDb.users.find(usr => usr.id === targetUser.id);
        if (u) {
          u.accessToken = tokens.access_token;
          if (tokens.expiry_date) {
            u.tokenExpiry = new Date(tokens.expiry_date).toISOString();
          }
          if (tokens.refresh_token) {
            u.refreshToken = tokens.refresh_token;
          }
          saveDb(freshDb);
          addLog('info', `Saved auto-refreshed OAuth token for user: ${targetUser.name}`);
        }
      }
    });

    oauth2Client.setCredentials({
      access_token: targetUser.accessToken,
      refresh_token: targetUser.refreshToken,
      expiry_date: targetUser.tokenExpiry ? new Date(targetUser.tokenExpiry).getTime() : undefined
    });

    // Explicitly check and refresh OAuth token before media upload starts
    const isExpired = !targetUser.tokenExpiry || new Date(targetUser.tokenExpiry).getTime() <= Date.now() + 5 * 60 * 1000;
    if (isExpired && targetUser.refreshToken) {
      addLog('info', `OAuth token is expired or near expiry for "${targetUser.name}". Refreshing before upload...`);
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        if (credentials.access_token) {
          targetUser.accessToken = credentials.access_token;
          targetUser.tokenExpiry = credentials.expiry_date 
            ? new Date(credentials.expiry_date).toISOString() 
            : new Date(Date.now() + 3600 * 1000).toISOString();
          if (credentials.refresh_token) {
            targetUser.refreshToken = credentials.refresh_token;
          }
          
          // Save refreshed token to DB
          const freshDbForUser = getDb();
          const u = freshDbForUser.users.find(usr => usr.id === targetUser.id);
          if (u) {
            u.accessToken = targetUser.accessToken;
            u.tokenExpiry = targetUser.tokenExpiry;
            if (credentials.refresh_token) {
              u.refreshToken = credentials.refresh_token;
            }
            saveDb(freshDbForUser);
          }
          addLog('success', `OAuth token successfully refreshed for "${targetUser.name}"`);
          
          oauth2Client.setCredentials({
            access_token: targetUser.accessToken,
            refresh_token: targetUser.refreshToken,
            expiry_date: credentials.expiry_date
          });
        }
      } catch (refreshErr: any) {
        let errMsg = refreshErr.message || refreshErr;
        if (errMsg.toLowerCase().includes('invalid_grant')) {
          errMsg = 'Invalid Grant (Refresh token revoked or expired). Please disconnect and reconnect your YouTube channel.';
        }
        addLog('error', `Failed to refresh OAuth token for "${targetUser.name}": ${errMsg}`);
        throw new Error(`Authentication refresh failed: ${errMsg}. Please disconnect and reconnect your YouTube channel.`);
      }
    }

    // Final security check
    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1024) {
      throw new Error('Video file on disk is invalid or too small. Aborting upload to prevent YouTube corruption error.');
    }

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    let resUpload;
    try {
      resUpload = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: video.title.slice(0, 100),
            description: video.description || '',
            tags: video.tags || [],
            categoryId: '22', // People & Blogs
          },
          status: {
            privacyStatus: video.privacyStatus || 'private',
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(outPath),
        },
      }, {
        timeout: 600000, // 10 minutes timeout for upload
        retry: true,
        retryConfig: {
          retry: 3,
          retryDelay: 1000,
          statusCodesToRetry: [[100, 199], [429, 429], [500, 599]],
          httpMethodsToRetry: ['POST'],
          onRetryAttempt: (err) => {
            addLog('warn', `Upload retry attempt due to error: ${err.message}`);
          }
        }
      });
    } catch (uploadErr: any) {
      const isAuthError = uploadErr.code === 401 || 
                          (uploadErr.message && (
                            uploadErr.message.toLowerCase().includes('invalid credentials') || 
                            uploadErr.message.toLowerCase().includes('auth') || 
                            uploadErr.message.toLowerCase().includes('token')
                          ));
      if (isAuthError && targetUser.refreshToken) {
        addLog('warn', `First upload attempt failed due to authorization. Force-refreshing token and retrying upload...`);
        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          if (credentials.access_token) {
            targetUser.accessToken = credentials.access_token;
            targetUser.tokenExpiry = credentials.expiry_date 
              ? new Date(credentials.expiry_date).toISOString() 
              : new Date(Date.now() + 3600 * 1000).toISOString();
            if (credentials.refresh_token) {
              targetUser.refreshToken = credentials.refresh_token;
            }
            
            // Save refreshed token to DB
            const freshDbForUser = getDb();
            const u = freshDbForUser.users.find(usr => usr.id === targetUser.id);
            if (u) {
              u.accessToken = targetUser.accessToken;
              u.tokenExpiry = targetUser.tokenExpiry;
              if (credentials.refresh_token) {
                u.refreshToken = credentials.refresh_token;
              }
              saveDb(freshDbForUser);
            }
            
            oauth2Client.setCredentials({
              access_token: targetUser.accessToken,
              refresh_token: targetUser.refreshToken,
              expiry_date: credentials.expiry_date
            });
            
            // Retry upload with fresh read stream
            resUpload = await youtube.videos.insert({
              part: ['snippet', 'status'],
              requestBody: {
                snippet: {
                  title: video.title.slice(0, 100),
                  description: video.description || '',
                  tags: video.tags || [],
                  categoryId: '22',
                },
                status: {
                  privacyStatus: video.privacyStatus || 'private',
                  selfDeclaredMadeForKids: false,
                },
              },
              media: {
                body: fs.createReadStream(outPath),
              },
            }, {
              timeout: 600000, // 10 minutes
              retry: true
            });
          } else {
            throw uploadErr;
          }
        } catch (retryErr: any) {
          let retryMsg = retryErr.message || retryErr;
          if (retryMsg.toLowerCase().includes('invalid_grant')) {
            retryMsg = 'Invalid Grant (Refresh token revoked or expired). Please disconnect and reconnect your YouTube channel.';
          }
          addLog('error', `Retry upload failed: ${retryMsg}`);
          throw new Error(`Upload failed after token refresh retry: ${retryMsg}`);
        }
      } else {
        addLog('error', `Real YouTube Upload failed: ${uploadErr.message || uploadErr}`);
        throw uploadErr;
      }
    }

    const uploadedVideoId = resUpload.data.id;
    if (downloadSucceeded) {
      addLog('success', `Real Upload Successful! Published "${video.title}" on ${targetUser.name}. YouTube Video ID: ${uploadedVideoId}`, { youtubeId: uploadedVideoId });
    } else {
      addLog('success', `[Fallback Mode] Upload Successful with high-fidelity placeholder! Published "${video.title}" on ${targetUser.name}. YouTube Video ID: ${uploadedVideoId}. Update your cookies or PO tokens to restore real video downloads.`, { youtubeId: uploadedVideoId });
    }

    // Mark as completed
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

  } catch (err: any) {
    addLog('error', `Processing failed for ${video.title}: ${err.message}`);
    let freshDb = getDb();
    let freshVideo = freshDb.videos.find(v => v.id === video.id);
    if(freshVideo) {
       freshVideo.status = 'failed';
       freshVideo.error = err.message;
       saveDb(freshDb);
    }
  } finally {
    // cleanup temp files securely
    if (fs.existsSync(outPath)) {
      try { fs.unlinkSync(outPath); } catch {}
    }
    if (fs.existsSync(cookiePath)) {
      try { fs.unlinkSync(cookiePath); } catch {}
    }
  }
}

// Background scheduler rule runner
setInterval(async () => {
  try {
    const db = getDb();
    let changed = false;
    const now = new Date();

    for (const rule of db.scheduleRules) {
      if (!rule.enabled) continue;

      const lastChecked = rule.lastCheckedAt ? new Date(rule.lastCheckedAt) : new Date(0);
      const diffMs = now.getTime() - lastChecked.getTime();
      const diffMins = diffMs / (1000 * 60);

      // Run immediately if never checked, or if interval minutes elapsed
      if (!rule.lastCheckedAt || diffMins >= rule.intervalMinutes) {
        rule.lastCheckedAt = now.toISOString();
        changed = true;

        addLog('info', `Interval reached for rule "${rule.name}". Checking for new videos...`);
        
        try {
          const sourceUrl = await fetchLatestVideoUrl(rule.sourceChannelUrl, db.settings);
          if (sourceUrl) {
            const videoId = sourceUrl.split('v=')[1] || Math.random().toString(36).substring(2, 7);
            const titlePrefix = rule.titlePrefix ? rule.titlePrefix + ' ' : '';
            const titleSuffix = rule.titleSuffix ? ' ' + rule.titleSuffix : '';
            const title = `${titlePrefix}Auto Fetched Video ${videoId}${titleSuffix}`.trim();
            const description = `${rule.descriptionTemplate || 'Auto fetched description.'}\n\nProcessed by Nexus Scheduler Rule: ${rule.name}`;

            if (!isVideoAlreadyProcessed(sourceUrl, title)) {
              const newVideo = {
                id: 'auto_' + Date.now() + '_' + videoId,
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
              addLog('success', `Scheduler rule "${rule.name}" found a NEW video: ${sourceUrl}`, { videoTitle: title });
            } else {
              addLog('info', `No new videos found for rule "${rule.name}" since last check.`);
            }
          } else {
            addLog('warn', `Scheduler rule "${rule.name}" could not find any videos at ${rule.sourceChannelUrl}`);
          }
        } catch (fetchErr: any) {
          addLog('error', `Rule "${rule.name}" auto-fetch failed: ${fetchErr.message}`);
        }
      }
    }

    if (changed) {
      saveDb(db);
    }
  } catch (err: any) {
    console.error('Error running scheduler:', err);
  }
}, 12000); // Check rules every 12 seconds

let isProcessing = false;
setInterval(async () => {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const db = getDb();
    const queuedVideos = db.videos.filter(v => v.status === 'queued');
    // Sort ascending by queuedAt (FIFO: oldest first)
    queuedVideos.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());
    const queued = queuedVideos[0];
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    addLog('info', 'System initialized and server started.');
  });
}

startServer();
