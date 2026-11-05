"use strict";
const $=s=>document.querySelector(s),AGENT="http://127.0.0.1:8765";
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const ls={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
let token=ls.get("tok",null),pending=null,rec=null,listening=false,tm=null;
const hasHi=s=>/[\u0900-\u097F]/.test(s);

/* ---------- speech ---------- */
function pickVoice(lang){const vs=speechSynthesis.getVoices(),b=lang.slice(0,2),f=/female|zira|heera|kalpana|neerja|swara|veena|samantha|aria|jenny|hazel|google (uk english female|हिन्दी)/i;
 return vs.find(v=>v.lang.startsWith(b)&&f.test(v.name))||vs.find(v=>v.lang.startsWith(b))||vs.find(v=>f.test(v.name))}
function speak(t){if(!window.speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang=hasHi(t)?"hi-IN":"en-IN";const v=pickVoice(u.lang);if(v)u.voice=v;u.pitch=1.1;speechSynthesis.speak(u)}
function say(t,c="bot"){const d=document.createElement("div");d.className=c;d.textContent=t;$("#log").append(d);d.scrollIntoView();return d}
function reply(t){say(t);speak(t)}
function link(u,label){const d=say("");const a=document.createElement("a");a.href=u;a.target="_blank";a.rel="noopener";a.textContent=label+" → "+u;d.append(a)}
function openUrl(u,label){const w=window.open(u,"_blank");if(w){w.opener=null;reply("Opening "+label)}else{say("Popup blocked by browser. Click the link:","err");link(u,label)}}

/* ---------- desktop agent ---------- */
function updAgent(on,msg){$("#adot").className="dot"+(on?" on":"");$("#astat").textContent=msg||(on?"Connected":"Not paired")}
async function agent(path,body){const r=await fetch(AGENT+path,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body||{})});
 if(r.status===401&&path!=="/pair"){token=null;ls.set("tok",null);updAgent(false,"Session expired. Pair again.")}return r.json()}
async function desk(action,args={}){
 if(!token){reply("The desktop agent is not paired. Use the Desktop Agent card.");return}
 try{showRes(await agent("/action",{action,args}))}catch{reply("Cannot reach the desktop agent. Is it running?")}}
function showRes(j){
 if(j.needs_confirm){pending=j.confirm_id;$("#confirm").hidden=false;$("#cq").textContent=j.message;speak(j.message+" Say yes or no.");return}
 reply(j.message||j.error||"Done");
 (j.results||[]).forEach(f=>{const d=say("📄 "+f.name+"  ","me");const b=document.createElement("button");b.textContent="Open";b.onclick=()=>desk("open_file",{path:f.path});d.append(b)})}
async function doConfirm(){const id=pending;pending=null;$("#confirm").hidden=true;try{showRes(await agent("/confirm",{id}))}catch{reply("Agent unreachable.")}}
function doCancel(){pending=null;$("#confirm").hidden=true;reply("Cancelled.")}
$("#cy").onclick=doConfirm;$("#cn").onclick=doCancel;
$("#pair").onclick=async()=>{try{const j=await agent("/pair",{code:$("#code").value.trim()});if(j.token){token=j.token;ls.set("tok",token);updAgent(true);reply("Desktop agent connected.")}else updAgent(false,j.error||"Pairing failed")}catch{updAgent(false,"Agent not reachable. Is it running?")}};
$("#unpair").onclick=()=>{token=null;ls.set("tok",null);updAgent(false);say("Disconnected.")};
$("#ping").onclick=async()=>{try{const j=await agent("/status");j.ok?(updAgent(true),reply("Agent is online.")):updAgent(false,j.error)}catch{updAgent(false,"Agent not reachable")}};

/* ---------- parsing ---------- */
const OPEN=/\b(open|kholo|khol|chalu|start|launch|chalao)\b|खोलो|खोल|चालू|शुरू|चलाओ/,CLOSE=/\b(close|band|exit|quit)\b|बंद/;
const APPS={notepad:/notepad|नोटपैड/,calculator:/calculator|calc\b|कैलकुलेटर|कैल्कुलेटर/,chrome:/chrome|क्रोम/,paint:/\bpaint\b|पेंट/,edge:/\bedge\b/,explorer:/explorer|एक्सप्लोरर/,taskmgr:/task ?manager|टास्क मैनेजर/,settings:/settings|सेटिंग/};
const DIRS={downloads:/download|डाउनलोड/,documents:/document|डॉक्यूमेंट|दस्तावेज/,desktop:/desktop|डेस्कटॉप/,pictures:/picture|photo|फोटो|तस्वीर/,music:/music|गाने|संगीत/,videos:/video|वीडियो/};
const SITES={google:"https://www.google.com",youtube:"https://www.youtube.com",gmail:"https://mail.google.com",github:"https://github.com",maps:"https://maps.google.com",wikipedia:"https://www.wikipedia.org",whatsapp:"https://web.whatsapp.com"};
const SITEHI={गूगल:"google",यूट्यूब:"youtube",जीमेल:"gmail"};
const FILL=/\b(search|find|for|on|in|to|please|karo|kar|do|de|dijiye|khojo|dhundo|dhoondo|google|youtube|par|pe|me|mein|ka|ki|ke|about|the|a|open|play|and|what|is|who|are|explain|samjhao|batao|kya|hai|kaun|meaning|of|matlab)\b|सर्च|खोजो|ढूंढो|करो|पर|में|यूट्यूब|गूगल|का|की|के|क्या|है|कौन|समझाओ|बताओ|मतलब/g;
const strip=(t,re=FILL)=>t.replace(re,"").replace(/\s+/g," ").trim();
const HELP=`Examples — Web: "open youtube", "search google for cats", "youtube par lofi search karo", "open github.com". Tools: "5 plus 3", "time", "date", "note buy milk", "explain photosynthesis", "timer 25". Desktop (needs agent): "open notepad", "close chrome", "calculator kholo", "open downloads folder", "find file resume", "volume up", "lock", "shutdown". Say yes/no (haan/nahi) to confirm.`;

