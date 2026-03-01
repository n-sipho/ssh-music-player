package scanner

import (
	"context"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grandcat/zeroconf"
)

type DiscoveredService struct {
	Name      string   `json:"name"`
	Type      string   `json:"type"`
	Host      string   `json:"host"`
	Port      int      `json:"port"`
	Addresses []string `json:"addresses"`
}

type DiscoveryManager struct {
	services []DiscoveredService
	mu       sync.RWMutex
}

var GlobalDiscoveryManager = &DiscoveryManager{
	services: []DiscoveredService{},
}

func (m *DiscoveryManager) Start(ctx context.Context) {
	go m.browse(ctx, "_smb._tcp", "smb")
	go m.browse(ctx, "_sftp-ssh._tcp", "ssh")
}

func (m *DiscoveryManager) browse(ctx context.Context, serviceType, friendlyType string) {
	for {
		resolver, err := zeroconf.NewResolver(nil)
		if err != nil {
			log.Printf("[Discovery] Failed to initialize resolver: %v", err)
			time.Sleep(10 * time.Second)
			continue
		}

		entries := make(chan *zeroconf.ServiceEntry)
		go func(results <-chan *zeroconf.ServiceEntry) {
			for entry := range results {
				name := m.cleanupName(entry.Instance)
				m.mu.Lock()
				// Check if already discovered
				exists := false
				for i, s := range m.services {
					if s.Name == name && s.Type == friendlyType {
						m.services[i].Addresses = m.entryToAddresses(entry)
						exists = true
						break
					}
				}
				if !exists {
					m.services = append(m.services, DiscoveredService{
						Name:      name,
						Type:      friendlyType,
						Host:      entry.HostName,
						Port:      entry.Port,
						Addresses: m.entryToAddresses(entry),
					})
					log.Printf("[Discovery] Found %s service: %s at %v", friendlyType, name, entry.AddrIPv4)
				}
				m.mu.Unlock()
			}
		}(entries)

		browseCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		err = resolver.Browse(browseCtx, serviceType, "local.", entries)
		if err != nil {
			log.Printf("[Discovery] Failed to browse %s: %v", serviceType, err)
		}

		<-browseCtx.Done()
		cancel()
		
		// Wait before next discovery cycle
		time.Sleep(60 * time.Second)
	}
}

func (m *DiscoveryManager) cleanupName(name string) string {
	// 1. Handle escaped spaces first
	res := strings.ReplaceAll(name, "\\ ", " ")

	// 2. Decode decimal escapes (\226\128\153 -> ’)
	var result []byte
	for i := 0; i < len(res); i++ {
		if res[i] == '\\' && i+3 < len(res) {
			digits := res[i+1 : i+4]
			// Try parsing the 3 digits as a decimal byte (0-255)
			if val, err := strconv.ParseUint(digits, 10, 8); err == nil {
				result = append(result, byte(val))
				i += 3 // Skip the 3 digits
				continue
			}
		}
		// If not a valid decimal escape, keep the character (including the backslash)
		result = append(result, res[i])
	}

	return string(result)
}

func (m *DiscoveryManager) GetServices() []DiscoveredService {
	m.mu.RLock()
	defer m.mu.RUnlock()
	// Return a copy
	res := make([]DiscoveredService, len(m.services))
	copy(res, m.services)
	return res
}

func (m *DiscoveryManager) entryToAddresses(entry *zeroconf.ServiceEntry) []string {
	var addrs []string
	for _, ip := range entry.AddrIPv4 {
		addrs = append(addrs, ip.String())
	}
	for _, ip := range entry.AddrIPv6 {
		addrs = append(addrs, ip.String())
	}
	return addrs
}
