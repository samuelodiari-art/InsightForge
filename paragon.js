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
    if (series.length < 5) {
      log("Not enough numeric data.");
      return;
    }

    summarySection.classList.remove("hidden");
    chartsSection.classList.remove("hidden");
    logsSection.classList.remove("hidden");

    const avg = mean(series);
    const growth = pct(series);
    const vol = std(series) / avg;
    const confidence = confidenceScore(series, vol);
    const validation = confidence >= 70 ? "Valid" : confidence >= 50 ? "Moderate" : "Weak";

    renderKPIs(avg, growth, vol, confidence, validation);
    renderChart(series);
    log(`Confidence score: ${confidence}% (${validation})`);
  }

  /* ========= KPIs ========= */

  function renderKPIs(avg, growth, vol, confidence, validation) {
    kpiContainer.innerHTML = `
      <div class="kpi"><h3>Metric</h3><p>${metric}</p></div>
      <div class="kpi"><h3>Average</h3><p>${avg.toFixed(2)}</p></div>
      <div class="kpi"><h3>Overall Change</h3><p>${growth.toFixed(2)}%</p></div>
      <div class="kpi"><h3>Volatility</h3><p>${(vol*100).toFixed(1)}%</p></div>
      <div class="kpi"><h3>Confidence</h3><p>${confidence}%</p></div>
      <div class="kpi"><h3>Validation</h3><p>${validation}</p></div>
    `;
  }

  /* ========= CHART + SCENARIOS ========= */

  function renderChart(series) {
    const smooth = ema(series, 0.35);
    const slope = (smooth.at(-1) - smooth[0]) / smooth.length;

    const base = forecast(smooth.at(-1), slope, 6);
    const sigma = std(series);
    const optimistic = base.map(v => v + sigma);
    const pessimistic = base.map(v => v - sigma);

    const ctx = document.getElementById("trendChart").getContext("2d");
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [...series.map((_, i) => `P${i+1}`), ...base.map((_, i) => `F${i+1}`)],
        datasets: [
          { label: "Actual", data: series },
          { label: "Trend", data: smooth, borderDash: [4,4] },
          { label: "Base Forecast", data: [...Array(series.length).fill(null), ...base], borderDash: [6,6] }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    autoCommentary(series, base, optimistic, pessimistic);
  }

  /* ========= EXEC COMMENTARY ========= */

  function autoCommentary(series, base, opt, pess) {
    const dir = series.at(-1) > series[0] ? "upward" : "downward";
    const range = ((opt.at(-1) - pess.at(-1)) / Math.abs(base.at(-1))) * 100;

    execSummary.innerHTML = `
      <h2>Executive Commentary</h2>
      <p>
        ${metric} shows a <strong>${dir}</strong> trend with
        forecast confidence sufficient for planning.
        Scenario analysis indicates a potential variance of
        <strong>±${range.toFixed(1)}%</strong> around the base outlook.
      </p>
    `;
  }

  function generateReport() {
    reportSection.classList.remove("hidden");
    reportKPIs.innerHTML = kpiContainer.innerHTML;
    forecastNotes.textContent =
      "Base, optimistic, and pessimistic scenarios are derived from trend and volatility.";
    riskNotes.textContent =
      "Lower confidence forecasts should be used directionally, not as fixed targets.";
    window.print();
  }

  /* ========= MATH ========= */

  function mean(a){ return a.reduce((x,y)=>x+y,0)/a.length; }
  function std(a){ const m=mean(a); return Math.sqrt(mean(a.map(v=>(v-m)**2))); }
  function pct(a){ return ((a.at(-1)-a[0])/Math.abs(a[0]))*100; }
  function ema(a,α){ const o=[a[0]]; for(let i=1;i<a.length;i++) o.push(α*a[i]+(1-α)*o[i-1]); return o; }
  function forecast(last,s,n){ return Array.from({length:n},(_,i)=>+(last+s*(i+1)).toFixed(2)); }

  function confidenceScore(series, vol){
    let score = 100;
    score -= vol * 200;
    score -= series.length < 30 ? 20 : 0;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function log(msg){ logOutput.textContent += msg + "\n"; }

});
