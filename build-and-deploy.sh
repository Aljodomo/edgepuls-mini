#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Starting EdgePulse-Mini Build and Deployment ===${NC}"

# Check minikube status
if ! minikube status | grep -q "Running"; then
    echo -e "${RED}Minikube is not running! Starting minikube...${NC}"
    minikube start --driver=docker
fi

echo -e "${GREEN}1. Setting up Minikube Docker environment...${NC}"
eval $(minikube -p minikube docker-env)

echo -e "${GREEN}2. Building Machine Simulator image...${NC}"
docker build -t edgepulse/machine-simulator:latest ./machine-simulator

echo -e "${GREEN}3. Building Go Gateway image...${NC}"
docker build -t edgepulse/go-gateway:latest ./go-gateway

echo -e "${GREEN}4. Building React Dashboard image...${NC}"
docker build -t edgepulse/dashboard:latest ./dashboard

echo -e "${GREEN}5. Installing / Upgrading Helm Release...${NC}"
helm upgrade --install edgepulse-mini ./helm/edgepulse-mini --namespace default

echo -e "${BLUE}=== Deployment Completed Successfully! ===${NC}"
echo -e "To access the applications, run the port-forwarding helper script in a new terminal window:"
echo -e "  ${GREEN}./port-forward.sh${NC}"
echo -e "Then open:"
echo -e "  Dashboard:  ${BLUE}http://localhost:8080${NC}"
echo -e "  Prometheus: ${BLUE}http://localhost:9090${NC}"
