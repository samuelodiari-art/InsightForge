document.addEventListener("DOMContentLoaded", () => {

  /* =====================
     ELEMENTS
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
  let headers = [];
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
      alert("Please upload a data file.");
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
     ROBUST PARSER
  ====================== */

  function parseText(text) {
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    log(`Raw lines detected: ${lines.length}`);
    log(`Preview: ${lines.slice(0, 3).join(" | ")}`);

    // Detect delimiter
    const delimiters = [",", ";", "\t", "|"];
    let delimiter = null;

    for (const d of delimiters) {
      if (lines[0].split(d).length > 1) {
        delimiter = d;
        break;
      }
    }

    // If no delimiter, fallback to whitespace
    if (!delimiter) {
      log("No standard delimiter found. Using whitespace parser.");
      parseWhitespace(lines);
      return;
    }

    log(`Detected delimiter: "${delimiter}"`);
    headers = normalizeHeaders(lines[0].split(delimiter));

    rawData = lines.slice(1).map(line => {
      const parts = line.split(delimiter);
      const row = {};
      headers.forEach((h, i) => {
        const val = parts[i]?.trim();
        const num = parseFloat(val);
        row[h] = isNaN(num) ? val : num;
      });
      return row;
    });

    finalizeAnalysis();
  }

  function parseWhitespace(lines) {
    const sample = lines[0].split(/\s+/);
    headers = sample.map((_, i) => `Column_${i + 1}`);

    rawData = lines.map(line => {
      const parts = line.split(/\s+/);
      const row = {};
      headers.forEach((h, i) => {
        const val = parts[i];
        const num = parseFloat(val);
        row[h] = isNaN(num) ? val : num;
      });
      return row;
    });

    finalizeAnalysis();
  }

  function normalizeHeaders(hs) {
    return hs.map(h =>
      h.replace(/[^a-zA-Z0-9_]/g, "_").trim() || "Field"
    );
  }

  function finalizeAnalysis() {
    numericColumns = headers.filter(h =>
      rawData.some(r => typeof r[h] === "number")
    );

    timeColumn = headers.find(h => /date|month|year/i.test(h));
    metricColumn =
      numericColumns.find(h => /revenue|sales|amount|value/i.test(h)) ||
      numericColumns[0];

    log(`Parsed rows: ${rawData.length}`);
    log(`Numeric columns: ${numericColumns.join(", ") || "None"}`);
    log(`Metric used: ${metricColumn || "None"}`);
    log(`Time axis: ${timeColumn || "Index-based"}`);

    analyze();
  }

  /* =====================
     ANALYSIS
  ====================== */

  function analyze() {
    summarySection.classList.remove("hidden");
    chartsSection.classList.remove("hidden");
    logsSection.classList.remove("hidden");

    if (!metricColumn) {
      log("No numeric data found. Chart cannot be rendered.");
      return;
    }

    renderKPIs();
    renderChart();
  }

  function renderKPIs() {
    numericColumns.forEach(col => {
      const vals = rawData.map(r => r[col]).filter(v => typeof v === "number");
      if (vals.length < 2) return;

      const avg = mean(vals);
      const growth = ((vals.at(-1) - vals[0]) / Math.abs(vals[0])) * 100;

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

  /* =====================
     CHART
  ====================== */

  function renderChart() {
    const actual = rawData.map(r => r[metricColumn]);
    const labels = timeColumn
      ? rawData.map(r => r[timeColumn])
      : actual.map((_, i) => `P${i + 1}`);

    const smoothed = ema(actual, 0.35);
    const forecast = forecastTrend(smoothed, 6);
    const bands = confidenceBands(smoothed, forecast);
    const forecastLabels = forecast.map((_, i) => `F${i + 1}`);

    const ctx = document.getElementById("trendChart").getContext("2d");
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [...labels, ...forecastLabels],
        datasets: [
          { label: "Actual", data: actual, borderWidth: 2 },
          { label: "Smoothed", data: smoothed, borderDash: [4, 4] },
          {
            label: "Forecast",
            data: [...Array(actual.length).fill(null), ...forecast],
            borderDash: [6, 6]
          },
          {
            label: "Upper Band",
            data: [...Array(actual.length).fill(null), ...bands.upper),
            borderWidth: 0,
            fill: "+1"
          },
          {
            label: "Lower Band",
            data: [...Array(actual.length).fill(null), ...bands.lower],
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

    log("Chart rendered successfully");
  }

  /* =====================
     PDF
  ====================== */

  function generateReport() {
    reportSection.classList.remove("hidden");

    execSummary.innerHTML = `
      <h2>Executive Summary</h2>
      <p>
        Analysis based on <strong>${rawData.length}</strong> records
        using <strong>${metricColumn}</strong>.
      </p>
    `;

    reportKPIs.innerHTML = kpiContainer.innerHTML;
    forecastNotes.textContent = "Forecast uses trend smoothing with uncertainty bands.";
    riskNotes.textContent = "Unstructured source data increases uncertainty.";

    window.print();
  }

  /* =====================
     MATH
  ====================== */

  function ema(arr, a) {
    const out = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      out.push(a * arr[i] + (1 - a) * out[i - 1]);
    }
    return out;
  }

  function forecastTrend(arr, n) {
    const slope = (arr.at(-1) - arr[0]) / Math.max(1, arr.length - 1);
    let last = arr.at(-1);
    return Array.from({ length: n }, () => {
      last += slope;
      return Number(last.toFixed(2));
    });
  }

  function confidenceBands(hist, fc) {
    const s = std(hist);
    return {
      upper: fc.map(v => v + s),
      lower: fc.map(v => v - s)
    };
  }

  function mean(a) {
    return a.reduce((x, y) => x + y, 0) / a.length;
  }

  function std(a) {
    const m = mean(a);
    return Math.sqrt(mean(a.map(v => (v - m) ** 2)));
  }

  function log(msg) {
    logOutput.textContent += msg + "\n";
  }

});
