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
     FLOW
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

    detectColumns(headers);
    analyze();
  }

  function detectColumns(headers) {
    numericColumns = headers.filter(h =>
      rawData.some(r => typeof r[h] === "number")
    );

    timeColumn = headers.find(h =>
      /date|month|year/i.test(h)
    );

    metricColumn =
      numericColumns.find(h => /revenue|sales|amount/i.test(h)) ||
      numericColumns[0];

    log(`Rows: ${rawData.length}`);
    log(`Metric: ${metricColumn}`);
    log(`Time axis: ${timeColumn || "Index-based"}`);
  }

  function analyze() {
    summarySection.classList.remove("hidden");
    chartsSection.classList.remove("hidden");
    logsSection.classList.remove("hidden");

    renderKPIs();
    if (metricColumn) renderChart();
  }

  /* =====================
     KPIs
  ====================== */

  function renderKPIs() {
    numericColumns.forEach(col => {
      const values = rawData.map(r => r[col]).filter(v => typeof v === "number");
      if (values.length < 2) return;

      const avg = mean(values);
      const growth = ((values.at(-1) - values[0]) / Math.abs(values[0])) * 100;

      const el = document.createElement("div");
      el.className = "kpi";
      el.innerHTML = `
        <h3>${col}</h3>
        <p>${avg.toFixed(2)}</p>
        <small>${isFinite(growth) ? growth.toFixed(2) + "% growth" : "—"}</small>
      `;
      kpiContainer.appendChild(el);
    });
  }

  /* =====================
     CHART + FORECAST
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
            data: [...Array(actual.length).fill(null), ...bands.upper],
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

    log("Forecast chart rendered");
  }

  /* =====================
     PDF REPORT
  ====================== */

  function generateReport() {
    reportSection.classList.remove("hidden");

    execSummary.innerHTML = `
      <h2>Executive Summary</h2>
      <p>
        This report analyzes <strong>${rawData.length}</strong> records
        using <strong>${metricColumn}</strong>.
        Forecasting is based on trend smoothing with confidence bounds.
      </p>
    `;

    reportKPIs.innerHTML = kpiContainer.innerHTML;
    forecastNotes.textContent =
      "Forecast reflects recent trend momentum and historical variance.";
    riskNotes.textContent =
      "Higher volatility increases forecast uncertainty.";

    window.print();
  }

  /* =====================
     MATH
  ====================== */

  function ema(values, alpha) {
    const out = [values[0]];
    for (let i = 1; i < values.length; i++) {
      out.push(alpha * values[i] + (1 - alpha) * out[i - 1]);
    }
    return out;
  }

  function forecastTrend(values, periods) {
    const slope =
      (values.at(-1) - values[0]) / Math.max(1, values.length - 1);
    let last = values.at(-1);
    return Array.from({ length: periods }, () => {
      last += slope;
      return Number(last.toFixed(2));
    });
  }

  function confidenceBands(history, forecast) {
    const sd = std(history);
    return {
      upper: forecast.map(v => v + sd),
      lower: forecast.map(v => v - sd)
    };
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