function calc(t){const e=t.replace(/plus|jod(o)?|जोड़ो?|\badd\b/g,"+").replace(/minus|ghata(o)?|घटाओ?|subtract/g,"-").replace(/times|multiplied by|गुणा|\binto\b|\bx\b|×/g,"*").replace(/divided by|bhag|भाग|÷/g,"/").replace(/percent|%/g,"/100").replace(/power|\^/g,"**").replace(/[^0-9+\-*/().\s]/g,"").trim();
 if(!/\d/.test(e)||!/[+\-*/]/.test(e)||!/^[\d+\-*/().\s]+$/.test(e))return null;try{const v=Function('"use strict";return ('+e+')')();return Number.isFinite(v)?[e,+v.toFixed(8)]:null}catch{return null}}

async function wiki(topic,hi){if(!topic)return reply("Tell me a topic to explain.");const L=hi?"hi":"en";
 try{const s=await(await fetch(`https://${L}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&srlimit=1&format=json&origin=*`)).json();const p=s.query.search[0];
 if(!p)return reply("I found nothing on Wikipedia for that.");
 const r=await(await fetch(`https://${L}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.title)}`)).json();
 reply(r.extract||"No summary available.");if(r.content_urls)link(r.content_urls.desktop.page,"Wikipedia: "+r.title)}catch{reply("Could not reach Wikipedia. Check your internet.")}}

function startTimer(min){clearInterval(tm);let left=min*60;const tick=()=>{$("#tdisp").textContent=String(Math.floor(left/60)).padStart(2,"0")+":"+String(left%60).padStart(2,"0");if(left--<=0){clearInterval(tm);reply("Study timer finished. Take a short break!")}};tick();tm=setInterval(tick,1000);say(`Timer started: ${min} min.`)}
$("#tstart").onclick=()=>startTimer(Math.max(1,+$("#tmin").value||25));
$("#tstop").onclick=()=>{clearInterval(tm);$("#tdisp").textContent="--:--";say("Timer stopped.")};

