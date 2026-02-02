document.addEventListener("DOMContentLoaded", () => {

  /* =====================
     ELEMENT REFERENCES
  ====================== */

  const analyzeBtn = document.getElementById("analyzeBtn");
  const pdfBtn = document.getElementById("pdfBtn");
  const fileInput = document.getElementById("csvFile");

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

  /* =====================
     STATE
  ====================== */

  let rawRows = [];
  let headers = [];
  let numericColumns = [];
  let metricColumn = null;
  let timeColumn = null;
  let chart = null;

  /* =====================
     EVENTS
  ====================== */

  analyzeBtn.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (!file) {
      alert("Please upload a data file first.");
      return;
    }
    resetUI();
    readFile(file);
  });

  pdfBtn.addEventListener("click", generateReport);

  /* =====================
     CORE FLOW
  ====================== */

  function resetUI() {
    kpiContainer.innerHTML = "";
    logOutput.textContent = "";
    summarySection.classList.add("hidden");
    chartsSection.classList.add("hidden");
    logsSection.classList.add("hidden");
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = e => parseText(e.target.result);
    reader.readAsText(file);
  }

  /* =====================
     ROBUST DATA PARSER
  ====================== */

  function parseText(text) {
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    log(`Lines read: ${lines.length}`);
    log(`Preview: ${lines.slice(0, 3).join(" | ")}`);

    // Detect delimiter
    const delimiters = [",", ";", "\t", "|"];
    let delimiter = delimiters.find(d => lines[0].split(d).length > 1);

    if (!delimiter) {
      log("No standard delimiter found. Falling back to whitespace parsing.");
      parseWhitespace(lines);
      return;
    }

    headers = sanitizeHeaders(lines[0].split(delimiter));

    rawRows = lines.slice(1).map(line => {
      const parts = line.split(delimiter);
      const row = {};
      headers.forEach((h, i) => {
        const v = parts[i]?.trim();
        const n = parseFloat(v);
        row[h] = isNaN(n) ? v : n;
      });
      return row;
    });

    finalizeAnalysis();
  }

  function parseWhitespace(lines) {
    const cols = lines[0].split(/\s+/);
    headers = cols.map((_, i) => `Column_${i + 1}`);

    rawRows = lines.map(line => {
      const parts = line.split(/\s+/);
      const row = {};
      headers.forEach((h, i) => {
        const v = parts[i];
        const n = parseFloat(v);
        row[h] = isNaN(n) ? v : n;
      });
      return row;
    });

    finalizeAnalysis();
  }

  function sanitizeHeaders(hs) {
    return hs.map(h =>
      h.toLowerCase().replace(/[^a-z0-9_]/g, "_")
    );
  }

  /* =====================
     ANALYSIS SETUP
  ====================== */

  function finalizeAnalysis() {
    numericColumns = headers.filter(h =>
      rawRows.some(r => typeof r[h] === "number")
    );

    timeColumn = headers.find(h => /date|time|month|year/i.test(h));

    metricColumn =
      numericColumns.find(h => /price|revenue|sales|amount|value/i.test(h)) ||
      numericColumns[0];

    log(`Numeric columns: ${numericColumns.join(", ")}`);
    log(`Metric selected: ${metricColumn}`);
    log(`Time axis: ${timeColumn || "Index-based"}`);

    if (!metricColumn) {
      log("No numeric metric found. Cannot forecast.");
      return;
    }

    runAnalysis();
  }

  /* =====================
     MAIN ANALYSIS
  ====================== */

  function runAnalysis() {
    summarySection.classList.remove("hidden");
    chartsSection.classList.remove("hidden");
    logsSection.classList.remove("hidden");

    const series = rawRows
      .map(r => r[metricColumn])
      .filter(v => typeof v === "number");

    if (series.length < 3) {
      log("Not enough numeric data to forecast.");
      return;
    }

    renderKPIs(series);
    renderForecastChart(series);
  }

  /* =====================
     KPIs
  ====================== */

  function renderKPIs(series) {
    const avg = mean(series);
    const growth = ((series.at(-1) - series[0]) / Math.abs(series[0])) * 100;

    const kpi = document.createElement("div");
    kpi.className = "kpi";
    kpi.innerHTML = `
      <h3>${metricColumn}</h3>
      <p>${avg.toFixed(2)}</p>
      <small>${isFinite(growth) ? growth.toFixed(2) + "% overall change" : "—"}</small>
    `;
    kpiContainer.appendChild(kpi);
  }

  /* =====================
     REAL FORECAST ENGINE
  ====================== */

  function renderForecastChart(series) {
    const labels = timeColumn
      ? rawRows.map(r => r[timeColumn])
      : series.map((_, i) => `P${i + 1}`);

    // 1. Exponential Moving Average (trend-aware)
    const smoothed = ema(series, 0.35);

    // 2. Trend slope (least-squares style approximation)
    const slope =
      (smoothed.at(-1) - smoothed[0]) / Math.max(1, smoothed.length - 1);

    // 3. Forecast forward
    const horizon = 6;
    let last = smoothed.at(-1);
    const forecast = [];
    for (let i = 0; i < horizon; i++) {
      last += slope;
      forecast.push(Number(last.toFixed(2)));
    }

    // 4. Volatility & confidence bands
    const sigma = std(series);
    const upper = forecast.map(v => v + sigma);
    const lower = forecast.map(v => v - sigma);

    const forecastLabels = forecast.map((_, i) => `F${i + 1}`);

    const ctx = document.getElementById("trendChart").getContext("2d");
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [...labels, ...forecastLabels],
        datasets: [
          { label: "Actual", data: series, borderWidth: 2 },
          { label: "Smoothed Trend", data: smoothed, borderDash: [4, 4] },
          {
            label: "Forecast",
            data: [...Array(series.length).fill(null), ...forecast],
            borderDash: [6, 6]
          },
          {
            label: "Upper Confidence",
            data: [...Array(series.length).fill(null), ...upper],
            borderWidth: 0,
            fill: "+1"
          },
          {
            label: "Lower Confidence",
            data: [...Array(series.length).fill(null), ...lower],
            borderWidth: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });

    log("Forecast chart rendered with confidence bands");
  }

  /* =====================
     PDF REPORT
  ====================== */

  function generateReport() {
    reportSection.classList.remove("hidden");

    execSummary.innerHTML = `
      <h2>Executive Summary</h2>
      <p>
        This analysis evaluates <strong>${metricColumn}</strong> across
        <strong>${rawRows.length}</strong> records.
        Forecasting is based on trend-aware exponential smoothing with
        volatility-adjusted confidence bounds.
      </p>
    `;

    reportKPIs.innerHTML = kpiContainer.innerHTML;
    forecastNotes.textContent =
      "Forecast projects recent trend momentum into the short term.";
    riskNotes.textContent =
      "Higher volatility widens confidence bands and increases uncertainty.";

    window.print();
  }

  /* =====================
     MATH UTILITIES
  ====================== */

  function ema(arr, alpha) {
    const out = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      out.push(alpha * arr[i] + (1 - alpha) * out[i - 1]);
    }
    return out;
  }

  function mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function std(arr) {
    const m = mean(arr);
    return Math.sqrt(mean(arr.map(v => (v - m) ** 2)));
  }

  function log(msg) {
    logOutput.textContent += msg + "\n";
  }

});
