import fs from 'fs';
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

db.videos.push({
  id: "test_" + Date.now(),
  targetUserId: db.users[0].id,
  sourceUrl: "https://www.youtube.com/watch?v=BaW_jenozKc", // standard small video
  title: "Test Download Video",
  description: "Test",
  thumbnailUrl: "",
  status: "queued",
  progress: 0,
  retryCount: 0,
  maxRetries: 3,
  queuedAt: new Date().toISOString(),
  privacyStatus: "private",
  tags: ["test"],
  isRewritten: false,
  autoOptimizeSeo: false
});

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
