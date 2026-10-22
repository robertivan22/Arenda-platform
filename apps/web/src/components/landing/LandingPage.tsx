"use client";
import { useState, useEffect, useRef } from "react";
import * as L from "leaflet";
const landingMap = "/landing-map.png";
import "leaflet/dist/leaflet.css";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, Check, MapPin, FileText, BarChart3,
  Shield, Users, Calculator, Lock, FolderOpen,
  Calendar, Bell, Map, Banknote, Upload, TrendingUp,
  User, Table2, Search, ClipboardList, BellRing,
  ShieldCheck, UserCog,
} from "lucide-react";
import { PricingPage } from "./PricingPage";
import { BlogPage } from "./BlogPage";
import { ResursePage } from "./ResursePage";

// ─── Photos ────────────────────────────────────────────────────────────────────
const PH_HARVESTER = "https://images.unsplash.com/photo-1773412910302-19bdca7f3ef6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1200";
const PH_TRACTOR   = "https://images.unsplash.com/photo-1780304222519-0b93ba39e5e7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1400";
const PH_AERIAL    = "https://images.unsplash.com/photo-1516822277566-bb38424a2b77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1200";
const PH_CTA       = "https://images.unsplash.com/photo-1786691663102-abc2ff5e9b5a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1400";

// ─── Tokens ────────────────────────────────────────────────────────────────────
const G    = "#1B5E20";
const G2   = "#2E7D32";
const GBG  = "#EEF7EE";
const GBD  = "rgba(27,94,32,0.20)";
const AM   = "#D97706";
const AMD  = "#B45309";
const AMBG = "#FEF3C7";
const AMBD = "rgba(217,119,6,0.22)";
const BG   = "#FAFAF5";
const BG2  = "#F5EDD8";
const BG3  = "#EDE5CC";
const W    = "#FFFFFF";
const TX   = "#1A1F10";
const TX2  = "#485240";
const TX3  = "#8A9080";
const BD   = "rgba(26,31,16,0.09)";
const BD2  = "rgba(26,31,16,0.16)";
const SH   = "0 1px 3px rgba(0,0,0,0.06),0 4px 12px rgba(0,0,0,0.05)";
const SH2  = "0 4px 20px rgba(0,0,0,0.09),0 1px 4px rgba(0,0,0,0.04)";
const SH3  = "0 8px 36px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.06)";
const HEAD: React.CSSProperties = { fontFamily:"'Manrope',sans-serif" };
const BODY: React.CSSProperties = { fontFamily:"'Inter',sans-serif" };

// ─── Icon Box helper ──────────────────────────────────────────────────────────
function IconBox({ icon: Icon, bg, color, size = 44 }: {
  icon: LucideIcon; bg: string; color: string; size?: number;
}) {
  return (
    <div style={{
      width:size, height:size, borderRadius:size*0.27,
      background:bg, display:"flex", alignItems:"center", justifyContent:"center",
      marginBottom:14, flexShrink:0,
    }}>
      <Icon size={size*0.46} color={color} strokeWidth={1.9}/>
    </div>
  );
}

// ─── Parcel data — REAL lat/lng coords in Bărăgan Plain (Ialomița) ───────────
// Agricultural fields NE of Slobozia, flat terrain, ESRI satellite shows crops
type LatLng = [number, number];
const PARCELS: {
  id:number; label:string; price:string; tarlaua:string; parcela:string;
  positions: LatLng[]; center: LatLng;
}[] = [
  {
    id:0, label:"22.4 ha", price:"24.850", tarlaua:"12", parcela:"43",
    positions:[
      [44.5645,27.3182],[44.5648,27.3248],[44.5602,27.3252],[44.5598,27.3186],
    ],
    center:[44.5623,27.3217],
  },
  {
    id:1, label:"16.7 ha", price:"14.925", tarlaua:"13", parcela:"44",
    positions:[
      [44.5650,27.3252],[44.5652,27.3304],[44.5610,27.3308],[44.5606,27.3256],
    ],
    center:[44.5630,27.3280],
  },
  {
    id:2, label:"31.2 ha", price:"28.080", tarlaua:"14", parcela:"45",
    positions:[
      [44.5596,27.3184],[44.5600,27.3254],[44.5544,27.3260],[44.5540,27.3188],
    ],
    center:[44.5570,27.3222],
  },
  {
    id:3, label:"42.8 ha", price:"38.160", tarlaua:"15", parcela:"46",
    positions:[
      [44.5604,27.3256],[44.5608,27.3312],[44.5540,27.3318],[44.5537,27.3262],
    ],
    center:[44.5573,27.3287],
  },
];

import { Leaf, Play, ChevronDown, Home, Map as MapIcon, Menu as MenuIcon, LayoutDashboard, Sprout, ScrollText, Wheat, FlaskConical, Boxes, ChevronRight, Tractor } from "lucide-react";

const PH_HERO = "https://images.unsplash.com/photo-1777063011921-a13c80721c2c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=2000";

const HG  = "#0F6B3F";
const HG2 = "#2E7F4F";
const HGD = "#0B5A34";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior:"smooth", block:"start" });
}

