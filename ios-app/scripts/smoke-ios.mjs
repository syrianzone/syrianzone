import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { reportBootStatus } from './simulator.mjs';

export function isAppRunning(output, pid, bundle) {
  return output.split('\n').some(line => {
    const [processId, , label] = line.trim().split(/\s+/);
    return Number(processId) === pid && label?.startsWith(`UIKitApplication:${bundle}[`);
  });
}

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
}

async function main() {
  if (process.platform !== 'darwin') throw new Error('Native iOS smoke testing requires a Mac.');
  const args = process.argv.slice(2);
  let app = resolve('.expo/build/Build/Products/Release-iphonesimulator/SyrianZone.app');
  let udid;
  let installed = false;
  let requestedBundle;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--app' && args[index + 1]) app = resolve(args[++index]);
    else if (args[index] === '--device' && args[index + 1]) udid = args[++index];
    else if (args[index] === '--bundle' && args[index + 1]) requestedBundle = args[++index];
    else if (args[index] === '--installed') installed = true;
    else throw new Error(`Unknown or incomplete option: ${args[index]}`);
  }
  if (requestedBundle && !installed) throw new Error('--bundle requires --installed.');
  const inventory = JSON.parse(run('xcrun', ['simctl', 'list', '--json']));
  const available = inventory.runtimes.filter(runtime => runtime.isAvailable && runtime.name.startsWith('iOS '))
    .sort((first, second) => second.version.localeCompare(first.version, undefined, { numeric: true }))
    .flatMap(runtime => inventory.devices[runtime.identifier] ?? []).filter(device => device.isAvailable);
  const device = udid ? available.find(candidate => candidate.udid === udid)
    : available.find(candidate => candidate.name.startsWith('iPhone') && !candidate.name.includes('Duo'));
  if (!device) throw new Error('No matching available iPhone simulator was found.');
  udid = device.udid;
  if (device.state !== 'Booted') run('xcrun', ['simctl', 'boot', udid]);
  reportBootStatus(run('xcrun', ['simctl', 'bootstatus', udid, '-b']));
  const bundle = installed ? requestedBundle ?? 'zone.syrian.ios'
    : run('/usr/libexec/PlistBuddy', ['-c', 'Print CFBundleIdentifier', join(app, 'Info.plist')]);
  if (!installed) run('xcrun', ['simctl', 'install', udid, app]);
  const launched = run('xcrun', ['simctl', 'launch', '--terminate-running-process', udid, bundle]);
  const pid = Number(launched.split('\n').find(line => line.startsWith(`${bundle}:`))?.split(':').at(-1)?.trim());
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`Could not read the launched app PID: ${launched}`);
  // A successful simctl launch only means spawn succeeded. Check the app after JS has had time to start.
  for (let index = 0; index < 5; index++) {
    await delay(2000);
    if (!isAppRunning(run('xcrun', ['simctl', 'spawn', udid, 'launchctl', 'list']), pid, bundle)) {
      const logs = run('xcrun', ['simctl', 'spawn', udid, 'log', 'show', '--last', '1m', '--style', 'compact', '--predicate', 'process == "SyrianZone"']);
      throw new Error(`The app terminated during native startup.\n${logs.slice(-12_000)}`);
    }
  }
  console.log(JSON.stringify({ device: device.name, udid, bundle, pid, aliveAfterMs: 10_000 }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
