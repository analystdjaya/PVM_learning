(() => {
  const CHANNELS = ["General Trade","Modern Trade","Food Service"];
  const SKUS = ["Value","Core","Premium","Legacy"];

  const Q1 = {
    "General Trade":[320,240,160,80],
    "Modern Trade":[320,240,160,80],
    "Food Service":[320,240,160,80]
  };
  const P1 = {
    "General Trade":[10,15,20,8],
    "Modern Trade":[12,16,22,9],
    "Food Service":[14,17,24,10]
  };
  const C1 = {
    "General Trade":[7,10,12,6],
    "Modern Trade":[8,10,13,6],
    "Food Service":[9,11,14,7]
  };

  // Step 6 Mixed Reality is the source of truth.
  const Q2 = {
    "General Trade":[324,216,108,72],
    "Modern Trade":[308,264,220,88],
    "Food Service":[312,312,312,104]
  };
  const PRICE_DELTA = {Value:1,Core:1,Premium:2,Legacy:0};
  const COST_DELTA = {Value:1,Core:1,Premium:1,Legacy:1};

  function masterRows(){
    const rows=[];
    CHANNELS.forEach(function(ch){
      SKUS.forEach(function(sku,i){
        rows.push({
          channel:ch, sku:sku,
          q1:Q1[ch][i], p1:P1[ch][i], c1:C1[ch][i],
          q2:Q2[ch][i], p2:P1[ch][i]+PRICE_DELTA[sku], c2:C1[ch][i]+COST_DELTA[sku]
        });
      });
    });
    return rows;
  }

  const sum = function(a,f){ return a.reduce(function(s,x){ return s+f(x); },0); };
  function clean(v){ return Math.abs(v-Math.round(v))<1e-8 ? Math.round(v) : v; }

  function calc(d){
    const tq1=sum(d,function(r){return r.q1;});
    const tq2=sum(d,function(r){return r.q2;});
    const rev1=sum(d,function(r){return r.p1*r.q1;});
    const rev2=sum(d,function(r){return r.p2*r.q2;});
    const gp1=sum(d,function(r){return (r.p1-r.c1)*r.q1;});
    const gp2=sum(d,function(r){return (r.p2-r.c2)*r.q2;});
    const price=sum(d,function(r){return (r.p2-r.p1)*r.q2;});
    const cost=-sum(d,function(r){return (r.c2-r.c1)*r.q2;});
    const volumeMixR=sum(d,function(r){return (r.q2-r.q1)*r.p1;});
    const volumeMixGP=sum(d,function(r){return (r.q2-r.q1)*(r.p1-r.c1);});
    const quantityR=(tq2-tq1)*(rev1/tq1);
    const quantityGP=(tq2-tq1)*(gp1/tq1);
    const totalMixR=volumeMixR-quantityR;
    const totalMixGP=volumeMixGP-quantityGP;

    const ct1={},ct2={};
    CHANNELS.forEach(function(ch){
      ct1[ch]=sum(d.filter(function(r){return r.channel===ch;}),function(r){return r.q1;});
      ct2[ch]=sum(d.filter(function(r){return r.channel===ch;}),function(r){return r.q2;});
    });

    let channelMixR=0,productMixR=0,channelMixGP=0,productMixGP=0;
    d.forEach(function(r){
      const s1=ct1[r.channel]/tq1, s2=ct2[r.channel]/tq2;
      const w1=r.q1/ct1[r.channel], w2=r.q2/ct2[r.channel];
      channelMixR += tq2*(s2-s1)*w1*r.p1;
      channelMixGP += tq2*(s2-s1)*w1*(r.p1-r.c1);
      productMixR += tq2*s2*(w2-w1)*r.p1;
      productMixGP += tq2*s2*(w2-w1)*(r.p1-r.c1);
    });

    return {
      tq1:clean(tq1),tq2:clean(tq2),rev1:clean(rev1),rev2:clean(rev2),gp1:clean(gp1),gp2:clean(gp2),
      price:clean(price),cost:clean(cost),volumeMixR:clean(volumeMixR),volumeMixGP:clean(volumeMixGP),
      quantityR:clean(quantityR),quantityGP:clean(quantityGP),totalMixR:clean(totalMixR),totalMixGP:clean(totalMixGP),
      channelMixR:clean(channelMixR),channelMixGP:clean(channelMixGP),productMixR:clean(productMixR),productMixGP:clean(productMixGP)
    };
  }

  const MASTER = masterRows();
  const RESULT = calc(MASTER);

  const views = {
    rev2:{
      start:"rev1",end:"rev2",type:"Revenue",
      drivers:[["Price","price"],["Volume + Mix","volumeMixR"]],
      focusMap:{price:"Price",quantity:"Volume + Mix",channel:"Volume + Mix",product:"Volume + Mix",cost:null},
      sales:"This first view answers only two questions: how much came from Price, and how much came from all quantity/composition changes combined?"
    },
    rev3:{
      start:"rev1",end:"rev2",type:"Revenue",
      drivers:[["Price","price"],["Quantity","quantityR"],["Total Mix","totalMixR"]],
      focusMap:{price:"Price",quantity:"Quantity",channel:"Total Mix",product:"Total Mix",cost:null},
      sales:"Total Mix is what remains after pure Quantity is removed from Volume + Mix."
    },
    rev4:{
      start:"rev1",end:"rev2",type:"Revenue",
      drivers:[["Price","price"],["Quantity","quantityR"],["Channel Mix","channelMixR"],["Product Mix","productMixR"]],
      focusMap:{price:"Price",quantity:"Quantity",channel:"Channel Mix",product:"Product Mix",cost:null},
      sales:"Channel Mix explains where volume moved. Product Mix explains what products gained or lost share inside each channel."
    },
    gp3:{
      start:"gp1",end:"gp2",type:"Gross Profit",
      drivers:[["Price","price"],["Volume + Mix","volumeMixGP"],["Cost","cost"]],
      focusMap:{price:"Price",quantity:"Volume + Mix",channel:"Volume + Mix",product:"Volume + Mix",cost:"Cost"},
      sales:"Gross Profit adds Cost, while all quantity and composition changes are still combined in Volume + Mix."
    },
    gp4:{
      start:"gp1",end:"gp2",type:"Gross Profit",
      drivers:[["Price","price"],["Quantity","quantityGP"],["Total Mix","totalMixGP"],["Cost","cost"]],
      focusMap:{price:"Price",quantity:"Quantity",channel:"Total Mix",product:"Total Mix",cost:"Cost"},
      sales:"Quantity uses the old composition. Total Mix captures the remaining change in sales composition."
    },
    gp5:{
      start:"gp1",end:"gp2",type:"Gross Profit",
      drivers:[["Price","price"],["Quantity","quantityGP"],["Channel Mix","channelMixGP"],["Product Mix","productMixGP"],["Cost","cost"]],
      focusMap:{price:"Price",quantity:"Quantity",channel:"Channel Mix",product:"Product Mix",cost:"Cost"},
      sales:"This is the full source-of-truth bridge: Price, pure Quantity, where volume moved, what was sold within each channel, and Cost."
    }
  };

  const focusLabels={mixed:"Mixed reality",price:"Price",quantity:"Quantity",channel:"Channel Mix",product:"Product Mix",cost:"Cost"};
  const focusOrder=["mixed","price","quantity","channel","product","cost"];
  let currentFocus="mixed";

  const numberFmt=new Intl.NumberFormat("id-ID",{maximumFractionDigits:0});
  const decimalFmt=new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1});
  function fmt(v){ return numberFmt.format(Math.round(Math.abs(v))); }
  function signed(v){ return (v>=0?"+":"−")+fmt(v); }
  function labelLines(label){
    const map={
      "Period 1":["Period 1"],"Period 2":["Period 2"],"Volume + Mix":["Volume","+ Mix"],
      "Channel Mix":["Channel","Mix"],"Product Mix":["Product","Mix"],"Total Mix":["Total","Mix"]
    };
    return map[label]||[label];
  }

  function viewDrivers(v,r){
    return v.drivers.map(function(x){return {label:x[0],key:x[1],value:r[x[1]]};});
  }

  function focusTarget(v){
    return currentFocus==="mixed" ? null : v.focusMap[currentFocus];
  }

  function renderWaterfall(svg,v,r){
    const drivers=viewDrivers(v,r);
    const start=r[v.start], end=r[v.end];
    const items=[{label:"Period 1",type:"total",from:0,to:start,value:start}];
    let cumulative=start;
    drivers.forEach(function(d){
      const before=cumulative;
      cumulative+=d.value;
      items.push({label:d.label,type:"driver",from:before,to:cumulative,value:d.value,key:d.key});
    });
    items.push({label:"Period 2",type:"total",from:0,to:end,value:end});

    const mobile=window.innerWidth<600;
    const W=mobile?500:820,H=330,padL=18,padR=18,padT=36,padB=58;
    const allVals=[0,start,end].concat(items.map(function(x){return x.from;})).concat(items.map(function(x){return x.to;}));
    let min=Math.min.apply(null,allVals), max=Math.max.apply(null,allVals);
    if(min>0)min=0;
    const range=Math.max(1,max-min);
    max+=range*.12;
    if(min<0)min-=range*.06;
    const y=function(val){return padT+(max-val)/(max-min)*(H-padT-padB);};
    const n=items.length,gap=mobile?7:14,plotW=W-padL-padR;
    const bw=Math.min(mobile?54:84,(plotW-gap*(n-1))/n);
    const used=bw*n+gap*(n-1),x0=padL+(plotW-used)/2;
    const target=focusTarget(v);
    let out='<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+y(0)+'" y2="'+y(0)+'" stroke="#d2d7df" stroke-width="1.2"/>';

    items.forEach(function(item,i){
      const x=x0+i*(bw+gap);
      const top=Math.max(item.from,item.to),bottom=Math.min(item.from,item.to);
      let yt=y(top),yb=y(bottom),h=Math.max(3,yb-yt);
      let fill=item.type==="total"?"#172033":(item.value>=0?"#147d64":"#c34b43");
      let opacity=1;
      if(item.type==="driver" && currentFocus!=="mixed" && target){
        opacity=item.label===target?1:.22;
      }
      const lines=labelLines(item.label);
      if(i>0 && item.type==="driver"){
        const prevX=x0+(i-1)*(bw+gap)+bw;
        out+='<line class="connector" x1="'+prevX+'" x2="'+x+'" y1="'+y(item.from)+'" y2="'+y(item.from)+'"/>';
      }
      if(item.type==="total" && i===items.length-1){
        const prevX=x0+(i-1)*(bw+gap)+bw;
        out+='<line class="connector" x1="'+prevX+'" x2="'+x+'" y1="'+y(end)+'" y2="'+y(end)+'"/>';
      }
      out+='<rect x="'+x+'" y="'+yt+'" width="'+bw+'" height="'+h+'" rx="7" fill="'+fill+'" opacity="'+opacity+'"/>';
      const valueText=item.type==="total"?fmt(item.value):signed(item.value);
      const valueY=Math.max(16,yt-9);
      out+='<text x="'+(x+bw/2)+'" y="'+valueY+'" text-anchor="middle" class="bar-value '+(item.type==="total"?"total":"")+'" opacity="'+Math.max(opacity,.45)+'">'+valueText+'</text>';
      const labelY=H-29;
      lines.forEach(function(line,j){
        out+='<text x="'+(x+bw/2)+'" y="'+(labelY+j*12)+'" text-anchor="middle" class="bar-label" opacity="'+Math.max(opacity,.5)+'">'+line+'</text>';
      });
    });

    svg.setAttribute("viewBox","0 0 "+W+" "+H);
    svg.innerHTML=out;
  }

  function focusMessage(v,r){
    if(currentFocus==="mixed") return "Mixed Reality shows the complete bridge. Choose a driver to trace where it sits as the analysis gets deeper.";
    const target=v.focusMap[currentFocus];
    if(target===null) return "Cost does not change Revenue. It appears only when the analysis moves from Revenue to Gross Profit.";
    const selected=focusLabels[currentFocus];
    if(target!==selected){
      const d=viewDrivers(v,r).find(function(x){return x.label===target;});
      return selected+" is not separated yet at this step. It is still inside "+target+" ("+signed(d.value)+").";
    }
    const d=viewDrivers(v,r).find(function(x){return x.label===target;});
    return "Same master bridge, now focusing "+selected+": "+signed(d.value)+". Nothing else in Period 1 or Period 2 changed.";
  }

  function interpretation(view,r){
    if(view==="rev2") return "Revenue: "+fmt(r.rev1)+" → "+fmt(r.rev2)+". Price "+signed(r.price)+"; Volume + Mix "+signed(r.volumeMixR)+".";
    if(view==="rev3") return "The same Revenue movement: Price "+signed(r.price)+", Quantity "+signed(r.quantityR)+", Total Mix "+signed(r.totalMixR)+".";
    if(view==="rev4") return "The same Revenue movement: Total Mix "+signed(r.totalMixR)+" is split into Channel Mix "+signed(r.channelMixR)+" + Product Mix "+signed(r.productMixR)+".";
    if(view==="gp3") return "Gross Profit: "+fmt(r.gp1)+" → "+fmt(r.gp2)+". Price "+signed(r.price)+", Volume + Mix "+signed(r.volumeMixGP)+", Cost "+signed(r.cost)+".";
    if(view==="gp4") return "The same GP movement: Volume + Mix "+signed(r.volumeMixGP)+" becomes Quantity "+signed(r.quantityGP)+" + Total Mix "+signed(r.totalMixGP)+".";
    return "Full GP bridge: Price "+signed(r.price)+", Quantity "+signed(r.quantityGP)+", Channel Mix "+signed(r.channelMixGP)+", Product Mix "+signed(r.productMixGP)+", Cost "+signed(r.cost)+".";
  }

  function formulaInfo(key,r){
    const avgPrice=r.rev1/r.tq1,avgMargin=r.gp1/r.tq1;
    const info={
      price:{name:"Price",formula:"Σ((P₂ − P₁) × Q₂)",sub:"Apply each selling-price change to Period-2 units.",value:r.price},
      volumeMixR:{name:"Volume + Mix",formula:"Σ((Q₂ − Q₁) × P₁)",sub:"All quantity and composition changes valued at Period-1 price.",value:r.volumeMixR},
      quantityR:{name:"Quantity",formula:"(TQ₂ − TQ₁) × average P₁",sub:"("+fmt(r.tq2)+" − "+fmt(r.tq1)+") × "+decimalFmt.format(avgPrice)+" = "+signed(r.quantityR)+". Old mix is held constant.",value:r.quantityR},
      totalMixR:{name:"Total Mix",formula:"Volume + Mix − Quantity",sub:fmt(r.volumeMixR)+" − "+fmt(r.quantityR)+" = "+signed(r.totalMixR)+". This is composition after pure quantity is removed.",value:r.totalMixR},
      channelMixR:{name:"Channel Mix",formula:"Σ TQ₂ × (S₂ − S₁) × W₁ × P₁",sub:"Shift channel shares first while keeping each channel's old product mix. Result = "+signed(r.channelMixR)+".",value:r.channelMixR},
      productMixR:{name:"Product Mix",formula:"Σ TQ₂j × (W₂ − W₁) × P₁",sub:"Then change product shares inside current channel volumes. "+fmt(r.totalMixR)+" − "+fmt(r.channelMixR)+" = "+signed(r.productMixR)+".",value:r.productMixR},
      volumeMixGP:{name:"Volume + Mix",formula:"Σ((Q₂ − Q₁) × M₁)",sub:"All quantity and composition changes valued at Period-1 unit margin.",value:r.volumeMixGP},
      quantityGP:{name:"Quantity",formula:"(TQ₂ − TQ₁) × average M₁",sub:"("+fmt(r.tq2)+" − "+fmt(r.tq1)+") × "+decimalFmt.format(avgMargin)+" = "+signed(r.quantityGP)+". Old mix is held constant.",value:r.quantityGP},
      totalMixGP:{name:"Total Mix",formula:"Volume + Mix − Quantity",sub:fmt(r.volumeMixGP)+" − "+fmt(r.quantityGP)+" = "+signed(r.totalMixGP)+".",value:r.totalMixGP},
      channelMixGP:{name:"Channel Mix",formula:"Σ TQ₂ × (S₂ − S₁) × W₁ × M₁",sub:"Shift channel shares first, valued at Period-1 unit margin. Result = "+signed(r.channelMixGP)+".",value:r.channelMixGP},
      productMixGP:{name:"Product Mix",formula:"Σ TQ₂j × (W₂ − W₁) × M₁",sub:"Then change product shares inside current channel volumes. "+fmt(r.totalMixGP)+" − "+fmt(r.channelMixGP)+" = "+signed(r.productMixGP)+".",value:r.productMixGP},
      cost:{name:"Cost",formula:"−Σ((C₂ − C₁) × Q₂)",sub:"Higher unit cost reduces Gross Profit, so the contribution is negative.",value:r.cost}
    };
    return info[key];
  }

  function calculationHTML(v,r){
    const drivers=viewDrivers(v,r);
    let arithmetic=fmt(r[v.start]);
    drivers.forEach(function(d){ arithmetic+=" "+(d.value>=0?"+":"−")+" "+fmt(d.value); });
    arithmetic+=" = "+fmt(r[v.end]);

    let steps="";
    drivers.forEach(function(d){
      const info=formulaInfo(d.key,r);
      steps+='<div class="calc-step"><div class="calc-top"><span class="calc-name">'+info.name+'</span><span class="calc-value">'+signed(info.value)+'</span></div><div class="calc-formula">'+info.formula+'</div><div class="calc-sub">'+info.sub+'</div></div>';
    });
    return '<div class="bridge-arithmetic">'+arithmetic+'</div><div class="calc-list">'+steps+'</div>';
  }

  function renderCard(card){
    const view=card.dataset.view,v=views[view],r=RESULT;
    card.innerHTML=
      '<div class="bridge-wrap">'+
        '<div class="bridge-head"><strong>'+v.type+' waterfall</strong><span>Master Mixed Reality dataset</span></div>'+
        '<div class="waterfall-scroll"><div class="waterfall-chart"><svg aria-label="'+v.type+' waterfall chart"></svg></div></div>'+
        '<div class="focus-note">'+focusMessage(v,r)+'</div>'+
        '<div class="reconcile">✓ Period 1 + impacts = Period 2</div>'+
      '</div>'+
      '<div class="experiments"><span class="lead">Focus one driver:</span>'+
        focusOrder.map(function(x){return '<button class="chip '+(x===currentFocus?'active':'')+'" data-focus="'+x+'">'+focusLabels[x]+'</button>';}).join("")+
      '</div>'+
      '<div class="readout">'+
        '<div><div class="label">Read the bridge</div><p>'+interpretation(view,r)+'</p></div>'+
        '<div><div class="label">Business meaning</div><p>'+v.sales+'</p></div>'+
      '</div>'+
      '<details class="math-drawer"><summary>Show the calculation</summary><div class="math-body">'+calculationHTML(v,r)+'</div></details>';
    renderWaterfall(card.querySelector("svg"),v,r);
  }

  function renderAll(){ document.querySelectorAll(".lesson-card").forEach(renderCard); }

  document.addEventListener("click",function(e){
    const go=e.target.closest("[data-go]");
    if(go) showStage(Number(go.dataset.go));
    const f=e.target.closest("[data-focus]");
    if(f){ currentFocus=f.dataset.focus; renderAll(); }
    const ans=e.target.closest("[data-answer]");
    if(ans) document.getElementById(ans.dataset.answer).classList.toggle("show");
  });

  function showStage(n){
    document.querySelectorAll(".stage").forEach(function(s){s.classList.toggle("active",Number(s.dataset.stage)===n);});
    document.querySelectorAll(".progress button").forEach(function(b){b.classList.toggle("active",Number(b.dataset.go)===n);});
    window.scrollTo({top:0,behavior:"smooth"});
  }

  const progress=document.querySelector(".progress");
  ["0","1","2","3","4","5","6","7"].forEach(function(n,i){
    const b=document.createElement("button");
    b.textContent=n;b.dataset.go=n;
    b.title=["Overview","Revenue 2-factor","Revenue 3-factor","Revenue 4-factor","GP 3-factor","GP 4-factor","GP 5-factor","Interpretation"][i];
    progress.appendChild(b);
  });
  progress.querySelector("button").classList.add("active");

  function close(a,b,t){ t=t||1e-9; return Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b)); }
  function runTests(){
    const r=RESULT;
    const checks=[
      close(r.rev2-r.rev1,r.price+r.volumeMixR),
      close(r.volumeMixR,r.quantityR+r.totalMixR),
      close(r.totalMixR,r.channelMixR+r.productMixR),
      close(r.rev2-r.rev1,r.price+r.quantityR+r.channelMixR+r.productMixR),
      close(r.gp2-r.gp1,r.price+r.volumeMixGP+r.cost),
      close(r.volumeMixGP,r.quantityGP+r.totalMixGP),
      close(r.totalMixGP,r.channelMixGP+r.productMixGP),
      close(r.gp2-r.gp1,r.price+r.quantityGP+r.channelMixGP+r.productMixGP+r.cost),
      close(r.rev1,35760),close(r.rev2,43984),close(r.gp1,12880),close(r.gp2,15360),
      close(r.price,3016),close(r.quantityGP,1288),close(r.channelMixGP,256),close(r.productMixGP,560)
    ];
    const passed=checks.filter(Boolean).length;
    return {passed:passed,total:checks.length,ok:passed===checks.length};
  }

  const test=runTests();
  const status=document.getElementById("mathStatus");
  status.textContent=test.ok?"Math verified · "+test.passed+"/"+test.total:"Math check failed · "+test.passed+"/"+test.total;
  status.style.color=test.ok?"var(--pos)":"var(--neg)";

  window.PVM_LAB_CORE={masterRows:masterRows,calc:calc,result:RESULT,runTests:runTests};
  renderAll();

  let resizeTimer;
  window.addEventListener("resize",function(){
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(renderAll,120);
  });
})();