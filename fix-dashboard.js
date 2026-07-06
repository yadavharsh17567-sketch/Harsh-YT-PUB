import fs from 'fs';

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// 1. Filter videos based on selected user
const activeVideosLine = "const activeVideos = state.videos.filter(v => ['queued', 'downloading', 'downloaded', 'uploading'].includes(v.status));";
content = content.replace(activeVideosLine, `
  const activeVideos = state.videos.filter(v => 
    ['queued', 'downloading', 'downloaded', 'uploading'].includes(v.status) &&
    (selectedUserId === '' || v.targetUserId === selectedUserId)
  );

  const handleDeleteChannel = async () => {
    if (!connectedUser) return;
    if (confirm(\`Are you sure you want to disconnect \${connectedUser.name}?\`)) {
      try {
        await fetch('/api/users/' + connectedUser.id, { method: 'DELETE' });
        window.location.reload();
      } catch (err) {
        console.error(err);
      }
    }
  };
`);

// 2. Add 'All Channels' to dropdown and delete button
const selectDropdown = `
                  <select 
                    value={connectedUser?.id}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  >
                    {state.users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
`;

content = content.replace(selectDropdown, `
                  <select 
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  >
                    <option value="">All Channels</option>
                    {state.users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
`);

// Also change the header of connectedUser
const headerTitle = `<h2 className="text-lg font-bold text-white">{connectedUser?.name}</h2>`;
content = content.replace(headerTitle, `<h2 className="text-lg font-bold text-white">{selectedUserId === "" ? "All Channels" : connectedUser?.name}</h2>`);

// Add Delete button
const addChannelBtn = `<Plus className="w-4 h-4" /> Add Channel
          </button>`;

content = content.replace(addChannelBtn, `<Plus className="w-4 h-4" /> Add Channel
          </button>
          {selectedUserId !== "" && (
            <button 
              onClick={handleDeleteChannel}
              className="whitespace-nowrap px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 font-medium rounded hover:bg-red-500/20 transition-colors flex items-center gap-2 text-sm"
            >
              Disconnect
            </button>
          )}`);


fs.writeFileSync('src/components/Dashboard.tsx', content, 'utf8');
console.log('Fixed Dashboard.tsx');
