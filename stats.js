(()=> {
"use strict";
const URL="https://dkwmkvruzebnqlmvwzhy.supabase.co";
const KEY="sb_publishable_Tur9X4MaQjH__4DnEtwAAQ_Xy9xVl5P";
const TABLE="hub_analytics_events";
const $=id=>document.getElementById(id);
const root=$("hubStatsView");
if(!root||!window.supabase)return;
const db=window.supabase.createClient(URL,KEY);
const now=()=>new Date();
const getSession=()=>{
  let id=localStorage.getItem("hubAnalyticsSession");
  if(!id){id=crypto.randomUUID();localStorage.setItem("hubAnalyticsSession",id);}
  return id;
};
const sessionId=getSession();
const ua=navigator.userAgent;
const device=/ipad|tablet/i.test(ua)?"Tablet":/mobi|android|iphone/i.test(ua)?"Mobile":"Desktop";
const browser=/edg\//i.test(ua)?"Edge":/firefox\//i.test(ua)?"Firefox":/opr\//i.test(ua)?"Opera":/chrome\//i.test(ua)?"Chrome":/safari\//i.test(ua)?"Safari":"Other";
const meta=()=>({device,browser,language:navigator.language||"unknown"});
async function record(type,extra={}){
 try{await db.from(TABLE).insert({event_type:type,session_id:sessionId,page_path:"/",metadata:{...meta(),...extra}});}
 catch(e){console.warn("Hub analytics event was not recorded:",e.message);}
}
record("page_view");
record("heartbeat");
setInterval(()=>record("heartbeat"),60000);
window.addEventListener("focus",()=>record("heartbeat"));
const periodButtons=[...root.querySelectorAll("[data-range]")];
let range="7d",events=[],loadError="";
const ranges={24h:24*60*60*1000,7d:7*86400000,30d:30*86400000,all:Infinity};
const fmt=n=>Number(n||0).toLocaleString();
function within(e,ms){return ms===Infinity||new Date(e.created_at).getTime()>=Date.now()-ms;}
function render(){
 const filtered=events.filter(e=>within(e,ranges[range]));
 const sessions=new Set(filtered.map(e=>e.session_id));
 const count=(type,list=filtered)=>list.filter(e=>e.event_type===type).length;
 const unique=(list)=>new Set(list.map(e=>e.session_id)).size;
 const today=events.filter(e=>Date.now()-new Date(e.created_at).getTime()<86400000);
 const week=events.filter(e=>Date.now()-new Date(e.created_at).getTime()<7*86400000);
 const month=events.filter(e=>Date.now()-new Date(e.created_at).getTime()<30*86400000);
 const active=new Set(events.filter(e=>e.event_type==="heartbeat"&&Date.now()-new Date(e.created_at).getTime()<5*60000).map(e=>e.session_id));
 const ofDevice=(list,name)=>unique(list.filter(e=>e.metadata?.device===name));
 const ofTab=(name)=>count("tab_view",filtered.filter(e=>e.metadata?.tab===name));
 const avg=sessions.size?filtered.length/sessions.size:0;
 const hours=Array(24).fill(0);filtered.filter(e=>e.event_type==="page_view").forEach(e=>hours[new Date(e.created_at).getHours()]++);
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
 ["Chrome sessions",unique(filtered.filter(e=>e.metadata?.browser==="Chrome")),"Browser breakdown","◉"],
 ["Peak activity hour",events.length?String(peak).padStart(2,"0")+":00":"—","Most page views · local display time","⌚"]
 ];
 $("statsGrid").innerHTML=cards.map(([label,value,sub,icon])=>'<article class="stat-card"><div class="stat-card-top"><span>'+icon+'</span><span class="stat-live-dot"></span></div><strong>'+fmt(value)+'</strong><b>'+label+'</b><small>'+sub+'</small></article>').join("");
 $("statsStatus").textContent=loadError||("Updated "+now().toLocaleTimeString()+" · "+fmt(events.length)+" events loaded");
 const bars=hours.map((v,i)=>'<div class="hour-col" title="'+String(i).padStart(2,"0")+':00 · '+v+' views"><i style="height:'+Math.max(3,Math.round(v/(Math.max(1,...hours))*100))+'%"></i><small>'+((i%3===0)?String(i).padStart(2,"0"):"")+'</small></div>').join("");
 $("statsHours").innerHTML=bars;
 $("statsTotalEvents").textContent=fmt(filtered.length)+" events";
}
async function refresh(){
 $("statsStatus").textContent="Loading analytics…";
 loadError="";
 const {data,error}=await db.from(TABLE).select("event_type,session_id,metadata,created_at").order("created_at",{ascending:false}).limit(10000);
 if(error){loadError="Analytics unavailable: "+error.message;events=[];}
 else events=data||[];
 render();
}
periodButtons.forEach(b=>b.addEventListener("click",()=>{range=b.dataset.range;periodButtons.forEach(x=>x.setAttribute("aria-pressed",String(x===b)));render();}));
$("statsRefresh").addEventListener("click",refresh);
$("proxyTab").addEventListener("click",()=>record("tab_view",{tab:"browse"}));
$("bookmarksTab").addEventListener("click",()=>record("tab_view",{tab:"bookmarks"}));
$("statsTab").addEventListener("click",()=>{record("tab_view",{tab:"statistics"});refresh();});
const proxyFrame=$("proxyMainFrame");
if(proxyFrame)proxyFrame.addEventListener("load",()=>record("proxy_load"));
refresh();
})();