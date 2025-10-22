#!/usr/bin/env node
/*
  Helper script: generates cURL commands to publish auth email templates
  Usage:
    node scripts/publish-templates.js

  Environment (set before running):
    - PROJECT_REF: your Supabase project ref (e.g. mthyfwexjeboclqjpvzz)
    - SUPABASE_ACCESS_TOKEN: a personal access token with access to the project

  This script writes JSON payload files to .out/ and prints one-line cURL
  commands for both Bash and PowerShell. No here-docs or line continuations.
*/

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TEMPLATES_DIR = path.join(ROOT, 'supabase', 'email-templates');
const OUT_DIR = path.join(ROOT, '.out');

const files = [
  { key: 'email_otp', file: 'otp.html', description: 'Email OTP template' },
  { key: 'invite', file: 'invite.html', description: 'Invite user template' },
  { key: 'reset_password', file: 'reset.html', description: 'Reset password template' },
];

function printHeader() {
  console.log('=== Supabase Email Templates: cURL Publisher ===');
  console.log('Set env vars before running:');
  console.log('  # Bash');
  console.log('  export PROJECT_REF="<your-project-ref>"');
  console.log('  export SUPABASE_ACCESS_TOKEN="<your-access-token>"');
  console.log('  # PowerShell');
  console.log('  $env:PROJECT_REF="<your-project-ref>"');
  console.log('  $env:SUPABASE_ACCESS_TOKEN="<your-access-token>"');
  console.log('');
}

function readTemplate(name) {
  const file = path.join(TEMPLATES_DIR, name);
  if (!fs.existsSync(file)) {
    throw new Error(`Template not found: ${file}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function makeBody(html) {
  return JSON.stringify({ html });
}

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);
}

async function applyTemplates() {
  const projectRef = process.env.PROJECT_REF;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !accessToken) {
    throw new Error('Missing env: PROJECT_REF and/or SUPABASE_ACCESS_TOKEN');
  }

  for (const { key, file, description } of files) {
    const html = readTemplate(file);
    const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/auth/templates/${key}`;
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ html }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`[${description}] ${res.status} ${res.statusText} — ${text}`);
    }
    console.log(`✔ Applied: ${description} (${key})`);
  }
}

function main() {
  printHeader();
  ensureOutDir();

  files.forEach(({ key, file, description }) => {
    const html = readTemplate(file);
    const body = makeBody(html);
    const outPath = path.join(OUT_DIR, `${key}.json`);
    fs.writeFileSync(outPath, body, 'utf8');

    const endpoint = `https://api.supabase.com/v1/projects/${process.env.PROJECT_REF || '$PROJECT_REF'}/auth/templates/${key}`;

    console.log(`\n# ${description} (${file})`);
    console.log('# Bash');
    console.log(`curl -X PUT -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data @${outPath} "${endpoint}"`);
    console.log('# PowerShell');
    console.log(`curl -X PUT -H "Authorization: Bearer $env:SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data @"${outPath}" "${endpoint}"`);
  });

  console.log('\n# NOTE');
  console.log('- Confirm the exact Management API endpoints for your Supabase version:');
  console.log('  https://supabase.com/docs/guides/api#management-api');
  console.log('- Some installations expect {{ .EmailOTP }} instead of {{ .Token }}. Adjust otp.html accordingly.');

  const args = process.argv.slice(2);
  if (args.includes('--apply')) {
    console.log('\nApplying templates now...');
    applyTemplates()
      .then(() => {
        console.log('All templates applied successfully.');
      })
      .catch((e) => {
        console.error('Apply error:', e.message);
        process.exit(1);
      });
  }
}

try {
  main();
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
