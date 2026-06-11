#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Starting Port Forwarding for EdgePulse-Mini ===${NC}"
echo "Dashboard will be accessible at:  http://localhost:8080"
echo "Prometheus will be accessible at: http://localhost:9090"
echo "Press [Ctrl+C] to stop port forwarding."

# Kill existing port forwards to prevent port bind errors
pkill -f "port-forward svc/edgepulse-mini" || true
sleep 1

# Start port forwarding for React Dashboard in the background
kubectl port-forward svc/edgepulse-mini-dashboard 8080:80 > /dev/null 2>&1 &
DASHBOARD_PID=$!

# Start port forwarding for Prometheus in the background
kubectl port-forward svc/edgepulse-mini-prometheus 9090:9090 > /dev/null 2>&1 &
PROM_PID=$!

# Handle shutdown gracefully on Ctrl+C
trap "echo -e '\n${BLUE}Stopping port forwarding...${NC}'; kill $DASHBOARD_PID $PROM_PID 2>/dev/null; exit 0" INT TERM EXIT

# Keep script running and wait for background processes
wait
