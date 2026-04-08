package main

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"syscall"
)

func listenForConfig(cfg config) (net.Listener, error) {
	if cfg.explicitPort || cfg.port != defaultPort {
		return net.Listen("tcp", net.JoinHostPort(cfg.address, strconv.Itoa(cfg.port)))
	}

	return listenWithPortFallback(cfg.address, cfg.port, portFallbackWindow)
}

func listenWithPortFallback(address string, startPort, window int) (net.Listener, error) {
	endPort := startPort + window - 1
	if endPort > 65535 {
		endPort = 65535
	}

	var lastErr error
	for port := startPort; port <= endPort; port++ {
		listener, err := net.Listen("tcp", net.JoinHostPort(address, strconv.Itoa(port)))
		if err == nil {
			return listener, nil
		}
		if !errors.Is(err, syscall.EADDRINUSE) {
			return nil, err
		}

		lastErr = err
	}

	if lastErr == nil {
		return nil, fmt.Errorf("no ports available in range %d-%d", startPort, endPort)
	}

	return nil, fmt.Errorf("no ports available in range %d-%d: %w", startPort, endPort, lastErr)
}

func serverURL(addr net.Addr) string {
	tcpAddr, ok := addr.(*net.TCPAddr)
	if !ok {
		return addr.String()
	}

	host := tcpAddr.IP.String()
	switch host {
	case "", "0.0.0.0", "::":
		host = "127.0.0.1"
	}

	return (&url.URL{
		Scheme: "http",
		Host:   net.JoinHostPort(host, strconv.Itoa(tcpAddr.Port)),
	}).String()
}

func listenerPort(addr net.Addr) int {
	tcpAddr, ok := addr.(*net.TCPAddr)
	if !ok {
		return 0
	}

	return tcpAddr.Port
}
