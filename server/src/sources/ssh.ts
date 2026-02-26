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
      this.client.on('ready', () => resolve());
      this.client.on('error', (err) => reject(err));
      this.client.connect({
        host: this.config.host,
        port: this.config.port || 22,
        username: this.config.username || process.env.USER,
        password: this.config.password,
        privateKey,
      });
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
    if (client.client?.readable) {
        return client;
    }
    clients.delete(key);
  }

  const client = new SSHClient({
    host: source.host,
    port: source.port,
    username: source.username,
    password: source.password,
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
