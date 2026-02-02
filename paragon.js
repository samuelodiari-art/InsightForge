document.addEventListener("DOMContentLoaded", () => {

  const fileInput = document.getElementById("csvFile");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const pdfBtn = document.getElementById("pdfBtn");
  const metricSelect = document.getElementById("metricSelect");

  const summary = document.getElementById("summary");
  const charts = document.getElementById("charts");
  const logs = document.getElementById("logs");

  const kpis = document.getElementById("kpis");
  const logOutput = document.getElementById("logOutput");

  const execSummary = document.getElementById("execSummary");
  const reportKPIs = document.getElementById("reportKPIs");
  const chartImage = document.getElementById("chartImage");
  const scenarioTable = document.getElementById("scenarioTable");
  const report = document.getElementById("report");

  let rows = [], headers = [], numericCols = [], metric = null, chart = null;
  let lastScenario = null;

  analyzeBtn.onclick = () => {
    if (!fileInput.files[0]) return alert("Upload a file first");
    readFile(fileInput.files[0]);
  };

  metricSelect.onchange = () => {
    metric = metricSelect.value;
    analyze();
  };

  pdfBtn.onclick = () => exportPDF();

  function readFile(file) {
    const r = new FileReader();
    r.onload = e => parse(e.target.result);
    r.readAsText(file);
  }

  function parse(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    const d = [",",";","\t","|"].find(x => lines[0].split(x).length > 1) || ",";
    headers = lines[0].split(d).map(h => h.toLowerCase().replace(/\W/g,"_"));
    rows = lines.slice(1).map(l => {
      const p = l.split(d), o={};
      headers.forEach((h,i)=>o[h]=isNaN(+p[i])?p[i]:+p[i]);
      return o;
    });
    numericCols = headers.filter(h => rows.some(r => typeof r[h]==="number"));
    metricSelect.innerHTML = numericCols.map(c=>`<option>${c}</option>`).join("");
    metric = numericCols[0];
    analyze();
  }

  function analyze() {
    const s = rows.map(r=>r[metric]).filter(v=>typeof v==="number");
    if (s.length < 6) return;

    summary.classList.remove("hidden");
    charts.classList.remove("hidden");
    logs.classList.remove("hidden");

    const avg = mean(s), vol = std(s)/avg;
    const smooth = ema(s,0.35);
    const slope = (smooth.at(-1)-smooth[0])/smooth.length;

    const base = forecast(smooth.at(-1), slope, 3);
    const sigma = std(s);
    const opt = base.map(v=>v+sigma);
    const pess = base.map(v=>v-sigma);

    const conf = Math.round(60 + Math.min(30,s.length) - vol*50);
    const badge = conf>75?"green":conf>55?"amber":"red";

    lastScenario = {base,opt,pess};

    kpis.innerHTML = `
      <div class="kpi"><h3>Metric</h3><p>${metric}</p></div>
      <div class="kpi"><h3>Avg</h3><p>${avg.toFixed(2)}</p></div>
      <div class="kpi"><h3>Volatility</h3><p>${(vol*100).toFixed(1)}%</p></div>
      <div class="kpi"><h3>Confidence</h3><p class="badge ${badge}">${conf}%</p></div>
    `;

    renderChart(s,smooth,base,opt,pess);

    execSummary.innerHTML = `
      <p>
        <strong>${metric}</strong> forecast shows
        <span class="badge ${badge}">${conf}% confidence</span>.
        Base scenario next value: <strong>${base[0].toFixed(2)}</strong>.
      </p>
    `;
  }

  function renderChart(a,t,b,o,p){
    if(chart) chart.destroy();
    chart = new Chart(trendChart,{
      type:"line",
      data:{
        labels:[...a.map((_,i)=>`P${i+1}`),...b.map((_,i)=>`F${i+1}`)],
        datasets:[
          {label:"Actual",data:a},
          {label:"Trend",data:t,borderDash:[4,4]},
          {label:"Forecast",data:[...Array(a.length).fill(null),...b],borderDash:[6,6]},
          {label:"Upper",data:[...Array(a.length).fill(null),...o],fill:"+1",borderWidth:0},
          {label:"Lower",data:[...Array(a.length).fill(null),...p],borderWidth:0}
        ]
      },
      options:{responsive:true,maintainAspectRatio:false}
    });
  }

  function exportPDF(){
    chartImage.src = chart.toBase64Image();

    scenarioTable.innerHTML = `
      <tr><th>Scenario</th><th>Next Value</th></tr>
      <tr><td>Base</td><td>${lastScenario.base[0].toFixed(2)}</td></tr>
      <tr><td>Optimistic</td><td>${lastScenario.opt[0].toFixed(2)}</td></tr>
      <tr><td>Pessimistic</td><td>${lastScenario.pess[0].toFixed(2)}</td></tr>
    `;

    reportKPIs.innerHTML = kpis.innerHTML;
    report.classList.remove("hidden");
    window.print();
  }

  function mean(a){return a.reduce((x,y)=>x+y,0)/a.length;}
  function std(a){const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)));}
  function ema(a,α){const o=[a[0]];for(let i=1;i<a.length;i++)o.push(α*a[i]+(1-α)*o[i-1]);return o;}
  function forecast(l,s,n){return Array.from({length:n},(_,i)=>+(l+s*(i+1)).toFixed(2));}

});
