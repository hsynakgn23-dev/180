import { spawnSync } from 'node:child_process';

const APP_PACKAGE = 'com.hsyna.absolutecinema';
const MAIN_ACTIVITY = '.MainActivity';

const DEEP_LINKS = [
  'absolutecinema://open?target=daily&screen=daily',
  'absolutecinema://open?target=invite&invite=ABC12345&screen=inviteClaim',
  'absolutecinema://open?target=share&platform=x&goal=streak&invite=ABC12345&screen=sharePrompt',
];

const toText = (value) => String(value || '');

const isRuntimeErrorLine = (line) => {
  if (/FATAL EXCEPTION/i.test(line)) return true;
  if (/E AndroidRuntime/i.test(line)) return true;
  if (/Unable to load script/i.test(line)) return true;
  if (/Unhandled JS Exception/i.test(line)) return true;
  if (/Invariant Violation/i.test(line)) return true;
  if (/ReactNativeJS/i.test(line) && /(TypeError|ReferenceError)/i.test(line)) return true;
  return false;
};

const sleep = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

const run = (command, args, allowFail = false) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  if (result.error && !allowFail) {
    throw result.error;
  }
  if (result.status !== 0 && !allowFail) {
    const stderr = String(result.stderr || '').trim();
    const stdout = String(result.stdout || '').trim();
    const message = stderr || stdout || `Command failed: ${command} ${args.join(' ')}`;
    throw new Error(message);
  }
  return result;
};

const getConnectedDeviceSerial = () => {
  const result = run('adb', ['devices', '-l']);
  const lines = String(result.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('List of devices attached'))
    .filter((line) => /\sdevice(\s|$)/.test(line));

  if (lines.length === 0) return '';

  const serials = lines.map((line) => line.split(/\s+/)[0]).filter(Boolean);
  const emulator = serials.find((serial) => serial.startsWith('emulator-'));
  return emulator || serials[0] || '';
};

const main = () => {
  run('adb', ['version']);

  const serial = getConnectedDeviceSerial();
  if (!serial) {
    console.error('[mobile-deeplink-smoke] No connected adb device/emulator found.');
    process.exit(1);
  }

  console.info(`[mobile-deeplink-smoke] target=${serial}`);

  const packageResult = run('adb', ['-s', serial, 'shell', 'pm', 'path', APP_PACKAGE], true);
  if (packageResult.status !== 0 || !toText(packageResult.stdout).includes('package:')) {
    console.error(
      `[mobile-deeplink-smoke] FAIL: ${APP_PACKAGE} not installed on ${serial}. Run npm run mobile:devclient:android first.`
    );
    process.exit(1);
  }

  run('adb', ['-s', serial, 'logcat', '-c'], true);
  run('adb', ['-s', serial, 'shell', 'am', 'start', '-W', '-n', `${APP_PACKAGE}/${MAIN_ACTIVITY}`]);
  sleep(1500);

  for (const deepLink of DEEP_LINKS) {
    const launch = run(
      'adb',
      [
        '-s',
        serial,
        'shell',
        'am',
        'start',
        '-W',
        '-a',
        'android.intent.action.VIEW',
        '-d',
        deepLink,
        APP_PACKAGE,
      ],
      true
    );
    const launchOutput = `${toText(launch.stdout)}\n${toText(launch.stderr)}`;
    if (/Error:|Unable to resolve Intent|Exception occurred/i.test(launchOutput)) {
      console.error(`[mobile-deeplink-smoke] FAIL: deep link launch error for ${deepLink}`);
      console.error(launchOutput.trim());
      process.exit(1);
    }
    sleep(1200);
  }

  sleep(2000);

  const logcatDump = run('adb', ['-s', serial, 'logcat', '-d'], true);
  const lines = String(logcatDump.stdout || '').split(/\r?\n/);
  const failures = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!isRuntimeErrorLine(line)) continue;

    const context = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4)).join('\n');
    const isAppRelated = context.includes(APP_PACKAGE) || /ReactNativeJS|Expo/i.test(context);
    if (isAppRelated) failures.push(line);
  }

  if (failures.length > 0) {
    console.error('[mobile-deeplink-smoke] FAIL: runtime errors detected');
    for (const line of failures.slice(0, 20)) {
      console.error(line);
    }
    process.exit(1);
  }

  console.info('[mobile-deeplink-smoke] PASS: no critical runtime errors found');
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[mobile-deeplink-smoke] FAIL:', message);
  process.exit(1);
}
