const { join } = require('node:path');
const cliLib = process.env.LEXICAL_FIREBASE_CLI_LIB;
const project = 'home-page-d6c39';
const field = 'projects/' + project + '/databases/(default)/collectionGroups/shared_decks/fields/expiresAt';
async function main() {
  const auth = require(join(cliLib, 'auth'));
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw Error('Sign in with firebase login and run this again.');
  const {access_token} = await auth.getAccessToken(account.tokens.refresh_token, []);
  async function request(path, options = {}) {
    const res = await fetch('https://firestore.googleapis.com/v1/' + path, {
      ...options, headers: {Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json'},
      signal: AbortSignal.timeout(30000)
    });
    const body = await res.json();
    if (!res.ok) throw Error(res.status + ' ' + body.error?.message);
    return body;
  }
  const current = await request(field);
  if (current.ttlConfig?.state === 'ACTIVE') { console.log('Code expiry cleanup is ACTIVE.'); return; }
  if (!current.ttlConfig || current.ttlConfig.state === 'NEEDS_REPAIR') {
    const operation = await request(field + '?updateMask=ttlConfig', {
      method: 'PATCH', body: JSON.stringify({name: field, ttlConfig: {}})
    });
    if (operation.error) throw Error(operation.error.message);
  }
  console.log('TTL state:', (await request(field)).ttlConfig?.state || 'requested');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
