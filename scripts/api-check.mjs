// Live check of every Pushbullet endpoint Pushpilot uses, against the account
// in .env (ACCESS_TOKEN=…). Read-only unless --send is passed, which creates a
// note addressed to a Pushpilot-owned device and deletes it again.
//
//   node --env-file=.env scripts/api-check.mjs [--send]

const token = process.env.ACCESS_TOKEN;
if (!token) {
  console.error('Set ACCESS_TOKEN in .env first.');
  process.exit(1);
}
const API = 'https://api.pushbullet.com';
const send = process.argv.includes('--send');

async function call(path, init = {}) {
  const res = await fetch(API + path, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { 'Access-Token': token, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, ok: res.ok, json };
}

let failures = 0;
function report(name, r, summary) {
  const mark = r.ok ? 'ok ' : 'FAIL';
  if (!r.ok) failures++;
  console.log(
    `${mark} ${name.padEnd(34)} ${r.status}  ${r.ok ? (summary?.(r.json) ?? '') : JSON.stringify(r.json.error ?? r.json)}`,
  );
}

const me = await call('/v2/users/me');
report('GET /v2/users/me', me, (j) => `${j.name ?? ''} <${j.email}> pro=${!!j.pro} max_upload=${j.max_upload_size}`);
if (!me.ok) process.exit(1);

const devices = await call('/v2/devices?active=true');
report('GET /v2/devices', devices, (j) =>
  j.devices
    .map((d) => `${d.nickname ?? d.model}[${d.type}${d.has_sms ? ',sms' : ''}${d.pushable === false ? ',unpushable' : ''}]`)
    .join(', '),
);

const chats = await call('/v2/chats?active=true');
report('GET /v2/chats', chats, (j) => `${j.chats.length} people`);

const subs = await call('/v2/subscriptions?active=true');
report('GET /v2/subscriptions', subs, (j) => `${j.subscriptions.length} channels`);

const pushes = await call('/v2/pushes?active=true&limit=5');
report('GET /v2/pushes', pushes, (j) => j.pushes.map((p) => `${p.type}/${p.direction}`).join(', '));

for (const d of devices.json.devices?.filter((d) => d.has_sms) ?? []) {
  const threads = await call(`/v2/permanents/${d.iden}_threads`);
  report(`GET permanents ${d.nickname ?? d.iden} threads`, threads, (j) =>
    j.encrypted ? 'encrypted (needs E2E password)' : `${j.threads?.length ?? 0} threads`,
  );
}

if (send) {
  let self = devices.json.devices.find((d) => d.type === 'chrome' && d.active);
  if (!self) {
    const created = await call('/v2/devices', {
      body: { nickname: 'Chrome', type: 'chrome', model: 'Pushpilot', icon: 'browser' },
    });
    report('POST /v2/devices', created, (j) => j.iden);
    self = created.json;
  }
  const push = await call('/v2/pushes', {
    body: { type: 'note', title: 'Pushpilot API check', body: 'Safe to ignore; deleted right away.', device_iden: self.iden },
  });
  report('POST /v2/pushes (note → this browser)', push, (j) => j.iden);
  if (push.ok) {
    const dismissed = await call(`/v2/pushes/${push.json.iden}`, { body: { dismissed: true } });
    report('POST /v2/pushes/{iden} dismissed', dismissed, (j) => `dismissed=${j.dismissed}`);
    const del = await call(`/v2/pushes/${push.json.iden}`, { method: 'DELETE' });
    report('DELETE /v2/pushes/{iden}', del);
  }
  const upload = await call('/v2/upload-request', { body: { file_name: 'pushpilot-check.txt', file_type: 'text/plain' } });
  report('POST /v2/upload-request', upload, (j) => (j.upload_url ? 'upload_url issued' : JSON.stringify(j)));
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
