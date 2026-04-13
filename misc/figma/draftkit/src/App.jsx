import { useState } from "react";

/* ─── DESIGN TOKENS ──────────────────────────────────────────────────── */
const T = {
  bg:       "#0d0d0d",
  surface:  "#141414",
  surface2: "#1a1a1a",
  surface3: "#202020",
  border:   "#2a2a2a",
  border2:  "#333",
  green:    "#34c759",
  greenDim: "rgba(52,199,89,0.12)",
  cyan:     "#00e5ff",
  gold:     "#c9951a",
  goldDim:  "rgba(201,149,26,0.12)",
  red:      "#ff3b30",
  redDim:   "rgba(255,59,48,0.14)",
  blue:     "#0a84ff",
  purple:   "#a78bfa",
  purpleDim:"rgba(167,139,250,0.12)",
  muted:    "#555",
  muted2:   "#888",
  text:     "#efefef",
  white:    "#fff",
};
const F = `'Alexandria', sans-serif`;

/* ─── MOCK DATA ──────────────────────────────────────────────────────── */
const PLAYERS = [
  { id:1,  name:"Shohei Ohtani",    team:"LAA", league:"AL", pos:["SP","DH"], maxBid:37, tier:"Elite",   avg:".304", hr:44,  rbi:95,  sb:20, era:"3.14", so:167, injury:null,    note:"Two-way unicorn. Start bids high." },
  { id:2,  name:"Ronald Acuña Jr.", team:"ATL", league:"NL", pos:["OF"],      maxBid:65, tier:"Elite",   avg:".337", hr:41,  rbi:106, sb:73, era:null,   so:null, injury:null,    note:"" },
  { id:3,  name:"Mookie Betts",     team:"LAD", league:"NL", pos:["OF","SS"], maxBid:55, tier:"Elite",   avg:".307", hr:39,  rbi:93,  sb:14, era:null,   so:null, injury:null,    note:"Versatile — fills SS in a pinch." },
  { id:4,  name:"Freddie Freeman",  team:"LAD", league:"NL", pos:["1B"],      maxBid:48, tier:"Elite",   avg:".331", hr:29,  rbi:144, sb:9,  era:null,   so:null, injury:null,    note:"" },
  { id:5,  name:"Gerrit Cole",      team:"NYY", league:"AL", pos:["SP"],      maxBid:38, tier:"Starter", avg:null,   hr:0,   rbi:0,   sb:0,  era:"2.63", so:222, injury:null,    note:"Ace in deep leagues." },
  { id:6,  name:"Spencer Strider",  team:"ATL", league:"NL", pos:["SP"],      maxBid:41, tier:"Starter", avg:null,   hr:0,   rbi:0,   sb:0,  era:"3.86", so:281, injury:"IL-15", note:"Monitor elbow." },
  { id:7,  name:"Francisco Lindor", team:"NYM", league:"NL", pos:["SS"],      maxBid:42, tier:"Starter", avg:".273", hr:31,  rbi:98,  sb:22, era:null,   so:null, injury:null,    note:"" },
  { id:8,  name:"Yordan Alvarez",   team:"HOU", league:"AL", pos:["OF","DH"], maxBid:44, tier:"Starter", avg:".293", hr:31,  rbi:97,  sb:3,  era:null,   so:null, injury:null,    note:"" },
  { id:9,  name:"Pete Alonso",      team:"NYM", league:"NL", pos:["1B"],      maxBid:31, tier:"Starter", avg:".217", hr:46,  rbi:111, sb:1,  era:null,   so:null, injury:null,    note:"High K rate but elite power." },
  { id:10, name:"Zack Wheeler",     team:"PHI", league:"NL", pos:["SP"],      maxBid:33, tier:"Starter", avg:null,   hr:0,   rbi:0,   sb:0,  era:"3.61", so:212, injury:null,    note:"" },
  { id:11, name:"Julio Rodriguez",  team:"SEA", league:"AL", pos:["OF"],      maxBid:36, tier:"Starter", avg:".275", hr:26,  rbi:87,  sb:37, era:null,   so:null, injury:null,    note:"" },
  { id:12, name:"Adley Rutschman",  team:"BAL", league:"AL", pos:["C"],       maxBid:28, tier:"Starter", avg:".265", hr:20,  rbi:79,  sb:4,  era:null,   so:null, injury:null,    note:"Best C available." },
  { id:13, name:"Trea Turner",      team:"PHI", league:"NL", pos:["SS","2B"], maxBid:32, tier:"Starter", avg:".300", hr:26,  rbi:76,  sb:30, era:null,   so:null, injury:null,    note:"" },
  { id:14, name:"Carlos Correa",    team:"MIN", league:"AL", pos:["SS"],      maxBid:27, tier:"Bench",   avg:".256", hr:23,  rbi:84,  sb:3,  era:null,   so:null, injury:null,    note:"" },
  { id:15, name:"Bo Bichette",      team:"TOR", league:"AL", pos:["SS"],      maxBid:29, tier:"Bench",   avg:".306", hr:20,  rbi:89,  sb:10, era:null,   so:null, injury:null,    note:"" },
];

const NEWS = [
  { player:"Spencer Strider", text:"Placed on 15-day IL with right elbow inflammation.", time:"2h ago", type:"injury" },
  { player:"Shohei Ohtani",   text:"Goes 2-for-4 with a HR in spring training.", time:"4h ago", type:"news" },
  { player:"Pete Alonso",     text:"Trade rumors: Mets exploring offers for 1B.", time:"6h ago", type:"trade" },
];

const ROSTER_POS = ["C","1B","2B","3B","SS","OF","OF","OF","SP","SP","RP","UTIL","BN","BN","BN"];
const TAXI_POS   = ["TAXI","TAXI","TAXI"];

const makeOwners = () => Array.from({length:12}, (_,i) => ({
  id: i+1, name: `Owner ${i+1}`,
  budget: 260,
  spent:  i === 0 ? 12 : 0,
  roster: ROSTER_POS.map((pos,j) => ({
    pos,
    player: (i===0 && j===0) ? { name:"Garrett Crochet", cost:12, pid:null } : null,
  })),
  taxi: TAXI_POS.map(pos => ({ pos, player:null })),
}));

const TABS = [
  { id:"draft",    label:"Draft Board" },
  { id:"taxi",     label:"Taxi Squad" },
  { id:"dict",     label:"Player Dictionary" },
  { id:"rosters",  label:"Rosters" },
  { id:"settings", label:"League Settings" },
  { id:"keepers",  label:"Keeper Setup" },
  { id:"api",      label:"API Sandbox" },
];

/* ─── ATOMS ──────────────────────────────────────────────────────────── */
const Card = ({children, style={}}) => (
  <div style={{background:T.surface, border:`1px solid ${T.border}`, borderRadius:13, ...style}}>
    {children}
  </div>
);

const Lbl = ({children, style={}}) => (
  <div style={{fontSize:9, fontWeight:700, letterSpacing:"0.12em", color:T.muted, fontFamily:F, textTransform:"uppercase", ...style}}>
    {children}
  </div>
);

const PosBadge = ({pos}) => {
  const cols = { SP:"#0a84ff", RP:"#5856d6", C:"#ff9f0a", "1B":"#ff6b35", "2B":"#ff8c42",
    "3B":"#ffac30", SS:"#ffd60a", OF:"#34c759", DH:"#00e5ff", UTIL:"#888", BN:"#3a3a3a", TAXI:"#7c3aed" };
  const c = cols[pos]||"#555";
  return (
    <span style={{ fontSize:9, fontWeight:800, padding:"2px 5px", borderRadius:3,
      background:`${c}20`, color:c, border:`1px solid ${c}40`, fontFamily:F, letterSpacing:"0.04em" }}>
      {pos}
    </span>
  );
};

const TierBadge = ({tier}) => {
  const m = { Elite:{bg:"#c9951a20",c:"#c9951a"}, Starter:{bg:T.greenDim,c:T.green}, Bench:{bg:"#ffffff0e",c:T.muted2} }[tier]||{bg:"#fff0",c:T.muted};
  return (
    <span style={{ fontSize:9, fontWeight:800, padding:"2px 6px", borderRadius:3,
      background:m.bg, color:m.c, border:`1px solid ${m.c}30`, fontFamily:F }}>
      {tier?.toUpperCase()}
    </span>
  );
};

const Btn = ({children, onClick, variant="primary", disabled=false, style={}}) => {
  const vs = {
    primary:  { bg:T.green,   fg:"#000",   fw:800,  bd:"none" },
    secondary:{ bg:T.surface3,fg:T.text,   fw:600,  bd:`1px solid ${T.border2}` },
    ghost:    { bg:"transparent", fg:T.muted, fw:500, bd:`1px solid ${T.border}` },
    gold:     { bg:T.gold,    fg:T.white,  fw:700,  bd:"none" },
    danger:   { bg:T.red,     fg:T.white,  fw:700,  bd:"none" },
    taxi:     { bg:T.purpleDim,fg:T.purple,fw:700,  bd:`1px solid rgba(167,139,250,0.3)` },
  };
  const v = vs[variant]||vs.primary;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:v.bg, color:v.fg, fontWeight:v.fw, border:v.bd,
      fontFamily:F, fontSize:12, borderRadius:7, padding:"7px 14px",
      cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1,
      transition:"opacity .12s", ...style,
    }}>{children}</button>
  );
};

