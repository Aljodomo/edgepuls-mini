import time
import math
import random
import json
import os
import paho.mqtt.client as mqtt

machine_id = os.environ.get("MACHINE_ID", "cnc_01")
broker_host = os.environ.get("MQTT_BROKER_HOST", "localhost")
broker_port = int(os.environ.get("MQTT_BROKER_PORT", 1883))
base_freq = float(os.environ.get("VIBRATION_FREQ", 10.0))
base_amplitude = float(os.environ.get("VIBRATION_AMPLITUDE", 1.5))
noise_level = float(os.environ.get("NOISE_LEVEL", 0.2))

client = mqtt.Client(client_id=f"sim_{machine_id}", clean_session=True)

print(f"Connecting to MQTT broker at {broker_host}:{broker_port}...")
client.connect(broker_host, broker_port, 60)
client.loop_start()

topic = "factory/machines/vibration"

print(f"Starting vibration simulation for '{machine_id}'")
print(f"Configuration: Base Freq = {base_freq}Hz, Base Amplitude = {base_amplitude}g, Noise = {noise_level}")
print(f"Publishing to topic: {topic}")

start_time = time.time()
sent_count = 0

target_hz = 1000
interval = 1.0 / target_hz

try:
    while True:
        now = time.time()
        elapsed = now - start_time
        
        expected_sent = int(elapsed * target_hz)
        
        while sent_count < expected_sent:
            t = start_time + sent_count * interval
            
            cycle_time = t % 120.0
            is_anomaly = 60.0 <= cycle_time <= 100.0
            
            amplitude = base_amplitude
            if is_anomaly:
                amplitude = base_amplitude * 2.5
                
            vibration = amplitude * math.sin(2 * math.pi * base_freq * t) + random.normalvariate(0, noise_level)
            
            payload = {
                "machine_id": machine_id,
                "vibration_g": round(vibration, 4),
                "ts": int(t)
            }
            
            client.publish(topic, json.dumps(payload))
            sent_count += 1
            
        time.sleep(0.0005)

except KeyboardInterrupt:
    print("Stopping simulator...")
finally:
    client.loop_stop()
    client.disconnect()
    print("Disconnected.")
