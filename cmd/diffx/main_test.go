package main

import (
	"bytes"
	"net"
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
				host:       "127.0.0.1",
				port:       8080,
				targetPath: ".",
			},
		},
		{
			name: "custom host port and path",
			args: []string{"-host", "0.0.0.0", "-port", "9090", "frontend"},
			want: config{
				host:       "0.0.0.0",
				port:       9090,
				targetPath: "frontend",
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
