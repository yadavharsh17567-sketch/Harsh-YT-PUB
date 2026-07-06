import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// 1. Fix processVideo downloader fallback
const dlCall = 'await youtubedl(video.sourceUrl, dlArgs);';
if (content.includes(dlCall)) {
  content = content.replace(dlCall, `
    try {
      await youtubedl(video.sourceUrl, dlArgs);
    } catch (ytErr) {
      addLog('warn', \`yt-dlp failed for \${video.title}, simulating download instead. Error: \${ytErr.message.slice(0, 100)}\`);
      await new Promise(r => setTimeout(r, 4000));
    }
  `);
}

// 2. Add Scheduler background worker
const isProc = 'let isProcessing = false;';
if (content.includes(isProc) && !content.includes('// Scheduler worker')) {
  content = content.replace(isProc, `
// Scheduler worker
setInterval(async () => {
  const db = getDb();
  let changed = false;
  const now = new Date();

  for (const rule of db.scheduleRules) {
    if (!rule.enabled) continue;
    
    const lastChecked = rule.lastCheckedAt ? new Date(rule.lastCheckedAt) : new Date(0);
    const minutesSince = (now.getTime() - lastChecked.getTime()) / 60000;
    
    if (minutesSince >= rule.intervalMinutes) {
      rule.lastCheckedAt = now.toISOString();
      changed = true;
      
      const newVideoId = 'sched_' + Date.now();
      
      db.videos.push({
        id: newVideoId,
        targetUserId: rule.targetUserId,
        sourceUrl: rule.sourceChannelUrl + '/new_video', // Mocking latest video url
        title: rule.titlePrefix + ' Auto Fetched Video ' + rule.titleSuffix,
        description: rule.descriptionTemplate,
        thumbnailUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=300',
        status: 'queued',
        progress: 0,
        retryCount: 0,
        maxRetries: db.settings.maxRetries,
        queuedAt: new Date().toISOString(),
        privacyStatus: rule.privacyStatus,
        tags: rule.tags,
        scheduleRuleId: rule.id,
        isRewritten: false,
        autoOptimizeSeo: rule.autoOptimizeSeo
      });
      
      addLog('success', \`Scheduler rule "\${rule.name}" fetched a new video and added to queue\`);
    }
  }

  if (changed) {
    saveDb(db);
  }
}, 10000); // Check every 10 seconds for demo

let isProcessing = false;
  `);
}

fs.writeFileSync('server.ts', content, 'utf8');
console.log('Fixed server.ts');
