// Optional local convenience launcher. The application itself reads its key from env.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server.mjs';

if (!process.env.SARVAM_API_KEY) {
  try {
    const settings = readFileSync(join(homedir(), '.sarvam', 'credentials'), 'utf8');
    for (const line of settings.split(/\r?\n/)) {
      const match = line.match(/^\s*api_key\s*=\s*(.*?)\s*$/);
      if (match) {
        process.env.SARVAM_API_KEY = match[1].replace(/^['"]|['"]$/g, '');
        break;
      }
    }
  } catch {
    // The website can still explain that its local service needs configuration.
  }
}

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const server = createServer();
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? 'Port is in use. Set PORT to another number.' : 'Could not start Suno.');
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`Suno: http://${host}:${port}`);
  console.log(`Sarvam key configured: ${Boolean(process.env.SARVAM_API_KEY)}`);
});
