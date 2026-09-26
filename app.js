(() => {
  const CHANNELS = ["General Trade","Modern Trade","Food Service"];
  const SKUS = ["Value","Core","Premium","Legacy"];
  const Q1 = {
    "General Trade":[500,400,150,100],
    "Modern Trade":[250,300,200,80],
    "Food Service":[100,220,180,60]
  };
  const P1 = {
    "General Trade":[10,14,20,9],
    "Modern Trade":[11,15,21,10],
    "Food Service":[12,16,23,11]
  };
  const C1 = {
    "General Trade":[7.0,9.0,12.0,7.0],
    "Modern Trade":[7.4,9.4,12.5,7.2],
    "Food Service":[7.8,9.8,13.0,7.5]
  };
  const priceMult = {Value:1.02,Core:1.03,Premium:1.05,Legacy:.99};
  const costMult = {Value:1.04,Core:1.05,Premium:1.06,Legacy:1.03};
  const mixedQ = {
    "General Trade":[450,420,200,70],
    "Modern Trade":[220,320,250,50],
    "Food Service":[80,240,230,30]
  };

  function rowsFromBase(){
    const rows=[];
    CHANNELS.forEach(ch=>SKUS.forEach((sku,i)=>rows.push({
      channel:ch, sku, q1:Q1[ch][i], p1:P1[ch][i], c1:C1[ch][i],
      q2:Q1[ch][i], p2:P1[ch][i], c2:C1[ch][i]
    })));
    return rows;
  }
  function scenario(name){
    const d=rowsFromBase();
    if(name==="price"){
      d.forEach(r=>r.p2=r.p1*priceMult[r.sku]);
    } else if(name==="quantity"){
      d.forEach(r=>r.q2=r.q1*1.15);
    } else if(name==="product"){
      CHANNELS.forEach(ch=>{
        const rr=d.filter(r=>r.channel===ch);
        const total=rr.reduce((s,r)=>s+r.q1,0);
        const move=total*.10;
        const from=rr.find(r=>r.sku==="Value"), to=rr.find(r=>r.sku==="Premium");
        from.q2=from.q1-move; to.q2=to.q1+move;
      });
    } else if(name==="channel"){
      const total=d.reduce((s,r)=>s+r.q1,0), move=total*.10;
      const ctot={}; CHANNELS.forEach(ch=>ctot[ch]=d.filter(r=>r.channel===ch).reduce((s,r)=>s+r.q1,0));
      const newTot={...ctot,"General Trade":ctot["General Trade"]-move,"Food Service":ctot["Food Service"]+move};
      CHANNELS.forEach(ch=>d.filter(r=>r.channel===ch).forEach(r=>r.q2=newTot[ch]*(r.q1/ctot[ch])));
    } else if(name==="cost"){
      d.forEach(r=>r.c2=r.c1*1.08);
    } else if(name==="volmix"){
      d.forEach(r=>r.q2=mixedQ[r.channel][SKUS.indexOf(r.sku)]);
    } else if(name==="mixed" || name==="legacy"){
      d.forEach(r=>{
        r.q2=mixedQ[r.channel][SKUS.indexOf(r.sku)];
        r.p2=r.p1*priceMult[r.sku];
        r.c2=r.c1*costMult[r.sku];
        if(name==="legacy" && r.sku==="Legacy") r.q2=0;
      });
    }
    return d;
  }

  const sum = (a,f)=>a.reduce((s,x)=>s+f(x),0);
  function calc(d){
    const tq1=sum(d,r=>r.q1), tq2=sum(d,r=>r.q2);
    const rev1=sum(d,r=>r.p1*r.q1), rev2=sum(d,r=>r.p2*r.q2);
    const gp1=sum(d,r=>(r.p1-r.c1)*r.q1), gp2=sum(d,r=>(r.p2-r.c2)*r.q2);
    const price=sum(d,r=>(r.p2-r.p1)*r.q2);
    const cost=-sum(d,r=>(r.c2-r.c1)*r.q2);
    const volumeMixR=sum(d,r=>(r.q2-r.q1)*r.p1);
    const volumeMixGP=sum(d,r=>(r.q2-r.q1)*(r.p1-r.c1));
    const quantityR=sum(d,r=>(tq2-tq1)*(r.q1/tq1)*r.p1);
    const quantityGP=sum(d,r=>(tq2-tq1)*(r.q1/tq1)*(r.p1-r.c1));
    const totalMixR=sum(d,r=>(r.q2-(r.q1/tq1)*tq2)*r.p1);
    const totalMixGP=sum(d,r=>(r.q2-(r.q1/tq1)*tq2)*(r.p1-r.c1));
    const ct1={}, ct2={};
    CHANNELS.forEach(ch=>{
      ct1[ch]=sum(d.filter(r=>r.channel===ch),r=>r.q1);
      ct2[ch]=sum(d.filter(r=>r.channel===ch),r=>r.q2);
    });
    let channelMixR=0, productMixR=0, channelMixGP=0, productMixGP=0;
    d.forEach(r=>{
      const s1=ct1[r.channel]/tq1, s2=ct2[r.channel]/tq2;
      const w1=r.q1/ct1[r.channel], w2=r.q2/ct2[r.channel];
      channelMixR += tq2*(s2-s1)*w1*r.p1;
      channelMixGP += tq2*(s2-s1)*w1*(r.p1-r.c1);
      productMixR += tq2*s2*(w2-w1)*r.p1;
      productMixGP += tq2*s2*(w2-w1)*(r.p1-r.c1);
    });
    return {tq1,tq2,rev1,rev2,gp1,gp2,price,cost,volumeMixR,volumeMixGP,quantityR,quantityGP,totalMixR,totalMixGP,channelMixR,channelMixGP,productMixR,productMixGP};
  }

  const views = {
    rev2:{start:"rev1",end:"rev2",drivers:[["Price","price"],["Volume + Mix","volumeMixR"]],type:"Revenue",
      meaning:"At this level, every non-price change stays inside Volume + Mix.",
      sales:"Use this when you only need the first answer: how much came from price versus changes in units and composition?",
      math:"ΔRevenue = Σ((P₂−P₁)×Q₂) + Σ((Q₂−Q₁)×P₁)",
      experiments:["mixed","price","volmix"]},
    rev3:{start:"rev1",end:"rev2",drivers:[["Price","price"],["Quantity","quantityR"],["Total Mix","totalMixR"]],type:"Revenue",
      meaning:"Quantity changes total units at the old composition; Total Mix captures the remaining composition shift.",
      sales:"If Total Mix is positive, the sales basket moved toward products/channels with higher Period-1 selling price.",
      math:"Quantity = (TQ₂−TQ₁)×Σ(W₁×P₁); Total Mix = Σ((Q₂−W₁×TQ₂)×P₁)",
      experiments:["mixed","quantity","product"]},
    rev4:{start:"rev1",end:"rev2",drivers:[["Price","price"],["Quantity","quantityR"],["Channel Mix","channelMixR"],["Product Mix","productMixR"]],type:"Revenue",
      meaning:"Channel Mix measures where volume moved; Product Mix measures what gained share inside each channel.",
      sales:"A positive Product Mix means the within-channel basket shifted toward higher Period-1 selling-price products.",
      math:"Channel first: TQ₂×(S₂−S₁)×W₁(i|j)×P₁; then Product: TQ₂j×(W₂(i|j)−W₁(i|j))×P₁",
      experiments:["mixed","channel","product"]},
    gp3:{start:"gp1",end:"gp2",drivers:[["Price","price"],["Volume + Mix","volumeMixGP"],["Cost","cost"]],type:"Gross Profit",
      meaning:"Gross Profit adds Cost; a cost increase appears as a negative contribution.",
      sales:"This first GP bridge separates commercial price, combined volume/mix, and cost movement.",
      math:"ΔGP = Price + Σ((Q₂−Q₁)×(P₁−C₁)) − Σ((C₂−C₁)×Q₂)",
      experiments:["mixed","price","volmix","cost"]},
    gp4:{start:"gp1",end:"gp2",drivers:[["Price","price"],["Quantity","quantityGP"],["Total Mix","totalMixGP"],["Cost","cost"]],type:"Gross Profit",
      meaning:"Mix is valued at Period-1 unit margin, keeping later price and cost changes out of the mix effect.",
      sales:"Positive Total Mix means composition shifted toward higher baseline unit-margin business.",
      math:"Quantity = (TQ₂−TQ₁)×Σ(W₁×M₁); Total Mix = Σ((Q₂−W₁×TQ₂)×M₁)",
      experiments:["mixed","quantity","product","cost"]},
    gp5:{start:"gp1",end:"gp2",drivers:[["Price","price"],["Quantity","quantityGP"],["Channel Mix","channelMixGP"],["Product Mix","productMixGP"],["Cost","cost"]],type:"Gross Profit",
      meaning:"The full bridge tells you whether margin moved because of price, units, where you sold, what you sold, or cost.",
      sales:"For sales action, Product Mix is the cleanest read on whether each channel’s basket moved toward higher baseline-margin SKUs.",
      math:"Channel first: TQ₂×(S₂−S₁)×W₁(i|j)×M₁; Product: TQ₂j×(W₂(i|j)−W₁(i|j))×M₁",
      experiments:["mixed","price","quantity","channel","product","cost"]}
  };
  const labels={mixed:"Mixed reality",price:"Price only",quantity:"Quantity only",product:"Product Mix only",channel:"Channel Mix only",cost:"Cost only",volmix:"Volume/Mix only"};

  let currentScenario="mixed";
  let data=scenario(currentScenario);

  const fmt = v => {
    const sign=v<0?"−":"", n=Math.abs(v);
    if(n>=1000000) return sign+(n/1000000).toFixed(1)+"m";
    if(n>=1000) return sign+(n/1000).toFixed(1)+"k";
    return sign+n.toFixed(n<100?1:0);
  };
  const signed = v => (v>=0?"+":"−")+fmt(Math.abs(v));

  function renderDelta(svg,drivers){
    const mobile=window.innerWidth<600;
    const W=mobile?360:760,H=250, padL=mobile?14:28,padR=mobile?10:20,padT=42,padB=34;
    let cum=0; const points=[0];
    drivers.forEach(d=>{cum+=d.value;points.push(cum)});
    let min=Math.min(...points,0), max=Math.max(...points,0);
    if(Math.abs(max-min)<1e-9){max=1;min=-1}
    const extra=(max-min)*.22; min-=extra; max+=extra;
    const y=v=>padT+(max-v)/(max-min)*(H-padT-padB);
    const n=drivers.length, gap=mobile?8:18, plotW=W-padL-padR, bw=Math.min(100,(plotW-gap*(n-1))/n);
    const used=bw*n+gap*(n-1), x0=padL+(plotW-used)/2;
    let out=`<line x1="${padL}" x2="${W-padR}" y1="${y(0)}" y2="${y(0)}" stroke="#cfd4dc" stroke-width="1.5" stroke-dasharray="4 5"/>
      <text x="${padL}" y="${y(0)-7}" class="axis-label">Change vs Period 1</text>`;
    cum=0;
    drivers.forEach((d,i)=>{
      const before=cum, after=cum+d.value, x=x0+i*(bw+gap);
      const yt=y(Math.max(before,after)), yb=y(Math.min(before,after));
      const h=Math.max(3,yb-yt), color=d.value>=0?"#147d64":"#c34b43";
      if(i>0){
        const prevx=x0+(i-1)*(bw+gap)+bw;
        out+=`<line x1="${prevx}" x2="${x}" y1="${y(before)}" y2="${y(before)}" stroke="#b7bec8" stroke-width="1.2"/>`;
      }
      out+=`<rect x="${x}" y="${yt}" width="${bw}" height="${h}" rx="8" fill="${color}" opacity=".92"/>
        <text x="${x+bw/2}" y="${Math.max(16,yt-10)}" text-anchor="middle" class="driver-value">${signed(d.value)}</text>
        <text x="${x+bw/2}" y="${H-8}" text-anchor="middle" class="driver-label">${d.label}</text>`;
      cum=after;
    });
    svg.setAttribute("viewBox",`0 0 ${W} ${H}`); svg.innerHTML=out;
  }

  function interpretation(view,r){
    if(view==="rev2") return `Revenue moved ${signed(r.rev2-r.rev1)}. Price contributed ${signed(r.price)}; Volume + Mix contributed ${signed(r.volumeMixR)}.`;
    if(view==="rev3") return `Pure Quantity contributed ${signed(r.quantityR)} and Total Mix ${signed(r.totalMixR)} to Revenue.`;
    if(view==="rev4") return `Within Total Mix, Channel Mix contributed ${signed(r.channelMixR)} and Product Mix ${signed(r.productMixR)} to Revenue.`;
    if(view==="gp3") return `Gross Profit moved ${signed(r.gp2-r.gp1)}: Price ${signed(r.price)}, Volume + Mix ${signed(r.volumeMixGP)}, Cost ${signed(r.cost)}.`;
    if(view==="gp4") return `Pure Quantity contributed ${signed(r.quantityGP)} and Total Mix ${signed(r.totalMixGP)} to Gross Profit.`;
    return `Full GP bridge: Price ${signed(r.price)}, Quantity ${signed(r.quantityGP)}, Channel Mix ${signed(r.channelMixGP)}, Product Mix ${signed(r.productMixGP)}, Cost ${signed(r.cost)}.`;
  }

  function renderCard(card){
    const view=card.dataset.view, v=views[view], r=calc(data);
    const drivers=v.drivers.map(([label,key])=>({label,value:r[key]}));
    const start=r[v.start], end=r[v.end];
    card.innerHTML=`
      <div class="bridge-wrap">
        <div class="bridge-head"><strong>${v.type} bridge</strong><span>${labels[currentScenario]}</span></div>
        <div class="bridge-grid">
          <div class="total-card"><div class="total-label">Period 1</div><div class="total-value">${fmt(start)}</div><div class="total-sub">${v.type}</div></div>
          <div class="delta-chart"><svg aria-label="${v.type} driver bridge"></svg></div>
          <div class="total-card end"><div class="total-label">Period 2</div><div class="total-value">${fmt(end)}</div><div class="total-sub">${signed(end-start)} vs Period 1</div></div>
        </div>
        <div class="reconcile">✓ Period 1 + impacts = Period 2</div>
      </div>
      <div class="experiments"><span class="lead">Try one change:</span>${v.experiments.map(x=>`<button class="chip ${x===currentScenario?"active":""}" data-scenario="${x}">${labels[x]}</button>`).join("")}</div>
      <div class="readout">
        <div><div class="label">Read the bridge</div><p>${interpretation(view,r)}</p></div>
        <div><div class="label">Business meaning</div><p>${v.sales}</p></div>
      </div>
      <details class="math-drawer"><summary>Show the calculation</summary><div class="math-body"><div><strong>Concept:</strong> ${v.meaning}</div><div style="margin-top:8px"><code>${v.math}</code></div></div></details>
    `;
    renderDelta(card.querySelector("svg"),drivers);
  }
  function renderAll(){document.querySelectorAll(".lesson-card").forEach(renderCard)}
  document.addEventListener("click",e=>{
    const go=e.target.closest("[data-go]"); if(go) showStage(Number(go.dataset.go));
    const sc=e.target.closest("[data-scenario]"); if(sc){currentScenario=sc.dataset.scenario;data=scenario(currentScenario);renderAll()}
    const ans=e.target.closest("[data-answer]"); if(ans){document.getElementById(ans.dataset.answer).classList.toggle("show")}
  });
  function showStage(n){
    document.querySelectorAll(".stage").forEach(s=>s.classList.toggle("active",Number(s.dataset.stage)===n));
    document.querySelectorAll(".progress button").forEach(b=>b.classList.toggle("active",Number(b.dataset.go)===n));
    window.scrollTo({top:0,behavior:"smooth"});
  }

  const progress=document.querySelector(".progress");
  ["0","1","2","3","4","5","6","7"].forEach((n,i)=>{
    const b=document.createElement("button");b.textContent=n;b.dataset.go=n;b.title=["Overview","Revenue 2-factor","Revenue 3-factor","Revenue 4-factor","GP 3-factor","GP 4-factor","GP 5-factor","Interpretation"][i];progress.appendChild(b)
  });
  progress.querySelector("button").classList.add("active");

  function close(a,b,t=1e-7){return Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b))}
  function verify(d){
    const r=calc(d);
    return [
      close(r.rev2-r.rev1,r.price+r.volumeMixR),
      close(r.volumeMixR,r.quantityR+r.totalMixR),
      close(r.totalMixR,r.channelMixR+r.productMixR),
      close(r.rev2-r.rev1,r.price+r.quantityR+r.channelMixR+r.productMixR),
      close(r.gp2-r.gp1,r.price+r.volumeMixGP+r.cost),
      close(r.volumeMixGP,r.quantityGP+r.totalMixGP),
      close(r.totalMixGP,r.channelMixGP+r.productMixGP),
      close(r.gp2-r.gp1,r.price+r.quantityGP+r.channelMixGP+r.productMixGP+r.cost)
    ];
  }
  function runTests(){
    const names=["base","price","quantity","product","channel","cost","mixed","legacy"];
    let passed=0,total=0;
    names.forEach(n=>verify(scenario(n)).forEach(x=>{total++;if(x)passed++}));
    return {passed,total,ok:passed===total};
  }
  const test=runTests();
  const status=document.getElementById("mathStatus");
  status.textContent=test.ok?`Math verified · ${test.passed}/${test.total}`:`Math check failed · ${test.passed}/${test.total}`;
  status.style.color=test.ok?"var(--pos)":"var(--neg)";
  window.PVM_LAB_CORE={scenario,calc,verify,runTests};
  renderAll();
  let resizeTimer; window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderAll,120)});
})();