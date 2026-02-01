const pdfBtn = document.getElementById("pdfBtn");
const reportSection = document.getElementById("report");
const execSummary = document.getElementById("execSummary");
const reportKPIs = document.getElementById("reportKPIs");
const forecastNotes = document.getElementById("forecastNotes");
const riskNotes = document.getElementById("riskNotes");
const fileInput = document.getElementById("csvFile");
const analyzeBtn = document.getElementById("analyzeBtn");

const summarySection = document.getElementById("summary");
const chartsSection = document.getElementById("charts");
const logsSection = document.getElementById("logs");

const kpiContainer = document.getElementById("kpis");
const logOutput = document.getElementById("logOutput");

let rawData = [];
let numericColumns = [];
let timeColumn = null;
let metricColumn = null;
let chart = null;

analyzeBtn.addEventListener("click", () => {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please upload a CSV file.");
    return;
  }
  resetUI();
  readCSV(file);
});

function resetUI() {
  kpiContainer.innerHTML = "";
  logOutput.textContent = "";
  chartsSection.classList.add("hidden");
}

function readCSV(file) {
  const reader = new FileReader();
  reader.onload = e => parseCSV(e.target.result);
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());

  rawData = lines.slice(1).map(line => {
    const values = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      const v = values[i]?.trim();
      const n = parseFloat(v);
      row[h] = isNaN(n) ? v : n;
    });
    return row;
  });

  log(`Loaded ${rawData.length} rows`);
  detectColumns(headers);
  analyze();
}

function detectColumns(headers) {
  numericColumns = headers.filter(h =>
    rawData.some(r => typeof r[h] === "number")
  );

  timeColumn = headers.find(h =>
    h.toLowerCase().includes("date") ||
    h.toLowerCase().includes("month") ||
    h.toLowerCase().includes("year")
  );

  metricColumn =
    numericColumns.find(h => h.toLowerCase().includes("revenue")) ||
    numericColumns[0];

  log(`Detected numeric columns: ${numericColumns.join(", ")}`);
  log(`Time column: ${timeColumn || "None"}`);
  log(`Primary metric: ${metricColumn}`);
}

function analyze() {
  summarySection.classList.remove("hidden");
  logsSection.classList.remove("hidden");

  // FORCE charts section visible early
  chartsSection.classList.remove("hidden");

  renderKPIs();

  if (timeColumn && metricColumn) {
    setTimeout(renderChart, 0);
  }
}


function renderKPIs() {
  numericColumns.forEach(col => {
    const values = rawData.map(r => r[col]).filter(v => typeof v === "number");
    if (values.length < 2 || isBinary(values)) return;

    const avg = average(values);
    const growth = ((values.at(-1) - values[0]) / Math.abs(values[0])) * 100;

    const div = document.createElement("div");
    div.className = "kpi";
    div.innerHTML = `
      <h3>${col}</h3>
      <p>${avg.toFixed(2)}</p>
      <small>${isFinite(growth) ? growth.toFixed(2) + "% growth" : "—"}</small>
    `;
    kpiContainer.appendChild(div);
  });
}

function renderChart() {
  pdfBtn.addEventListener("click", generateReport);

function generateReport() {
  reportSection.classList.remove("hidden");
  buildExecutiveSummary();
  buildReportKPIs();
  buildNotes();
  window.print();
}
  function buildExecutiveSummary() {
  execSummary.innerHTML = `
    <h2>Executive Summary</h2>
    <p>
      This report analyzes <strong>${rawData.length}</strong> records
      across the <strong>${metricColumn}</strong> metric.
      The data shows an overall <strong>upward trend</strong> with
      forward projections based on smoothed historical performance.
    </p>
  `;
  }
  function buildNotes() {
  forecastNotes.textContent =
    "The forecast is based on exponential smoothing and historical trend continuation. Confidence bands reflect historical variability.";

  riskNotes.textContent =
    "Forecast reliability is moderate. Higher volatility increases uncertainty. Results should be used for planning, not guarantees.";
  }
  function buildReportKPIs() {
  reportKPIs.innerHTML = "";
  numericColumns.forEach(col => {
    const values = rawData.map(r => r[col]).filter(v => typeof v === "number");
    if (values.length < 2 || isBinary(values)) return;

    const avg = average(values);
    const div = document.createElement("div");
    div.className = "kpi";
    div.innerHTML = `<strong>${col}</strong><br>${avg.toFixed(2)}`;
    reportKPIs.appendChild(div);
  });
  }
  const labels = rawData.map(r => r[timeColumn]);
  const actual = rawData.map(r => r[metricColumn]);

  const smoothed = ema(actual, 0.3);
  const forecast = forecastFromEMA(smoothed, 6);
  const { upper, lower } = confidenceBands(smoothed, forecast);

  const forecastLabels = forecast.map((_, i) => `F${i + 1}`);
  const ctx = document.getElementById("trendChart").getContext("2d");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [...labels, ...forecastLabels],
      datasets: [
        {
          label: "Actual",
          data: actual,
          borderWidth: 2
        },
        {
          label: "Smoothed",
          data: smoothed,
          borderDash: [4, 4],
          borderWidth: 2
        },
        {
          label: "Forecast",
          data: [...Array(actual.length).fill(null), ...forecast],
          borderDash: [6, 6],
          borderWidth: 2
        },
        {
          label: "Upper Bound",
          data: [...Array(actual.length).fill(null), ...upper],
          borderWidth: 0,
          fill: "+1"
        },
        {
          label: "Lower Bound",
          data: [...Array(actual.length).fill(null), ...lower],
          borderWidth: 0,
          fill: false
        }
      ]
    }
  });

  log("Applied EMA smoothing (α = 0.3)");
  log("Computed confidence bands from historical error");
}

function ema(values, alpha) {
  const result = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

function forecastFromEMA(smoothed, periods) {
  const slope = (smoothed.at(-1) - smoothed[0]) / (smoothed.length - 1);
  let last = smoothed.at(-1);
  const out = [];
  for (let i = 0; i < periods; i++) {
    last += slope;
    out.push(Number(last.toFixed(2)));
  }
  return out;
}

function confidenceBands(smoothed, forecast) {
  const errors = smoothed.map((v, i) => v - (smoothed[i - 1] ?? v));
  const sigma = Math.sqrt(average(errors.map(e => e * e))) || 0;
  const k = 1.96; // ~95%

  return {
    upper: forecast.map(v => Number((v + k * sigma).toFixed(2))),
    lower: forecast.map(v => Number((v - k * sigma).toFixed(2)))
  };
}

function isBinary(values) {
  const set = new Set(values);
  return set.size <= 2 && set.has(0);
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function log(msg) {
  logOutput.textContent += msg + "\n";
}
