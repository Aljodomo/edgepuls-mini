#!/bin/bash

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Starting Port Forwarding for EdgePulse-Mini ===${NC}"
echo "Dashboard will be accessible at:  http://localhost:8080"
echo "Prometheus will be accessible at: http://localhost:9090"
echo "Press [Ctrl+C] to stop port forwarding."

pkill -f "port-forward svc/edgepulse-mini" || true
sleep 1

kubectl port-forward svc/edgepulse-mini-dashboard 8080:80 > /dev/null 2>&1 &
DASHBOARD_PID=$!

kubectl port-forward svc/edgepulse-mini-prometheus 9090:9090 > /dev/null 2>&1 &
PROM_PID=$!

trap "echo -e '\n${BLUE}Stopping port forwarding...${NC}'; kill $DASHBOARD_PID $PROM_PID 2>/dev/null; exit 0" INT TERM EXIT

wait
