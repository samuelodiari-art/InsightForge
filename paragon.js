const fileInput = document.getElementById("csvFile");
const analyzeBtn = document.getElementById("analyzeBtn");

const summarySection = document.getElementById("summary");
const chartsSection = document.getElementById("charts");
const logsSection = document.getElementById("logs");

const kpiContainer = document.getElementById("kpis");
const logOutput = document.getElementById("logOutput");

let rawData = [];
let numericColumns = [];

analyzeBtn.addEventListener("click", () => {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please upload a CSV file.");
    return;
  }

  readCSV(file);
});

function readCSV(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    const text = e.target.result;
    parseCSV(text);
  };

  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());

  rawData = lines.slice(1).map(line => {
    const values = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      const value = values[i]?.trim();
      const num = parseFloat(value);
      row[h] = isNaN(num) ? value : num;
    });
    return row;
  });

  log(`Loaded ${rawData.length} rows`);
  identifyNumericColumns(headers);
  analyzeData();
}

function identifyNumericColumns(headers) {
  numericColumns = headers.filter(h =>
    rawData.some(row => typeof row[h] === "number")
  );

  log(`Detected numeric columns: ${numericColumns.join(", ")}`);
}

function analyzeData() {
  if (numericColumns.length === 0) {
    log("No numeric columns detected. Analysis stopped.");
    return;
  }

  summarySection.classList.remove("hidden");
  logsSection.classList.remove("hidden");

  kpiContainer.innerHTML = "";

  numericColumns.forEach(col => {
    const values = rawData
      .map(r => r[col])
      .filter(v => typeof v === "number");

    if (values.length < 2) return;

    const total = sum(values);
    const avg = total / values.length;
    const growth = ((values[values.length - 1] - values[0]) / values[0]) * 100;

    renderKPI(col, avg, growth);
    logAnalysis(col, values, avg, growth);
  });
}

function renderKPI(column, avg, growth) {
  const div = document.createElement("div");
  div.className = "kpi";

  div.innerHTML = `
    <h3>${column}</h3>
    <p>${avg.toFixed(2)}</p>
    <small>${growth.toFixed(2)}% growth</small>
  `;

  kpiContainer.appendChild(div);
}

function logAnalysis(column, values, avg, growth) {
  log(`--- ${column} ---`);
  log(`Data points: ${values.length}`);
  log(`Average: ${avg.toFixed(2)}`);
  log(`Start: ${values[0]}`);
  log(`End: ${values[values.length - 1]}`);
  log(`Growth: ${growth.toFixed(2)}%`);
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function log(message) {
  logOutput.textContent += message + "\n";
                 }
