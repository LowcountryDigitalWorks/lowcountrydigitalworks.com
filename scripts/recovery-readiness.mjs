import assert from 'node:assert/strict';
import { access, appendFile, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { pathToFileURL } from 'node:url';

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function evaluateRecoveryReadiness({
  packageJson,
  wranglerText,
  deploymentText,
  recoveryText,
  lockExists,
  workerExists,
  distIndexExists,
}) {
  assert.equal(packageJson.scripts?.build, 'astro build', 'accepted build script changed unexpectedly');
  assert.ok(lockExists, 'committed package-lock.json is required for recovery readiness');
  assert.ok(workerExists, 'worker.js is required for the accepted production boundary');
  assert.ok(distIndexExists, 'clean build must produce dist/index.html');

  assert.match(wranglerText, /"name"\s*:\s*"lowcountrydigitalworks"/, 'Wrangler project identity changed');
  assert.match(wranglerText, /"main"\s*:\s*"\.\/worker\.js"/, 'Wrangler Worker entrypoint changed');
  assert.match(wranglerText, /"directory"\s*:\s*"\.\/dist"/, 'Wrangler static-assets directory changed');

  assert.match(deploymentText, /production branch `main`/i, 'deployment authority must retain production branch main');
  assert.match(deploymentText, /production deploy command: `npx wrangler deploy`/i, 'deployment authority must retain accepted deploy command');
  assert.match(deploymentText, /build: `npm run build`/i, 'deployment authority must retain accepted build command');
  assert.match(
    deploymentText,
    /SECURE_SHARE_DESTINATION_URL/,
    'deployment authority must preserve the production-only Secure Share secret dependency',
  );

  assert.match(recoveryText, /Recovery class: `STATIC_GIT_MANAGED`/, 'recovery class must remain explicit');
  const secretRecoveryVerified = /Production-only Secure Share secret recovery: \*\*VERIFIED\*\*/.test(recoveryText);
  const secretRecoveryUnverified = /Production-only Secure Share secret recovery: \*\*UNVERIFIED\*\*/.test(recoveryText);
  assert.ok(
    secretRecoveryVerified || secretRecoveryUnverified,
    'recovery record must explicitly classify production-only secret recovery',
  );
  assert.ok(
    recoveryText.includes('The secret value must never be copied into this document'),
    'recovery record must retain the no-secret-value boundary',
  );

  const overall = secretRecoveryVerified ? 'VERIFIED' : 'PARTIAL';
  if (overall === 'PARTIAL') {
    assert.match(
      recoveryText,
      /Current overall result remains \*\*PARTIAL\*\*/,
      'recovery record must not report VERIFIED while external secret recovery is unverified',
    );
  }

  return {
    overall,
    sourceBuild: 'VERIFIED',
    repositoryRedeploy: 'VERIFIED',
    secureShareSecretRecovery: secretRecoveryVerified ? 'VERIFIED' : 'UNVERIFIED',
  };
}

async function writeGithubSummary(result) {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) return;

  const lines = [
    '',
    '## Website recovery assurance',
    '',
    `- Overall: **${result.overall}**`,
    `- Source / clean build: **${result.sourceBuild}**`,
    `- Repository-driven redeploy contract: **${result.repositoryRedeploy}**`,
    `- Secure Share production-secret recovery: **${result.secureShareSecretRecovery}**`,
    '- This check is evidence only and does not authorize deployment or provider mutation.',
    '',
  ];
  await appendFile(target, lines.join('\n'), 'utf8');
}

export async function runRecoveryReadiness() {
  const [packageJsonText, wranglerText, deploymentText, recoveryText] = await Promise.all([
    readFile('package.json', 'utf8'),
    readFile('wrangler.jsonc', 'utf8'),
    readFile('docs/deployment.md', 'utf8'),
    readFile('docs/recovery-assurance.md', 'utf8'),
  ]);

  const result = evaluateRecoveryReadiness({
    packageJson: JSON.parse(packageJsonText),
    wranglerText,
    deploymentText,
    recoveryText,
    lockExists: await exists('package-lock.json'),
    workerExists: await exists('worker.js'),
    distIndexExists: await exists('dist/index.html'),
  });

  await writeGithubSummary(result);
  return result;
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  runRecoveryReadiness()
    .then(result => {
      console.log('RECOVERY ASSURANCE: ' + result.overall);
      console.log('source-build=' + result.sourceBuild);
      console.log('repository-redeploy=' + result.repositoryRedeploy);
      console.log('secure-share-secret-recovery=' + result.secureShareSecretRecovery);
    })
    .catch(error => {
      console.error('RECOVERY ASSURANCE: FAIL');
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