async function handle(raw){
 const t=raw.toLowerCase().replace(/^(hey |hi |ok )?(friday|फ्राइडे)[,. ]*/,"").trim();if(!t)return;
 const h=ls.get("hist",[]);h.unshift(raw);ls.set("hist",h.slice(0,40));renderHist();
 if(pending&&/^(yes|yeah|confirm|haan|han|ha|ji|हाँ|हां|जी)/.test(t))return doConfirm();
 if(pending&&/^(no|nahi|nahin|cancel|नहीं|ना)/.test(t))return doCancel();
 if(/^(help|madad|मदद)/.test(t))return reply(HELP);
 let m=t.match(/(?:note(?: down)?|नोट(?: करो)?|likh(?:o)?)[: ]+(.+)/);if(m){addNote(m[1]);return reply("Note saved.")}
 if(/\btimer\b|pomodoro|टाइमर/.test(t)){startTimer(+(t.match(/\d+/)||[25])[0]);return}
 if(/\b(time|samay|baje)\b|समय|बजे/.test(t)){const d=new Date();return reply(hasHi(raw)?"अभी समय है "+d.toLocaleTimeString("hi-IN"):"The time is "+d.toLocaleTimeString("en-IN"))}
 if(/\b(date|tarikh|today|din)\b|तारीख|आज/.test(t)&&!/search|youtube|open/.test(t)){const d=new Date();return reply(hasHi(raw)?"आज "+d.toLocaleDateString("hi-IN",{dateStyle:"full"}):"Today is "+d.toLocaleDateString("en-IN",{dateStyle:"full"}))}
 /* desktop */
 const app=Object.keys(APPS).find(k=>APPS[k].test(t)),dir=Object.keys(DIRS).find(k=>DIRS[k].test(t));
 if(app&&CLOSE.test(t))return desk("close_app",{app});
 if(app&&(OPEN.test(t)||t.split(" ").length<=2))return desk("open_app",{app});
 if(dir&&(OPEN.test(t)||/folder|फोल्डर/.test(t)))return desk("open_folder",{folder:dir});
 if(/volume|awaaz|आवाज़|आवाज|sound/.test(t)){const d=/mute|चुप/.test(t)?"mute":/down|kam|ghata|decrease|कम|घटा/.test(t)?"down":/up|badha|increase|zyada|बढ़ा|ज्यादा/.test(t)?"up":null;return d?desk("volume",{direction:d}):reply("Say volume up, down or mute.")}
 if(/cancel shutdown|shutdown cancel/.test(t))return desk("cancel_shutdown");
 if(/\block\b|लॉक/.test(t))return desk("lock");
 if(/shut ?down|band karo laptop|शटडाउन/.test(t))return desk("shutdown");
 if(/restart|रीस्टार्ट/.test(t))return desk("restart");
 m=t.match(/(?:find|search|dhundo|khojo|dhoondo)\s+(?:my\s+)?files?\s+(.+)/)||t.match(/(?:file|फाइल)\s+(?:dhundo|khojo|find)\s+(.+)/);if(m)return desk("search_files",{query:m[1].trim()});
 /* web */
 const yt=/youtube|यूट्यूब/.test(t),srch=/search|khojo|dhundo|dhoondo|play|सर्च|खोजो|ढूंढो|चला/.test(t);
 if(yt&&srch){const q=strip(t);return q?openUrl("https://www.youtube.com/results?search_query="+encodeURIComponent(q),"YouTube search"):openUrl(SITES.youtube,"YouTube")}
 const dm=t.match(/([a-z0-9-]+\.(?:com|in|org|net|edu|io|gov))/);
 if(OPEN.test(t)){if(dm)return openUrl("https://"+dm[1],dm[1]);const k=Object.keys(SITES).find(k=>t.includes(k))||Object.entries(SITEHI).find(([h])=>t.includes(h))?.[1];if(k)return openUrl(SITES[k],k)}
 const c=calc(t);if(c)return reply(`${c[0].replace(/\*\*/g,"^")} = ${c[1]}`);
 if(/explain|what is|who is|meaning|kya hai|kaun hai|matlab|samjhao|क्या है|कौन है|मतलब|समझाओ|बताओ/.test(t))return wiki(strip(t),hasHi(raw)||$("#lang").value==="hi-IN");
 if(srch){const q=strip(t);if(q)return openUrl("https://www.google.com/search?q="+encodeURIComponent(q),"Google search")}
 reply('Sorry, I did not understand. I am a rule-based assistant, not a general AI. Say "help" for supported commands.')}

/* ---------- UI wiring ---------- */
function renderHist(){const box=$("#hist");box.textContent="";ls.get("hist",[]).slice(0,15).forEach(x=>{const b=document.createElement("button");b.textContent=x;b.onclick=()=>{say(x,"me");handle(x)};box.append(b)})}
function addNote(x){const n=ls.get("notes",[]);n.unshift(x);ls.set("notes",n);renderNotes()}
function renderNotes(){const box=$("#notes");box.textContent="";ls.get("notes",[]).forEach((x,i)=>{const d=document.createElement("div");d.textContent=x+" ";const b=document.createElement("button");b.textContent="✕";b.onclick=()=>{const n=ls.get("notes",[]);n.splice(i,1);ls.set("notes",n);renderNotes()};d.append(b);box.append(d)})}
$("#noteadd").onclick=()=>{const v=$("#notetxt").value.trim();if(v){addNote(v);$("#notetxt").value=""}};
$("#histclr").onclick=()=>{ls.set("hist",[]);renderHist()};
$("#helpbtn").onclick=()=>reply(HELP);$("#stop").onclick=()=>speechSynthesis.cancel();
$("#explain").onclick=()=>{const v=$("#topic").value.trim();if(v){say("Explain "+v,"me");wiki(v,hasHi(v)||$("#lang").value==="hi-IN")}};
$("#f").onsubmit=e=>{e.preventDefault();const v=$("#txt").value.trim();if(v){say(v,"me");$("#txt").value="";handle(v)}};
$("#mic").onclick=()=>{
 if(!SR)return say("Speech recognition is not supported in this browser. Use Chrome or Edge, or type commands.","err");
 if(listening)return rec.stop();
 rec=new SR();rec.lang=$("#lang").value;rec.interimResults=false;
 rec.onstart=()=>{listening=true;$("#mic").classList.add("on");$("#state").textContent="Listening…"};
 rec.onresult=e=>{const t=e.results[0][0].transcript;say(t,"me");handle(t)};
 rec.onerror=e=>say("Mic error: "+e.error+(e.error==="not-allowed"?" (allow microphone access)":""),"err");
 rec.onend=()=>{listening=false;$("#mic").classList.remove("on");$("#state").textContent="Idle"};rec.start()};
$("#caps").textContent=`Mic: ${SR?"supported":"NOT supported"} · Voice output: ${window.speechSynthesis?"supported":"NOT supported"}`;
if(window.speechSynthesis)speechSynthesis.onvoiceschanged=()=>{};
renderHist();renderNotes();updAgent(false);
if(token)$("#ping").click();
say('FRIDAY online. Say or type "help" to see commands.');
