const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');

test('sync preserves explicit URLs, encodes passwords and never executes dotenv values', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kak-fit-env-'));
  try {
    for (const dir of ['scripts', 'apps/web', 'apps/mobile']) {
      fs.mkdirSync(path.join(root, dir), { recursive: true });
    }
    fs.symlinkSync(path.resolve(__dirname, '../node_modules'), path.join(root, 'node_modules'));
    fs.copyFileSync(path.join(__dirname, 'sync-ip.sh'), path.join(root, 'scripts/sync-ip.sh'));
    const marker = path.join(root, 'must-not-exist');
    const password = `a@b&c:/$(touch ${marker})`;
    const input = {
      SUPABASE_PROJECT_REF: 'test-ref',
      SUPABASE_POOLER_HOST: 'example.invalid',
      SUPABASE_DB_PASSWORD: password,
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-key',
      PRISMA_ACCELERATE_URL: '',
      DATABASE_URL: '',
      EXPO_PUBLIC_API_URL: 'http://localhost:3000',
      BETTER_AUTH_URL: 'http://localhost:3000',
      SYNC_LAN_IP: 'false',
    };
    fs.writeFileSync(path.join(root, '.env'), Object.entries(input)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n');
    for (let run = 0; run < 2; run++) {
      const result = spawnSync('bash', [path.join(root, 'scripts/sync-ip.sh')], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(fs.existsSync(marker), false);
      const env = dotenv.parse(fs.readFileSync(path.join(root, '.env')));
      const url = new URL(env.DATABASE_URL);
      assert.equal(decodeURIComponent(url.password), password);
      assert.equal(url.hostname, 'example.invalid');
      assert.equal(env.EXPO_PUBLIC_API_URL, input.EXPO_PUBLIC_API_URL);
      assert.equal(env.BETTER_AUTH_URL, input.BETTER_AUTH_URL);
      assert.equal(new URL(env.DIRECT_URL).port, '5432');
      assert.deepEqual(dotenv.parse(fs.readFileSync(path.join(root, 'apps/mobile/.env'))), {
        EXPO_PUBLIC_API_URL: input.EXPO_PUBLIC_API_URL,
      });
      assert.equal(fs.readFileSync(path.join(root, 'apps/web/.env.local'), 'utf8'),
        fs.readFileSync(path.join(root, '.env'), 'utf8'));
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
