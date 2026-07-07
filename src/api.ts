import { AppState } from './db/db';

const API_BASE = '/api';

function getHeaders() {
  const token = localStorage.getItem('nexus_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export async function login(credentials: any): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  if (!res.ok) throw new Error('Invalid credentials');
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    headers: getHeaders()
  });
  localStorage.removeItem('nexus_auth_token');
}

export async function checkAuthStatus(): Promise<{ isAuthenticated: boolean }> {
  const res = await fetch(`${API_BASE}/auth/status`, {
    headers: getHeaders()
  });
  if (!res.ok) return { isAuthenticated: false };
  return res.json();
}

export async function fetchState(): Promise<AppState> {
  const res = await fetch(`${API_BASE}/state`, {
    headers: getHeaders()
  });
  if (res.status === 401) {
    localStorage.removeItem('nexus_auth_token');
    window.location.reload();
  }
  return res.json();
}

export async function getAuthUrl(): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/auth/url`, {
    headers: getHeaders()
  });
  return res.json();
}

export async function exchangeAuthCode(code: string): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/callback`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ code })
  });
  return res.json();
}

export async function createRule(rule: any): Promise<any> {
  const res = await fetch(`${API_BASE}/rules`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(rule)
  });
  return res.json();
}

export async function updateRule(id: string, rule: any): Promise<any> {
  const res = await fetch(`${API_BASE}/rules/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(rule)
  });
  return res.json();
}

export async function deleteRule(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/rules/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return res.json();
}

export async function updateSettings(settings: any): Promise<any> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(settings)
  });
  return res.json();
}

export async function optimizeVideo(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/videos/${id}/optimize`, {
    method: 'POST',
    headers: getHeaders()
  });
  return res.json();
}

export async function runRule(id: string, sourceUrl?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/rules/${id}/run`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ sourceUrl })
  });
  return res.json();
}

export async function addManualVideo(videoData: any): Promise<any> {
  const res = await fetch(`${API_BASE}/videos`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(videoData)
  });
  return res.json();
}

export async function retryVideo(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/videos/${id}/retry`, {
    method: 'POST',
    headers: getHeaders()
  });
  return res.json();
}

export async function deleteVideo(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/videos/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return res.json();
}
