import { AppState } from './db/db';

const API_BASE = '/api';

export async function fetchState(): Promise<AppState> {
  const res = await fetch(`${API_BASE}/state`);
  return res.json();
}

export async function getAuthUrl(): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/auth/url`);
  return res.json();
}

export async function exchangeAuthCode(code: string): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  return res.json();
}

export async function createRule(rule: any): Promise<any> {
  const res = await fetch(`${API_BASE}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule)
  });
  return res.json();
}

export async function updateRule(id: string, rule: any): Promise<any> {
  const res = await fetch(`${API_BASE}/rules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule)
  });
  return res.json();
}

export async function deleteRule(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/rules/${id}`, {
    method: 'DELETE'
  });
  return res.json();
}

export async function updateSettings(settings: any): Promise<any> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  return res.json();
}

export async function optimizeVideo(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/videos/${id}/optimize`, {
    method: 'POST'
  });
  return res.json();
}

export async function runRule(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/rules/${id}/run`, {
    method: 'POST'
  });
  return res.json();
}

export async function addManualVideo(videoData: any): Promise<any> {
  const res = await fetch(`${API_BASE}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(videoData)
  });
  return res.json();
}

