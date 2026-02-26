import { Client, SFTPWrapper } from 'ssh2';
import { Readable } from 'stream';
import type { Source } from '../types/index.js';

export interface SSHConfig {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  basePath?: string;
}

export class SSHClient {
  private config: SSHConfig;
  public client: Client | null = null;

  constructor(config: SSHConfig) {
    this.config = { port: 22, ...config };
  }

  async connect(): Promise<void> {
    const privateKey = await this.readPrivateKey();
    return new Promise((resolve, reject) => {
      this.client = new Client();
      
      const connectionOptions = {
        host: this.config.host,
        port: this.config.port || 22,
        username: this.config.username || process.env.USER,
        password: this.config.password,
        privateKey,
        readyTimeout: 20000, // Increase timeout
        debug: (message: string) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('[SSH DEBUG]', message);
          }
        },
        keepaliveInterval: 10000,
        keepaliveCountMax: 5
      };

      console.log(`[SSH] Attempting to connect to ${connectionOptions.host}:${connectionOptions.port} as ${connectionOptions.username}...`);
      if (connectionOptions.password) console.log('[SSH] Offering password authentication.');
      if (connectionOptions.privateKey) console.log('[SSH] Offering private key authentication.');
      
      this.client.on('ready', () => {
        console.log(`[SSH] Connection successful for ${connectionOptions.username}`);
        resolve()
      });
      this.client.on('error', (err) => {
        console.error(`[SSH] Connection error:`, err);
        reject(err)
      });
      
      this.client.connect(connectionOptions);
    });
  }

  private async readPrivateKey(): Promise<Buffer | undefined> {
    const fs = await import('fs');
    const keyPath = process.env.HOME + '/.ssh/id_rsa';
    try {
      return fs.readFileSync(keyPath);
    } catch {
      return undefined;
    }
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end();
        this.client = null;
      }
      resolve();
    });
  }

  // --- THESE FUNCTIONS WERE MISSING ---
  async withSftp<T>(callback: (sftp: SFTPWrapper) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.client) return reject(new Error('Not connected'));
      this.client.sftp((err, sftp) => {
        if (err) return reject(err);
        callback(sftp).then(resolve).catch(reject);
      });
    });
  }

  async stat(path: string): Promise<{ size: number; isDirectory: boolean }> {
    return this.withSftp(async (sftp) => {
      return new Promise((resolve, reject) => {
        sftp.stat(path, (err, stats) => {
          if (err) return reject(err);
          resolve({ size: stats.size, isDirectory: stats.isDirectory() });
        });
      });
    });
  }

  async readFile(path: string): Promise<Readable> {
    return this.withSftp(async (sftp) => sftp.createReadStream(path));
  }
  
  async readFileRange(path: string, start: number, end: number): Promise<Readable> {
    return this.withSftp(async (sftp) => sftp.createReadStream(path, { start, end }));
  }
}

const clients = new Map<string, SSHClient>();

export async function getSSHClient(source: Source): Promise<SSHClient> {
  const key = source.id || source.host;
  
  if (clients.has(key)) {
    const client = clients.get(key)!;
    // Test with a lightweight stat call
    try {
      await client.stat(source.basePath || '/');
      return client;
    } catch {
      clients.delete(key);
    }
  }

  const client = new SSHClient({
    host: source.host,
    port: source.port ?? undefined,
    username: source.username ?? undefined,
    password: source.password ?? undefined,
    basePath: source.basePath,
  });

  await client.connect();
  clients.set(key, client);
  return client;
}

export async function getSftpClient(source: Source): Promise<any> {
  const client = await getSSHClient(source);
  return new Promise((resolve, reject) => {
    client.client!.sftp((err, sftp) => {
      if (err) return reject(err);
      resolve(sftp);
    });
  });
}
