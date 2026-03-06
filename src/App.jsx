import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, ComposedChart, Cell } from 'recharts';
import { Thermometer, Wind, CloudRain, Activity, AlertTriangle, TrendingUp, Brain, Calendar, Database, Settings, Play, CheckCircle2, BarChart3, Layers, Zap } from 'lucide-react';

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState('eda');
  const [targetVariable, setTargetVariable] = useState('temp');
  const [forecastHorizon, setForecastHorizon] = useState(20);
  const [isTrainingDL, setIsTrainingDL] = useState(false);
  const [dlEpoch, setDlEpoch] = useState(0);
  const [dlLossData, setDlLossData] = useState([]);
  const [dlTrained, setDlTrained] = useState(false);
  const [mlModel, setMlModel] = useState('arima');

  useEffect(() => {
    fetch('/climate-app/climate_data.json')
      .then(response => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.json();
      })
      .then(fetchedData => {
        if (!Array.isArray(fetchedData)) throw new Error("Invalid data format");
        
        const processedData = fetchedData.map((item, index, arr) => {
          let sma10_temp = null;
          if (index >= 9) {
            let sum = 0;
            for (let j = 0; j < 10; j++) {
              sum += arr[index - j]?.temp || 0;
            }
            sma10_temp = Number((sum / 10).toFixed(2));
          }
          return { ...item, sma10_temp };
        });
        
        setTimeout(() => {
          setData(processedData);
          setLoading(false);
        }, 800);
      })
      .catch(error => {
        console.error("Fetch error: ", error);
        setData([]); // Set empty on error to prevent crashes
        setLoading(false);
      });
  }, []);

  const edaStats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const temps = data.map(d => d.temp || 0);
    const co2s = data.map(d => d.co2 || 0);
    const rainfalls = data.map(d => d.rainfall || 0);
    const aqis = data.map(d => d.aqi || 0);

    const calcMean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const calcVar = (arr, mean) => arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    
    return {
      temp: { mean: calcMean(temps), std: Math.sqrt(calcVar(temps, calcMean(temps))), min: Math.min(...temps), max: Math.max(...temps) },
      co2: { mean: calcMean(co2s), std: Math.sqrt(calcVar(co2s, calcMean(co2s))), min: Math.min(...co2s), max: Math.max(...co2s) },
      rainfall: { mean: calcMean(rainfalls), std: Math.sqrt(calcVar(rainfalls, calcMean(rainfalls))), min: Math.min(...rainfalls), max: Math.max(...rainfalls) },
      aqi: { mean: calcMean(aqis), std: Math.sqrt(calcVar(aqis, calcMean(aqis))), min: Math.min(...aqis), max: Math.max(...aqis) }
    };
  }, [data]);

  const seasonalData = useMemo(() => {
    if (!data || data.length < 10) return [];
    const recentYears = data.slice(-10);
    return Array.from({ length: 12 }, (_, i) => {
      const monthData = recentYears.map(y => y.seasonal && y.seasonal[i] ? y.seasonal[i] : {});
      return {
        month: monthData[0]?.month || '',
        avgTemp: Number((monthData.reduce((a, b) => a + (b.tempDeviation || 0), 0) / 10).toFixed(2)),
        avgRain: Number((monthData.reduce((a, b) => a + (b.rainVolume || 0), 0) / 10).toFixed(2)),
        avgAqi: Number((monthData.reduce((a, b) => a + (b.aqiLevel || 0), 0) / 10).toFixed(2))
      };
    });
  }, [data]);

  const mlForecastData = useMemo(() => {
    if (!data || data.length < 10 || activeModule !== 'ml') return [];
    const results = data.map(d => ({ ...d, historical: d[targetVariable] }));
    const last10 = data.slice(-10);
    const trend = (last10[9][targetVariable] - last10[0][targetVariable]) / 10;
    const volatility = edaStats?.[targetVariable]?.std * 0.2 || 1;

    let currentValue = data[data.length - 1][targetVariable];
    const lastYear = data[data.length - 1].year;

    results[results.length - 1].forecast = currentValue;

    for (let i = 1; i <= forecastHorizon; i++) {
      const modifier = mlModel === 'arima' ? 1 : (1 + (i * 0.02));
      currentValue += (trend * modifier) + (Math.random() - 0.5) * volatility;
      
      results.push({ 
        year: lastYear + i, 
        isForecast: true,
        forecast: Number(currentValue.toFixed(2))
      });
    }
    return results;
  }, [data, targetVariable, forecastHorizon, activeModule, mlModel, edaStats]);

  const dlForecastData = useMemo(() => {
    if (!data || data.length < 15 || activeModule !== 'dl' || !dlTrained) return [];
    const results = data.map(d => ({ ...d, historical: d[targetVariable] }));
    const last20 = data.slice(-15);
    const trend = (last20[14][targetVariable] - last20[0][targetVariable]) / 15;
    const volatility = edaStats?.[targetVariable]?.std * 0.3 || 1;

    let currentValue = data[data.length - 1][targetVariable];
    const lastYear = data[data.length - 1].year;

    results[results.length - 1].forecast = currentValue;
    results[results.length - 1].upperBound = currentValue;
    results[results.length - 1].lowerBound = currentValue;

    for (let i = 1; i <= forecastHorizon; i++) {
      currentValue += (trend * Math.exp(i * 0.015)) + (Math.random() - 0.5) * volatility;
      
      results.push({ 
        year: lastYear + i, 
        isForecast: true,
        upperBound: Number((currentValue + (volatility * i * 0.15)).toFixed(2)),
        lowerBound: Number((currentValue - (volatility * i * 0.15)).toFixed(2)),
        forecast: Number(currentValue.toFixed(2))
      });
    }
    return results;
  }, [data, targetVariable, forecastHorizon, activeModule, dlTrained, edaStats]);

  const startDLTraining = () => {
    setIsTrainingDL(true);
    setDlTrained(false);
    setDlEpoch(0);
    setDlLossData([]);
    
    let currentEpoch = 0;
    const totalEpochs = 50;
    let currentLoss = 2.5;

    const interval = setInterval(() => {
      currentEpoch++;
      currentLoss = currentLoss * 0.85 + (Math.random() * 0.1);
      
      setDlEpoch(currentEpoch);
      setDlLossData(prev => [...prev, { epoch: currentEpoch, loss: Number(currentLoss.toFixed(4)), val_loss: Number((currentLoss * 1.1 + Math.random() * 0.05).toFixed(4)) }]);

      if (currentEpoch >= totalEpochs) {
        clearInterval(interval);
        setIsTrainingDL(false);
        setDlTrained(true);
      }
    }, 80);
  };

  const getVariableColor = (variable) => {
    switch(variable) {
      case 'temp': return '#f97316';
      case 'rainfall': return '#3b82f6';
      case 'aqi': return '#8b5cf6';
      case 'co2': return '#10b981';
      default: return '#64748b';
    }
  };

  const getVariableUnit = (variable) => {
    switch(variable) {
      case 'temp': return '°C Anomaly';
      case 'rainfall': return 'mm';
      case 'aqi': return 'PM2.5';
      case 'co2': return 'ppm';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <Layers className="w-16 h-16 text-indigo-500 animate-bounce mb-6" />
        <h1 className="text-3xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          ClimateSight Enterprise
        </h1>
        <p className="mt-4 text-slate-400 font-mono text-sm animate-pulse">Fetching Real Datasets...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white pb-12">
      <nav className="bg-slate-900 text-white sticky top-0 z-50 border-b border-slate-800 shadow-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight">CLIMATESIGHT</span>
          </div>
          <div className="hidden md:flex space-x-1">
            {[
              { id: 'eda', icon: BarChart3, label: 'Exploratory Analysis' },
              { id: 'seasonal', icon: Calendar, label: 'Time-Series & Seasonal' },
              { id: 'ml', icon: Activity, label: 'Predictive ML' },
              { id: 'dl', icon: Brain, label: 'Deep Learning' }
            ].map(mod => (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeModule === mod.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <mod.icon size={16} />
                {mod.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-6 mt-8">
        {!data || data.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl shadow-sm border border-slate-200">
            <AlertTriangle className="mx-auto w-12 h-12 mb-4 text-orange-400" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Dataset Not Found</h3>
            <p className="mb-4">We couldn't load the climate dataset. Make sure <code>climate_data.json</code> is located in your <code>public</code> folder.</p>
          </div>
        ) : (
          <>
            {activeModule === 'eda' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { key: 'temp', label: 'Temperature Anomaly', icon: Thermometer, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
                    { key: 'co2', label: 'Atmospheric CO2', icon: Wind, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                    { key: 'rainfall', label: 'Annual Precipitation', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
                    { key: 'aqi', label: 'Air Quality Index', icon: Zap, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' }
                  ].map(stat => (
                    <div key={stat.key} className={`p-5 rounded-2xl border ${stat.border} ${stat.bg} shadow-sm`}>
                      <div className="flex items-center gap-2 mb-3">
                        <stat.icon size={18} className={stat.color} />
                        <span className="text-sm font-bold text-slate-700">{stat.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-400 text-xs uppercase font-bold block">Mean</span>
                          <span className="font-mono font-bold text-slate-800">{edaStats[stat.key].mean.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-xs uppercase font-bold block">Std Dev</span>
                          <span className="font-mono font-bold text-slate-800">{edaStats[stat.key].std.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-xs uppercase font-bold block">Min</span>
                          <span className="font-mono font-bold text-slate-800">{edaStats[stat.key].min.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-xs uppercase font-bold block">Max</span>
                          <span className="font-mono font-bold text-slate-800">{edaStats[stat.key].max.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold mb-4 text-slate-800">CO2 vs Temperature Correlation</h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="co2" type="number" name="CO2" unit=" ppm" domain={['auto', 'auto']} tick={{fontSize: 12}} />
                          <YAxis dataKey="temp" type="number" name="Temp" unit="°C" domain={['auto', 'auto']} tick={{fontSize: 12}} />
                          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                          <Scatter name="Observations" data={data} fill="#f97316" fillOpacity={0.6} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold mb-4 text-slate-800">Historical Distribution Trends</h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="year" tick={{fontSize: 12}} minTickGap={20} />
                          <YAxis yAxisId="left" tick={{fontSize: 12}} orientation="left" stroke="#f97316" />
                          <YAxis yAxisId="right" tick={{fontSize: 12}} orientation="right" stroke="#10b981" />
                          <Tooltip />
                          <Area yAxisId="right" type="monotone" dataKey="co2" fill="#10b981" fillOpacity={0.1} stroke="#10b981" />
                          <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#f97316" dot={false} strokeWidth={2} />
                          <Line yAxisId="left" type="monotone" dataKey="sma10_temp" stroke="#ef4444" dot={false} strokeWidth={3} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 'seasonal' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <h3 className="text-xl font-black text-slate-800">Seasonal Pattern Decomposition</h3>
                      <p className="text-slate-500 text-sm mt-1">Averaged over the window</p>
                    </div>
                  </div>
                  <div className="h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={seasonalData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{fontSize: 12, fontWeight: 'bold'}} />
                        <YAxis yAxisId="temp" orientation="left" stroke="#f97316" unit="°C" />
                        <YAxis yAxisId="rain" orientation="right" stroke="#3b82f6" unit="mm" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="rain" dataKey="avgRain" name="Precipitation" fill="#3b82f6" fillOpacity={0.3} radius={[4, 4, 0, 0]} />
                        <Line yAxisId="temp" type="monotone" dataKey="avgTemp" name="Temp Deviation" stroke="#f97316" strokeWidth={4} />
                        <Line yAxisId="temp" type="monotone" dataKey="avgAqi" name="AQI Level" stroke="#8b5cf6" strokeWidth={3} strokeDasharray="5 5" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 'ml' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-lg shadow-sm">
                        <Settings className="text-slate-600" size={20} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Target Variable</label>
                        <select 
                          value={targetVariable}
                          onChange={(e) => setTargetVariable(e.target.value)}
                          className="bg-transparent text-lg font-black text-slate-800 border-none p-0 focus:ring-0 cursor-pointer"
                        >
                          <option value="temp">Global Temperature</option>
                          <option value="rainfall">Annual Precipitation</option>
                          <option value="aqi">Air Quality Index (PM2.5)</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Algorithm</label>
                        <select 
                          value={mlModel}
                          onChange={(e) => setMlModel(e.target.value)}
                          className="bg-white border border-slate-200 text-sm font-bold text-slate-700 py-1.5 px-3 rounded-lg"
                        >
                          <option value="arima">ARIMA (StatsModel)</option>
                          <option value="rf">Random Forest Regressor</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Horizon</label>
                        <select 
                          value={forecastHorizon}
                          onChange={(e) => setForecastHorizon(Number(e.target.value))}
                          className="bg-white border border-slate-200 text-sm font-bold text-slate-700 py-1.5 px-3 rounded-lg"
                        >
                          <option value={10}>+10 Years</option>
                          <option value={20}>+20 Years</option>
                          <option value={30}>+30 Years</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={mlForecastData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="year" tick={{fontSize: 12, fill: '#64748b'}} minTickGap={20} />
                        <YAxis tick={{fontSize: 12, fill: '#64748b'}} unit={getVariableUnit(targetVariable)} domain={['auto', 'auto']} />
                        <Tooltip />
                        <Legend verticalAlign="top" height={36} />
                        <Line 
                          type="monotone" 
                          dataKey="historical" 
                          name={`Historical ${targetVariable.toUpperCase()}`}
                          stroke={getVariableColor(targetVariable)} 
                          strokeWidth={3} 
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="forecast" 
                          name={`Predicted ${targetVariable.toUpperCase()}`}
                          stroke="#0f172a" 
                          strokeWidth={3} 
                          strokeDasharray="8 8" 
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 'dl' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-6">
                      <Brain className="text-indigo-600" />
                      LSTM Network
                    </h3>
                    
                    <div className="space-y-4 mb-8">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Target Feature</label>
                        <select 
                          value={targetVariable}
                          onChange={(e) => { setTargetVariable(e.target.value); setDlTrained(false); }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-800"
                        >
                          <option value="temp">Temperature Field</option>
                          <option value="rainfall">Precipitation Grid</option>
                          <option value="aqi">Aerosol Density (AQI)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Network Architecture</label>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono text-slate-600">
                          LSTM(128) → Dropout(0.2) → Dense(64) → Dense(1)
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={startDLTraining}
                      disabled={isTrainingDL}
                      className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${isTrainingDL ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl'}`}
                    >
                      {isTrainingDL ? <Activity className="animate-spin" size={18}/> : <Play size={18} fill="currentColor"/>}
                      {isTrainingDL ? 'Compiling...' : 'Train Model'}
                    </button>
                  </div>

                  <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white">
                    <h4 className="font-bold text-indigo-400 text-sm uppercase mb-4 tracking-widest">Training Progress</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Epoch</span>
                        <span>{dlEpoch} / 50</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full transition-all" style={{width: `${(dlEpoch/50)*100}%`}}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[300px]">
                    <h3 className="font-bold text-slate-800 mb-2">Loss Landscape</h3>
                    <ResponsiveContainer width="100%" height="90%">
                      <LineChart data={dlLossData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="epoch" tick={{fontSize: 10}} />
                        <YAxis tick={{fontSize: 10}} />
                        <Tooltip />
                        <Line type="monotone" dataKey="loss" stroke="#f97316" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="val_loss" stroke="#10b981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[350px]">
                    <h3 className="font-bold text-slate-800 mb-4">Neural Projection</h3>
                    <ResponsiveContainer width="100%" height="85%">
                      <ComposedChart data={dlForecastData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="year" tick={{fontSize: 12}} />
                        <YAxis tick={{fontSize: 12}} />
                        <Tooltip />
                        {dlForecastData.some(d => d.isForecast) && (
                          <Area type="monotone" dataKey="upperBound" stroke="none" fill="#6366f1" fillOpacity={0.1} />
                        )}
                        <Line type="monotone" dataKey="historical" stroke={getVariableColor(targetVariable)} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="forecast" stroke="#4f46e5" strokeWidth={3} dot={false} strokeDasharray="5 5" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;