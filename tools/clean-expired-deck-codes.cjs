const { join } = require('node:path');
const collection = 'shared_decks';
const documents = 'projects/home-page-d6c39/databases/(default)/documents';
const prefix = documents + '/' + collection + '/';
const lifetime = 72 * 60 * 60 * 1000;

async function clean(request, preview) {
  const base = { from: [{ collectionId: collection }], select: { fields: [{ fieldPath: 'issuedAt' }] } };
  const query = options => request('runQuery', { structuredQuery: { ...base, ...options } });
  // Anchor the entire run to Firestore's clock, rounding down conservatively.
  const probe = await query({ limit: 1 });
  const now = Date.parse(probe[0]?.readTime);
  if (!Number.isFinite(now)) throw Error('Missing Firestore server time.');
  const cutoff = new Date(now - lifetime).toISOString();
  const rows = await query({ where: { fieldFilter: { field: { fieldPath: 'issuedAt' },
    op: 'LESS_THAN_OR_EQUAL', value: { timestampValue: cutoff } } } });
  const candidates = rows.map(row => row.document).filter(doc =>
    doc && doc.name.startsWith(prefix) && /^\d{6}$/.test(doc.name.slice(prefix.length)) &&
    doc.updateTime && doc.fields?.issuedAt?.timestampValue);
  let deleted = 0, changed = 0;
  if (!preview) for (let i = 0; i < candidates.length; i += 100) {
    const writes = candidates.slice(i, i + 100).map(doc => ({
      delete: doc.name, currentDocument: { updateTime: doc.updateTime }
    }));
    const reply = await request('batchWrite', { writes });
    if (reply.status?.length !== writes.length) throw Error('Incomplete Firestore response. Safe to run again.');
    for (const status of reply.status) {
      if (!status.code) deleted++;
      else if ([5, 9].includes(status.code)) changed++;
      else throw Error('Firestore: ' + (status.message || status.code) + '. Safe to run again.');
    }
  }
  return { expired: candidates.length, deleted, changed };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 1 && args[0] === '--preview')) throw Error('Only --preview is supported.');
  const preview = args.length === 1;
  const auth = require(join(process.env.LEXICAL_FIREBASE_CLI_LIB, 'auth'));
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw Error('Sign in with firebase login first.');
  const { access_token } = await auth.getAccessToken(account.tokens.refresh_token, []);
  async function request(method, data) {
    const res = await fetch('https://firestore.googleapis.com/v1/' + documents + ':' + method, {
      method: 'POST', headers: { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify(data), signal: AbortSignal.timeout(60000)
    });
    const result = await res.json();
    if (!res.ok) throw Error(result.error?.message || 'Firestore HTTP ' + res.status);
    return result;
  }
  const counts = await clean(request, preview);
  console.log((preview ? 'Preview' : 'Finished') + ' | Expired: ' + counts.expired +
    ' | Deleted: ' + counts.deleted + ' | Changed or already removed: ' + counts.changed);
}

module.exports = { clean };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });

