// Trusted local-only release QA. Never bundle or deploy this Node script.
// Uses the existing gitignored Worker secret; does not print or change it.
// Creates two disposable confirmed Supabase accounts, proves tenant isolation,
// runs the deployed Playwright suite, and cleans up ONLY those two accounts.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function readLocalConfig(file) {
  const entries = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const pos = line.indexOf('=');
    if (pos <= 0) continue;
    let value = line.slice(pos + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    entries[line.slice(0, pos).trim()] = value;
  }
  return entries;
}

const auditFile = '.qa-disposable-ids.local';
const users = [];
let admin;
let success = false;
const publicOrigin = 'https://careerprofilego.memrae-staging.workers.dev';

function fail(reason) {
  throw new Error(reason);
}

async function run() {
  const ignored = spawnSync('git', ['check-ignore', '-q', '.wrangler-secrets.local']);
  if (ignored.status !== 0) fail('Refusing to read a Worker secret file that Git might track.');
  const secrets = readLocalConfig('.wrangler-secrets.local');
  const config = readLocalConfig('.env.local');
  const url = config.VITE_SUPABASE_URL;
  const pubKey = config.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !pubKey || !secrets.SUPABASE_SECRET_KEY) {
    fail('Missing configured Supabase URL, publishable key, or existing Worker secret.');
  }
  if (new URL(url).hostname !== 'yxrbytzhiilnzlamqpqz.supabase.co') {
    fail('Supabase URL does not match the intended QA project.');
  }
  const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const remoteSha = execFileSync('git', ['rev-parse', 'origin/master'], {
    encoding: 'utf8',
  }).trim();
  if (gitSha !== remoteSha) fail('Refusing QA on a commit different from origin/master.');
  const health = await fetch(publicOrigin + '/api/health');
  if (!health.ok) fail('Deployed Worker health check failed.');
  const { buildSha } = await health.json();
  if (buildSha !== gitSha) {
    fail(
      'The deployed Worker does not match git HEAD. Deploy the exact SHA before creating QA users.'
    );
  }

  admin = createClient(url, secrets.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = randomBytes(7).toString('hex');
  const clients = [];
  const profiles = [];
  for (const num of [1, 2]) {
    const email = `cpg-qa-${suffix}-${num}@example.test`;
    const password = 'Qa1!' + randomBytes(24).toString('base64url');
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { qa_disposable: true },
    });
    if (error || !data.user?.id) fail('Could not create disposable Supabase QA user.');
    const id = data.user.id;
    users.push({ id, email, password });
    writeFileSync(
      auditFile,
      JSON.stringify({
        notice:
          'Temporary QA accounts created by scripts/live-qa-disposable.mjs; never delete other users',
        ids: users.map((u) => u.id),
      }),
      { mode: 0o600 }
    );

    const client = createClient(url, pubKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error || login.data.user?.id !== id) fail('Disposable QA user cannot sign in.');
    const username = `cpgqa${suffix}${num}`;
    const { data: profileId, error: profileError } = await client.rpc(
      'create_profile_with_basics',
      {
        p_user_id: id,
        p_username: username,
        p_display_name: `QA Disposable ${num}`,
        p_headline: 'Temporary QA fixture',
        p_about: 'Disposable testing profile',
        p_location: 'Test only',
      }
    );
    if (profileError || !profileId) {
      // The PostgREST SQLSTATE is safe diagnostic metadata; don't print
      // user input, credentials, request headers, or raw DB error messages.
      const code =
        typeof profileError?.code === 'string' && /^[A-Z0-9]{4,8}$/.test(profileError.code)
          ? profileError.code
          : 'unknown';
      fail(`Onboarding RPC failed for disposable user (code: ${code}).`);
    }
    clients.push(client);
    profiles.push({ id: profileId, username });
  }
  console.log('Created two isolated preconfirmed disposable accounts (no email delivery claimed).');

  // Actual authenticated RLS: user 2 must be unable to read or modify user 1.
  const { data: visible, error: readError } = await clients[1]
    .from('profiles')
    .select('id')
    .eq('id', profiles[0].id);
  if (readError || (visible?.length ?? 0) !== 0)
    fail('Cross-user private profile read was not isolated.');
  const { data: modified, error: updateError } = await clients[1]
    .from('profiles')
    .update({ headline: 'UNAUTHORIZED' })
    .eq('id', profiles[0].id)
    .select('id');
  if (updateError || (modified?.length ?? 0) !== 0) {
    fail('Cross-user profile update was not isolated.');
  }
  console.log('Authenticated two-user RLS isolation: PASS.');

  // Publish, fetch through the REAL Worker, then unpublish.
  const { error: publishError } = await clients[0]
    .from('profiles')
    .update({ visibility: 'published', published_at: new Date().toISOString() })
    .eq('id', profiles[0].id);
  if (publishError) fail('Profile publication via owner session failed.');
  const published = await fetch(publicOrigin + '/api/public/profile/' + profiles[0].username);
  if (published.status !== 200) fail('Newly published QA profile is not publicly accessible.');
  const { error: unpublishError } = await clients[0]
    .from('profiles')
    .update({ visibility: 'draft', published_at: null })
    .eq('id', profiles[0].id);
  if (unpublishError) fail('Profile unpublication via owner session failed.');
  const hidden = await fetch(publicOrigin + '/api/public/profile/' + profiles[0].username);
  if (hidden.status !== 404) fail('Unpublished QA profile is still public.');
  console.log('Real Worker publication/unpublication: PASS.');

  const env = {
    ...process.env,
    E2E_BASE_URL: publicOrigin,
    E2E_EXPECT_SHA: gitSha,
    E2E_QA_EMAIL: users[0].email,
    E2E_QA_PASSWORD: users[0].password,
    E2E_QA_SECOND_EMAIL: users[1].email,
    E2E_QA_SECOND_PASSWORD: users[1].password,
    E2E_QA_ACCOUNT_DISPOSABLE: 'yes',
  };
  // No privileged key crosses into the browser test subprocess.
  for (const name of ['SUPABASE_SECRET_KEY', 'SUPABASE_ACCESS_TOKEN', 'RATE_LIMIT_KEY_SECRET']) {
    delete env[name];
  }
  console.log('Running real deployed-browser tests with private subprocess environment.');
  const processName = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(processName, ['test:e2e:live'], {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    timeout: 12 * 60 * 1000,
  });
  if (result.error || result.status !== 0) {
    fail('Deployed browser QA did not pass. See sanitized test results.');
  }

  // The browser suite signs user 1 out with Supabase's default global scope,
  // which revokes EVERY session of that user — including the session this
  // Node client holds (GoTrue then rejects getUser with HTTP 400). Account
  // survival is what must be proven: a fresh password sign-in is the
  // authoritative check, and it reports the exact error code if it fails.
  const ownStillValid = await clients[0].auth.getUser();
  if (ownStillValid.error || ownStillValid.data.user?.id !== users[0].id) {
    const staleCode = ownStillValid.error?.code ?? ownStillValid.error?.status ?? 'no-user';
    console.log(`Pre-check: old session rejected after browser sign-out (code ${staleCode}).`);
    const relogin = await clients[0].auth.signInWithPassword({
      email: users[0].email,
      password: users[0].password,
    });
    if (relogin.error || relogin.data.user?.id !== users[0].id) {
      const code = relogin.error?.code ?? relogin.error?.status ?? 'no-user';
      fail(
        `Surviving QA account no longer authenticates after deletion test (error code: ${code}).`
      );
    }
    console.log('Surviving QA account re-authenticated with fresh credentials: PASS.');
  }
  const deleted = await admin.auth.admin.getUserById(users[1].id);
  if (!deleted.error && deleted.data.user) {
    fail('Second disposable QA account still exists after UI deletion.');
  }
  console.log('UI deletion of QA account 2 and survival of QA account 1: PASS.');
  success = true;
}

async function cleanup() {
  if (!admin) return;
  let hadError = false;
  for (const user of users.reverse()) {
    // This query is scoped by the exact freshly-created ID, never to other users.
    const profileDelete = await admin.from('profiles').delete().eq('user_id', user.id);
    if (profileDelete.error) hadError = true;
    const result = await admin.auth.admin.deleteUser(user.id);
    // 404 is expected when UI deletion already removed account 2.
    if (result.error && result.error.status !== 404) hadError = true;
  }
  if (!hadError) rmSync(auditFile, { force: true });
  else console.error('QA cleanup incomplete; inspect exact generated IDs in local QA audit file.');
  if (hadError) process.exitCode = 1;
}

try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Live QA failed.');
  process.exitCode = 1;
} finally {
  await cleanup();
  if (success && !process.exitCode) console.log('Disposable QA run completed; accounts cleaned.');
}
