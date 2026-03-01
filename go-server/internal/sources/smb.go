package sources

import (
	"fmt"
	"log"
	"net"
	"os"
	"strings"
	"time"

	"github.com/hirochachacha/go-smb2"
)

type SMBConfig struct {
	Host     string
	Share    string
	Username string
	Password string
	Domain   string
}

type SMBClient struct {
	config SMBConfig
	conn   net.Conn
	session *smb2.Session
	share   *smb2.Share
}

func NewSMBClient(config SMBConfig) *SMBClient {
	return &SMBClient{config: config}
}

func (c *SMBClient) Connect() error {
	conn, err := net.Dial("tcp", fmt.Sprintf("%s:445", c.config.Host))
	if err != nil {
		return fmt.Errorf("failed to dial: %w", err)
	}
	c.conn = conn

	d := &smb2.Dialer{
		Initiator: &smb2.NTLMInitiator{
			User:     c.config.Username,
			Password: c.config.Password,
			Domain:   c.config.Domain,
		},
	}

	s, err := d.Dial(conn)
	if err != nil {
		c.conn.Close()
		return fmt.Errorf("failed to dial smb: %w", err)
	}
	c.session = s

	if c.config.Share != "" {
		share, err := s.Mount(c.config.Share)
		if err != nil {
			s.Logoff()
			c.conn.Close()
			return fmt.Errorf("failed to mount share: %w", err)
		}
		c.share = share
	}

	return nil
}

func (c *SMBClient) Close() {
	if c.share != nil {
		c.share.Umount()
	}
	if c.session != nil {
		c.session.Logoff()
	}
	if c.conn != nil {
		c.conn.Close()
	}
}

func (c *SMBClient) ReadDir(path string) ([]os.FileInfo, error) {
	if c.share == nil {
		return nil, fmt.Errorf("not connected to a share")
	}
	return c.share.ReadDir(path)
}

func (c *SMBClient) Open(path string) (*smb2.File, error) {
	if c.share == nil {
		return nil, fmt.Errorf("not connected to a share")
	}
	return c.share.Open(path)
}

func EnumerateShares(host, username, password, domain string) ([]string, error) {
	addr := host
	if !strings.Contains(addr, ":") {
		addr = addr + ":445"
	}

	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return nil, fmt.Errorf("failed to dial: %w", err)
	}
	defer conn.Close()

	d := &smb2.Dialer{
		Initiator: &smb2.NTLMInitiator{
			User:     username,
			Password: password,
			Domain:   domain,
		},
	}

	log.Printf("[SMB] Dialing %s with user=%s, domain=%s", addr, username, domain)
	
	s, err := d.Dial(conn)
	if err != nil {
		return nil, fmt.Errorf("failed to authenticate: %w", err)
	}
	defer s.Logoff()

	shares, err := s.ListSharenames()
	if err != nil {
		return nil, fmt.Errorf("failed to list shares: %w", err)
	}

	var filtered []string
	ignored := map[string]bool{
		"IPC$":    true,
		"print$":  true,
		"ADMIN$":  true,
		"C$":      true,
		"D$":      true,
	}

	for _, name := range shares {
		if !ignored[strings.ToUpper(name)] && !strings.HasSuffix(name, "$") {
			filtered = append(filtered, name)
		}
	}

	return filtered, nil
}
