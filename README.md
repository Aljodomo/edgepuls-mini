# EdgePulse-Mini

EdgePulse-Mini is a demonstration project showcasing a complete pipeline of high-frequency raw data from a simulated machine down to a real-time dashboard. The project is designed to run locally on a Kubernetes cluster using Minikube and Helm.

## Demo Dashboard

Check out the dashboard in action:

[![EdgePulse-Mini Dashboard Demo](https://img.youtube.com/vi/CQJ0UnxA4gA/0.jpg)](https://youtu.be/CQJ0UnxA4gA)

## Architecture

The system consists of the following components:

1. **Machine Simulator (Python)**
   - Simulates a CNC machine's vibration sensor.
   - Generates a continuous, noisy sine wave at high frequency (e.g., 1,000 values per second).
   - Publishes JSON payloads to an MQTT broker under the topic `factory/machines/vibration`.

2. **MQTT Broker (Eclipse Mosquitto)**
   - A lightweight message broker that facilitates communication between the simulator and the gateway.

3. **Edge Gateway (Go)**
   - Subscribes to the MQTT topic.
   - Aggregates the high-frequency data buffer every second.
   - Calculates the RMS (Root Mean Square) value to represent the effective vibration.
   - Exposes these calculated metrics for Prometheus to scrape.

4. **Prometheus**
   - Scrapes metrics from the Go Gateway.
   - Evaluates alerting rules (e.g., if the RMS vibration exceeds a critical threshold).
   - Exposes an API for the dashboard to fetch real-time metrics.

5. **Real-time Dashboard (React + TypeScript)**
   - Built with Vite, React, Tailwind CSS, Recharts, and shadcn/ui.
   - Fetches the current RMS vibration metrics and machine status directly from Prometheus.
   - Displays real-time charts and status indicators.

## Tech Stack

- **Infrastructure**: Kubernetes (Minikube), Helm, Docker
- **Message Broker**: Eclipse Mosquitto (MQTT)
- **Data Generator**: Python
- **Data Aggregation**: Go (Golang)
- **Monitoring & Metrics**: Prometheus
- **Frontend UI**: React, TypeScript, Vite, Tailwind CSS, Recharts

## Prerequisites

Before running the project, ensure you have the following installed:
- [Docker](https://docs.docker.com/get-docker/)
- [Minikube](https://minikube.sigs.k8s.io/docs/start/)
- [Helm](https://helm.sh/docs/intro/install/)
- bash

## How to Run

1. **Start Minikube**
   Ensure Docker is running, then start your local Kubernetes cluster:
   ```bash
   minikube start
   ```

2. **Build Images and Deploy**
   We provide a handy script to build the local Docker images inside the Minikube environment and deploy the Helm chart:
   ```bash
   ./build-and-deploy.sh
   ```

3. **Port Forward**
   Once the pods are running, open the necessary ports to access the dashboard and Prometheus locally:
   ```bash
   ./port-forward.sh
   ```

4. **Access the Applications**
   - **Dashboard**: [http://localhost:8080](http://localhost:8080)
   - **Prometheus**: [http://localhost:9090](http://localhost:9090)

## Modifying the Application

If you make changes to the code, simply re-run `./build-and-deploy.sh` to update the Docker images and roll out the new version using Helm.
