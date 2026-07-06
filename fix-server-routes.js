import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes("app.delete('/api/users/:id'")) {
  const routes = "app.post('/api/videos',";
  content = content.replace(routes, `
app.delete('/api/users/:id', (req, res) => {
  const db = getDb();
  db.users = db.users.filter(u => u.id !== req.params.id);
  saveDb(db);
  addLog('success', \`Disconnected channel\`);
  res.json({ success: true });
});

` + routes);
  fs.writeFileSync('server.ts', content, 'utf8');
  console.log('Added delete user route');
}
