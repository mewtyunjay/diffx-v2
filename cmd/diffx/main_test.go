package main

import (
	"bytes"
	"fmt"
	"net"
	"strings"
	"testing"
)

func TestParseConfig(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		args    []string
		want    config
		wantErr bool
	}{
		{
			name: "defaults",
			want: config{
				address:      defaultAddress,
				port:         defaultPort,
				explicitPort: false,
				dev:          false,
				targetPath:   ".",
			},
		},
		{
			name: "custom address port and path",
			args: []string{"-address", "0.0.0.0", "-port", "9090", "frontend"},
			want: config{
				address:      "0.0.0.0",
				port:         9090,
				explicitPort: true,
				dev:          false,
				targetPath:   "frontend",
			},
		},
		{
			name: "short address and port flags",
			args: []string{"-a", "0.0.0.0", "-p", "9090"},
			want: config{
				address:      "0.0.0.0",
				port:         9090,
				explicitPort: true,
				dev:          false,
				targetPath:   ".",
			},
		},
		{
			name: "host alias still works",
			args: []string{"-host", "0.0.0.0"},
			want: config{
				address:      "0.0.0.0",
				port:         defaultPort,
				explicitPort: false,
				dev:          false,
				targetPath:   ".",
			},
		},
		{
			name: "dev mode",
			args: []string{"--dev"},
			want: config{
				address:      defaultAddress,
				port:         defaultPort,
				explicitPort: false,
				dev:          true,
				targetPath:   ".",
			},
		},
		{
			name:    "multiple paths",
			args:    []string{"frontend", "internal"},
			wantErr: true,
		},
		{
			name:    "invalid port",
			args:    []string{"-port", "70000"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := parseConfig(tt.args, &bytes.Buffer{})
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}

			if err != nil {
				t.Fatalf("parseConfig returned error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("parseConfig returned %#v, want %#v", got, tt.want)
			}
		})
	}
}

func TestNormalizeFlagAliases(t *testing.T) {
	t.Parallel()

	got := normalizeFlagAliases([]string{
		"-host",
		"0.0.0.0",
		"--host=localhost",
		"-host=127.0.0.1",
		"--port",
		"9090",
	})

	want := []string{
		"-address",
		"0.0.0.0",
		"--address=localhost",
		"-address=127.0.0.1",
		"--port",
		"9090",
	}

	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("normalizeFlagAliases()[%d] = %q, want %q", index, got[index], want[index])
		}
	}
}

func TestServerURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		addr net.Addr
		want string
	}{
		{
			name: "loopback",
			addr: &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: 8080},
			want: "http://127.0.0.1:8080",
		},
		{
			name: "wildcard IPv4 uses localhost URL",
			addr: &net.TCPAddr{IP: net.ParseIP("0.0.0.0"), Port: 8080},
			want: "http://127.0.0.1:8080",
		},
		{
			name: "wildcard IPv6 uses localhost URL",
			addr: &net.TCPAddr{IP: net.ParseIP("::"), Port: 8080},
			want: "http://127.0.0.1:8080",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := serverURL(tt.addr); got != tt.want {
				t.Fatalf("serverURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestListenWithPortFallbackSkipsOccupiedPorts(t *testing.T) {
	startPort, listeners := reserveContiguousPorts(t, 3)
	defer closeListeners(listeners)

	if err := listeners[2].Close(); err != nil {
		t.Fatalf("close free slot listener: %v", err)
	}
	listeners[2] = nil

	listener, err := listenWithPortFallback(defaultAddress, startPort, 3)
	if err != nil {
		t.Fatalf("listenWithPortFallback returned error: %v", err)
	}
	defer listener.Close()

	if got := listenerPort(listener.Addr()); got != startPort+2 {
		t.Fatalf("listenerPort() = %d, want %d", got, startPort+2)
	}
}

func TestListenWithPortFallbackReturnsErrorWhenRangeExhausted(t *testing.T) {
	startPort, listeners := reserveContiguousPorts(t, 2)
	defer closeListeners(listeners)

	_, err := listenWithPortFallback(defaultAddress, startPort, 2)
	if err == nil {
		t.Fatal("expected error")
	}

	if !strings.Contains(err.Error(), fmt.Sprintf("no ports available in range %d-%d", startPort, startPort+1)) {
		t.Fatalf("expected range exhaustion error, got %v", err)
	}
}

func TestListenForConfigExplicitPortDoesNotFallback(t *testing.T) {
	startPort, listeners := reserveContiguousPorts(t, 2)
	defer closeListeners(listeners)

	if err := listeners[1].Close(); err != nil {
		t.Fatalf("close next port listener: %v", err)
	}
	listeners[1] = nil

	_, err := listenForConfig(config{
		address:      defaultAddress,
		port:         startPort,
		explicitPort: true,
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "address already in use") {
		t.Fatalf("expected address in use error, got %v", err)
	}
}

func TestListenWithPortFallbackReturnsDirectListenErrors(t *testing.T) {
	_, err := listenWithPortFallback("256.0.0.1", defaultPort, 2)
	if err == nil {
		t.Fatal("expected error")
	}
	if strings.Contains(err.Error(), "no ports available in range") {
		t.Fatalf("expected direct listen error, got %v", err)
	}
}

func reserveContiguousPorts(t *testing.T, count int) (int, []net.Listener) {
	t.Helper()

	for startPort := 20000; startPort <= 60000-count; startPort++ {
		listeners := make([]net.Listener, 0, count)
		ok := true

		for offset := 0; offset < count; offset++ {
			listener, err := net.Listen("tcp", fmt.Sprintf("%s:%d", defaultAddress, startPort+offset))
			if err != nil {
				ok = false
				break
			}
			listeners = append(listeners, listener)
		}

		if ok {
			return startPort, listeners
		}

		closeListeners(listeners)
	}

	t.Fatal("could not reserve contiguous ports")
	return 0, nil
}

func closeListeners(listeners []net.Listener) {
	for _, listener := range listeners {
		if listener == nil {
			continue
		}
		_ = listener.Close()
	}
}
