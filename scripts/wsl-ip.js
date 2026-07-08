#!/usr/bin/env node
/**
 * JengaBooks — WSL IP Detector
 *
 * Detects the WSL instance's network IP address from Windows.
 * Prints the IP to stdout so it can be captured by PowerShell scripts.
 *
 * Usage:
 *   node scripts/wsl-ip.js
 *   # => 192.168.1.180
 *
 *   node scripts/wsl-ip.js --export
 *   # => $env:DATABASE_URL="postgresql://postgres:postgres@192.168.1.180:5432/jengabooks?schema=public&sslmode=disable"
 *
 * Exit codes:
 *   0 — IP detected and printed
 *   1 — WSL not available or IP detection failed
 */

const { execSync } = require('child_process');
const os = require('os');

function isWindows() {
  return os.platform() === 'win32';
}

/**
 * Detect WSL IP by parsing `wsl -- ip addr` output.
 * Looks for the first non-loopback IPv4 address (e.g., 192.168.1.XXX or 172.X.X.X).
 */
function detectWslIp() {
  if (!isWindows()) {
    // On Linux/macOS, just use localhost
    return 'localhost';
  }

  let stdout;
  try {
    stdout = execSync('wsl -- ip addr', {
      encoding: 'utf-8',
      timeout: 10000,
      shell: 'powershell.exe',
    });
  } catch (err) {
    throw new Error(
      'Failed to run `wsl -- ip addr`. Is WSL installed?\n' + err.message
    );
  }

  // Parse the output for IPv4 addresses (e.g., "inet 192.168.1.180/20")
  const ipv4Pattern = /inet\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/\d+/g;
  const matches = [...stdout.matchAll(ipv4Pattern)];

  if (matches.length === 0) {
    throw new Error(
      'No IPv4 address found in WSL output. Is the WSL instance running?\n' +
        'Run: wsl -d <distro> -- echo "WSL started"'
    );
  }

  // Filter out loopback (127.0.0.1) and take the first real network IP
  for (const match of matches) {
    const ip = match[1];
    if (!ip.startsWith('127.')) {
      return ip;
    }
  }

  throw new Error(
    'No non-loopback IPv4 address found. WSL may not have network access.'
  );
}

/**
 * Build a DATABASE_URL connection string for the given host.
 */
function buildDatabaseUrl(host) {
  const sslParam = host !== 'localhost' ? '&sslmode=disable' : '';
  return `postgresql://postgres:postgres@${host}:5432/jengabooks?schema=public${sslParam}`;
}

function main() {
  const args = process.argv.slice(2);
  const shouldExport = args.includes('--export');

  let ip;
  try {
    ip = detectWslIp();
  } catch (err) {
    console.error(err.message);
    if (shouldExport) {
      // If export mode and detection fails, fall back to localhost
      ip = 'localhost';
      console.error(`Falling back to ${ip} — connection may fail.`);
    } else {
      process.exit(1);
    }
  }

  if (shouldExport) {
    const url = buildDatabaseUrl(ip);
    // PowerShell-compatible export command
    console.log(`$env:DATABASE_URL="${url}"`);
    // Also print a Bash-compatible export for Git Bash / WSL
    console.error(`export DATABASE_URL="${url}"`);
  } else {
    console.log(ip);
  }
}

main();
