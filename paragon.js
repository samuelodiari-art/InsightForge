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
  reader.onload = (e) => parseCSV(e.target.result);
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

  metricColumn = numericColumns.find(h =>
    h.toLowerCase().includes("revenue")
  ) || numericColumns[0];

  log(`Detected numeric columns: ${numericColumns.join(", ")}`);
  log(`Time column: ${timeColumn || "None"}`);
  log(`Primary metric: ${metricColumn}`);
}

function analyze() {
  summarySection.classList.remove("hidden");
  logsSection.classList.remove("hidden");

  renderKPIs();
  if (timeColumn && metricColumn) {
    renderChart();
  }
}

function renderKPIs() {
  numericColumns.forEach(col => {
    const values = rawData.map(r => r[col]).filter(v => typeof v === "number");
    if (values.length < 2) return;

    if (isBinary(values)) {
      log(`Skipping KPI for flag column: ${col}`);
      return;
    }

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
  chartsSection.classList.remove("hidden");

  const labels = rawData.map(r => r[timeColumn]);
  const values = rawData.map(r => r[metricColumn]);

  const forecast = forecastSeries(values, 6);
  const forecastLabels = forecast.map((_, i) => `F${i + 1}`);

  const ctx = document.getElementById("trendChart").getContext("2d");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [...labels, ...forecastLabels],
      datasets: [
        {
          label: "Historical",
          data: values,
          borderWidth: 2
        },
        {
          label: "Forecast",
          data: [...Array(values.length).fill(null), ...forecast],
          borderDash: [6, 6],
          borderWidth: 2
        }
      ]
    }
  });

  log(`Generated ${forecast.length}-period forecast for ${metricColumn}`);
}

function forecastSeries(values, periods) {
  const n = values.length;
  const slope = (values[n - 1] - values[0]) / (n - 1);
  const avgGrowth =
    values.slice(1).map((v, i) => (v - values[i]) / Math.abs(values[i] || 1));
  const growthRate = average(avgGrowth) * 0.6;

  let last = values.at(-1);
  const result = [];

  for (let i = 0; i < periods; i++) {
    last = last + slope + last * growthRate;
    result.push(Number(last.toFixed(2)));
  }

  return result;
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
