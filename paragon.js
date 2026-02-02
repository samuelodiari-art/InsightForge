document.addEventListener("DOMContentLoaded", () => {

  /* ========= ELEMENTS ========= */

  const fileInput = document.getElementById("csvFile");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const pdfBtn = document.getElementById("pdfBtn");
  const metricSelect = document.getElementById("metricSelect");

  const summarySection = document.getElementById("summary");
  const chartsSection = document.getElementById("charts");
  const logsSection = document.getElementById("logs");

  const kpiContainer = document.getElementById("kpis");
  const logOutput = document.getElementById("logOutput");

  const execSummary = document.getElementById("execSummary");
  const reportKPIs = document.getElementById("reportKPIs");
  const forecastNotes = document.getElementById("forecastNotes");
  const riskNotes = document.getElementById("riskNotes");
  const reportSection = document.getElementById("report");

  let rows = [];
  let headers = [];
  let numericCols = [];
  let metric = null;
  let chart = null;

  /* ========= EVENTS ========= */

  analyzeBtn.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (!file) {
      alert("Upload a data file first.");
      return;
    }
    resetUI();
    readFile(file);
  });

  metricSelect.addEventListener("change", () => {
    metric = metricSelect.value;
    runAnalysis();
  });

  pdfBtn.addEventListener("click", generateReport);

  /* ========= CORE ========= */

  function resetUI() {
    kpiContainer.innerHTML = "";
    logOutput.textContent = "";
    summarySection.classList.add("hidden");
    chartsSection.classList.add("hidden");
    logsSection.classList.add("hidden");
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = e => parse(e.target.result);
    reader.readAsText(file);
  }

  function parse(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const delims = [",", ";", "\t", "|"];
    const d = delims.find(x => lines[0].split(x).length > 1) || ",";

    headers = lines[0].split(d).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
    rows = lines.slice(1).map(line => {
      const parts = line.split(d);
      const obj = {};
      headers.forEach((h, i) => {
        const n = parseFloat(parts[i]);
        obj[h] = isNaN(n) ? parts[i] : n;
      });
      return obj;
    });

    numericCols = headers.filter(h => rows.some(r => typeof r[h] === "number"));

    metricSelect.innerHTML = numericCols.map(c =>
      `<option value="${c}">${c}</option>`
    ).join("");

    metric = numericCols[0];
    runAnalysis();
  }

  /* ========= ANALYSIS ========= */

  function runAnalysis() {
    if (!metric) return;

    const series = rows.map(r => r[metric]).filter(v => typeof v === "number");
    if (series.length < 6) {
      log("Not enough numeric data for forecasting.");
      return;
    }

    summarySection.classList.remove("hidden");
    chartsSection.classList.remove("hidden");
    logsSection.classList.remove("hidden");

    const avg = mean(series);
    const growth = pct(series);
    const vol = std(series) / avg;

    // --- Forecast math ---
    const smooth = ema(series, 0.35);
    const slope = trendSlope(smooth);

    const base = forecast(smooth.at(-1), slope, 6);
    const sigma = std(series);

    const optimistic = base.map(v => v + sigma);
    const pessimistic = base.map(v => v - sigma);

    // --- Confidence score (soft-scaled) ---
    const confidence = confidenceScore(series.length, vol, slope);
    const validation =
      confidence >= 75 ? "Valid" :
      confidence >= 55 ? "Moderate" : "Weak";

    renderKPIs({
      avg, growth, vol,
      confidence, validation,
      base, optimistic, pessimistic
    });

    renderChart(series, smooth, base, optimistic, pessimistic);
    autoCommentary(confidence, validation, base, optimistic, pessimistic);
  }

  /* ========= KPIs ========= */

  function renderKPIs(data) {
    const nextBase = data.base[0];
    const nextLow = data.pessimistic[0];
    const nextHigh = data.optimistic[0];

    kpiContainer.innerHTML = `
      <div class="kpi"><h3>Metric</h3><p>${metric}</p></div>
      <div class="kpi"><h3>Average</h3><p>${data.avg.toFixed(2)}</p></div>
      <div class="kpi"><h3>Overall Change</h3><p>${data.growth.toFixed(2)}%</p></div>
      <div class="kpi"><h3>Volatility</h3><p>${(data.vol * 100).toFixed(1)}%</p></div>
      <div class="kpi"><h3>Next Forecast</h3><p>${nextBase.toFixed(2)}</p></div>
      <div class="kpi"><h3>Forecast Range</h3><p>${nextLow.toFixed(2)} – ${nextHigh.toFixed(2)}</p></div>
      <div class="kpi"><h3>Confidence</h3><p>${data.confidence}%</p></div>
      <div class="kpi"><h3>Validation</h3><p>${data.validation}</p></div>
    `;
  }

  /* ========= CHART ========= */

  function renderChart(actual, smooth, base, opt, pess) {
    const labels = [
      ...actual.map((_, i) => `P${i + 1}`),
      ...base.map((_, i) => `F${i + 1}`)
    ];

    const ctx = document.getElementById("trendChart").getContext("2d");
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Actual", data: actual },
          { label: "Trend", data: smooth, borderDash: [4, 4] },
          { label: "Base Forecast", data: [...Array(actual.length).fill(null), ...base], borderDash: [6, 6] },
          { label: "Upper Confidence", data: [...Array(actual.length).fill(null), ...opt], borderWidth: 0, fill: "+1" },
          { label: "Lower Confidence", data: [...Array(actual.length).fill(null), ...pess], borderWidth: 0 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  /* ========= EXEC COMMENTARY ========= */

  function autoCommentary(conf, val, base, opt, pess) {
    execSummary.innerHTML = `
      <h2>Executive Commentary</h2>
      <p>
        The selected metric shows a forecast confidence of
        <strong>${conf}%</strong>, classified as <strong>${val}</strong>.
        The next expected value is <strong>${base[0].toFixed(2)}</strong>,
        with a plausible range between
        <strong>${pess[0].toFixed(2)}</strong> and
        <strong>${opt[0].toFixed(2)}</strong>.
      </p>
    `;
  }

  function generateReport() {
    reportSection.classList.remove("hidden");
    reportKPIs.innerHTML = kpiContainer.innerHTML;
    forecastNotes.textContent =
      "Forecast values are derived from trend smoothing and historical variance.";
    riskNotes.textContent =
      "Wider confidence ranges indicate higher uncertainty and require caution.";
    window.print();
  }

  /* ========= MATH ========= */

  function mean(a){ return a.reduce((x,y)=>x+y,0)/a.length; }
  function std(a){ const m=mean(a); return Math.sqrt(mean(a.map(v=>(v-m)**2))); }
  function pct(a){ return ((a.at(-1)-a[0])/Math.abs(a[0]))*100; }
  function ema(a,α){ const o=[a[0]]; for(let i=1;i<a.length;i++) o.push(α*a[i]+(1-α)*o[i-1]); return o; }

  function trendSlope(arr){
    let num=0, den=0;
    for(let i=0;i<arr.length;i++){ num += i*arr[i]; den += i*i; }
    return num / Math.max(1, den);
  }

  function forecast(last,s,n){
    return Array.from({length:n},(_,i)=>+(last+s*(i+1)).toFixed(2));
  }

  function confidenceScore(len, vol, slope){
    let score = 50;
    score += Math.min(30, len);
    score += Math.max(-20, 20 - vol * 100);
    score += Math.min(20, Math.abs(slope) * 10);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function log(msg){ logOutput.textContent += msg + "\n"; }

});
