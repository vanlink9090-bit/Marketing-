const cfg = window.APP_CONFIG;
const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

async function callFunction(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-secret': cfg.APP_SECRET },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// --- Gmail connection ---

async function refreshStatus() {
  const el = document.getElementById('gmailStatus');
  const connectArea = document.getElementById('connectArea');
  try {
    const { connected, email } = await callFunction(cfg.FUNCTIONS.oauthStatus, { method: 'GET' });
    if (connected) {
      el.textContent = `Gmail connected (${email})`;
      el.className = 'pill connected';
      connectArea.innerHTML = '<span class="hint">Gmail is connected.</span><br><button class="secondary" onclick="connectGmail()">Reconnect Gmail</button>';
    } else {
      el.textContent = 'Gmail not connected';
      el.className = 'pill disconnected';
      connectArea.innerHTML = '<button onclick="connectGmail()">Connect Gmail</button>';
    }
  } catch (e) {
    el.textContent = 'Status check failed';
    el.className = 'pill disconnected';
    connectArea.innerHTML = '<button onclick="connectGmail()">Connect Gmail</button><div class="hint">Status check errored: ' + e.message + '</div>';
  }
}

function connectGmail() {
  const scope = encodeURIComponent(
    'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email'
  );
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(cfg.GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(cfg.GOOGLE_REDIRECT_URI)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  window.location.href = url;
}

// --- Contacts (direct to Supabase, no server involved) ---

const KNOWN = new Set(['name', 'email', 'school', 'business']);
function normalizeKey(k) { return String(k).trim().toLowerCase().replace(/\s+/g, '_'); }

async function uploadFile() {
  const input = document.getElementById('fileInput');
  const result = document.getElementById('uploadResult');
  if (!input.files.length) return (result.textContent = 'Choose a file first.');

  result.textContent = 'Reading file…';
  try {
    const buf = await input.files[0].arrayBuffer();
    const workbook = XLSX.read(buf, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) throw new Error('Spreadsheet is empty');

    const contacts = rows.map((row) => {
      const normalized = {};
      Object.entries(row).forEach(([k, v]) => (normalized[normalizeKey(k)] = v));
      const extra = {};
      Object.entries(normalized).forEach(([k, v]) => { if (!KNOWN.has(k)) extra[k] = v; });
      return {
        name: normalized.name || '',
        email: String(normalized.email || '').trim().toLowerCase(),
        school: normalized.school || '',
        business: normalized.business || '',
        extra,
      };
    }).filter((c) => c.email);

    if (!contacts.length) throw new Error('No rows had a usable "email" column');

    const { error } = await sb.from('contacts').upsert(contacts, { onConflict: 'email' });
    if (error) throw error;

    result.textContent = `Imported/updated ${contacts.length} contacts.`;
    loadContacts();
    loadStats();
  } catch (e) {
    result.textContent = 'Error: ' + e.message;
  }
}

async function exportContacts() {
  const { data, error } = await sb.from('contacts').select('*');
  if (error) return alert('Export failed: ' + error.message);

  const rows = data.map((c) => ({
    name: c.name, email: c.email, school: c.school, business: c.business,
    status: c.status, sent_at: c.sent_at, follow_up_count: c.follow_up_count,
    replied_at: c.replied_at, ...(c.extra || {}),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
  XLSX.writeFile(wb, 'contacts_export.xlsx');
}

async function deleteContact(id) {
  await sb.from('contacts').delete().eq('id', id);
  loadContacts();
  loadStats();
}

async function loadContacts() {
  const { data, error } = await sb.from('contacts').select('*').order('created_at', { ascending: false });
  if (error) return;
  document.getElementById('contactsBody').innerHTML = data.map((c) => `
    <tr>
      <td>${c.name || ''}</td>
      <td>${c.email}</td>
      <td>${c.school || ''}</td>
      <td><span class="badge b-${c.status}">${c.status}</span></td>
      <td>${c.follow_up_count || 0}</td>
      <td><button class="secondary" onclick="deleteContact('${c.id}')">Remove</button></td>
    </tr>
  `).join('');
}

async function loadStats() {
  const { data, error } = await sb.from('contacts').select('status, follow_up_count');
  if (error) return;
  const total = data.length;
  const sent = data.filter((c) => ['sent', 'replied'].includes(c.status)).length;
  const replied = data.filter((c) => c.status === 'replied').length;
  const followUpsSent = data.reduce((s, c) => s + (c.follow_up_count || 0), 0);
  const replyRate = sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0;

  document.getElementById('stats').innerHTML = `
    <div class="stat"><div class="n">${total}</div><div class="l">Total</div></div>
    <div class="stat"><div class="n">${sent}</div><div class="l">Emailed</div></div>
    <div class="stat"><div class="n">${replied}</div><div class="l">Replied</div></div>
    <div class="stat"><div class="n">${replyRate}%</div><div class="l">Reply rate</div></div>
    <div class="stat"><div class="n">${followUpsSent}</div><div class="l">Follow-ups sent</div></div>
  `;
}

// --- Campaign settings & sending (sending goes through an edge function) ---

async function loadSettings() {
  const { data } = await sb.from('campaign_settings').select('*').eq('id', 1).maybeSingle();
  if (!data) return;
  document.getElementById('subject').value = data.subject || '';
  document.getElementById('body').value = data.body || '';
  document.getElementById('fuSubject').value = data.follow_up_subject || '';
  document.getElementById('fuBody').value = data.follow_up_body || '';
  document.getElementById('followUpDays').value = data.follow_up_days ?? 3;
  document.getElementById('followUpDays2').value = data.follow_up_days_2 ?? 3;
  document.getElementById('maxFollowUps').value = data.max_follow_ups ?? 1;
}

async function saveSettings() {
  const payload = {
    id: 1,
    subject: document.getElementById('subject').value,
    body: document.getElementById('body').value,
    follow_up_subject: document.getElementById('fuSubject').value,
    follow_up_body: document.getElementById('fuBody').value,
    follow_up_days: parseInt(document.getElementById('followUpDays').value, 10) || 3,
    follow_up_days_2: parseInt(document.getElementById('followUpDays2').value, 10) || 3,
    max_follow_ups: parseInt(document.getElementById('maxFollowUps').value, 10) || 0,
  };
  await sb.from('campaign_settings').upsert(payload);
  document.getElementById('sendResult').textContent = 'Saved.';
}

async function sendCampaign() {
  const result = document.getElementById('sendResult');
  await saveSettings();
  result.textContent = 'Sending…';
  try {
    const r = await callFunction(cfg.FUNCTIONS.sendCampaign);
    result.textContent = `Sent ${r.sent} emails. ${r.failed ? r.failed + ' failed.' : ''}`;
    loadContacts();
    loadStats();
  } catch (e) {
    result.textContent = 'Error: ' + e.message;
  }
}

// --- boot ---
refreshStatus();
loadSettings();
loadContacts();
loadStats();
setInterval(() => { loadContacts(); loadStats(); refreshStatus(); }, 30000);
    
