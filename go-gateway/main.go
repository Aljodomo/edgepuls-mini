package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	vibrationGauge = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "machine_vibration_rms_g",
			Help: "Gefilterter RMS-Wert der Maschinenvibration in g.",
		},
		[]string{"machine_id"},
	)
)

func init() {
	prometheus.MustRegister(vibrationGauge)
}

type VibrationMessage struct {
	MachineID  string  `json:"machine_id"`
	VibrationG float64 `json:"vibration_g"`
	Timestamp  int64   `json:"ts"`
}

type MachineBuffer struct {
	mu         sync.Mutex
	vibrations []float64
}

var (
	buffers   = make(map[string]*MachineBuffer)
	buffersMu sync.RWMutex
)

func getOrCreateBuffer(machineID string) *MachineBuffer {
	buffersMu.RLock()
	buf, exists := buffers[machineID]
	buffersMu.RUnlock()

	if exists {
		return buf
	}

	buffersMu.Lock()
	defer buffersMu.Unlock()
	if buf, exists = buffers[machineID]; exists {
		return buf
	}

	buf = &MachineBuffer{
		vibrations: make([]float64, 0, 1000),
	}
	buffers[machineID] = buf
	return buf
}

func main() {
	brokerHost := getEnv("MQTT_BROKER_HOST", "localhost")
	brokerPort := getEnv("MQTT_BROKER_PORT", "1883")
	brokerURI := fmt.Sprintf("tcp://%s:%s", brokerHost, brokerPort)

	opts := mqtt.NewClientOptions().AddBroker(brokerURI)
	opts.SetClientID("go_edge_gateway")
	opts.SetCleanSession(true)
	opts.SetAutoReconnect(true)
	opts.SetConnectRetry(true)

	opts.SetOnConnectHandler(func(client mqtt.Client) {
		log.Println("Connected to MQTT broker.")
		topic := "factory/machines/vibration"
		token := client.Subscribe(topic, 0, handleMessage)
		if token.Wait() && token.Error() != nil {
			log.Fatalf("Error subscribing to topic: %v", token.Error())
		}
		log.Printf("Subscribed to topic: %s", topic)
	})

	client := mqtt.NewClient(opts)
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		log.Printf("Error connecting to MQTT: %v. Will retry in background...", token.Error())
	}

	go func() {
		ticker := time.NewTicker(1 * time.Second)
		for range ticker.C {
			calculateAndPublishRMS()
		}
	}()

	http.Handle("/metrics", promhttp.Handler())
	port := getEnv("PORT", "8080")
	log.Printf("Starting HTTP server on port %s...", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("HTTP server failed: %v", err)
	}
}

func handleMessage(client mqtt.Client, msg mqtt.Message) {
	var val VibrationMessage
	if err := json.Unmarshal(msg.Payload(), &val); err != nil {
		log.Printf("Error unmarshalling payload: %v", err)
		return
	}

	if val.MachineID == "" {
		return
	}

	buf := getOrCreateBuffer(val.MachineID)
	buf.mu.Lock()
	buf.vibrations = append(buf.vibrations, val.VibrationG)
	buf.mu.Unlock()
}

func calculateAndPublishRMS() {
	buffersMu.RLock()
	machineIDs := make([]string, 0, len(buffers))
	for id := range buffers {
		machineIDs = append(machineIDs, id)
	}
	buffersMu.RUnlock()

	for _, id := range machineIDs {
		buf := getOrCreateBuffer(id)
		
		buf.mu.Lock()
		count := len(buf.vibrations)
		if count == 0 {
			buf.mu.Unlock()
			vibrationGauge.WithLabelValues(id).Set(0)
			continue
		}
		
		localVibrations := make([]float64, count)
		copy(localVibrations, buf.vibrations)
		buf.vibrations = buf.vibrations[:0]
		buf.mu.Unlock()

		var sumSquares float64
		for _, v := range localVibrations {
			sumSquares += v * v
		}
		rms := math.Sqrt(sumSquares / float64(count))

		vibrationGauge.WithLabelValues(id).Set(rms)
	}
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return defaultVal
}
