import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function resolveTodoistToken(): string {
  if (process.env.TODOIST_API_TOKEN && process.env.TODOIST_API_TOKEN.trim() !== '') {
    return process.env.TODOIST_API_TOKEN.trim();
  }

  // Check OpenClaw configuration file if running on host
  const openclawPaths = [
    '/data/var/openclaw/workspace/config/mcporter.json',
    path.join(process.env.HOME || '', '.openclaw/workspace/config/mcporter.json'),
    path.join(process.env.HOME || '', '.openclaw/openclaw.json')
  ];

  for (const p of openclawPaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        const json = JSON.parse(content);
        if (json?.mcpServers?.todoist?.env?.TODOIST_API_TOKEN) {
          console.log(`[Config] Loaded Todoist API token automatically from ${p}`);
          return json.mcpServers.todoist.env.TODOIST_API_TOKEN.trim();
        }
      }
    } catch (e) {
      // Ignore read errors
    }
  }

  // Check local data/token.txt or settings
  const localTokenPath = path.resolve(process.cwd(), 'data', 'token.txt');
  if (fs.existsSync(localTokenPath)) {
    try {
      const token = fs.readFileSync(localTokenPath, 'utf-8').trim();
      if (token) return token;
    } catch {}
  }

  return '';
}

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3333', 10),
  TODOIST_API_TOKEN: resolveTodoistToken(),
  AGY_PATH: process.env.AGY_PATH || '/home/tivvit/.local/bin/agy',
  DATA_DIR: path.resolve(process.cwd(), 'data'),
  CHECKER_CRON: process.env.CHECKER_CRON || '* * * * *', // every minute
};
