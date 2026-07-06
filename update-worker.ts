import fs from 'fs';
import path from 'path';

let content = fs.readFileSync('server.ts', 'utf8');

const intervalStart = content.indexOf('setInterval(() => {');
const intervalEnd = content.indexOf('}, 3000);') + 9;

if (intervalStart !== -1 && intervalEnd !== -1) {
  content = content.slice(0, intervalStart) + `
import { exec } from 'child_process';
import util from 'util';
import youtubedl from 'youtube-dl-exec';

const execPromise = util.promisify(exec);

async function processVideo(video) {
  const db = getDb();
  const settings = db.settings;
  
  try {
    // 1. Prepare cookies if available
    let cookieArgs = {};
    const cookiePath = path.resolve(process.cwd(), \`cookies_\${video.id}.txt\`);
    if (settings.youtubeCookies) {
      fs.writeFileSync(cookiePath, settings.youtubeCookies, 'utf8');
      cookieArgs = { cookies: cookiePath };
    }
    
    // Extractor args for PO Token
    let extractorArgs = '';
    if (settings.youtubePoToken || settings.youtubeVisitorData) {
      const parts = [];
      if (settings.youtubeVisitorData) parts.push(\`visitor_data=\${settings.youtubeVisitorData}\`);
      if (settings.youtubePoToken) parts.push(\`po_token=web+\${settings.youtubePoToken}\`);
      extractorArgs = \`youtube:\${parts.join(',')}\`;
    }

    addLog('info', \`Starting download for \${video.title}\`);
    video.status = 'downloading';
    video.progress = 10;
    saveDb(getDb()); // reload db and save

    const outPath = path.resolve(process.cwd(), \`tmp_\${video.id}.mp4\`);
    
    const dlArgs = {
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
    
    addLog('success', \`Downloaded \${video.title}, starting mock upload\`);
    
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
    addLog('success', \`Completed pipeline for \${video.title}\`);

    // cleanup
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    if (fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
    
  } catch (err) {
    addLog('error', \`Processing failed for \${video.title}: \${err.message}\`);
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
` + content.slice(intervalEnd);
  
  fs.writeFileSync('server.ts', content, 'utf8');
  console.log('Success');
} else {
  console.log('Could not find setInterval block');
}
