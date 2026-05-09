#!/usr/bin/env node
/**
 * Regenerates CHANGELOG.md from git tags. Pulls the commit subject of each
 * tag (which we conventionally write as "<version> — <theme summary>") and
 * the bullet-listed body, then writes them in reverse-chronological order.
 *
 * Run from the repo root:  node scripts/generate-changelog.mjs
 *
 * Uses execFileSync (not exec) so tag names go in as argv rather than being
 * interpolated into a shell command.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const tagsRaw = git(['tag', '--sort=-creatordate', '-l', '[0-9]*']);
const tags = tagsRaw.split('\n').filter(Boolean);
if (tags.length === 0) {
  console.error('No release tags found.');
  process.exit(1);
}

const sections = ['# Changelog', '', 'Generated from git tags by `scripts/generate-changelog.mjs`.', ''];

for (const tag of tags) {
  const date = git(['log', '-1', '--format=%cs', tag]);
  const subject = git(['log', '-1', '--format=%s', tag]);
  const body = git(['log', '-1', '--format=%b', tag]);

  sections.push(`## ${tag} — ${date}`);
  sections.push('');
  sections.push(`*${subject}*`);
  sections.push('');
  if (body) {
    sections.push(body.trim());
    sections.push('');
  }
}

writeFileSync('CHANGELOG.md', sections.join('\n'));
console.log(`Wrote CHANGELOG.md (${tags.length} releases).`);
