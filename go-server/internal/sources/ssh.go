package sources

import (
	"fmt"
	"io"
	"os"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type SSHConfig struct {
	Host     string
	Port     int
	Username string
	Password string
}

type SSHClient struct {
	config     SSHConfig
	sshClient  *ssh.Client
	sftpClient *sftp.Client
}

func NewSSHClient(config SSHConfig) *SSHClient {
	if config.Port == 0 {
		config.Port = 22
	}
	return &SSHClient{config: config}
}

func (c *SSHClient) Connect() error {
	sshConfig := &ssh.ClientConfig{
		User: c.config.Username,
		Auth: []ssh.AuthMethod{
			ssh.Password(c.config.Password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // For home use, simplified
		Timeout:         10 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", c.config.Host, c.config.Port)
	client, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return fmt.Errorf("failed to dial ssh: %w", err)
	}
	c.sshClient = client

	sftp, err := sftp.NewClient(client)
	if err != nil {
		client.Close()
		return fmt.Errorf("failed to create sftp client: %w", err)
	}
	c.sftpClient = sftp

	return nil
}

func (c *SSHClient) Close() {
	if c.sftpClient != nil {
		c.sftpClient.Close()
	}
	if c.sshClient != nil {
		c.sshClient.Close()
	}
}

func (c *SSHClient) ReadDir(path string) ([]os.FileInfo, error) {
	return c.sftpClient.ReadDir(path)
}

func (c *SSHClient) Open(path string) (io.ReadCloser, error) {
	return c.sftpClient.Open(path)
}
