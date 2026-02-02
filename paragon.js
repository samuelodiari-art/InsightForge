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

  let rawData = [];
  let numericColumns = [];
  let timeColumn = null;
  let metricColumn = null;
  let chart = null;

  /* =====================
     EVENTS
  ====================== */

  analyzeBtn.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (!file) {
      alert("Please upload a CSV file.");
      return;
    }
    resetUI();
    readCSV(file);
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

    log(`Numeric columns: ${numericColumns.join(", ")}`);
    log(`Time column: ${timeColumn || "None"}`);
    log(`Metric column: ${metricColumn}`);
  }

  function analyze() {
    summarySection.classList.remove("hidden");
    chartsSection.classList.remove("hidden");
    logsSection.classList.remove("hidden");

    renderKPIs();
    if (timeColumn && metricColumn) {
      renderChart();
    }
  }

  /* =====================
     KPIs
  ====================== */

  function renderKPIs() {
    numericColumns.forEach(col => {
      const values = rawData.map(r => r[col]).filter(v => typeof v === "number");
      if (values.length < 2) return;

      const avg = average(values);
      const growth = ((values.at(-1) - values[0]) / Math.abs(values[0])) * 100;

      const div = document.createElement("div");
      div.className = "kpi";
      div.innerHTML = `
        <h3>${col}</h3>
        <p>${avg.toFixed(2)}</p>
        <small>${isFinite(growth) ? growth.toFixed(2) + "% growth" : "-"}</small>
      `;
      kpiContainer.appendChild(div);
    });
  }

  /* =====================
     CHART
  ====================== */

  function renderChart() {
    const labels = rawData.map(r => r[timeColumn]);
    const actual = rawData.map(r => r[metricColumn]);

    const smoothed = ema(actual, 0.3);
    const forecast = forecastFromEMA(smoothed, 6);

    const forecastLabels = forecast.map((_, i) => `F${i + 1}`);

    const ctx = document.getElementById("trendChart").getContext("2d");
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [...labels, ...forecastLabels],
        datasets: [
          { label: "Actual", data: actual, borderWidth: 2 },
          { label: "Smoothed", data: smoothed, borderDash: [4, 4], borderWidth: 2 },
          {
            label: "Forecast",
            data: [...Array(actual.length).fill(null), ...forecast],
            borderDash: [6, 6],
            borderWidth: 2
          }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    log("Chart rendered");
  }

  /* =====================
     PDF REPORT
  ====================== */

  function generateReport() {
    reportSection.classList.remove("hidden");

    execSummary.innerHTML = `
      <h2>Executive Summary</h2>
      <p>Analysis based on <strong>${rawData.length}</strong> records for
      <strong>${metricColumn}</strong>.</p>
    `;

    reportKPIs.innerHTML = kpiContainer.innerHTML;
    forecastNotes.textContent =
      "Forecast uses exponential smoothing based on historical trend.";
    riskNotes.textContent =
      "Forecast reliability depends on data stability and volatility.";

    window.print();
  }

  /* =====================
     UTILITIES
  ====================== */

  function ema(values, alpha) {
    const out = [values[0]];
    for (let i = 1; i < values.length; i++) {
      out.push(alpha * values[i] + (1 - alpha) * out[i - 1]);
    }
    return out;
  }

  function forecastFromEMA(smoothed, periods) {
    const slope =
      (smoothed.at(-1) - smoothed[0]) / (smoothed.length - 1);
    let last = smoothed.at(-1);
    const out = [];
    for (let i = 0; i < periods; i++) {
      last += slope;
      out.push(Number(last.toFixed(2)));
    }
    return out;
  }

  function average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function log(msg) {
    logOutput.textContent += msg + "\n";
  }

});
