document.addEventListener("DOMContentLoaded", () => {

  alert("Paragon JS loaded");

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

  let rawData = [];
  let chart = null;

  analyzeBtn.addEventListener("click", () => {
    alert("Analyze clicked");

    const file = fileInput.files[0];
    if (!file) {
      alert("Please upload a data file first.");
      return;
    }

    resetUI();
    readFile(file);
  });

  pdfBtn.addEventListener("click", () => {
    alert("Export PDF clicked");
    generateReport();
  });

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

  function parseText(text) {
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    log(`Lines read: ${lines.length}`);
    log(lines.slice(0, 3).join(" | "));

    const values = lines.map((_, i) => i + 1);
    rawData = values;

    render(values);
  }

  function render(values) {
    summarySection.classList.remove("hidden");
    chartsSection.classList.remove("hidden");
    logsSection.classList.remove("hidden");

    const ctx = document.getElementById("trendChart").getContext("2d");
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: values.map(v => `P${v}`),
        datasets: [{
          label: "Test Data",
          data: values,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });

    log("Chart rendered");
  }

  function generateReport() {
    reportSection.classList.remove("hidden");
    execSummary.innerHTML = "<h2>Executive Summary</h2><p>Report generated.</p>";
    window.print();
  }

  function log(msg) {
    logOutput.textContent += msg + "\n";
  }

});
