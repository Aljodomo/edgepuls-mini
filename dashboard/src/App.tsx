import { useState, useEffect, useRef } from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { 
  Activity, 
  AlertTriangle, 
  Cpu, 
  Server, 
  Wifi, 
  WifiOff, 
  RefreshCw 
} from "lucide-react";

interface DataPoint {
  time: string;
  timestamp: number;
  value: number;
}

export default function App() {
  const [prometheusUrl, setPrometheusUrl] = useState("http://localhost:9090");
  const [machines, setMachines] = useState<string[]>(["cnc_01"]);
  const [selectedMachine, setSelectedMachine] = useState("cnc_01");
  const [chartData, setChartData] = useState<DataPoint[]>([]);
  const [currentValue, setCurrentValue] = useState<number>(0);
  const [status, setStatus] = useState<"connected" | "disconnected" | "loading">("loading");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isAlerting, setIsAlerting] = useState<boolean>(false);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const refreshIntervalRef = useRef<any>(null);

  const fetchData = async () => {
    try {
      setStatus("loading");
      const now = Math.floor(Date.now() / 1000);
      const start = now - 300;

      const instantRes = await fetch(
        `${prometheusUrl}/api/v1/query?query=machine_vibration_rms_g`
      );
      if (!instantRes.ok) throw new Error("Failed to contact Prometheus API");
      
      const instantJson = await instantRes.json();
      
      if (instantJson.status === "success" && instantJson.data.result) {
        const results = instantJson.data.result;
        const activeMachines: string[] = [];
        let selectedMachineVal = 0;

        results.forEach((r: any) => {
          const mId = r.metric.machine_id;
          if (mId) {
            activeMachines.push(mId);
            if (mId === selectedMachine) {
              selectedMachineVal = parseFloat(r.value[1]);
            }
          }
        });

        if (activeMachines.length > 0) {
          setMachines(Array.from(new Set(activeMachines)));
          if (!activeMachines.includes(selectedMachine)) {
            setSelectedMachine(activeMachines[0]);
          }
        }
        setCurrentValue(selectedMachineVal);
      }

      const rangeRes = await fetch(
        `${prometheusUrl}/api/v1/query_range?query=machine_vibration_rms_g{machine_id="${selectedMachine}"}&start=${start}&end=${now}&step=5s`
      );
      if (!rangeRes.ok) throw new Error("Failed to contact Prometheus Range API");

      const rangeJson = await rangeRes.json();
      if (rangeJson.status === "success" && rangeJson.data.result && rangeJson.data.result.length > 0) {
        const values = rangeJson.data.result[0].values;
        const formattedData: DataPoint[] = values.map((val: any) => {
          const t = val[0];
          const v = parseFloat(val[1]);
          const date = new Date(t * 1000);
          return {
            timestamp: t,
            time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`,
            value: parseFloat(v.toFixed(3))
          };
        });
        setChartData(formattedData);
      } else {
        setChartData([]);
      }

      try {
        const alertsRes = await fetch(`${prometheusUrl}/api/v1/alerts`);
        if (alertsRes.ok) {
          const alertsJson = await alertsRes.json();
          if (alertsJson.status === "success" && alertsJson.data.alerts) {
            const alerts = alertsJson.data.alerts.filter((a: any) => a.state === "firing");
            setActiveAlerts(alerts);
            
            const machineAlert = alerts.some((a: any) => a.labels.machine_id === selectedMachine);
            setIsAlerting(machineAlert);
          }
        }
      } catch (alertErr) {
        console.warn("Could not fetch alerts", alertErr);
      }

      setStatus("connected");
      setErrorMsg("");
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error(err);
      setStatus("disconnected");
      setErrorMsg(err.message || "Unknown error connecting to Prometheus");
      setIsAlerting(false);
    }
  };

  useEffect(() => {
    fetchData();
    refreshIntervalRef.current = setInterval(fetchData, 5000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [selectedMachine, prometheusUrl]);

  const handleManualRefresh = () => {
    fetchData();
  };

  const getAlertColorClass = () => {
    if (isAlerting) return "border-red-500 bg-red-950/40 text-red-400";
    if (currentValue > 3.0) return "border-yellow-500 bg-yellow-950/30 text-yellow-400";
    return "border-emerald-500/30 bg-emerald-950/20 text-emerald-400";
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 text-slate-100 p-6 md:p-10">
      
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-8 w-8 text-indigo-500 animate-pulse" />
              <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-100">
                EdgePulse-Mini
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
                Edge Gateway Demo
              </span>
            </div>
            <p className="text-sm text-slate-400">
              High-frequency sensor telemetry aggregator & anomaly detector
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-900/60 border border-white/5 px-3 py-1.5 rounded-lg text-xs">
              <span className="text-slate-400">Prometheus URL:</span>
              <input 
                type="text" 
                value={prometheusUrl} 
                onChange={(e) => setPrometheusUrl(e.target.value)}
                className="bg-transparent border-none text-indigo-400 focus:outline-none w-40 font-mono"
              />
            </div>
            
            <button 
              onClick={handleManualRefresh}
              className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-white/5 transition-all flex items-center justify-center"
              title="Refresh Now"
            >
              <RefreshCw className={`h-4 w-4 text-slate-400 ${status === 'loading' ? 'animate-spin' : ''}`} />
            </button>

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              status === "connected" 
                ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400"
                : status === "loading"
                ? "bg-indigo-950/20 border-indigo-500/20 text-indigo-400"
                : "bg-red-950/20 border-red-500/20 text-red-400"
            }`}>
              {status === "connected" ? (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  <span>CONNECTED</span>
                </>
              ) : status === "loading" ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>REFRESHING</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  <span>DISCONNECTED</span>
                </>
              )}
            </div>
          </div>
        </header>

        {status === "disconnected" && (
          <div className="border border-red-500/30 bg-red-950/20 text-red-400 p-4 rounded-xl flex items-start gap-3 glass shadow-lg">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-500" />
            <div className="space-y-1">
              <h4 className="font-bold">Failed to connect to Prometheus</h4>
              <p className="text-xs text-red-300">
                Ensure Prometheus is running and port-forwarded correctly to the cluster: 
                <code className="bg-red-950/50 px-1.5 py-0.5 rounded ml-1 font-mono text-white">
                  kubectl port-forward svc/edgepulse-mini-prometheus 9090:9090
                </code>
              </p>
              {errorMsg && <p className="text-xs font-mono text-red-300/80 mt-1">{errorMsg}</p>}
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="glass p-6 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-400">
                <Cpu className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Selected Machine</span>
              </div>
              <h3 className="text-2xl font-bold">Active Sensors</h3>
              <p className="text-xs text-slate-400">
                Vibration sensor streams currently detected in MQTT and scraped by Prometheus.
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block font-semibold">Switch Machine Monitor:</label>
              <div className="flex flex-wrap gap-2">
                {machines.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMachine(m)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                      selectedMachine === m
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20"
                        : "bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={`glass p-6 rounded-2xl shadow-xl flex flex-col justify-between border ${getAlertColorClass()} transition-all duration-300`}>
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-wider opacity-80">RMS Vibration</span>
                </div>
                <h3 className="text-2xl font-bold">Vibration (RMS)</h3>
              </div>
              
              <div className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                isAlerting 
                  ? "bg-red-500/20 border-red-500 text-red-300 animate-pulse" 
                  : currentValue > 3.0 
                  ? "bg-yellow-500/20 border-yellow-500 text-yellow-300" 
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              }`}>
                {isAlerting ? "CRITICAL ALERT Firing" : currentValue > 3.0 ? "WARNING" : "NORMAL"}
              </div>
            </div>

            <div className="my-3 flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tracking-tight">
                {status === "disconnected" ? "—" : currentValue.toFixed(3)}
              </span>
              <span className="text-xl font-bold opacity-70">g</span>
            </div>

            <p className="text-xs opacity-75">
              {isAlerting 
                ? "Vibration exceeds 3.0g critical threshold for >30s!"
                : currentValue > 3.0
                ? "Warning: Transient vibration surge detected. Threshold is 3.0g."
                : "Aggregated RMS value representing filtered high-frequency sensor inputs."}
            </p>
          </div>

          <div className="glass p-6 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-400">
                <Server className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Edge Gateway Specs</span>
              </div>
              <h3 className="text-2xl font-bold">Aggregation Logic</h3>
            </div>
            
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-400">Input Raw Rate:</span>
                <span className="font-semibold text-slate-100">1,000 values/sec</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-400">Aggregator logic:</span>
                <span className="font-semibold text-slate-100">RMS calculation</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-400">Prometheus Scrape Interval:</span>
                <span className="font-semibold text-slate-100">5 seconds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Alert Rule:</span>
                <span className="font-semibold text-red-400">RMS &gt; 3.0g (for 30s)</span>
              </div>
            </div>

            <div className="text-xs bg-slate-900/40 p-2.5 rounded-lg border border-white/5 text-slate-400">
              Last refresh: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>

        </section>

        <section className="glass p-6 md:p-8 rounded-3xl shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/5 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500" />
                RMS Vibration History (5m)
              </h2>
              <p className="text-xs text-slate-400">
                Real-time chart of vibration RMS in g, scraped at 5-second intervals from Prometheus.
              </p>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
              <span>machine_vibration_rms_g</span>
            </div>
          </div>

          <div className="h-[350px] w-full pt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorVibration" x1="0" y1="0" x2="0" y2="1">
                      <stop 
                        offset="5%" 
                        stopColor={isAlerting ? "#ef4444" : "#6366f1"} 
                        stopOpacity={0.4}
                      />
                      <stop 
                        offset="95%" 
                        stopColor={isAlerting ? "#ef4444" : "#6366f1"} 
                        stopOpacity={0.0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#64748b" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 'dataMax + 0.5']}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="RMS Vibration (g)"
                    stroke={isAlerting ? "#ef4444" : "#6366f1"}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorVibration)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 space-y-2 border border-dashed border-white/5 rounded-2xl bg-slate-900/20">
                <Activity className="h-8 w-8 animate-pulse text-slate-600" />
                <span className="text-sm">No data points available for {selectedMachine}.</span>
                <span className="text-xs">Waiting for scraping to populate database...</span>
              </div>
            )}
          </div>
        </section>

        {activeAlerts.length > 0 && (
          <section className="glass p-6 rounded-2xl shadow-xl border border-red-500/20">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-500 animate-bounce" />
              Firing Alerts in Prometheus
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeAlerts.map((alert, idx) => (
                <div key={idx} className="bg-red-950/20 border border-red-500/10 p-3.5 rounded-xl text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-red-300 uppercase">{alert.labels.alertname}</span>
                    <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 font-bold uppercase text-[9px]">
                      {alert.labels.severity}
                    </span>
                  </div>
                  <p className="text-slate-300 font-medium">{alert.annotations.summary || alert.annotations.description}</p>
                  <div className="flex items-center justify-between text-slate-500 text-[10px]">
                    <span>Machine: <code className="text-indigo-400">{alert.labels.machine_id}</code></span>
                    <span>Started: {new Date(alert.startsAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="text-center text-xs text-slate-500 space-y-2">
          <p>
            EdgePulse-Mini Dashboard built with React, Vite, TailwindCSS v4, Recharts, and Lucide React.
          </p>
          <div className="flex justify-center gap-4 text-slate-600">
            <span>Machine Sim: 1000Hz (Python)</span>
            <span>•</span>
            <span>Gateway: RMS Filter (Go)</span>
            <span>•</span>
            <span>Storage: Prometheus TSDB</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