function Logo({ size = 28, text = 26 }: { size?: number; text?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Leaf size={size} color={HG} fill={HG} strokeWidth={1.5} style={{ transform:"rotate(-8deg)" }}/>
      <span style={{ ...HEAD, fontSize:text, fontWeight:800, letterSpacing:"-.03em", color:TX }}>
        Arenda<span style={{ color:HG }}>Pro</span>
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════════════════════════════════════
function Nav({ onLogin, onPricing, onBlog, onResurse }: {
  onLogin:()=>void; onPricing:()=>void; onBlog:()=>void; onResurse:()=>void;
}) {
  const [open, setOpen] = useState(false);
  const linkCls = "px-4 py-2 text-[15px] font-medium rounded-lg transition-colors hover:text-[#0F6B3F]";
  return (
    <header className="fixed top-0 inset-x-0 z-[300] h-[76px] backdrop-blur-xl border-b" style={{ background:"rgba(255,255,255,0.88)", borderColor:BD, ...BODY }}>
      <div className="max-w-[1440px] mx-auto px-6 lg:px-[76px] h-full flex items-center">
        <div className="shrink-0 cursor-pointer" onClick={()=>window.scrollTo({ top:0, behavior:"smooth" })}><Logo/></div>
        <nav className="hidden lg:flex flex-1 justify-center gap-3 xl:gap-5" style={{ color:TX }}>
          <button className={linkCls} onClick={()=>scrollToId("platforma")}>Platformă</button>
          <button className={linkCls} onClick={()=>scrollToId("functionalitati")}>Funcționalități</button>
          <button className={linkCls} onClick={onPricing}>Prețuri</button>
          <div className="relative" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
            <button className={`${linkCls} flex items-center gap-1`} onClick={onResurse}>
              Resurse <ChevronDown size={15} className={`transition-transform ${open?"rotate-180":""}`}/>
            </button>
            {open && (
              <div className="absolute top-full left-0 pt-1">
                <div className="w-44 rounded-xl bg-white border p-1.5" style={{ borderColor:BD, boxShadow:SH3 }}>
                  {[["Centru de resurse",onResurse],["Blog",onBlog]].map(([l,fn])=>(
                    <button key={l as string} onClick={fn as ()=>void} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[#EEF7EE] hover:text-[#0F6B3F]">{l as string}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className={linkCls} onClick={()=>scrollToId("contact")}>Contact</button>
        </nav>
        <div className="ml-auto lg:ml-0 flex items-center gap-3 xl:gap-6">
          <button onClick={onLogin} className="hidden sm:block text-[15px] font-medium hover:text-[#0F6B3F] transition-colors" style={{ color:TX }}>Autentifică-te</button>
          <button onClick={onLogin} className="flex items-center gap-2 px-5 sm:px-6 h-[46px] rounded-lg text-[15px] font-semibold text-white transition-colors hover:brightness-110"
            style={{ background:HG, boxShadow:"0 4px 14px rgba(15,107,63,0.30)", ...HEAD }}>
            Începe gratuit <ArrowRight size={16}/>
          </button>
        </div>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO MOCKUPS
// ═══════════════════════════════════════════════════════════════════════════════
const CROPS = [
  { n:"Grâu",           p:42, c:"#0F6B3F" },
  { n:"Porumb",         p:28, c:"#E8B63A" },
  { n:"Floarea-soarelui",p:15, c:"#2F5FB8" },
  { n:"Rapiță",         p:8,  c:"#7C8B3A" },
  { n:"Soia",           p:5,  c:"#8A8F85" },
  { n:"Altele",         p:2,  c:"#B9BDB3" },
];

function Donut() {
  const r = 38, C = 2*Math.PI*r;
  let acc = 0;
  return (
    <svg viewBox="0 0 100 100" className="w-[92px] h-[92px] -rotate-90 shrink-0">
      {CROPS.map(c=>{
        const len = C*c.p/100;
        const el = <circle key={c.n} cx="50" cy="50" r={r} fill="none" stroke={c.c} strokeWidth="13" strokeDasharray={`${len} ${C-len}`} strokeDashoffset={-acc}/>;
        acc += len; return el;
      })}
    </svg>
  );
}

function ParcelMap() {
  return <img src={landingMap} alt="Hartă satelit cu parcelele fermei" className="w-full h-full block object-cover"/>;
}

function TabletMockup() {
  const nav = [
    { l:"Dashboard", i:LayoutDashboard, on:true },
    { l:"Terenuri", i:MapIcon }, { l:"Contracte", i:ScrollText }, { l:"Culturi", i:Sprout },
    { l:"Plan de fertilizare", i:FlaskConical }, { l:"Inputuri și stocuri", i:Boxes },
  ];
  const kpis = [
    { l:"Suprafață totală", v:"324,50 ha", d:"+12% față de anul trecut", c:HG, i:MapIcon, ok:true },
    { l:"Contracte active", v:"48", d:"2 expiră în 3 luni", c:"#DC4A3A", i:ScrollText, ok:false },
    { l:"Plăți arendă", v:"1.245.000 RON", d:"+8% față de anul trecut", c:HG, i:Wheat, ok:true },
    { l:"Culturi", v:"6", d:"în campanie", c:"#E8A21A", i:Sprout, ok:null },
  ];
  const acts = [
    ["Ai adăugat o aplicare de fertilizant","P12 - 12,40 ha","Acum 2 ore"],
    ["Plată arendă înregistrată","Contract #234","Ieri, 14:32"],
    ["A fost generat registrul fitosanitar","Anul 2026","Ieri, 10:15"],
  ];
  return (
    <div className="rounded-[26px] p-[7px]" style={{ background:"#1c1f1d", boxShadow:"0 30px 70px rgba(10,30,15,0.40), 0 0 0 1.5px #3a3f3b" }}>
      <div className="rounded-[20px] bg-[#F7F8F6] overflow-hidden text-[#17201a]" style={{ ...BODY, width:716, height:516 }}>
        <div className="h-[48px] bg-white flex items-center px-5 border-b" style={{ borderColor:BD }}>
          <Logo size={15} text={14}/>
          <div className="ml-auto flex items-center gap-3">
            <Bell size={13} color={TX2}/>
            <div className="w-5 h-5 rounded-full bg-[#2b3a2f]"/>
            <div className="leading-tight"><div className="text-[8px] font-semibold">Ferma Popescu SRL</div><div className="text-[7px] text-[#8A9080]">324,50 ha</div></div>
          </div>
        </div>
        <div className="flex" style={{ height:468 }}>
          <div className="w-[118px] bg-white border-r p-2.5 pt-3 space-y-1" style={{ borderColor:BD }}>
            {nav.map(n=>(
              <div key={n.l} className="flex items-center gap-2 px-2 py-[7px] rounded-md text-[8.5px] font-medium" style={n.on?{ background:"#E6F1EA", color:HG, fontWeight:700 }:{ color:TX2 }}>
                <n.i size={10}/>{n.l}
              </div>
            ))}
          </div>
          <div className="flex-1 p-4 min-w-0">
            <div className="flex items-start justify-between">
              <div><div className="text-[13px] font-bold">Bună dimineața, Andrei!</div><div className="text-[8px] text-[#8A9080] mt-0.5">Iată situația fermei tale astăzi.</div></div>
              <div className="flex gap-1.5 text-[7.5px]"><span className="px-2 py-1 rounded border bg-white" style={{ borderColor:BD }}>An agricol 2026 ⌄</span><span className="px-2 py-1 rounded bg-[#EEF0EC] font-semibold">2026</span></div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {kpis.map(k=>(
                <div key={k.l} className="bg-white rounded-lg border p-2" style={{ borderColor:BD }}>
                  <div className="flex items-start gap-1.5">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background:`${k.c}1A` }}><k.i size={10} color={k.c}/></div>
                    <div className="min-w-0"><div className="text-[6.5px] text-[#8A9080] truncate">{k.l}</div><div className="text-[10.5px] font-bold whitespace-nowrap">{k.v}</div></div>
                  </div>
                  <div className="text-[6px] mt-1.5" style={{ color:k.ok===true?HG:k.ok===false?"#DC4A3A":"#8A9080" }}>{k.d}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-2.5 mt-2.5" style={{ gridTemplateColumns:"1.15fr 1fr" }}>
              <div className="bg-white rounded-lg border p-2.5" style={{ borderColor:BD }}>
                <div className="flex justify-between items-center mb-2"><span className="text-[8.5px] font-bold">Parcele</span>
                  <span className="flex text-[7px] border rounded overflow-hidden" style={{ borderColor:BD }}><span className="px-2 py-0.5 bg-white font-semibold">Hartă</span><span className="px-2 py-0.5 bg-[#F1F2EF] text-[#8A9080]">Listă</span></span></div>
                <div className="relative rounded-md overflow-hidden" style={{ height:262 }}>
                  <ParcelMap/>
                  <div className="absolute left-[56%] top-[44%] bg-white rounded-md px-2 py-1 text-[7px] leading-snug shadow-lg"><b>P12 - 12,40 ha</b><br/>Grâu de toamnă</div>
                </div>
              </div>
              <div className="space-y-2.5 min-w-0">
                <div className="bg-white rounded-lg border p-2.5" style={{ borderColor:BD }}>
                  <div className="flex justify-between text-[8.5px] font-bold mb-1"><span>Culturile din fermă</span><span className="text-[7px] font-medium" style={{ color:HG }}>Vezi detalii →</span></div>
                  <div className="flex items-center gap-2.5">
                    <div className="relative"><Donut/><div className="absolute inset-0 flex flex-col items-center justify-center leading-tight"><b className="text-[9px]">324,50 ha</b><span className="text-[6px] text-[#8A9080]">Total</span></div></div>
                    <div className="flex-1 space-y-[3px]">
                      {CROPS.map(c=>(<div key={c.n} className="flex items-center gap-1 text-[6.5px]"><i className="w-1.5 h-1.5 rounded-[2px] inline-block" style={{ background:c.c }}/><span className="flex-1 truncate">{c.n}</span><span className="text-[#6b7468]">{c.p}%</span></div>))}
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg border p-2.5" style={{ borderColor:BD }}>
                  <div className="text-[8.5px] font-bold mb-1.5">Activități recente</div>
                  {acts.map(a=>(
                    <div key={a[0]} className="flex items-center gap-1.5 py-[5px] border-t first:border-0" style={{ borderColor:BD }}>
                      <div className="w-4 h-4 rounded bg-[#E6F1EA] flex items-center justify-center shrink-0"><Leaf size={8} color={HG}/></div>
                      <div className="flex-1 min-w-0"><div className="text-[6.5px] font-semibold truncate">{a[0]}</div><div className="text-[5.5px] text-[#8A9080]">{a[1]}</div></div>
                      <span className="text-[5.5px] text-[#8A9080] shrink-0">{a[2]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneMockup() {
  const rows = [
    { l:"Parcele", v:"24", i:MapIcon, c:"#2F5FB8" },
    { l:"Contracte active", v:"48", i:ScrollText, c:HG },
    { l:"Plăți arendă", v:"1.245.000 RON", i:Wheat, c:"#DC4A3A" },
    { l:"Culturi", v:"6", i:Sprout, c:"#E8A21A" },
  ];
  return (
    <div className="rounded-[34px] p-[6px]" style={{ background:"#15171a", boxShadow:"0 24px 50px rgba(0,0,0,0.38), 0 0 0 1.5px #3a3f3b" }}>
      <div className="rounded-[28px] bg-white overflow-hidden relative" style={{ ...BODY, width:152, height:340 }}>
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-3.5 rounded-full bg-[#15171a]"/>
        <div className="flex justify-between px-4 pt-2 text-[6px] font-semibold"><span>12:30</span><span>●●●</span></div>
        <div className="flex items-center justify-between px-3 mt-3"><Logo size={11} text={11}/><Search size={10} color={TX2}/></div>
        <div className="mx-3 mt-2.5 bg-[#F3F5F1] rounded-md px-2 py-1.5 text-[6.5px] flex justify-between items-center"><span><b className="block text-[7px]">Ferma Popescu SRL</b><span className="text-[#8A9080]">324,50 ha</span></span><ChevronRight size={8}/></div>
        <div className="px-3 mt-2 space-y-1.5">
          {rows.map(r=>(
            <div key={r.l} className="flex items-center gap-2 rounded-md border px-2 py-2" style={{ borderColor:BD }}>
              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background:`${r.c}1A` }}><r.i size={10} color={r.c}/></div>
              <div className="flex-1"><div className="text-[6px] text-[#8A9080]">{r.l}</div><div className="text-[8px] font-bold">{r.v}</div></div>
              <ChevronRight size={8} color="#aaa"/>
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 inset-x-0 h-[46px] bg-white border-t flex items-center justify-around px-2 text-[5px] text-[#8A9080]" style={{ borderColor:BD }}>
          <span className="flex flex-col items-center gap-0.5" style={{ color:HG }}><Home size={9}/>Acasă</span>
          <span className="flex flex-col items-center gap-0.5"><MapIcon size={9}/>Hartă</span>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm -mt-3" style={{ background:HG }}>+</span>
          <span className="flex flex-col items-center gap-0.5"><Bell size={9}/>Notificări</span>
          <span className="flex flex-col items-center gap-0.5"><MenuIcon size={9}/>Meniu</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO
// ═══════════════════════════════════════════════════════════════════════════════
function HeroSection({ onLogin }: { onLogin:()=>void }) {
  return (
    <section className="relative overflow-hidden pt-[76px]" style={{ background:"#EFEBDD", ...BODY }}>
      <img src={PH_HERO} alt="Câmpuri agricole verzi la apus, văzute din dronă" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition:"center 70%" }}/>
      <div className="absolute inset-0" style={{ background:"linear-gradient(90deg,rgba(250,250,245,0.95) 0%,rgba(250,250,245,0.82) 34%,rgba(250,250,245,0.22) 60%,rgba(250,250,245,0) 100%)" }}/>
      <div className="absolute inset-x-0 top-0 h-1/2" style={{ background:"linear-gradient(180deg,rgba(255,255,255,0.55),transparent)" }}/>

      <div className="relative max-w-[1440px] mx-auto px-6 lg:px-[76px] pt-10 pb-16 lg:pb-20 min-h-[640px] lg:min-h-[690px]">
        <div className="max-w-[600px] relative z-10">
          <div className="inline-flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full text-[14px] font-medium" style={{ background:"rgba(226,240,230,0.9)", color:HGD }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background:"#CFE6D7" }}><Leaf size={12} color={HG} fill={HG}/></span>
            Platforma #1 pentru fermierii din România
          </div>
          <h1 className="mt-7 text-[44px] sm:text-[56px] lg:text-[62px]" style={{ ...HEAD, fontWeight:800, lineHeight:1.06, letterSpacing:"-.035em", color:"#111611" }}>
            Toată ferma.<br/>Într-un singur loc.<br/>
            <span style={{ color:HG2 }}>Mai mult control.<br/>Mai multă performanță.</span>
          </h1>
          <p className="mt-7 text-[17px] lg:text-[18px] leading-[1.6] max-w-[560px]" style={{ color:"#2c352d" }}>
            Gestionează terenurile, contractele, culturile, inputurile și obligațiile fiscale într-o platformă simplă, construită pentru agricultura din România.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <button onClick={onLogin} className="h-[64px] px-9 rounded-lg text-[18px] font-semibold text-white flex items-center gap-3 transition hover:brightness-110"
              style={{ background:HG, boxShadow:"0 8px 22px rgba(15,107,63,0.32)", ...HEAD }}>Începe gratuit <ArrowRight size={20}/></button>
            <button onClick={()=>scrollToId("functionalitati")} className="h-[64px] px-8 rounded-lg text-[18px] font-semibold flex items-center gap-3 border-[1.5px] transition hover:bg-white"
              style={{ borderColor:HG2, color:HGD, background:"rgba(255,255,255,0.55)", ...HEAD }}>
              <span className="w-7 h-7 rounded-full border-[1.5px] flex items-center justify-center" style={{ borderColor:HGD }}><Play size={11} fill={HGD}/></span>
              Vezi cum funcționează
            </button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-y-2 text-[15px]" style={{ color:"#2c352d" }}>
            {["Inregistrare imediata","Configurare rapidă","Date securizate"].map((t,i)=>(
              <span key={t} className={`flex items-center gap-2 pr-5 ${i<2?"mr-5 border-r border-black/15":""}`}><Check size={17} color={HG} strokeWidth={3}/>{t}</span>
            ))}
          </div>
        </div>

        <div className="hidden lg:block absolute top-[48px] right-[76px] z-10 text-right pointer-events-none">
          <div style={{ fontFamily:"'Caveat',cursive", fontSize:38, lineHeight:1, color:"#2a3a30", transform:"rotate(-8deg)", textShadow:"0 1px 8px rgba(255,255,255,.6)" }}>
            Agricultura<br/><span className="inline-block mt-1">un viitor mai bun</span>
          </div>
          <svg width="170" height="16" viewBox="0 0 170 16" className="ml-auto mt-1" style={{ transform:"rotate(-8deg)" }}><path d="M2 12 C 50 6, 110 4, 168 3" stroke={HG2} strokeWidth="2.5" fill="none" strokeLinecap="round"/></svg>
        </div>

        <div className="hidden xl:block absolute right-[60px] top-[148px] z-10">
          <div className="relative" style={{ width:716, height:560 }}>
            <div className="absolute right-0 top-0"><TabletMockup/></div>
            <div className="absolute -left-[24px] top-[196px]"><PhoneMockup/></div>
          </div>
        </div>
        <div className="hidden lg:block xl:hidden absolute right-4 top-[148px] z-10 origin-top-right scale-[.72]">
          <div className="relative" style={{ width:716, height:560 }}>
            <div className="absolute right-0 top-0"><TabletMockup/></div>
            <div className="absolute -left-[24px] top-[196px]"><PhoneMockup/></div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS + TRUST
// ═══════════════════════════════════════════════════════════════════════════════
function StatsStrip() {
  const s = [
    { v:"2.400+", l:"Fermieri activi", i:Users },
    { v:"156.320 ha", l:"Suprafață gestionată", i:TrendingUp },
    { v:"24,8 mil. RON", l:"Plăți procesate anual", i:BarChart3 },
    { v:"98,7%", l:"Contracte la zi", i:Check, ring:true },
  ];
  return (
    <>
      <div style={{ background:"#EFEEE6", ...BODY }}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-[76px] py-7 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {s.map(st=>(
            <div key={st.l} className="flex items-center gap-4 lg:justify-center">
              {st.ring
                ? <span className="w-[46px] h-[46px] rounded-full flex items-center justify-center shrink-0" style={{ background:HG }}><Check size={26} color="#fff" strokeWidth={3.5}/></span>
                : <st.i size={42} color={HG} strokeWidth={2.2} className="shrink-0"/>}
              <div><div className="text-[24px] font-bold leading-tight" style={{ ...HEAD, color:"#111611" }}>{st.v}</div><div className="text-[15px]" style={{ color:TX2 }}>{st.l}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white" style={BODY}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-[76px] py-9">
          <div className="text-center text-[13px] font-medium tracking-[.2em] uppercase" style={{ color:TX3 }}>Au încredere în noi fermieri din toată țara</div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROBLEM SECTION  — Lucide icons with colored backgrounds
// ═══════════════════════════════════════════════════════════════════════════════
const PROBLEMS: { icon:LucideIcon; bg:string; color:string; t:string; d:string }[] = [
  { icon:FolderOpen, bg:"#FEF3C7", color:"#B45309", t:"Contracte în dosare diferite",   d:"Fișierele sunt împrăștiate pe calculatoare și foldere fizice, greu de găsit rapid." },
  { icon:User,       bg:"#EDE9FE", color:"#6D28D9", t:"Proprietari greu de verificat",  d:"Informațiile despre arendatori nu sunt centralizate și se pierd în timp." },
  { icon:Calendar,   bg:"#DBEAFE", color:"#1D4ED8", t:"Termene urmărite manual",         d:"Scadențele contractelor se notează în agende sau calcule Excel care pot fi ratate." },
  { icon:FileText,   bg:"#F3F4F6", color:"#4B5563", t:"Documente indisponibile",          d:"Documentele nu sunt disponibile când ai nevoie de ele sau lipsesc complet." },
  { icon:Table2,     bg:"#D1FAE5", color:"#065F46", t:"Fișiere Excel multiple",           d:"Mai multe persoane lucrează cu versiuni diferite ale acelorași date." },
  { icon:Search,     bg:"#CCFBF1", color:"#0F766E", t:"Lipsă imagine de ansamblu",        d:"Nu există o vedere clară și actualizată a situației arendei fermei." },
];

function ProblemSection() {
  return (
    <section style={{ position:"relative", overflow:"hidden", background:"linear-gradient(180deg,#F6FAF6 0%,#FFFFFF 38%,#FFFFFF 100%)", padding:"88px 0 72px", ...BODY }}>
      <div className="hidden lg:flex" style={{ position:"absolute", left:"4%", top:56, width:190, height:150, borderRadius:"58% 42% 55% 45%", background:"#E6F2E9", transform:"rotate(-6deg)", padding:24, flexDirection:"column", justifyContent:"center", gap:6 }}>
        <Leaf size={22} color={G}/>
        <span style={{ fontFamily:"'Caveat','Segoe Script',cursive", fontSize:22, lineHeight:1.1, color:"#2F5D3F" }}>Mai simplu în fiecare zi.</span>
        <span style={{ width:110, height:2, background:G, borderRadius:2 }}/>
      </div>
      <div className="hidden lg:flex" style={{ position:"absolute", right:"4%", top:64, alignItems:"center", gap:10, padding:"14px 22px", borderRadius:28, background:"#E6F2E9", transform:"rotate(-3deg)" }}>
        <BarChart3 size={22} color={G}/>
        <span style={{ fontSize:13, lineHeight:1.35, color:"#2F5D3F", fontWeight:500 }}>Date clare.<br/>Decizii mai bune.</span>
      </div>
      <div style={{ maxWidth:1000, margin:"0 auto", padding:"0 24px", position:"relative" }}>
        <div style={{ textAlign:"center", marginBottom:56 }}>
          <p style={{ display:"inline-flex", alignItems:"center", gap:14, fontSize:13, fontWeight:700, color:G, letterSpacing:".16em", textTransform:"uppercase", marginBottom:14 }}>
            <span style={{ width:36, height:1, background:G }}/>DE CE ESTE NEVOIE<span style={{ width:36, height:1, background:G }}/>
          </p>
          <h2 style={{ ...HEAD, fontSize:"clamp(30px,4.4vw,46px)", fontWeight:900, color:"#0B3D2A", letterSpacing:"-.04em", lineHeight:1.1, marginBottom:16 }}>
            Mai puțin timp pierdut<br/>cu administrarea.<br/><span style={{ color:G }}>Mai mult control asupra fermei.</span>
          </h2>
          <p style={{ fontSize:16, color:TX2, maxWidth:520, margin:"0 auto", lineHeight:1.72 }}>
            ArendaPro centralizează informațiile importante și le face ușor de găsit, verificat și actualizat.
          </p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:16 }}>
          {PROBLEMS.map((p,i)=>{
                        return (
              <div key={i} style={{ position:"relative", overflow:"hidden", background:W, border:"1px solid rgba(15,60,40,.06)", borderRadius:18, boxShadow:"0 6px 22px rgba(15,60,40,.06)", transition:"all .22s", cursor:"default" }}
                onMouseEnter={e=>{ const el=e.currentTarget as HTMLDivElement; el.style.boxShadow="0 14px 34px rgba(15,60,40,.12)"; el.style.transform="translateY(-3px)"; }}
                onMouseLeave={e=>{ const el=e.currentTarget as HTMLDivElement; el.style.boxShadow="0 6px 22px rgba(15,60,40,.06)"; el.style.transform="translateY(0)"; }}
              >
                <div style={{ position:"relative", padding:"18px 20px", display:"flex", flexDirection:"column", height:"100%" }}>
                  <IconBox icon={p.icon} bg={p.bg} color={p.color}/>
                  <h3 style={{ ...HEAD, fontSize:17, fontWeight:800, color:"#0B3D2A", letterSpacing:"-.02em", margin:"2px 0 6px" }}>{p.t}</h3>
                  <p style={{ fontSize:13, color:TX2, lineHeight:1.6, margin:0 }}>{p.d}</p>
                  <span style={{ marginTop:"auto", paddingTop:12 }}>
                    <span style={{ width:30, height:30, borderRadius:"50%", background:p.bg, color:p.color, display:"inline-flex", alignItems:"center", justifyContent:"center" }}><ArrowRight size={16}/></span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign:"center", marginTop:56 }}>
          <Leaf size={18} color={G}/>
          <p style={{ fontSize:12, letterSpacing:".2em", textTransform:"uppercase", color:TX2, margin:"8px 0 0", lineHeight:1.9 }}>
            O fermă mai organizată.<br/><strong style={{ color:G }}>Un viitor mai sigur.</strong>
          </p>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HARVESTER STRIP — full-width photo (combine + tractor)
// ═══════════════════════════════════════════════════════════════════════════════
function HarvesterStrip({ onLogin }: { onLogin:()=>void }) {
  return (
    <section style={{ position:"relative", overflow:"hidden", minHeight:380, display:"flex", alignItems:"center" }}>
      <img src={PH_TRACTOR} alt="Combină și tractor la recoltatul grâului" style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 60%" }}/>
      <div style={{ position:"absolute",inset:0,background:"linear-gradient(100deg,rgba(8,22,4,0.84) 0%,rgba(8,22,4,0.65) 45%,rgba(8,22,4,0.24) 100%)" }}/>
      <div style={{ position:"relative",zIndex:1,maxWidth:1360,margin:"0 auto",padding:"64px 40px",display:"grid",gridTemplateColumns:"1fr 1fr",alignItems:"center",gap:48,width:"100%" }}>
        <div>
          <p style={{ ...BODY,fontSize:13,fontWeight:700,color:"#d4b060",letterSpacing:".12em",textTransform:"uppercase",marginBottom:14 }}>DE LA CÂMP LA PLATFORMĂ</p>
          <h2 style={{ ...HEAD,fontSize:40,fontWeight:900,color:W,letterSpacing:"-.04em",lineHeight:1.12,marginBottom:16 }}>
            Mașinile lucrează câmpul.<br/><span style={{ color:"#e8c060" }}>Arenda Pro lucrează datele.</span>
          </h2>
          <p style={{ ...BODY,fontSize:16,color:"rgba(255,255,255,0.78)",lineHeight:1.72,maxWidth:440,marginBottom:28 }}>
            Cât timp combinele și tractoarele strâng recolta, platforma ține evidența contractelor, proprietarilor și plăților — fără efort suplimentar.
          </p>
          <button onClick={onLogin} style={{
            padding:"12px 26px",border:"none",borderRadius:10,background:AM,
            cursor:"pointer",fontSize:14,fontWeight:700,color:W,
            boxShadow:`0 4px 18px rgba(217,119,6,0.42)`,
            display:"inline-flex",alignItems:"center",gap:7,transition:"all .2s",...HEAD,
          }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=AMD;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background=AM;}}
          >Descoperă cum funcționează <ArrowRight size={14}/></button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          {[
            { Icon:Map,       t:"Parcele pe hartă interactivă",         d:"Vizualizează și administrează suprafețele agricole." },
            { Icon:ClipboardList, t:"Contracte organizate digital",     d:"Toate documentele accesibile cu un click." },
            { Icon:Bell,      t:"Plăți și scadențe urmărite automat",   d:"Nicio dată importantă nu mai trece neobservată." },
          ].map(({ Icon, t, d },i)=>(
            <div key={i} style={{ display:"flex",gap:14,alignItems:"flex-start",background:"rgba(255,255,255,0.09)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.14)",borderRadius:14,padding:"16px 18px" }}>
              <div style={{ width:38,height:38,borderRadius:10,background:"rgba(255,255,255,0.14)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <Icon size={18} color="white" strokeWidth={1.8}/>
              </div>
              <div>
                <div style={{ ...HEAD,fontSize:14,fontWeight:700,color:W,marginBottom:4 }}>{t}</div>
                <div style={{ ...BODY,fontSize:12,color:"rgba(255,255,255,0.65)" }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES — Lucide icons, 8 cards
// ═══════════════════════════════════════════════════════════════════════════════
const FEATURES: { icon:LucideIcon; bg:string; wash:string; color:string; t:string; d:string }[] = [
  { icon:Users,        bg:"#D5EFDD", wash:"#F0F9F2", color:"#1B6B3A", t:"Administrarea proprietarilor", d:"Registru complet cu date de contact, documente și istoricul relației." },
  { icon:ClipboardList,bg:"#FBE5BF", wash:"#FEF7EA", color:"#B45309", t:"Contracte de arendă",          d:"Organizezi, urmărești și reînnoiești contractele cu ușurință." },
  { icon:Map,          bg:"#D5EFDD", wash:"#F0F9F2", color:"#1B6B3A", t:"Parcele și suprafețe",          d:"Vizualizezi și gestionezi limitele și suprafețele tuturor terenurilor." },
  { icon:Banknote,     bg:"#D8E7FB", wash:"#F0F6FE", color:"#1D4ED8", t:"Plăți și obligații",            d:"Urmărești plățile efectuate, restante și scadențele viitoare." },
  { icon:FolderOpen,   bg:"#E4DBFA", wash:"#F6F2FE", color:"#6D28D9", t:"Documente centralizate",         d:"Toate documentele fermei într-un singur loc, ușor de găsit." },
  { icon:Bell,         bg:"#FBD9D3", wash:"#FEF3F1", color:"#C2321F", t:"Termene și notificări",          d:"Alerte automate pentru scadențe, reînnoiri și plăți apropiate." },
  { icon:BarChart3,    bg:"#D5EFDD", wash:"#F0F9F2", color:"#1B6B3A", t:"Rapoarte și situații",           d:"Generezi rapid situații centralizate pentru orice perioadă." },
  { icon:UserCog,      bg:"#FBE5BF", wash:"#FEF7EA", color:"#B45309", t:"Colaborare pe roluri",           d:"Administrator, contabil sau colaborator — fiecare vede ce are nevoie." },
];

function FeaturesSection({ onLogin }: { onLogin:()=>void }) {
  const script: React.CSSProperties = { fontFamily:"'Caveat','Segoe Script',cursive", color:"#2F5D3F" };
  return (
    <section style={{ position:"relative", overflow:"hidden", background:"linear-gradient(180deg,#F5F8F1 0%,#FBFCF8 55%,#F1F6EA 100%)", padding:"72px 0 0", ...BODY }}>
      <div className="hidden xl:block" style={{ position:"absolute", left:"5%", top:56, width:200, transform:"rotate(-6deg)" }}>
        <Leaf size={44} color={G} fill={G} strokeWidth={1.2}/>
        <div style={{ ...script, fontSize:22, lineHeight:1.1, marginTop:6 }}>Gestionăm prezentul pentru un viitor mai bun.</div>
      </div>
      <div className="hidden xl:block" style={{ position:"absolute", right:"5%", top:70, transform:"rotate(-5deg)", textAlign:"left" }}>
        <div style={{ ...script, fontSize:26, lineHeight:1.1 }}>Mai mult decât terenuri.<br/>Rezultate.</div>
        <svg width="150" height="12" viewBox="0 0 150 12" style={{ display:"block", marginTop:4 }}><path d="M2 9 C 40 3, 100 3, 148 4" stroke={G} strokeWidth="2.2" fill="none" strokeLinecap="round"/></svg>
      </div>

      <div style={{ maxWidth:1180, margin:"0 auto", padding:"0 24px", position:"relative" }}>
        <div style={{ textAlign:"center", marginBottom:44 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:14, marginBottom:14 }}>
            <span style={{ width:40, height:1, background:G, opacity:.6 }}/>
            <span style={{ fontSize:13, fontWeight:700, color:G, letterSpacing:".2em", textTransform:"uppercase" }}>Funcționalități</span>
            <span style={{ width:40, height:1, background:G, opacity:.6 }}/>
          </div>
          <h2 style={{ ...HEAD, fontSize:"clamp(32px,4.6vw,50px)", fontWeight:800, color:"#0E1F14", letterSpacing:"-.04em", lineHeight:1.1, margin:"0 0 16px" }}>
            Tot ce ai nevoie pentru<br/><span style={{ color:G }}>administrarea arendei</span>
          </h2>
          <p style={{ fontSize:16, color:TX2, maxWidth:560, margin:"0 auto", lineHeight:1.65 }}>
            Simplu, eficient și totul într-un singur loc. Descoperă cum ArendaPro te ajută să gestionezi ferma modern, fără bătăi de cap.
          </p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:18, marginBottom:40 }}>
          {FEATURES.map((f,i)=>{
            const Icon = f.icon;
            return (
              <div key={i} style={{ position:"relative", overflow:"hidden", display:"flex", flexDirection:"column", background:`linear-gradient(160deg,#fff 30%,${f.wash})`, border:"1px solid rgba(15,60,30,.07)", borderRadius:18, padding:"24px 24px 20px", boxShadow:"0 6px 20px rgba(30,60,30,.06)", transition:"all .22s", cursor:"default" }}
                onMouseEnter={e=>{ const el=e.currentTarget as HTMLDivElement; el.style.boxShadow="0 14px 32px rgba(30,60,30,.12)"; el.style.transform="translateY(-3px)"; }}
                onMouseLeave={e=>{ const el=e.currentTarget as HTMLDivElement; el.style.boxShadow="0 6px 20px rgba(30,60,30,.06)"; el.style.transform="translateY(0)"; }}
              >
                <Icon size={84} color={f.color} strokeWidth={1.2} style={{ position:"absolute", right:-6, top:14, opacity:.1 }}/>
                <div style={{ width:56, height:56, borderRadius:16, background:f.bg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:18, position:"relative" }}>
                  <Icon size={26} color={f.color} strokeWidth={1.8}/>
                </div>
                <h3 style={{ ...HEAD, fontSize:17, fontWeight:800, color:"#0E1F14", letterSpacing:"-.02em", margin:"0 0 8px" }}>{f.t}</h3>
                <p style={{ fontSize:14, color:TX2, lineHeight:1.6, margin:0, position:"relative" }}>{f.d}</p>
                <div style={{ marginTop:"auto", paddingTop:18, display:"flex", alignItems:"center", justifyContent:"space-between", color:f.color }}>
                  <span style={{ fontSize:13.5, fontWeight:500 }}>Află mai multe</span>
                  <span style={{ width:32, height:32, borderRadius:"50%", background:f.bg, display:"inline-flex", alignItems:"center", justifyContent:"center" }}><ArrowRight size={15}/></span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign:"center", marginBottom:44 }}>
          <button onClick={onLogin} style={{ padding:"15px 32px", border:"none", borderRadius:999, background:G, color:W, cursor:"pointer", fontSize:15, fontWeight:600, display:"inline-flex", alignItems:"center", gap:10, boxShadow:"0 8px 22px rgba(27,94,32,.28)", ...HEAD }}>
            Explorează toate funcționalitățile <ArrowRight size={16}/>
          </button>
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"20px 0", paddingBottom:72 }}>
          {[
            { Icon:Leaf,      t:"Mai multă organizare", d:"Mai puțin stres" },
            { Icon:BarChart3, t:"Decizii mai bune",     d:"Pe baza datelor reale" },
            { Icon:ShieldCheck,t:"O fermă mai sigură",  d:"Pentru prezent și viitor" },
          ].map(({ Icon,t,d },i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:"0 36px", borderLeft:i?"1px solid rgba(15,60,30,.14)":"none" }}>
              <Icon size={34} color={G} strokeWidth={1.6}/>
              <div><div style={{ ...HEAD, fontSize:14, fontWeight:700, color:"#0E1F14" }}>{t}</div><div style={{ fontSize:13, color:TX2 }}>{d}</div></div>
            </div>
          ))}
        </div>
      </div>
      <svg aria-hidden viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ position:"absolute", left:0, right:0, bottom:0, width:"100%", height:110, pointerEvents:"none" }}>
        <path d="M0 70 C 240 20, 480 100, 760 55 S 1200 20, 1440 60 L1440 120 L0 120Z" fill="#DDEBCF" opacity=".55"/>
        <path d="M0 95 C 300 60, 620 120, 900 85 S 1250 60, 1440 90 L1440 120 L0 120Z" fill="#C9DEB6" opacity=".6"/>
      </svg>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOW IT WORKS — Lucide icons in step boxes
// ═══════════════════════════════════════════════════════════════════════════════
const STEPS: { Icon:LucideIcon; bg:string; color:string; n:number; t:string; d:string }[] = [
  { Icon:Upload,       bg:"#EFF6FF", color:"#2563EB", n:1, t:"Adaugi informațiile", d:"Imporți sau adaugi datele fermei tale." },
  { Icon:FolderOpen,   bg:"#FEF3C7", color:"#B45309", n:2, t:"Organizezi datele",   d:"Proprietari, contracte și parcele." },
  { Icon:Calendar,     bg:"#CCFBF1", color:"#0F766E", n:3, t:"Urmărești activ",     d:"Plăți, documente și termene." },
  { Icon:Users,        bg:"#FEF3C7", color:"#D97706", n:4, t:"Colaborezi",          d:"Persoane autorizate, roluri clare." },
  { Icon:TrendingUp,   bg:"#F5F3FF", color:"#7C3AED", n:5, t:"Generezi situații",   d:"Rapoarte rapide când ai nevoie." },
];

function HowItWorksSection({ onLogin }: { onLogin:()=>void }) {
  return (
    <section style={{ background:`linear-gradient(180deg,#FBFCF8 0%,#F3F7EE 100%)`, padding:"96px 0 88px", position:"relative", overflow:"hidden", ...BODY }}>
      <div style={{ maxWidth:1180, margin:"0 auto", padding:"0 40px", position:"relative" }}>
        <div className="hidden lg:block" style={{ position:"absolute", left:10, top:-8, transform:"rotate(-6deg)", fontFamily:"'Caveat',cursive", fontSize:26, lineHeight:1.05, color:"#3b5a45" }}>
          <Leaf size={26} color={G} fill={G} strokeWidth={1.2}/>
          <div style={{ marginTop:4 }}>Pas cu pas,<br/>fără bătăi de cap.</div>
        </div>
        <div className="hidden lg:block" style={{ position:"absolute", right:10, top:6, transform:"rotate(5deg)", fontFamily:"'Caveat',cursive", fontSize:26, lineHeight:1.05, color:"#3b5a45", textAlign:"right" }}>
          Mai puțin haos.<br/>Mai mult control.
          <svg width="120" height="12" viewBox="0 0 120 12" style={{ display:"block", marginLeft:"auto", marginTop:4 }}><path d="M2 8 C 35 2, 80 2, 118 5" stroke={G} strokeWidth="2.2" fill="none" strokeLinecap="round"/></svg>
        </div>

        <div style={{ textAlign:"center", marginBottom:56 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:14, marginBottom:16 }}>
            <span style={{ width:34, height:1.5, background:G, opacity:.7 }}/>
            <span style={{ fontSize:13, fontWeight:700, color:G, letterSpacing:".2em", textTransform:"uppercase" }}>Cum funcționează</span>
            <span style={{ width:34, height:1.5, background:G, opacity:.7 }}/>
          </div>
          <h2 style={{ ...HEAD, fontSize:46, fontWeight:900, color:TX, letterSpacing:"-.045em", lineHeight:1.08, margin:0 }}>
            De la haos, la control.<br/><span style={{ color:G }}>În 5 pași simpli.</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 relative" style={{ marginBottom:36 }}>
          {STEPS.map((s,i)=>(
            <div key={i} style={{ position:"relative", background:`linear-gradient(160deg,#fff 40%,${s.bg})`, border:"1px solid rgba(15,60,30,.08)", borderRadius:20, padding:"22px 18px 20px", boxShadow:"0 6px 20px rgba(30,60,30,.06)", textAlign:"left", overflow:"hidden" }}>
              <s.Icon size={92} color={s.color} strokeWidth={1.2} style={{ position:"absolute", right:-14, bottom:-14, opacity:.09 }}/>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                <div style={{ width:52, height:52, borderRadius:15, background:s.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <s.Icon size={24} color={s.color} strokeWidth={1.8}/>
                </div>
                <span style={{ ...HEAD, fontSize:30, fontWeight:900, color:s.color, opacity:.35, lineHeight:1 }}>0{s.n}</span>
              </div>
              <div style={{ fontSize:15, fontWeight:700, color:TX, marginBottom:6, ...HEAD }}>{s.t}</div>
              <div style={{ fontSize:12.5, color:TX3, lineHeight:1.5, position:"relative" }}>{s.d}</div>
              {i<4&&(
                <div className="hidden lg:flex" style={{ position:"absolute", right:-17, top:38, zIndex:2, width:18, height:18, borderRadius:"50%", background:"#fff", border:"1px solid rgba(15,60,30,.12)", alignItems:"center", justifyContent:"center", color:G }}>
                  <ArrowRight size={10}/>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5" style={{ background:`linear-gradient(135deg,${GBG},${AMBG})`,border:`1px solid ${GBD}`,borderRadius:22,padding:"22px 32px",boxShadow:SH }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:48,height:48,borderRadius:14,background:W,border:`1px solid ${BD}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:SH }}>
              <BarChart3 size={22} color={G} strokeWidth={1.8}/>
            </div>
            <p style={{ fontSize:15, color:TX, lineHeight:1.6, margin:0, ...BODY }}>
              Arenda Pro conectează toate datele tale și îți dă<br/><strong style={{ color:G }}>control total asupra fermei.</strong>
            </p>
          </div>
          <button onClick={onLogin} style={{ padding:"12px 26px",border:"none",borderRadius:999,background:G,cursor:"pointer",fontSize:14,fontWeight:700,color:W,boxShadow:`0 4px 14px rgba(27,94,32,0.30)`,flexShrink:0,display:"flex",alignItems:"center",gap:6,transition:"all .2s",...HEAD }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=G2;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background=G;}}
          >Începe gratuit <ArrowRight size={13}/></button>
        </div>

        <div style={{ marginTop:44, textAlign:"center", fontSize:12, letterSpacing:".22em", textTransform:"uppercase", color:TX3, fontWeight:600 }}>
          <Leaf size={16} color={G} style={{ margin:"0 auto 8px" }}/>
          O fermă mai organizată · <span style={{ color:G }}>un viitor mai sigur</span>
        </div>
      </div>
    </section>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ROLES — Lucide icons
// ═══════════════════════════════════════════════════════════════════════════════
const ROLES = [
  { Icon:ShieldCheck, bg:"#DCFCE7", color:"#15803D", title:"Administrator",
    desc:"Acces complet la toate datele și setările fermei.",
    checks:["Gestionare completă","Utilizatori și permisiuni","Setări și configurări","Rapoarte avansate"] },
  { Icon:Calculator,  bg:"#FEF3C7", color:"#B45309", title:"Contabil",
    desc:"Acces la documente, plăți și rapoarte financiare.",
    checks:["Documente și rapoarte","Situația plăților","Descărcare rapoarte","Export date"] },
  { Icon:Users,       bg:"#EFF6FF", color:"#1D4ED8", title:"Colaborator",
    desc:"Acces selectiv la informațiile relevante rolului său.",
    checks:["Vizualizare parcele","Contracte alocate","Activități atribuite","Documente partajate"] },
];

function RolesSection() {
  return (
    <section style={{ background:W, padding:"88px 0", ...BODY }}>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 40px" }}>
        <div style={{ textAlign:"center", marginBottom:52 }}>
          <p style={{ fontSize:13, fontWeight:700, color:G, letterSpacing:".12em", textTransform:"uppercase", marginBottom:10 }}>ROLURI ȘI PERMISIUNI</p>
          <h2 style={{ ...HEAD, fontSize:40, fontWeight:900, color:TX, letterSpacing:"-.04em", lineHeight:1.12 }}>
            Aceleași date. Accesul potrivit<br/>pentru fiecare utilizator.
          </h2>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20, marginBottom:24 }}>
          {ROLES.map((r,i)=>(
            <div key={i} style={{ background:BG,border:`1.5px solid ${BD}`,borderRadius:18,padding:"30px",boxShadow:SH,transition:"all .22s" }}
              onMouseEnter={e=>{ const el=e.currentTarget as HTMLDivElement; el.style.boxShadow=SH2; el.style.borderColor=GBD; }}
              onMouseLeave={e=>{ const el=e.currentTarget as HTMLDivElement; el.style.boxShadow=SH; el.style.borderColor=BD; }}
            >
              <IconBox icon={r.Icon} bg={r.bg} color={r.color} size={48}/>
              <h3 style={{ ...HEAD, fontSize:18, fontWeight:800, color:TX, marginBottom:8 }}>{r.title}</h3>
              <p style={{ fontSize:14, color:TX2, marginBottom:22, lineHeight:1.65 }}>{r.desc}</p>
              <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
                {r.checks.map((c,j)=>(
                  <div key={j} style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <div style={{ width:18,height:18,borderRadius:5,background:GBG,border:`1px solid ${GBD}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                      <Check size={10} color={G} strokeWidth={3}/>
                    </div>
                    <span style={{ fontSize:13, color:TX }}>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:10,background:GBG,border:`1px solid ${GBD}`,borderRadius:12,padding:"14px 20px" }}>
          <Lock size={15} color={G} strokeWidth={2}/>
          <span style={{ fontSize:13, color:TX2 }}>
            <strong style={{ color:G }}>Fiecare rol vede doar ce are nevoie.</strong> Datele fermei tale rămân în siguranță.
          </span>
        </div>
      </div>
    </section>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
function FinalCtaSection({ onLogin }: { onLogin:()=>void }) {
  return (
    <section style={{ position:"relative", overflow:"hidden", padding:"100px 40px", textAlign:"center" }}>
      <img src={PH_CTA} alt="Câmpuri agricole la apus" style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 40%" }}/>
      <div style={{ position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(8,20,4,0.74) 0%,rgba(8,20,4,0.62) 100%)" }}/>
      <div style={{ position:"relative",zIndex:1,maxWidth:600,margin:"0 auto" }}>
        <p style={{ ...BODY,fontSize:13,fontWeight:700,color:"#e8c060",letterSpacing:".12em",textTransform:"uppercase",marginBottom:16 }}>ÎNCEPE AZI</p>
        <h2 style={{ ...HEAD,fontSize:44,fontWeight:900,color:W,letterSpacing:"-.05em",lineHeight:1.1,marginBottom:20 }}>
          Terenurile sunt în câmp.<br/>Datele lor nu trebuie<br/><span style={{ color:"#e8c060" }}>să fie împrăștiate.</span>
        </h2>
        <div style={{ display:"flex",gap:14,justifyContent:"center",marginBottom:24 }}>
          <button onClick={onLogin} style={{ padding:"14px 32px",border:"none",borderRadius:12,background:G,cursor:"pointer",fontSize:16,fontWeight:800,color:W,boxShadow:`0 6px 28px rgba(27,94,32,0.44)`,display:"inline-flex",alignItems:"center",gap:8,transition:"all .2s",...HEAD }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=G2;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background=G;}}
          >Solicită o demonstrație <ArrowRight size={16}/></button>
          <button onClick={onLogin} style={{ padding:"14px 28px",border:"1px solid rgba(255,255,255,0.30)",background:"rgba(255,255,255,0.10)",backdropFilter:"blur(8px)",borderRadius:12,cursor:"pointer",fontSize:15,fontWeight:500,color:W,transition:"all .2s",...BODY }}>Descoperă platforma</button>
        </div>
        <div style={{ display:"flex",gap:22,justifyContent:"center",flexWrap:"wrap" }}>
          {["Fără card bancar","Configurare rapidă","Poți anula oricând"].map((t,i)=>(
            <div key={i} style={{ display:"flex",alignItems:"center",gap:7 }}>
              <Check size={14} color="#e8c060"/>
              <span style={{ ...BODY,fontSize:13,color:"rgba(255,255,255,0.82)" }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════════════
function Footer({ onLogin }: { onLogin:()=>void }) {
  return (
    <footer style={{ background:BG, borderTop:`1px solid ${BD}`, ...BODY }}>
      <div style={{ maxWidth:1360, margin:"0 auto", padding:"44px 40px 18px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:48, marginBottom:40 }}>
          <div>
            <div style={{ display:"flex",alignItems:"center",gap:9,marginBottom:14 }}>
              <div style={{ width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${G2},${G})`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                <Shield size={14} color="white" strokeWidth={2}/>
              </div>
              <span style={{ ...HEAD,fontWeight:800,fontSize:15,color:TX }}>ArendaPro</span>
            </div>
            <p style={{ fontSize:13,color:TX2,lineHeight:1.74,maxWidth:280,marginBottom:18 }}>
              Platforma digitală pentru gestionarea contractelor de arendă agricolă din România.
            </p>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {["GDPR","ANAF","APIA"].map(b=>(
                <span key={b} style={{ padding:"3px 10px",border:`1px solid ${BD2}`,borderRadius:6,fontSize:10,fontWeight:600,color:TX3 }}>{b}</span>
              ))}
            </div>
          </div>
          {[
            { t:"Produs",   links:["Funcționalități","Prețuri","Securitate","Noutăți"] },
            { t:"Resurse",  links:["Blog","Ghiduri","Tutoriale","Documentație"] },
            { t:"Companie", links:["Despre noi","Contact","Termeni","Confidențialitate"] },
          ].map(col=>(
            <div key={col.t}>
              <h4 style={{ ...HEAD,fontSize:10,fontWeight:800,color:TX3,textTransform:"uppercase",letterSpacing:".1em",marginBottom:14 }}>{col.t}</h4>
              <div style={{ display:"flex",flexDirection:"column",gap:11 }}>
                {col.links.map(l=>(
                  <a key={l} href="#" style={{ ...BODY,fontSize:13,color:TX2,textDecoration:"none",transition:"color .18s" }}
                    onMouseEnter={e=>{e.currentTarget.style.color=G;}}
                    onMouseLeave={e=>{e.currentTarget.style.color=TX2;}}
                  >{l}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop:`1px solid ${BD}`,paddingTop:18,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <span style={{ fontSize:12,color:TX3 }}>© 2026 ArendaPro. Toate drepturile rezervate. · contact@arendapro.ro</span>
          <button onClick={onLogin} style={{ padding:"8px 18px",border:`1px solid ${GBD}`,background:GBG,borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,color:G,display:"flex",alignItems:"center",gap:5,...HEAD }}>
            Intră în aplicație <ArrowRight size={12}/>
          </button>
        </div>
      </div>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export function LandingPage({ onLogin }: { onLogin:()=>void }) {
  const [view, setView] = useState<"home"|"pricing"|"blog"|"resurse">("home");
  const go = (v: typeof view) => { setView(v); window.scrollTo({ top:0 }); };
  const home = () => { setView("home"); window.scrollTo({ top:0, behavior:"smooth" }); };

  if (view === "pricing") return <PricingPage onLogin={onLogin} onBack={home}/>;
  if (view === "blog")    return <BlogPage    onLogin={onLogin} onBack={home}/>;
  if (view === "resurse") return <ResursePage onLogin={onLogin} onBack={home}/>;

  return (
    <div style={{ background:BG, fontFamily:"'Inter',sans-serif", overflowX:"hidden" }}>
      <Nav onLogin={onLogin} onPricing={()=>go("pricing")} onBlog={()=>go("blog")} onResurse={()=>go("resurse")}/>
      <HeroSection       onLogin={onLogin}/>
      <StatsStrip/>
      <ProblemSection/>
      <HarvesterStrip    onLogin={onLogin}/>
      <div id="platforma"><FeaturesSection   onLogin={onLogin}/></div>
      <div id="functionalitati"><HowItWorksSection onLogin={onLogin}/></div>
      <RolesSection/>
      <FinalCtaSection   onLogin={onLogin}/>
      <div id="contact"><Footer            onLogin={onLogin}/></div>
    </div>
  );
}
