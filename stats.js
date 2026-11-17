(()=>{
"use strict";

const SUPABASE_URL="https://dkwmkvruzebnqlmvwzhy.supabase.co";
const SUPABASE_KEY="sb_publishable_Tur9X4MaQjH__4DnEtwAAQ_Xy9xVl5P";
const TABLE="hub_analytics_events";
const $=id=>document.getElementById(id);
const root=$("statsTabView");
if(!root)return;

const status=$("statsStatus");
const showStatus=message=>{if(status)status.textContent=message;};
let started=false;

function start(){
  if(started)return;
  if(!window.supabase||typeof window.supabase.createClient!=="function"){
    showStatus("Analytics could not start: Supabase library did not load. Refresh the page to retry.");
    return;
  }
  started=true;

  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const now=()=>new Date();
  const getSession=()=>{
    try{
      let id=localStorage.getItem("hubAnalyticsSession");
      if(!id){id=crypto.randomUUID();localStorage.setItem("hubAnalyticsSession",id);}
      return id;
    }catch(error){
      return crypto.randomUUID();
    }
  };
  const sessionId=getSession();
  const ua=navigator.userAgent;
  const device=/ipad|tablet/i.test(ua)?"Tablet":/mobi|android|iphone/i.test(ua)?"Mobile":"Desktop";
  const browser=/edg\//i.test(ua)?"Edge":/firefox\//i.test(ua)?"Firefox":/opr\//i.test(ua)?"Opera":/chrome\//i.test(ua)?"Chrome":/safari\//i.test(ua)?"Safari":"Other";
  const meta=()=>({device,browser,language:navigator.language||"unknown"});

  async function record(type,extra={}){
    try{
      const {error}=await db.from(TABLE).insert({
        event_type:type,session_id:sessionId,page_path:location.pathname,
        metadata:{...meta(),...extra}
      });
      if(error)console.warn("Hub analytics insert failed:",error.message);
    }catch(error){
      console.warn("Hub analytics event was not recorded:",error);
    }
  }

  const periodButtons=[...root.querySelectorAll("[data-range]")];
  const ranges={"24h":86400000,"7d":7*86400000,"30d":30*86400000,"all":Infinity};
  let range="7d",events=[];
  const fmt=n=>Number(n||0).toLocaleString();
  const within=(event,ms)=>ms===Infinity||new Date(event.created_at).getTime()>=Date.now()-ms;

  function render(){
    const filtered=events.filter(event=>within(event,ranges[range]));
    const sessions=new Set(filtered.map(event=>event.session_id));
    const count=(type,list=filtered)=>list.filter(event=>event.event_type===type).length;
    const unique=list=>new Set(list.map(event=>event.session_id)).size;
    const today=events.filter(event=>within(event,86400000));
    const week=events.filter(event=>within(event,7*86400000));
    const month=events.filter(event=>within(event,30*86400000));
    const active=new Set(events.filter(event=>event.event_type==="heartbeat"&&within(event,5*60000)).map(event=>event.session_id));
    const ofDevice=(list,name)=>unique(list.filter(event=>event.metadata?.device===name));
    const ofTab=name=>count("tab_view",filtered.filter(event=>event.metadata?.tab===name));
    const avg=sessions.size?filtered.length/sessions.size:0;
    const hours=Array(24).fill(0);
    filtered.filter(event=>event.event_type==="page_view").forEach(event=>hours[new Date(event.created_at).getHours()]++);
    const peak=hours.indexOf(Math.max(...hours));
    const cards=[
      ["Page views",count("page_view"),"Page loads in selected range","◫"],
      ["Unique visitors",unique(filtered),"Distinct anonymous browser sessions","◎"],
      ["Active now",active.size,"Seen in the last 5 minutes","●"],
      ["Heartbeat events",count("heartbeat"),"Presence pings received","♥"],
      ["Proxy loads",count("proxy_load"),"Proxy frame load events","↗"],
      ["Browse tab views",ofTab("browse"),"Visits to Browse","⌕"],
      ["Bookmarks tab views",ofTab("bookmarks"),"Visits to Bookmarks","▦"],
      ["Today's views",count("page_view",today),"Rolling last 24 hours","◷"],
      ["Today's visitors",unique(today),"Distinct sessions · last 24h","◉"],
      ["7-day views",count("page_view",week),"Page loads · last 7 days","▤"],
      ["7-day visitors",unique(week),"Distinct sessions · last 7 days","♧"],
      ["30-day views",count("page_view",month),"Page loads · last 30 days","▥"],
      ["30-day visitors",unique(month),"Distinct sessions · last 30 days","♙"],
      ["All-time visitors",unique(events),"Distinct sessions in available history","∞"],
      ["Avg. events / visitor",avg.toFixed(1),"Engagement events per session","∑"],
      ["Desktop visitors",ofDevice(filtered,"Desktop"),"Desktop browser sessions","▣"],
      ["Mobile visitors",ofDevice(filtered,"Mobile"),"Mobile browser sessions","▯"],
      ["Tablet visitors",ofDevice(filtered,"Tablet"),"Tablet browser sessions","▤"],
      ["Chrome sessions",unique(filtered.filter(event=>event.metadata?.browser==="Chrome")),"Browser breakdown","◉"],
      ["Peak activity hour",events.length?String(peak).padStart(2,"0")+":00":"—","Most page views · local display time","⌚"]
    ];
    const grid=$("statsGrid");
    if(grid)grid.innerHTML=cards.map(([label,value,sub,icon])=>'<article class="stat-card"><div class="stat-card-top"><span>'+icon+'</span><span class="stat-live-dot"></span></div><strong>'+((typeof value==="number")?fmt(value):value)+'</strong><b>'+label+'</b><small>'+sub+'</small></article>').join("");
    showStatus("Updated "+now().toLocaleTimeString()+" · "+fmt(events.length)+" events loaded · "+range);
    const bars=hours.map((value,index)=>'<div class="hour-col" title="'+String(index).padStart(2,"0")+':00 · '+value+' views"><i style="height:'+Math.max(3,Math.round(value/Math.max(1,...hours)*100))+'%"></i><small>'+((index%3===0)?String(index).padStart(2,"0"):"")+'</small></div>').join("");
    const chart=$("statsHours");
    if(chart)chart.innerHTML=bars;
    const total=$("statsTotalEvents");
    if(total)total.textContent=fmt(filtered.length)+" events in selected range";
  }

  async function refresh(){
    const button=$("statsRefresh");
    if(button)button.disabled=true;
    showStatus("Loading analytics…");
    try{
      const {data,error}=await db.from(TABLE)
        .select("event_type,session_id,metadata,created_at")
        .order("created_at",{ascending:false})
        .limit(10000);
      if(error)throw error;
      events=data||[];
      render();
    }catch(error){
      console.error("Hub analytics load failed:",error);
      events=[];
      const grid=$("statsGrid");
      if(grid)grid.innerHTML="";
      const chart=$("statsHours");
      if(chart)chart.innerHTML="";
      const total=$("statsTotalEvents");
      if(total)total.textContent="No analytics data loaded";
      showStatus("Analytics unavailable: "+(error?.message||"Unknown database or network error"));
    }finally{
      if(button)button.disabled=false;
    }
  }

  periodButtons.forEach(button=>button.addEventListener("click",()=>{
    const selected=button.dataset.range;
    if(!Object.prototype.hasOwnProperty.call(ranges,selected))return;
    range=selected;
    periodButtons.forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
    render();
  }));

  const refreshButton=$("statsRefresh");
  if(refreshButton)refreshButton.addEventListener("click",refresh);
  const proxyTab=$("proxyTab");
  if(proxyTab)proxyTab.addEventListener("click",()=>record("tab_view",{tab:"browse"}));
  const bookmarksTab=$("bookmarksTab");
  if(bookmarksTab)bookmarksTab.addEventListener("click",()=>record("tab_view",{tab:"bookmarks"}));
  const statsTab=$("statsTab");
  if(statsTab)statsTab.addEventListener("click",()=>{record("tab_view",{tab:"statistics"});refresh();});
  const proxyFrame=$("proxyMainFrame");
  if(proxyFrame)proxyFrame.addEventListener("load",()=>record("proxy_load"));

  record("page_view");
  record("heartbeat");
  setInterval(()=>record("heartbeat"),60000);
  window.addEventListener("focus",()=>record("heartbeat"));
  refresh();
}

if(window.supabase)start();
else{
  window.addEventListener("load",start,{once:true});
  setTimeout(()=>{if(!started)start();},1500);
}
})();