const Input = ({value, onChange, placeholder, style={}, autoFocus}) => (
  <input value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus} style={{
    background:T.surface3, border:`1px solid ${T.border}`, borderRadius:7,
    color:T.text, fontFamily:F, fontSize:12, padding:"7px 11px",
    width:"100%", outline:"none", boxSizing:"border-box", ...style,
  }}/>
);

/* ─── BASEBALL CARD ──────────────────────────────────────────────────── */
function BaseballCard({ player, compact=false }) {
  const [note, setNote] = useState(player?.note || "");
  
  // Helper function to get player image URL from search
  const getPlayerImageUrl = (playerName) => {
    // Use a placeholder service that can fetch player images
    const encodedName = encodeURIComponent(playerName);
    return `https://source.unsplash.com/200x250/?baseball,player&sig=${encodedName}`;
  };

  if (!player) return (
    <div style={{ padding:28, textAlign:"center" }}>
      <div style={{ color:T.muted, fontSize:11, fontFamily:F }}>Click any player to view their card</div>
    </div>
  );
  
  const isPitcher = player.pos?.some(p => ["SP","RP"].includes(p));
  const imageUrl = getPlayerImageUrl(player.name);
  
  return (
    <div style={{ fontFamily:F }}>
      {/* Card header — black background */}
      <div style={{
        background:"#000000",
        borderBottom:`2px solid ${T.green}`, padding:"14px 14px 0", position:"relative",
      }}>
        {player.injury && (
          <div style={{ position:"absolute", top:8, right:8, background:T.red, color:T.white,
            fontSize:8, fontWeight:800, padding:"2px 7px", borderRadius:3, letterSpacing:"0.06em" }}>
            WARNING: {player.injury}
          </div>
        )}
        <div style={{ display:"flex", gap:11, alignItems:"flex-end", paddingBottom:12 }}>
          {/* Real player image */}
          <div style={{ width:60, height:75, borderRadius:9, flexShrink:0,
            background:"#000",
            border:`2px solid ${T.border2}`, overflow:"hidden" }}>
            <img src={imageUrl} alt={player.name} 
              style={{ width:"100%", height:"100%", objectFit:"cover" }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.style.display = 'flex';
                e.target.parentElement.style.alignItems = 'center';
                e.target.parentElement.style.justifyContent = 'center';
                e.target.parentElement.innerHTML = '<div style="color:#555;font-size:10px">No Image</div>';
              }}
            />
          </div>
          <div style={{ flex:1, paddingBottom:2 }}>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", fontWeight:700, letterSpacing:"0.1em", marginBottom:3 }}>
              {player.team} · {player.league} LEAGUE
            </div>
            <div style={{ fontSize:16, fontWeight:800, color:T.white, lineHeight:1.1, marginBottom:5 }}>
              {player.name}
            </div>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6 }}>
              {player.pos?.map(p => <PosBadge key={p} pos={p}/>)}
              <TierBadge tier={player.tier}/>
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
              <span style={{ fontSize:24, fontWeight:800, color:T.green, lineHeight:1 }}>${player.maxBid}</span>
              <span style={{ fontSize:9, color:T.muted }}>MAX BID</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding:"11px 13px", borderBottom:`1px solid ${T.border}` }}>
        <Lbl style={{ marginBottom:7 }}>Statistics</Lbl>
        {isPitcher ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:5 }}>
            {[["ERA",player.era],["SO",player.so],["WHIP","—"]].map(([k,v]) => (
              <div key={k} style={{ background:T.surface2, borderRadius:6, padding:"6px 8px" }}>
                <div style={{ fontSize:8, color:T.muted, fontWeight:700 }}>{k}</div>
                <div style={{ fontSize:15, fontWeight:800, color:T.text }}>{v ?? <span style={{color:T.muted}}>—</span>}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5 }}>
            {[["AVG",player.avg],["HR",player.hr],["RBI",player.rbi],["SB",player.sb]].map(([k,v]) => (
              <div key={k} style={{ background:T.surface2, borderRadius:6, padding:"6px 6px" }}>
                <div style={{ fontSize:8, color:T.muted, fontWeight:700 }}>{k}</div>
                <div style={{ fontSize:14, fontWeight:800, color:T.text }}>{v ?? <span style={{color:T.muted}}>—</span>}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Valuation bar */}
      <div style={{ padding:"9px 13px", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <Lbl>True Dollar Value</Lbl>
          <span style={{ fontSize:10, color:T.green, fontWeight:800 }}>${player.maxBid}</span>
        </div>
        <div style={{ height:4, background:T.surface3, borderRadius:2 }}>
          <div style={{ height:"100%", borderRadius:2,
            background:`linear-gradient(90deg,${T.green},${T.cyan})`,
            width:`${Math.min((player.maxBid/70)*100,100)}%` }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
          <span style={{ fontSize:8, color:T.muted }}>$1</span>
          <span style={{ fontSize:8, color:T.muted }}>$70</span>
        </div>
      </div>

      {/* News */}
      {NEWS.filter(n => n.player === player.name).map((n,i) => (
        <div key={i} style={{ padding:"8px 13px", borderBottom:`1px solid ${T.border}`,
          display:"flex", gap:7, alignItems:"flex-start" }}>
          <span style={{ fontSize:9, fontWeight:800, color:T.green, textTransform:"uppercase" }}>
            [{n.type}]
          </span>
          <div>
            <div style={{ fontSize:10, color:T.text, lineHeight:1.4 }}>{n.text}</div>
            <div style={{ fontSize:9, color:T.muted, marginTop:1 }}>{n.time}</div>
          </div>
        </div>
      ))}

      {/* Eligibility */}
      <div style={{ padding:"9px 13px", borderBottom:`1px solid ${T.border}` }}>
        <Lbl style={{ marginBottom:6 }}>Eligibility</Lbl>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {player.pos?.map(p => <PosBadge key={p} pos={p}/>)}
        </div>
      </div>

      {/* Notes */}
      {!compact && (
        <div style={{ padding:"9px 13px" }}>
          <Lbl style={{ marginBottom:5 }}>My Notes</Lbl>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="Add scouting notes, reminders, strategy..."
            style={{ width:"100%", minHeight:60, background:T.surface3,
              border:`1px solid ${T.border}`, borderRadius:6, color:T.text,
              fontFamily:F, fontSize:11, padding:"6px 8px",
              resize:"vertical", outline:"none", boxSizing:"border-box" }}/>
        </div>
      )}
    </div>
  );
}

/* ─── SELL MODAL ─────────────────────────────────────────────────────── */
function SellModal({ player, owners, onConfirm, onClose }) {
  const [winnerIdx, setWinnerIdx] = useState(0);
  const [price, setPrice]         = useState("");
  const p = parseInt(price) || 0;
  const overpay = p > player.maxBid ? p - player.maxBid : 0;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:3000, fontFamily:F }}>
      <div style={{ background:T.surface, border:`2px solid ${T.gold}`,
        borderRadius:18, padding:28, width:380,
        boxShadow:`0 0 60px rgba(201,149,26,0.25)` }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,#1a1200,#241a00)`,
          border:`1px solid ${T.gold}50`, borderRadius:11, padding:"12px 16px",
          marginBottom:20, textAlign:"center" }}>
          <div style={{ fontSize:18, fontWeight:800, color:T.white }}>{player.name}</div>
          <div style={{ display:"flex", justifyContent:"center", gap:5, marginTop:5 }}>
            {player.pos?.map(p => <PosBadge key={p} pos={p}/>)}
            <span style={{ fontSize:9, color:T.muted, fontFamily:F }}>{player.team}</span>
          </div>
          <div style={{ marginTop:6, fontSize:11, color:T.muted }}>
            API value: <span style={{ color:T.green, fontWeight:700 }}>${player.maxBid}</span>
          </div>
        </div>

        <Lbl style={{ marginBottom:5 }}>Sold To</Lbl>
        <select value={winnerIdx} onChange={e => setWinnerIdx(parseInt(e.target.value))} style={{
          background:T.surface3, border:`1px solid ${T.border}`, borderRadius:7,
          color:T.text, fontFamily:F, fontSize:12, padding:"8px 11px",
          width:"100%", outline:"none", marginBottom:14,
        }}>
          {owners.map((o,i) => (
            <option key={i} value={i}>{o.name}  —  ${o.budget - o.spent} remaining</option>
          ))}
        </select>

        <Lbl style={{ marginBottom:5 }}>Winning Bid ($)</Lbl>
        <Input value={price} onChange={e => setPrice(e.target.value)}
          placeholder="e.g. 35" autoFocus
          style={{ fontSize:20, textAlign:"center", fontWeight:800, marginBottom:8 }}/>

        {overpay > 0 && (
          <div style={{ fontSize:10, color:T.red, fontWeight:700, textAlign:"center", marginBottom:10 }}>
            WARNING: Overpay by ${overpay} vs. API valuation
          </div>
        )}
        {price && !overpay && p > 0 && (
          <div style={{ fontSize:10, color:T.green, textAlign:"center", marginBottom:10 }}>
            Within API valuation
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:4 }}>
          <Btn variant="ghost" onClick={onClose} style={{ padding:"10px 0" }}>Cancel</Btn>
          <Btn onClick={() => onConfirm({ player, winnerIdx, cost:p })}
            disabled={!p} style={{ padding:"10px 0" }}>
            Confirm Sold
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── SLOT EDIT MODAL Commissioner Override ─────────────────────────── */
function SlotModal({ slot, ownerName, players, onSave, onRemove, onClose }) {
  const [q, setQ]       = useState(slot.player?.name || "");
  const [cost, setCost]  = useState(slot.player?.cost || "");
  const [picked, setPick] = useState(slot.player || null);
  const avail = players.filter(p => !p.drafted && p.name.toLowerCase().includes(q.toLowerCase()) && q.length > 0);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:3000, fontFamily:F }}>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`,
        borderRadius:16, padding:26, width:400,
        boxShadow:"0 0 40px rgba(0,0,0,0.7)" }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.text, marginBottom:3 }}>
          {slot.player ? "Edit Slot" : "Add Player"} — {ownerName}
        </div>
        <div style={{ fontSize:11, color:T.muted, marginBottom:16 }}>
          Slot: <PosBadge pos={slot.pos}/>&nbsp;&nbsp;Commissioner Override
        </div>

        <Lbl style={{ marginBottom:5 }}>Search Player</Lbl>
        <div style={{ position:"relative", marginBottom:avail.length>0?0:12 }}>
          <Input value={q} onChange={e => { setQ(e.target.value); setPick(null); }}
            placeholder="Type player name..." autoFocus/>
        </div>
        {avail.length > 0 && (
          <div style={{ border:`1px solid ${T.border}`, borderRadius:7,
            maxHeight:150, overflow:"auto", marginBottom:12 }}>
            {avail.slice(0,7).map(p => (
              <div key={p.id} onClick={() => { setPick(p); setQ(p.name); }}
                style={{ padding:"7px 11px", cursor:"pointer",
                  background: picked?.id===p.id ? T.greenDim : T.surface2,
                  borderBottom:`1px solid ${T.border}`,
                  display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:T.text }}>{p.name}</div>
                  <div style={{ display:"flex", gap:3, marginTop:2 }}>
                    {p.pos.map(po => <PosBadge key={po} pos={po}/>)}
                    <span style={{ fontSize:9, color:T.muted }}>{p.team}</span>
                  </div>
                </div>
                <span style={{ color:T.green, fontWeight:800, fontSize:12 }}>${p.maxBid}</span>
              </div>
            ))}
          </div>
        )}

        <Lbl style={{ marginBottom:5 }}>Purchase Price ($)</Lbl>
        <Input value={cost} onChange={e => setCost(e.target.value)}
          placeholder="e.g. 25" style={{ marginBottom:18 }}/>

        <div style={{ display:"grid", gridTemplateColumns: slot.player ? "1fr 1fr 1fr" : "1fr 1fr", gap:8 }}>
          <Btn variant="ghost" onClick={onClose} style={{ padding:"9px 0" }}>Cancel</Btn>
          {slot.player && (
            <Btn variant="danger" onClick={onRemove} style={{ padding:"9px 0", fontSize:11 }}>Remove</Btn>
          )}
          <Btn onClick={() => onSave({ player: picked || slot.player, cost: parseInt(cost)||0 })}
            disabled={!picked && !slot.player} style={{ padding:"9px 0" }}>
            Save
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── TOP NAV ────────────────────────────────────────────────────────── */
function TopNav({ league, tab, setTab }) {
  return (
    <div style={{ height:50, background:T.surface, borderBottom:`1px solid ${T.border}`,
      display:"flex", alignItems:"center", padding:"0 18px", gap:0,
      fontFamily:F, position:"sticky", top:0, zIndex:200 }}>
      <div style={{ marginRight:22, flexShrink:0 }}>
        <div style={{ fontSize:12, fontWeight:800, color:T.text }}>{league.name}</div>
        <div style={{ fontSize:8, color:T.muted, fontWeight:700, letterSpacing:"0.1em" }}>SEASON {league.year}</div>
      </div>
      <div style={{ display:"flex", gap:1, flex:1, overflow:"auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:"5px 13px", borderRadius:6, fontFamily:F, fontSize:10,
            fontWeight: tab===t.id ? 800 : 400, cursor:"pointer", whiteSpace:"nowrap", border:"none",
            background: tab===t.id ? "rgba(52,199,89,0.13)" : "transparent",
            color: tab===t.id ? T.green : T.muted,
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ display:"flex", gap:10, alignItems:"center", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:T.green,
            boxShadow:`0 0 5px ${T.green}` }}/>
          <span style={{ fontSize:9, color:T.muted, fontWeight:700 }}>API ONLINE</span>
        </div>
        <div style={{ background:T.greenDim, border:"1px solid rgba(52,199,89,0.28)",
          borderRadius:5, padding:"2px 9px", fontSize:9, fontWeight:800, color:T.green }}>
          IN PROGRESS
        </div>
      </div>
    </div>
  );
}

function OwnerBanner({ owner }) {
  const maxBid = owner.budget - owner.spent - Math.max(owner.roster.filter(s=>!s.player).length - 1, 0);
  return (
    <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`,
      padding:"7px 18px", display:"flex", alignItems:"center", gap:12, fontFamily:F }}>
      <div>
        <Lbl>Your Owner</Lbl>
        <div style={{ fontSize:15, fontWeight:800, color:T.text, marginTop:1 }}>{owner.name}</div>
      </div>
      <div style={{ background:T.greenDim, border:"1px solid rgba(52,199,89,0.25)",
        borderRadius:7, padding:"3px 11px", display:"flex", alignItems:"center", gap:5 }}>
        <span style={{ color:T.green, fontWeight:800, fontSize:10 }}>VERIFIED</span>
        <span style={{ color:T.muted, fontSize:10 }}>${owner.budget} budget</span>
      </div>
      <div style={{ flex:1 }}/>
      <div style={{ textAlign:"center" }}>
        <Lbl>Inflation</Lbl>
        <div style={{ fontSize:11, fontWeight:800, color:"#ff9f0a", marginTop:1 }}>+4.2%</div>
      </div>
      <div style={{ textAlign:"center" }}>
        <Lbl>Max Bid</Lbl>
        <div style={{ fontSize:11, fontWeight:800, color:T.green, marginTop:1 }}>${maxBid}</div>
      </div>
      <div style={{ background:T.surface2, border:`1px solid ${T.border}`, borderRadius:7,
        padding:"4px 11px", fontSize:11 }}>
        <span style={{ color:T.muted }}>Turn: </span>
        <span style={{ color:T.text, fontWeight:700 }}>{owner.name}</span>
        <span style={{ marginLeft:7, background:T.green, color:"#000",
          fontSize:8, fontWeight:800, padding:"2px 6px", borderRadius:3, letterSpacing:"0.05em" }}>
          YOUR TURN
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DRAFT BOARD — big table left 70%, right sidebar, search moved under grid
═══════════════════════════════════════════════════════════════════════ */
function DraftBoard({ owners, setOwners, players, setPlayers, myIdx }) {
  const [cursor,   setCursor]   = useState(PLAYERS[0]);
  const [search,   setSearch]   = useState("");
  const [posFilter,setPosFilter]= useState("ALL");
  const [sellTarget,setSell]    = useState(null);   // player to sell
  const [slotEdit,  setSlot]    = useState(null);   // {oi, si}
  const [showResults,setShowR]  = useState(false);

  const me = owners[myIdx];
  const undrafted = players.filter(p => !p.drafted);
  const suggestions = [...undrafted].sort((a,b) => b.maxBid - a.maxBid).slice(0,6);

  const searchResults = undrafted.filter(p => {
    const q = search.toLowerCase();
    const hit = p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q);
    const pos = posFilter === "ALL" || p.pos.includes(posFilter);
    return q.length > 0 && hit && pos;
  });

  const POS_FILTERS = ["ALL","C","1B","2B","3B","SS","OF","SP","RP"];

  /* sell a player → assign to owner, deduct budget */
  const handleSell = ({ player, winnerIdx, cost }) => {
    setPlayers(prev => prev.map(p => p.id===player.id ? {...p, drafted:true} : p));
    setOwners(prev => prev.map((o,i) => {
      if (i !== winnerIdx) return o;
      const roster = [...o.roster];
      // find first matching pos slot, else first empty
      let idx = roster.findIndex(s => s.pos === player.pos[0] && !s.player);
      if (idx < 0) idx = roster.findIndex(s => !s.player);
      if (idx >= 0) roster[idx] = { ...roster[idx], player:{ name:player.name, cost, pid:player.id } };
      return { ...o, spent: o.spent + cost, roster };
    }));
    setSell(null);
  };

  /* edit slot — commissioner override */
  const handleSlotSave = ({ player, cost }) => {
    if (!slotEdit) return;
    const { oi, si } = slotEdit;
    setOwners(prev => prev.map((o,i) => {
      if (i !== oi) return o;
      const roster = [...o.roster];
      const oldCost = roster[si].player?.cost || 0;
      roster[si] = { ...roster[si], player:{ name:player.name, cost, pid:player.id } };
      return { ...o, spent: o.spent - oldCost + cost };
    }));
    if (player.id) setPlayers(prev => prev.map(p => p.id===player.id ? {...p,drafted:true} : p));
    setSlot(null);
  };

  const handleSlotRemove = () => {
    if (!slotEdit) return;
    const { oi, si } = slotEdit;
    setOwners(prev => prev.map((o,i) => {
      if (i !== oi) return o;
      const roster = [...o.roster];
      const old = roster[si].player;
      const pid = old?.pid;
      roster[si] = { ...roster[si], player:null };
      if (pid) setPlayers(prev2 => prev2.map(p => p.id===pid ? {...p,drafted:false} : p));
      return { ...o, spent: Math.max(0, o.spent - (old?.cost||0)) };
    }));
    setSlot(null);
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 290px",
      height:"calc(100vh - 98px)", overflow:"hidden" }}>

      {/* ══ LEFT: big table + search moved to bottom ══ */}
      <div style={{ display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>

        {/* ── ROSTER TABLE — scrollable ── */}
        <div style={{ flex:1, overflow:"auto", padding:"14px 14px 0" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:800, color:T.text, fontFamily:F, letterSpacing:"0.03em" }}>
              DRAFT LEAGUE TEAMS TABLE
            </span>
            <span style={{ fontSize:9, color:T.muted, fontFamily:F }}>Click any cell to edit</span>
            <div style={{ flex:1 }}/>
            <Btn variant="ghost" style={{ fontSize:9, padding:"3px 9px" }}>Undo</Btn>
            <div style={{ fontSize:9, color:"#ff9f0a", fontWeight:700, fontFamily:F }}>+4.2% inflation</div>
          </div>

          <div style={{ overflowX:"auto" }}>
            <table style={{ borderCollapse:"collapse", fontFamily:F, fontSize:10, minWidth:"max-content", width:"100%" }}>
              <thead>
                <tr style={{ background:T.surface2 }}>
                  {/* Sticky owner col */}
                  <th style={{ padding:"7px 12px", textAlign:"left", color:T.muted, fontWeight:700,
                    borderBottom:`1px solid ${T.border}`, position:"sticky", left:0,
                    background:T.surface2, zIndex:10, minWidth:110, whiteSpace:"nowrap" }}>
                    OWNER
                  </th>
                  <th style={{ padding:"7px 9px", color:T.muted, fontWeight:700,
                    borderBottom:`1px solid ${T.border}`, minWidth:58, textAlign:"center" }}>
                    $ LEFT
                  </th>
                  {ROSTER_POS.map((pos,i) => (
                    <th key={i} style={{ padding:"5px 7px", borderBottom:`1px solid ${T.border}`,
                      minWidth:88, textAlign:"center" }}>
                      <PosBadge pos={pos}/>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {owners.map((o, oi) => {
                  const isMe = oi === myIdx;
                  const budgetLeft = o.budget - o.spent;
                  const emptySlots = o.roster.filter(s => !s.player).length;
                  const myMaxBid = budgetLeft - Math.max(emptySlots - 1, 0);
                  return (
                    <tr key={o.id}
                      style={{ borderBottom:`1px solid ${T.border}`,
                        background: isMe ? "rgba(52,199,89,0.035)" : "transparent" }}>
                      {/* Owner cell */}
                      <td style={{ padding:"5px 12px", position:"sticky", left:0, zIndex:5,
                        background: isMe ? "rgba(52,199,89,0.05)" : T.surface,
                        borderRight:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>
                        <div style={{ fontWeight: isMe?800:500, color: isMe?T.green:T.text }}>
                          {isMe ? "★ " : ""}{o.name}
                        </div>
                        {isMe && (
                          <div style={{ fontSize:8, color:T.muted, marginTop:1 }}>
                            max bid: <span style={{color:T.green}}>${myMaxBid}</span>
                          </div>
                        )}
                      </td>
                      {/* Budget */}
                      <td style={{ padding:"5px 9px", textAlign:"center",
                        color: budgetLeft < 50 ? T.red : T.green, fontWeight:700 }}>
                        ${budgetLeft}
                      </td>
                      {/* Roster slots */}
                      {o.roster.map((slot, si) => (
                        <td key={si}
                          onClick={() => setSlot({ oi, si })}
                          title="Click to add/edit/remove"
                          style={{ padding:"3px 4px", textAlign:"center",
                            cursor:"pointer", verticalAlign:"middle" }}>
                          {slot.player ? (
                            <div style={{ background:"rgba(52,199,89,0.08)",
                              border:"1px solid rgba(52,199,89,0.2)", borderRadius:5,
                              padding:"3px 5px", textAlign:"left" }}>
                              <div style={{ fontSize:9, fontWeight:700, color:T.text,
                                overflow:"hidden", textOverflow:"ellipsis",
                                whiteSpace:"nowrap", maxWidth:78 }}>
                                {slot.player.name}
                              </div>
                              <div style={{ fontSize:8, color:T.green, fontWeight:700 }}>
                                ${slot.player.cost}
                              </div>
                            </div>
                          ) : (
                            <div style={{ border:`1px dashed ${T.border}`, borderRadius:5,
                              padding:"5px 4px", color:T.muted, fontSize:9, opacity:0.5 }}>
                              —
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SEARCH — now pinned under the grid, more visible ── */}
        <div style={{ borderTop:`2px solid ${T.green}`, background:T.surface,
          padding:"14px 14px", flexShrink:0 }}>
          {/* Pos filter + label row */}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:9, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, fontWeight:800, color:T.green, fontFamily:F, marginRight:4 }}>
              PLAYER SEARCH
            </span>
            <span style={{ fontSize:9, color:T.muted, fontFamily:F, marginRight:8 }}>Quick search and autocomplete</span>
            {POS_FILTERS.map(p => (
              <button key={p} onClick={() => setPosFilter(p)} style={{
                padding:"3px 9px", borderRadius:4, fontFamily:F, fontSize:9, fontWeight:700,
                cursor:"pointer", border:"none",
                background: posFilter===p ? T.greenDim : T.surface3,
                color: posFilter===p ? T.green : T.muted,
              }}>{p}</button>
            ))}
            <span style={{ marginLeft:"auto", fontSize:9, color:T.muted, fontFamily:F }}>
              {undrafted.length} available
            </span>
          </div>

          {/* Search input */}
          <div style={{ position:"relative" }}>
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setShowR(e.target.value.length > 0); }}
              placeholder="Search players or teams for autocomplete... click result to view card or record sale"
              style={{ paddingRight:80, fontSize:13 }}
            />
            {search && (
              <button onClick={() => { setSearch(""); setShowR(false); }}
                style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", color:T.muted, cursor:"pointer",
                  fontFamily:F, fontSize:11 }}>Clear</button>
            )}
          </div>

          {/* Search results */}
          {showResults && searchResults.length > 0 && (
            <div style={{ display:"flex", gap:7, marginTop:10, flexWrap:"wrap" }}>
              {searchResults.slice(0,10).map(p => (
                <div key={p.id}
                  onClick={() => { setCursor(p); setSell(p); setSearch(""); setShowR(false); }}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px",
                    borderRadius:8, cursor:"pointer", background:T.surface2,
                    border:`1px solid ${T.border}`, flexShrink:0, transition:"all 0.15s" }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:T.text, fontFamily:F }}>{p.name}</div>
                    <div style={{ display:"flex", gap:3, marginTop:2 }}>
                      {p.pos.slice(0,2).map(po => <PosBadge key={po} pos={po}/>)}
                      <span style={{ fontSize:8, color:T.muted, fontFamily:F }}>{p.team}</span>
                      {p.injury && <span style={{ fontSize:8, color:T.red, fontWeight:700 }}>WARNING</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:14, fontWeight:800, color:T.green, fontFamily:F }}>${p.maxBid}</div>
                    <TierBadge tier={p.tier}/>
                  </div>
                </div>
              ))}
              {searchResults.length > 10 && (
                <div style={{ fontSize:10, color:T.muted, fontFamily:F, alignSelf:"center" }}>
                  +{searchResults.length-10} more
                </div>
              )}
            </div>
          )}
          {showResults && searchResults.length === 0 && search.length > 0 && (
            <div style={{ fontSize:10, color:T.muted, fontFamily:F, marginTop:7 }}>
              No available players match "{search}"
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT SIDEBAR ══ */}
      <div style={{ borderLeft:`1px solid ${T.border}`, display:"flex",
        flexDirection:"column", overflow:"hidden", background:T.surface }}>

        {/* My budget strip */}
        <div style={{ padding:"8px 12px", borderBottom:`1px solid ${T.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <Lbl>Budget</Lbl>
            <div style={{ fontSize:18, fontWeight:800, color:T.green, fontFamily:F }}>
              ${me.budget - me.spent}
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <Lbl>Slots Left</Lbl>
            <div style={{ fontSize:18, fontWeight:800, color:T.text, fontFamily:F }}>
              {me.roster.filter(s => !s.player).length}
            </div>
          </div>
        </div>

        {/* CURRENT PLAYER section */}
        <div style={{ flexShrink:0, borderBottom:`1px solid ${T.border}` }}>
          <div style={{ padding:"7px 12px", borderBottom:`1px solid ${T.border}`,
            display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:10, fontWeight:800, color:T.text, fontFamily:F }}>
              CURRENT PLAYER
            </span>
            {cursor && (
              <button onClick={() => setSell(cursor)} style={{
                background:T.green, border:"none", color:"#000", fontFamily:F,
                fontSize:8, fontWeight:800, padding:"3px 8px", borderRadius:4, cursor:"pointer",
                letterSpacing:"0.05em",
              }}>RECORD SALE</button>
            )}
          </div>
          <BaseballCard player={cursor} compact/>
        </div>

        {/* RECOMMENDED PLAYERS list */}
        <div style={{ flex:1, overflow:"auto" }}>
          <div style={{ padding:"7px 12px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            <span style={{ fontSize:10, fontWeight:800, color:T.text, fontFamily:F }}>
              RECOMMENDED PLAYERS
            </span>
            <span style={{ fontSize:8, color:T.muted, fontFamily:F, marginLeft:6 }}>AI Suggestions</span>
          </div>
          {suggestions.map(p => (
            <div key={p.id} onClick={() => setCursor(p)}
              style={{ display:"flex", alignItems:"center", cursor:"pointer",
                borderBottom:`1px solid ${T.border}`,
                background: cursor?.id===p.id ? "rgba(52,199,89,0.05)" : "transparent" }}>
              {/* Avatar - use real image */}
              <div style={{ width:52, height:52, flexShrink:0,
                background:"#000",
                borderRight:`1px solid ${T.border}`,
                overflow:"hidden" }}>
                <img 
                  src={`https://source.unsplash.com/52x52/?baseball,player&sig=${p.id}`}
                  alt={p.name}
                  style={{ width:"100%", height:"100%", objectFit:"cover" }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              <div style={{ flex:1, padding:"7px 10px", minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.text, fontFamily:F,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {p.name}
                </div>
                <div style={{ fontSize:9, color:T.muted, fontFamily:F, marginBottom:3 }}>
                  {p.team}
                </div>
                <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                  {p.pos.map(po => <PosBadge key={po} pos={po}/>)}
                </div>
              </div>
              <div style={{ padding:"7px 10px", textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:14, fontWeight:800, color:T.green, fontFamily:F }}>${p.maxBid}</div>
                <TierBadge tier={p.tier}/>
              </div>
            </div>
          ))}

          {/* Add player button — bottom of sidebar */}
          <div style={{ padding:"10px 12px", borderTop:`1px solid ${T.border}` }}>
            <button onClick={() => setSell(cursor)} style={{
              width:"100%", background:T.surface3, border:`1px solid ${T.border}`,
              color:T.muted, fontFamily:F, fontSize:10, fontWeight:700,
              padding:"8px 0", borderRadius:7, cursor:"pointer",
            }}>+ Add Player to Team</button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {sellTarget && (
        <SellModal player={sellTarget} owners={owners}
          onConfirm={handleSell} onClose={() => setSell(null)}/>
      )}
      {slotEdit && (
        <SlotModal
          slot={owners[slotEdit.oi].roster[slotEdit.si]}
          ownerName={owners[slotEdit.oi].name}
          players={players}
          onSave={handleSlotSave}
          onRemove={handleSlotRemove}
          onClose={() => setSlot(null)}/>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TAXI SQUAD VIEW
═══════════════════════════════════════════════════════════════════════ */
function TaxiSquad({ owners, setOwners, players, myIdx }) {
  const [cursor,  setCursor]  = useState(null);
  const [search,  setSearch]  = useState("");
  const [slotEdit,setSlot]    = useState(null);

  const me = owners[myIdx];
  const undrafted = players.filter(p => !p.drafted);
  const results   = undrafted.filter(p =>
    search.length > 0 && (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.team.toLowerCase().includes(search.toLowerCase())
    )
  );

  const handleSave = ({ player }) => {
    if (!slotEdit) return;
    const { oi, si } = slotEdit;
    setOwners(prev => prev.map((o,i) => {
      if (i !== oi) return o;
      const taxi = [...o.taxi];
      taxi[si] = { ...taxi[si], player:{ name:player.name, cost:1, pid:player.id } };
      return { ...o };
    }));
    setSlot(null);
  };

  const handleRemove = () => {
    if (!slotEdit) return;
    const { oi, si } = slotEdit;
    setOwners(prev => prev.map((o,i) => {
      if (i !== oi) return o;
      const taxi = [...o.taxi];
      taxi[si] = { ...taxi[si], player:null };
      return { ...o };
    }));
    setSlot(null);
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 290px",
      height:"calc(100vh - 98px)", overflow:"hidden" }}>

      {/* Left: taxi table + search */}
      <div style={{ display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Header banner */}
        <div style={{ padding:"11px 16px", borderBottom:`1px solid rgba(167,139,250,0.2)`,
          background:"rgba(124,58,237,0.07)", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
          <div style={{ fontSize:16, fontWeight:800, color:T.purple, fontFamily:F }}>
            TAXI SQUAD MODE
          </div>
          <div style={{ background:T.purpleDim, border:"1px solid rgba(167,139,250,0.3)",
            borderRadius:6, padding:"3px 10px", fontSize:9, color:T.purple, fontWeight:700, fontFamily:F }}>
            $1 fixed per pick · does NOT reduce main $260 budget
          </div>
          <div style={{ flex:1 }}/>
          <span style={{ fontSize:10, color:T.muted, fontFamily:F }}>
            Main auction complete. Reserve minor-league prospects below.
          </span>
        </div>

        {/* Taxi table */}
        <div style={{ flex:1, overflow:"auto", padding:"12px 14px 0" }}>
          <div style={{ fontSize:10, fontWeight:800, color:T.text, fontFamily:F,
            marginBottom:10, letterSpacing:"0.03em" }}>
            ALL TAXI SQUADS
          </div>
          <table style={{ borderCollapse:"collapse", fontFamily:F, fontSize:10,
            minWidth:"max-content", width:"100%" }}>
            <thead>
              <tr style={{ background:T.surface2 }}>
                <th style={{ padding:"7px 12px", textAlign:"left", color:T.muted, fontWeight:700,
                  borderBottom:`1px solid ${T.border}`, minWidth:120, position:"sticky", left:0,
                  background:T.surface2, zIndex:10 }}>OWNER</th>
                {TAXI_POS.map((pos,i) => (
                  <th key={i} style={{ padding:"5px 10px", borderBottom:`1px solid ${T.border}`,
                    minWidth:130, textAlign:"center" }}>
                    <PosBadge pos={pos}/>
                    <span style={{ color:T.green, marginLeft:5, fontSize:9 }}>$1</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {owners.map((o, oi) => {
                const isMe = oi === myIdx;
                return (
                  <tr key={o.id} style={{ borderBottom:`1px solid ${T.border}`,
                    background: isMe ? "rgba(124,58,237,0.05)" : "transparent" }}>
                    <td style={{ padding:"6px 12px", position:"sticky", left:0, zIndex:5,
                      background: isMe ? "rgba(124,58,237,0.07)" : T.surface,
                      borderRight:`1px solid ${T.border}`, fontWeight:isMe?800:500,
                      color:isMe?T.purple:T.text, whiteSpace:"nowrap" }}>
                      {isMe ? "★ " : ""}{o.name}
                    </td>
                    {o.taxi.map((slot, si) => (
                      <td key={si}
                        onClick={isMe ? () => setSlot({ oi, si }) : undefined}
                        style={{ padding:"4px 6px", textAlign:"center",
                          cursor:isMe?"pointer":"default" }}>
                        {slot.player ? (
                          <div style={{ background:T.purpleDim,
                            border:"1px solid rgba(167,139,250,0.3)", borderRadius:5,
                            padding:"4px 8px" }}>
                            <div style={{ fontSize:9, fontWeight:700, color:T.purple,
                              overflow:"hidden", textOverflow:"ellipsis",
                              whiteSpace:"nowrap", maxWidth:110 }}>
                              {slot.player.name}
                            </div>
                            <div style={{ fontSize:8, color:T.muted }}>$1</div>
                          </div>
                        ) : (
                          <div style={{ border:`1px dashed ${isMe ? "rgba(167,139,250,0.35)" : T.border}`,
                            borderRadius:5, padding:"6px 8px",
                            color:isMe?T.purple:T.muted, fontSize:9, opacity:isMe?0.7:0.4 }}>
                            {isMe ? "+ pick" : "empty"}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Search pinned to bottom */}
        <div style={{ borderTop:`1px solid ${T.border}`, background:T.surface,
          padding:"10px 14px", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
            <span style={{ fontSize:10, fontWeight:800, color:T.purple, fontFamily:F }}>
              TAXI PICK SEARCH
            </span>
            <span style={{ fontSize:9, color:T.muted, fontFamily:F }}>
              click result to assign $1 pick to selected slot
            </span>
          </div>
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search available players for $1 taxi pick..."/>
          {results.length > 0 && (
            <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
              {results.slice(0,7).map(p => (
                <div key={p.id} onClick={() => { setCursor(p); }}
                  style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 10px",
                    borderRadius:7, cursor:"pointer", background:T.surface2,
                    border:"1px solid rgba(167,139,250,0.25)", flexShrink:0 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:T.text, fontFamily:F }}>{p.name}</div>
                    <div style={{ display:"flex", gap:3, marginTop:2 }}>
                      {p.pos.map(po => <PosBadge key={po} pos={po}/>)}
                    </div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:800, color:T.purple, fontFamily:F }}>$1</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <div style={{ borderLeft:`1px solid ${T.border}`, overflow:"auto", background:T.surface }}>
        {/* My main roster */}
        <div style={{ padding:"8px 13px", borderBottom:`1px solid ${T.border}` }}>
          <span style={{ fontSize:10, fontWeight:800, color:T.text, fontFamily:F }}>MY MAIN ROSTER</span>
        </div>
        <div style={{ padding:"8px 13px", borderBottom:`1px solid ${T.border}` }}>
          {me.roster.map((s,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:5,
              padding:"3px 0", borderBottom:`1px solid ${T.border}` }}>
              <PosBadge pos={s.pos}/>
              <span style={{ fontSize:10, color:s.player?T.text:T.muted, flex:1, fontFamily:F,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {s.player ? s.player.name : "—"}
              </span>
              {s.player && <span style={{ fontSize:9, color:T.green, fontWeight:700, fontFamily:F }}>${s.player.cost}</span>}
            </div>
          ))}
        </div>

        {/* My taxi squad */}
        <div style={{ padding:"8px 13px", borderBottom:`1px solid ${T.border}` }}>
          <span style={{ fontSize:10, fontWeight:800, color:T.purple, fontFamily:F }}>MY TAXI SQUAD</span>
        </div>
        <div style={{ padding:"8px 13px", borderBottom:`1px solid ${T.border}` }}>
          {me.taxi.map((s,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:5,
              padding:"5px 8px", borderRadius:6, marginBottom:4,
              background: s.player ? T.purpleDim : T.surface2,
              border:`1px solid ${s.player ? "rgba(167,139,250,0.25)" : T.border}` }}>
              <PosBadge pos={s.pos}/>
              <span style={{ fontSize:10, color:s.player?T.purple:T.muted, flex:1, fontFamily:F }}>
                {s.player ? s.player.name : "empty"}
              </span>
              {s.player && <span style={{ fontSize:9, color:T.purple, fontWeight:700, fontFamily:F }}>$1</span>}
            </div>
          ))}
        </div>

        {/* Current player cursor */}
        {cursor && (
          <>
            <div style={{ padding:"8px 13px", borderBottom:`1px solid ${T.border}` }}>
              <span style={{ fontSize:10, fontWeight:800, color:T.text, fontFamily:F }}>SELECTED PLAYER</span>
            </div>
            <BaseballCard player={cursor} compact/>
          </>
        )}
      </div>

      {slotEdit && (
        <SlotModal
          slot={owners[slotEdit.oi].taxi[slotEdit.si]}
          ownerName={owners[slotEdit.oi].name}
          players={players}
          onSave={handleSave}
          onRemove={handleRemove}
          onClose={() => setSlot(null)}/>
      )}
    </div>
  );
}

/* ═══ PLAYER DICTIONARY ══════════════════════════════════════════════════ */
function PlayerDict({ players }) {
  const [search, setSearch]     = useState("");
  const [pos,    setPos]        = useState("ALL");
  const [tier,   setTier]       = useState("ALL");
  const [sel,    setSel]        = useState(PLAYERS[0]);
  const POSS  = ["ALL","C","1B","2B","3B","SS","OF","SP","RP","DH"];
  const TIERS = ["ALL","Elite","Starter","Bench"];
  const filtered = players.filter(p => {
    const ms = p.name.toLowerCase().includes(search.toLowerCase()) || p.team.toLowerCase().includes(search.toLowerCase());
    const mp = pos==="ALL" || p.pos.includes(pos);
    const mt = tier==="ALL" || p.tier===tier;
    return ms && mp && mt;
  });
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 320px",
      height:"calc(100vh - 98px)", overflow:"hidden", fontFamily:F }}>
      <div style={{ overflow:"auto", padding:18 }}>
        <div style={{ fontSize:20, fontWeight:800, color:T.text, letterSpacing:"0.03em", marginBottom:3 }}>PLAYER DICTIONARY</div>
        <div style={{ color:T.muted, fontSize:11, marginBottom:14 }}>Browse full pool · click for card · add notes anytime</div>
        <div style={{ display:"flex", gap:7, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or team..." style={{maxWidth:220}}/>
          <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
            {POSS.map(p=>(
              <button key={p} onClick={()=>setPos(p)} style={{
                padding:"3px 8px",borderRadius:4,fontFamily:F,fontSize:9,fontWeight:700,cursor:"pointer",
                background:pos===p?T.greenDim:T.surface2,color:pos===p?T.green:T.muted,
                border:`1px solid ${pos===p?"rgba(52,199,89,0.3)":T.border}`,
              }}>{p}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:3 }}>
            {TIERS.map(t=>(
              <button key={t} onClick={()=>setTier(t)} style={{
                padding:"3px 8px",borderRadius:4,fontFamily:F,fontSize:9,fontWeight:700,cursor:"pointer",
                background:tier===t?"rgba(201,149,26,0.14)":T.surface2,color:tier===t?T.gold:T.muted,
                border:`1px solid ${tier===t?"rgba(201,149,26,0.28)":T.border}`,
              }}>{t}</button>
            ))}
          </div>
          <span style={{ marginLeft:"auto", fontSize:10, color:T.muted }}>{filtered.length} players</span>
        </div>
        {["Elite","Starter","Bench"].map(tn => {
          const g = filtered.filter(p=>p.tier===tn);
          if(!g.length) return null;
          return (
            <div key={tn}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, marginTop:14 }}>
                <TierBadge tier={tn}/>
                <div style={{ flex:1, height:1, background:T.border }}/>
                <span style={{ fontSize:9, color:T.muted }}>{g.length}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:7 }}>
                {g.map(p=>(
                  <div key={p.id} onClick={()=>setSel(p)} style={{
                    padding:"10px 12px", borderRadius:10, cursor:"pointer",
                    background:sel?.id===p.id?"rgba(52,199,89,0.07)":T.surface,
                    border:`2px solid ${sel?.id===p.id?T.green:T.border}`,
                  }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:T.text, marginBottom:2 }}>{p.name}</div>
                        <div style={{ fontSize:9, color:T.muted, marginBottom:4 }}>{p.team} · {p.league}</div>
                        <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                          {p.pos.map(po=><PosBadge key={po} pos={po}/>)}
                        </div>
                        {p.injury && <div style={{ fontSize:8, color:T.red, fontWeight:700, marginTop:3 }}>WARNING: {p.injury}</div>}
                        {p.note  && <div style={{ fontSize:9, color:"#ff9f0a", marginTop:3 }}>Note: {p.note.slice(0,28)}…</div>}
                      </div>
                      <div style={{ textAlign:"right", marginLeft:8 }}>
                        <div style={{ fontSize:16, fontWeight:800, color:p.drafted?T.muted:T.green }}>${p.maxBid}</div>
                        {p.drafted && <div style={{ fontSize:8, color:T.red, fontWeight:700 }}>DRAFTED</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ borderLeft:`1px solid ${T.border}`, overflow:"auto", background:T.surface }}>
        <div style={{ padding:"9px 13px", borderBottom:`1px solid ${T.border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:10, fontWeight:800, color:T.text, fontFamily:F }}>PLAYER CARD</span>
          {sel && <TierBadge tier={sel.tier}/>}
        </div>
        <BaseballCard player={sel}/>
      </div>
    </div>
  );
}

/* ═══ ROSTERS ════════════════════════════════════════════════════════════ */
function Rosters({ owners }) {
  return (
    <div style={{ padding:22, fontFamily:F, overflow:"auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:T.text }}>TEAM ROSTERS</div>
          <div style={{ color:T.muted, fontSize:11, marginTop:2 }}>Click table slots to override</div>
        </div>
        <Btn variant="secondary" style={{ fontSize:10 }}>Export CSV</Btn>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {owners.map(o => (
          <div key={o.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <div style={{ fontSize:12, fontWeight:800, color:T.text }}>{o.name}</div>
              <span style={{ fontSize:10, color:T.green, fontWeight:800 }}>${o.budget-o.spent}</span>
            </div>
            <div style={{ fontSize:9, color:T.muted, marginBottom:8 }}>
              {o.roster.filter(s=>!s.player).length} slots empty
            </div>
            <div style={{ height:3, background:T.surface3, borderRadius:2, marginBottom:10 }}>
              <div style={{ height:"100%", borderRadius:2, background:T.green,
                width:`${((o.budget-o.spent)/o.budget)*100}%` }}/>
            </div>
            {o.roster.filter(s=>s.player).map((s,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"3px 7px", background:"rgba(52,199,89,0.07)", borderRadius:5, marginBottom:3 }}>
                <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                  <PosBadge pos={s.pos}/>
                  <span style={{ fontSize:10, color:T.text }}>{s.player.name}</span>
                </div>
                <span style={{ fontSize:9, color:T.green, fontWeight:700 }}>${s.player.cost}</span>
              </div>
            ))}
            {!o.roster.some(s=>s.player) && (
              <div style={{ textAlign:"center", padding:"10px 0", color:T.muted, fontSize:11 }}>No players yet</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ LEAGUE SETTINGS ════════════════════════════════════════════════════ */
const H_CATS=["R","H","HR","RBI","SB","AVG","OBP","BB","TB","XBH"];
const P_CATS=["W","SV","ERA","WHIP","SO","HLD","K/9","BB/9","QS"];
function Settings() {
  const [active,setA]=useState({R:1,H:1,HR:1,RBI:1,SB:1,AVG:1,W:1,SV:1,ERA:1,WHIP:1,SO:1});
  const [slots,setS]=useState({C:1,"1B":1,"2B":1,"3B":1,SS:1,OF:3,SP:2,RP:2,UTIL:1,BN:2,TAXI:3});
  return (
    <div style={{ padding:22, fontFamily:F, overflow:"auto", maxWidth:1100 }}>
      <div style={{ fontSize:20, fontWeight:800, color:T.text, marginBottom:18 }}>LEAGUE SETTINGS</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:22 }}>
          <div style={{ fontSize:12, fontWeight:800, color:T.text, marginBottom:12 }}>SCORING CATEGORIES</div>
          <Lbl style={{ marginBottom:7 }}>Hitting</Lbl>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
            {H_CATS.map(c=>(
              <button key={c} onClick={()=>setA(p=>({...p,[c]:p[c]?0:1}))} style={{
                padding:"5px 10px",borderRadius:5,fontFamily:F,fontSize:11,fontWeight:700,cursor:"pointer",
                background:active[c]?T.greenDim:T.surface3,color:active[c]?T.green:T.muted,
                border:`1px solid ${active[c]?"rgba(52,199,89,0.3)":T.border}`,
              }}>{c}</button>
            ))}
          </div>
          <Lbl style={{ marginBottom:7 }}>Pitching</Lbl>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {P_CATS.map(c=>(
              <button key={c} onClick={()=>setA(p=>({...p,[c]:p[c]?0:1}))} style={{
                padding:"5px 10px",borderRadius:5,fontFamily:F,fontSize:11,fontWeight:700,cursor:"pointer",
                background:active[c]?"rgba(0,229,255,0.1)":T.surface3,color:active[c]?T.cyan:T.muted,
                border:`1px solid ${active[c]?"rgba(0,229,255,0.25)":T.border}`,
              }}>{c}</button>
            ))}
          </div>
        </div>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:22 }}>
          <div style={{ fontSize:12, fontWeight:800, color:T.text, marginBottom:12 }}>ROSTER CONFIGURATION</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
            {Object.entries(slots).map(([pos,n])=>(
              <div key={pos} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                background:T.surface2, borderRadius:7, padding:"7px 11px" }}>
                <span style={{ fontSize:12, color:T.text, fontWeight:700 }}>{pos}</span>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <button onClick={()=>setS(p=>({...p,[pos]:Math.max(0,p[pos]-1)}))}
                    style={{ background:T.border,border:"none",color:T.text,borderRadius:3,width:20,height:20,cursor:"pointer",fontSize:13 }}>−</button>
                  <span style={{ color:T.green, fontWeight:800, minWidth:12, textAlign:"center", fontFamily:F }}>{n}</span>
                  <button onClick={()=>setS(p=>({...p,[pos]:p[pos]+1}))}
                    style={{ background:T.border,border:"none",color:T.text,borderRadius:3,width:20,height:20,cursor:"pointer",fontSize:13 }}>+</button>
                </div>
              </div>
            ))}
          </div>
          <Btn style={{ marginTop:12, width:"100%" }}>Save Settings</Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══ KEEPER SETUP ════════════════════════════════════════════════════════ */
function Keepers({ owners, onDone }) {
  const [keepers,setK]=useState([]);
  const [oi,setOi]=useState(0);
  const [player,setP]=useState("");
  const [cost,setC]=useState("");
  const add=()=>{
    if(!player||!cost) return;
    setK(prev=>[...prev,{ownerId:owners[oi].id,ownerName:owners[oi].name,player,cost:parseInt(cost)}]);
    setP(""); setC("");
  };
  return (
    <div style={{ padding:26, fontFamily:F }}>
      <div style={{ fontSize:20, fontWeight:800, color:T.text, marginBottom:3 }}>PRE-DRAFT KEEPER INITIALIZATION</div>
      <div style={{ color:T.muted, fontSize:11, marginBottom:20 }}>Enter keeper contracts. Budgets auto-adjust per owner.</div>
      <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:18 }}>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:800, color:T.text, marginBottom:12 }}>ADD KEEPER CONTRACT</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div>
              <Lbl style={{ marginBottom:4 }}>Owner</Lbl>
              <select value={oi} onChange={e=>setOi(parseInt(e.target.value))} style={{
                background:T.surface3,border:`1px solid ${T.border}`,borderRadius:7,
                color:T.text,fontFamily:F,fontSize:12,padding:"7px 11px",width:"100%",outline:"none",
              }}>{owners.map((o,i)=><option key={i} value={i}>{o.name}</option>)}</select>
            </div>
            <div><Lbl style={{ marginBottom:4 }}>Player Name</Lbl><Input value={player} onChange={e=>setP(e.target.value)} placeholder="e.g. Shohei Ohtani"/></div>
            <div><Lbl style={{ marginBottom:4 }}>Contract Cost ($)</Lbl><Input value={cost} onChange={e=>setC(e.target.value)} placeholder="e.g. 25"/></div>
            <Btn onClick={add}>Add Keeper</Btn>
          </div>
          {keepers.length>0&&(
            <div style={{ marginTop:16 }}>
              <Lbl style={{ marginBottom:7 }}>Entered Keepers</Lbl>
              {keepers.map((k,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${T.border}` }}>
                  <div><div style={{ fontSize:11, color:T.text, fontWeight:700 }}>{k.player}</div><div style={{ fontSize:9, color:T.muted }}>{k.ownerName}</div></div>
                  <span style={{ color:T.green, fontWeight:800, fontFamily:F }}>${k.cost}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <Lbl style={{ marginBottom:9 }}>Adjusted Starting Budgets</Lbl>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:9 }}>
            {owners.map(o=>{
              const ks=keepers.filter(k=>k.ownerId===o.id);
              const spend=ks.reduce((s,k)=>s+k.cost,0);
              return (
                <div key={o.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:12 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:T.text, marginBottom:2 }}>{o.name}</div>
                  <div style={{ fontSize:9, color:T.muted }}>{ks.length} keeper{ks.length!==1?"s":""}</div>
                  <div style={{ marginTop:7, display:"flex", justifyContent:"space-between" }}>
                    <div><div style={{ fontSize:8, color:T.muted }}>DEDUCTED</div><div style={{ color:T.red, fontWeight:800, fontFamily:F }}>-${spend}</div></div>
                    <div style={{ textAlign:"right" }}><div style={{ fontSize:8, color:T.muted }}>STARTS WITH</div><div style={{ color:T.green, fontWeight:800, fontFamily:F }}>${o.budget-spend}</div></div>
                  </div>
                </div>
              );
            })}
          </div>
          {onDone && <Btn onClick={onDone} style={{ marginTop:16, padding:"10px 20px" }}>Finalize Keepers & Start Draft</Btn>}
        </div>
      </div>
    </div>
  );
}

/* ═══ API SANDBOX ════════════════════════════════════════════════════════ */
const SAMPLE_IN = `{\n  "license_key": "DB-2026-XXXX-XXXX",\n  "draft_state": {\n    "total_teams": 12,\n    "budget_per_team": 260,\n    "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],\n    "teams": [\n      { "id": 1, "budget_remaining": 248, "roster": ["Garrett Crochet"] }\n    ],\n    "nominated_player": "Gerrit Cole"\n  }\n}`;
const SAMPLE_OUT = `{\n  "player": "Gerrit Cole",\n  "true_dollar_value": 38,\n  "max_bid_recommendation": 35,\n  "market_inflation": 1.042,\n  "scarcity_tier": "Starter",\n  "position_scarcity": { "SP": "HIGH" },\n  "draftability_score": 0.87,\n  "reasoning": "SP scarce — 9/12 teams need ≥1 SP. Inflation +4.2%."\n}`;
function ApiSandbox() {
  const [payload,setPay]=useState(SAMPLE_IN);
  const [response,setRes]=useState("");
  const [ran,setRan]=useState(false);
  return (
    <div style={{ padding:22, fontFamily:F, overflow:"auto", maxWidth:1100 }}>
      <div style={{ fontSize:20, fontWeight:800, color:T.text, marginBottom:3 }}>API TESTING SANDBOX</div>
      <div style={{ color:T.muted, fontSize:11, marginBottom:16 }}>Paste draft-state JSON and test the Valuation API interactively.</div>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:11, padding:13, marginBottom:16,
        display:"flex", gap:22, flexWrap:"wrap", alignItems:"center" }}>
        <div><Lbl style={{ marginBottom:3 }}>Endpoint</Lbl>
          <div style={{ fontFamily:"monospace", fontSize:11, color:T.cyan, background:T.surface2, padding:"3px 9px", borderRadius:5 }}>POST https://api.darkblue.io/v1/valuate</div></div>
        <div><Lbl style={{ marginBottom:3 }}>Auth</Lbl>
          <div style={{ fontFamily:"monospace", fontSize:11, color:"#ff9f0a", background:T.surface2, padding:"3px 9px", borderRadius:5 }}>X-License-Key: DB-2026-XXXX</div></div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:T.green, boxShadow:`0 0 5px ${T.green}` }}/>
          <span style={{ color:T.green, fontWeight:800, fontSize:11 }}>ONLINE</span>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div>
          <Lbl style={{ marginBottom:6 }}>Request Payload Stateless</Lbl>
          <textarea value={payload} onChange={e=>setPay(e.target.value)} style={{
            width:"100%", height:280, background:T.surface2, border:`1px solid ${T.border}`,
            borderRadius:10, color:T.cyan, fontFamily:"monospace", fontSize:11,
            padding:13, resize:"none", outline:"none", boxSizing:"border-box", lineHeight:1.6 }}/>
          <Btn onClick={()=>{setRes(SAMPLE_OUT);setRan(true);}} style={{ marginTop:7, width:"100%", padding:"10px 0" }}>Send Request</Btn>
        </div>
        <div>
          <Lbl style={{ marginBottom:6 }}>API Response</Lbl>
          <div style={{ height:280, background:T.surface2,
            border:`1px solid ${ran?"rgba(52,199,89,0.3)":T.border}`,
            borderRadius:10, padding:13, fontFamily:"monospace", fontSize:11,
            color:ran?T.green:T.muted, overflow:"auto", lineHeight:1.6, whiteSpace:"pre-wrap" }}>
            {ran ? response : "// Response appears here..."}
          </div>
          {ran && <div style={{ marginTop:7, padding:9, background:"rgba(52,199,89,0.06)", border:"1px solid rgba(52,199,89,0.2)", borderRadius:8 }}>
            <div style={{ fontSize:11, color:T.green, fontWeight:700 }}>200 OK · 42ms</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>Max Bid: $35 · Inflation: +4.2% · Tier: Starter</div>
          </div>}
        </div>
      </div>
    </div>
  );
}

/* ═══ CREATE DRAFT ════════════════════════════════════════════════════════ */
function CreateDraft({ onStart }) {
  const [name,setName]=useState("Valuation Test League");
  const [year,setYear]=useState("2025");
  const [num,setNum]=useState("12");
  const [budget,setBudget]=useState("260");
  const [pool,setPool]=useState("MLB (All)");
  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex",
      alignItems:"center", justifyContent:"center", fontFamily:F }}>
      <div style={{ width:480 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ fontSize:10, letterSpacing:"0.3em", color:T.green, fontWeight:800, marginBottom:9 }}>DARK BLUE SOFTWARE SOLUTIONS</div>
          <div style={{ fontSize:46, fontWeight:800, color:T.white, lineHeight:1, letterSpacing:"-0.03em" }}>
            AUCTION<br/><span style={{ color:T.green }}>DRAFT KIT</span>
          </div>
          <div style={{ color:T.muted, fontSize:12, marginTop:9 }}>Fantasy Baseball · Dynamic Valuation Engine · v2.0</div>
        </div>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:18, padding:32 }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.text, marginBottom:20, letterSpacing:"0.05em" }}>
            CREATE NEW DRAFT INSTANCE
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            <div><Lbl style={{ marginBottom:4 }}>League Name</Lbl><Input value={name} onChange={e=>setName(e.target.value)} placeholder="My Fantasy League"/></div>
            <div><Lbl style={{ marginBottom:4 }}>Season Year</Lbl><Input value={year} onChange={e=>setYear(e.target.value)} placeholder="2025"/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
              <div><Lbl style={{ marginBottom:4 }}>Owners</Lbl><Input value={num} onChange={e=>setNum(e.target.value)} placeholder="12"/></div>
              <div><Lbl style={{ marginBottom:4 }}>Budget / Owner</Lbl><Input value={budget} onChange={e=>setBudget(e.target.value)} placeholder="260"/></div>
            </div>
            <div>
              <Lbl style={{ marginBottom:6 }}>Player Pool</Lbl>
              <div style={{ display:"flex", gap:7 }}>
                {["MLB (All)","AL Only","NL Only"].map(opt => (
                  <button key={opt} onClick={()=>setPool(opt)} style={{
                    flex:1, padding:"7px 0", borderRadius:7, fontFamily:F, fontSize:11, fontWeight:700, cursor:"pointer",
                    background:pool===opt?T.greenDim:T.surface3, color:pool===opt?T.green:T.muted,
                    border:`1px solid ${pool===opt?"rgba(52,199,89,0.3)":T.border}`,
                  }}>{opt}</button>
                ))}
              </div>
            </div>
          </div>
          <Btn onClick={() => onStart({ name, year, budget:parseInt(budget) })}
            style={{ width:"100%", marginTop:22, padding:"13px 0", fontSize:14,
              borderRadius:11, letterSpacing:"0.07em" }}>
            INITIALIZE DRAFT
          </Btn>
          <div style={{ marginTop:10, textAlign:"center", fontSize:10, color:T.muted }}>
            ~1,200 player pool auto-populated on start
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ ROOT ════════════════════════════════════════════════════════════════ */
export default function App() {
  const [phase,  setPhase]  = useState("create");
  const [league, setLeague] = useState(null);
  const [tab,    setTab]    = useState("draft");
  const [owners, setOwners] = useState(() => makeOwners());
  const [players,setPlayers]= useState(PLAYERS);
  const myIdx = 2;

  if (phase === "create") {
    return <CreateDraft onStart={l => { setLeague(l); setPhase("keepers"); }}/>;
  }

  if (phase === "keepers") {
    return (
      <div style={{ minHeight:"100vh", background:T.bg }}>
        <div style={{ height:50, background:T.surface, borderBottom:`1px solid ${T.border}`,
          display:"flex", alignItems:"center", padding:"0 18px", fontFamily:F }}>
          <div style={{ fontSize:12, fontWeight:800, color:T.text }}>{league?.name}</div>
          <div style={{ marginLeft:9, fontSize:9, color:T.green, fontWeight:700 }}>· KEEPER SETUP</div>
        </div>
        <Keepers owners={owners} onDone={() => setPhase("draft")}/>
      </div>
    );
  }

  const lg = league || { name:"Valuation Test League", year:"2025" };
  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text }}>
      <TopNav league={lg} tab={tab} setTab={setTab}/>
      <OwnerBanner owner={owners[myIdx]}/>
      {tab==="draft"    && <DraftBoard owners={owners} setOwners={setOwners} players={players} setPlayers={setPlayers} myIdx={myIdx}/>}
      {tab==="taxi"     && <TaxiSquad  owners={owners} setOwners={setOwners} players={players} myIdx={myIdx}/>}
      {tab==="dict"     && <PlayerDict players={players}/>}
      {tab==="rosters"  && <Rosters owners={owners}/>}
      {tab==="settings" && <Settings/>}
      {tab==="keepers"  && <Keepers owners={owners} onDone={null}/>}
      {tab==="api"      && <ApiSandbox/>}
    </div>
  );
}
