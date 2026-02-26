import SMB2 from 'smb2';
import { Readable } from 'stream';
import type { Source } from '../types/index.js';

export interface SMBConfig {
  host: string;
  share: string;
  username?: string;
  password?: string;
  basePath?: string;
}

export class SMBClient {
  private config: SMBConfig;
  private client: SMB2 | null = null;

  constructor(config: SMBConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.client = new SMB2({
      share: `\\\\${this.config.host}\\${this.config.share}`,
      domain: '.',
      username: this.config.username || 'guest',
      password: this.config.password || '',
    });

    // Test connection by listing root
    return new Promise((resolve, reject) => {
      this.client!.readdir(this.config.basePath || '\\', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    // smb2 doesn't have explicit disconnect
    this.client = null;
  }

  async listFiles(path: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('Not connected'));
      }

      this.client.readdir(path, (err, files) => {
        if (err) return reject(err);
        resolve(files.map(f => f.name || f.toString()).filter(n => n !== '.' && n !== '..'));
      });
    });
  }

  async stat(path: string): Promise<{ size: number; isDirectory: boolean }> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('Not connected'));
      }

      this.client.stat(path, (err, stats) => {
        if (err) return reject(err);
        resolve({
          size: stats.size,
          isDirectory: stats.isDirectory(),
        });
      });
    });
  }

  async readFile(path: string): Promise<Readable> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('Not connected'));
      }

      const stream = this.client.createReadStream(path);
      stream.on('error', reject);
      stream.on('open', () => resolve(stream));
    });
  }

  async readFileRange(path: string, start: number, end: number): Promise<Readable> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('Not connected'));
      }

      const stream = this.client.createReadStream(path, {
        start,
        end,
      });
      stream.on('error', reject);
      stream.on('open', () => resolve(stream));
    });
  }
}

// Connection pool for SMB clients
const clients = new Map<string, SMBClient>();

export async function getSMBClient(source: Source): Promise<SMBClient> {
  const key = source.id || `${source.host}/${source.share}`;
  
  if (clients.has(key)) {
    const client = clients.get(key)!;
    try {
      await client.stat(source.basePath || '\\');
      return client;
    } catch {
      clients.delete(key);
    }
  }

  const client = new SMBClient({
    host: source.host,
    share: source.share || '',
    username: source.username,
    password: source.password,
    basePath: source.basePath,
  });

  await client.connect();
  clients.set(key, client);
  return client;
}