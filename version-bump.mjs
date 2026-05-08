import { readFileSync, writeFileSync } from 'node:fs';

// Standard Obsidian community-plugin bump script.
// Reads the new version from package.json (so `npm version <new>` is the trigger)
// and propagates it to manifest.json and versions.json.

const targetVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const minAppVersion = manifest.minAppVersion;
manifest.version = targetVersion;
writeFileSync('manifest.json', `${JSON.stringify(manifest, null, '\t')}\n`);

const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[targetVersion] = minAppVersion;
writeFileSync('versions.json', `${JSON.stringify(versions, null, '\t')}\n`);

console.log(`Bumped to ${targetVersion} (minAppVersion ${minAppVersion}).`);
