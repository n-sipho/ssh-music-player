import { Bonjour, Service } from 'bonjour-service';

export interface DiscoveredService {
  name: string;
  type: 'smb' | 'ssh';
  host: string;
  port: number;
  addresses: string[];
}

class DiscoveryManager {
  private bonjour: Bonjour | null = null;
  private services: Map<string, DiscoveredService> = new Map();

  start() {
    if (this.bonjour) return;
    
    this.bonjour = new Bonjour();
    
    // Browse for SMB
    const smbBrowser = this.bonjour.find({ type: 'smb' });
    smbBrowser.on('up', (service: Service) => this.addService(service, 'smb'));
    smbBrowser.on('down', (service: Service) => this.removeService(service));

    // Browse for SFTP/SSH
    const sftpBrowser = this.bonjour.find({ type: 'sftp-ssh' });
    sftpBrowser.on('up', (service: Service) => this.addService(service, 'ssh'));
    sftpBrowser.on('down', (service: Service) => this.removeService(service));

    console.log('📡 Network discovery started (mDNS/Bonjour)');
  }

  stop() {
    if (this.bonjour) {
      this.bonjour.destroy();
      this.bonjour = null;
    }
  }

  private addService(service: Service, type: 'smb' | 'ssh') {
    const id = `${service.name}-${service.type}`;
    
    // Prioritize IPv4 addresses (containing dots) over IPv6
    const allAddresses = service.addresses || [];
    const ipv4 = allAddresses.filter(a => a.includes('.'));
    const ipv6 = allAddresses.filter(a => a.includes(':'));
    const sortedAddresses = [...ipv4, ...ipv6];

    this.services.set(id, {
      name: service.name,
      type,
      host: service.host,
      port: service.port,
      addresses: sortedAddresses,
    });
    console.log(`✨ Discovered ${type} service: ${service.name} at ${sortedAddresses[0] || service.host}`);
  }

  private removeService(service: Service) {
    const id = `${service.name}-${service.type}`;
    this.services.delete(id);
  }

  getDiscoveredServices(): DiscoveredService[] {
    return Array.from(this.services.values());
  }
}

export const discoveryManager = new DiscoveryManager();
