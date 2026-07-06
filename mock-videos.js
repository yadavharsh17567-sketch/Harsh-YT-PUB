import fs from 'fs';
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

db.videos = [
  {
    id: "vid1",
    targetUserId: db.users[0].id,
    sourceUrl: "https://www.youtube.com/watch?v=mock1",
    title: "Awesome AI Tutorial Part 1",
    description: "Learn how to build AI agents...",
    thumbnailUrl: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=300",
    status: "downloading",
    progress: 45,
    retryCount: 0,
    maxRetries: 3,
    queuedAt: new Date().toISOString(),
    privacyStatus: "private",
    tags: ["AI", "Tutorial"],
    isRewritten: false,
    autoOptimizeSeo: false
  },
  {
    id: "vid2",
    targetUserId: db.users[0].id,
    sourceUrl: "https://www.youtube.com/watch?v=mock2",
    title: "Awesome AI Tutorial Part 2",
    description: "Learn how to build AI agents part 2...",
    thumbnailUrl: "https://images.unsplash.com/photo-1673847248186-064db9f2a089?q=80&w=300",
    status: "queued",
    progress: 0,
    retryCount: 0,
    maxRetries: 3,
    queuedAt: new Date().toISOString(),
    privacyStatus: "private",
    tags: ["AI", "Tutorial"],
    isRewritten: false,
    autoOptimizeSeo: false
  }
];

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
