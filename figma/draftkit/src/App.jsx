import { useState } from "react";

/* ─── TOKENS ─────────────────────────────────────────────────────────── */
const T = {
  bg:        "#0d0d0d",
  surface:   "#141414",
  surface2:  "#1a1a1a",
  surface3:  "#202020",
  border:    "#2a2a2a",
  border2:   "#333",
  green:     "#34c759",
  greenDim:  "rgba(52,199,89,0.12)",
  cyan:      "#00e5ff",
  gold:      "#c9951a",
  goldBg:    "#1a1200",
  red:       "#ff3b30",
  redDim:    "rgba(255,59,48,0.15)",
  blue:      "#0a84ff",
  muted:     "#666",
  muted2:    "#999",
  text:      "#f0f0f0",
  white:     "#ffffff",
};

const font = `'Alexandria', sans-serif`;

/* ─── MOCK DATA ──────────────────────────────────────────────────────── */
const PLAYERS = [
  { id:1,  name:"Shohei Ohtani",      team:"LAA", league:"AL", pos:["SP","DH"],    maxBid:37, tier:"Elite",   avg:".304", hr:44, rbi:95,  sb:20, era:"3.14", so:167, injury:null,    note:"Two-way unicorn. Start bids high.", drafted:false },
  { id:2,  name:"Ronald Acuña Jr.",   team:"ATL", league:"NL", pos:["OF"],         maxBid:65, tier:"Elite",   avg:".337", hr:41, rbi:106, sb:73, era:null,   so:null, injury:null,    note:"", drafted:false },
  { id:3,  name:"Mookie Betts",       team:"LAD", league:"NL", pos:["OF","SS"],    maxBid:55, tier:"Elite",   avg:".307", hr:39, rbi:93,  sb:14, era:null,   so:null, injury:null,    note:"Versatile—fills SS in a pinch.", drafted:false },
  { id:4,  name:"Freddie Freeman",    team:"LAD", league:"NL", pos:["1B"],         maxBid:48, tier:"Elite",   avg:".331", hr:29, rbi:144, sb:9,  era:null,   so:null, injury:null,    note:"", drafted:false },
  { id:5,  name:"Gerrit Cole",        team:"NYY", league:"AL", pos:["SP"],         maxBid:38, tier:"Starter", avg:null,   hr:0,  rbi:0,   sb:0,  era:"2.63", so:222, injury:null,    note:"Ace in deep leagues.", drafted:false },
  { id:6,  name:"Spencer Strider",    team:"ATL", league:"NL", pos:["SP"],         maxBid:41, tier:"Starter", avg:null,   hr:0,  rbi:0,   sb:0,  era:"3.86", so:281, injury:"IL-15", note:"Monitor elbow.", drafted:false },
  { id:7,  name:"Francisco Lindor",   team:"NYM", league:"NL", pos:["SS"],         maxBid:42, tier:"Starter", avg:".273", hr:31, rbi:98,  sb:22, era:null,   so:null, injury:null,    note:"", drafted:false },
  { id:8,  name:"Yordan Alvarez",     team:"HOU", league:"AL", pos:["OF","DH"],    maxBid:44, tier:"Starter", avg:".293", hr:31, rbi:97,  sb:3,  era:null,   so:null, injury:null,    note:"", drafted:false },
  { id:9,  name:"Pete Alonso",        team:"NYM", league:"NL", pos:["1B"],         maxBid:31, tier:"Starter", avg:".217", hr:46, rbi:111, sb:1,  era:null,   so:null, injury:null,    note:"High K rate but elite power.", drafted:false },
  { id:10, name:"Zack Wheeler",       team:"PHI", league:"NL", pos:["SP"],         maxBid:33, tier:"Starter", avg:null,   hr:0,  rbi:0,   sb:0,  era:"3.61", so:212, injury:null,    note:"", drafted:false },
  { id:11, name:"Julio Rodriguez",    team:"SEA", league:"AL", pos:["OF"],         maxBid:36, tier:"Starter", avg:".275", hr:26, rbi:87,  sb:37, era:null,   so:null, injury:null,    note:"", drafted:false },
  { id:12, name:"Adley Rutschman",    team:"BAL", league:"AL", pos:["C"],          maxBid:28, tier:"Starter", avg:".265", hr:20, rbi:79,  sb:4,  era:null,   so:null, injury:null,    note:"Best C available.", drafted:false },
  { id:13, name:"Trea Turner",        team:"PHI", league:"NL", pos:["SS","2B"],    maxBid:32, tier:"Starter", avg:".300", hr:26, rbi:76,  sb:30, era:null,   so:null, injury:null,    note:"", drafted:false },
  { id:14, name:"Carlos Correa",      team:"MIN", league:"AL", pos:["SS"],         maxBid:27, tier:"Bench",   avg:".256", hr:23, rbi:84,  sb:3,  era:null,   so:null, injury:null,    note:"", drafted:false },
  { id:15, name:"Bo Bichette",        team:"TOR", league:"AL", pos:["SS"],         maxBid:29, tier:"Bench",   avg:".306", hr:20, rbi:89,  sb:10, era:null,   so:null, injury:null,    note:"", drafted:false },
];

const OWNERS = Array.from({length:12},(_,i)=>({
  id:i+1, name:`Owner ${i+1}`,
  budget:260, spent: i===0?12:0,
  roster: [
    {pos:"C",  player: i===0?{name:"Garrett Crochet",cost:12}:null},
    {pos:"1B", player:null},{pos:"2B",player:null},{pos:"3B",player:null},
    {pos:"SS", player:null},{pos:"OF",player:null},{pos:"OF",player:null},
    {pos:"OF", player:null},{pos:"SP",player:null},{pos:"SP",player:null},
    {pos:"RP", player:null},{pos:"UTIL",player:null},{pos:"BN",player:null},
    {pos:"BN", player:null},{pos:"BN",player:null},
  ],
}));

const NEWS = [
  { player:"Spencer Strider", text:"Placed on 15-day IL with right elbow inflammation.", time:"2h ago", type:"injury" },
  { player:"Shohei Ohtani",   text:"Goes 2-for-4 with a HR in spring training game.", time:"4h ago", type:"news" },
  { player:"Pete Alonso",     text:"Trade rumors: Mets exploring offers for 1B.", time:"6h ago", type:"trade" },
];

const TABS = [
  { id:"draft",    label:"Draft Board" },
  { id:"players",  label:"Player Dictionary" },
  { id:"rosters",  label:"Rosters" },
  { id:"settings", label:"League Settings" },
  { id:"keepers",  label:"Keeper Setup" },
  { id:"api",      label:"API Sandbox" },
];

/* ─── PRIMITIVES ─────────────────────────────────────────────────────── */
const Card = ({children, style={}}) => (
  <div style={{background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, ...style}}>
    {children}
  </div>
);

const Label = ({children, style={}}) => (
  <div style={{fontSize:10, fontWeight:700, letterSpacing:"0.12em", color:T.muted, fontFamily:font, ...style}}>
    {children}
  </div>
);

const GreenPill = ({children}) => (
  <span style={{background:T.greenDim, color:T.green, fontSize:10, fontWeight:800,
    padding:"2px 8px", borderRadius:20, border:`1px solid rgba(52,199,89,0.25)`, fontFamily:font}}>
    {children}
  </span>
);

const PosBadge = ({pos}) => {
  const colors = {SP:"#0a84ff",RP:"#5856d6",C:"#ff9f0a","1B":"#ff6b35","2B":"#ff6b35","3B":"#ff6b35",SS:"#ff6b35",OF:"#34c759",DH:"#00e5ff",UTIL:"#888",BN:"#444"};
  const c = colors[pos]||"#444";
  return (
    <span style={{fontSize:9,fontWeight:800,padding:"2px 6px",borderRadius:4,fontFamily:font,
      background:`${c}22`,color:c,border:`1px solid ${c}44`}}>{pos}</span>
  );
};

const TierBadge = ({tier}) => {
  const map = {Elite:{bg:"#c9951a22",c:"#c9951a"},Starter:{bg:"rgba(52,199,89,.12)",c:T.green},Bench:{bg:"#ffffff11",c:T.muted2}};
  const m = map[tier]||map.Bench;
  return <span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:4,background:m.bg,color:m.c,fontFamily:font,border:`1px solid ${m.c}33`}}>{tier?.toUpperCase()}</span>;
};

const Btn = ({children, onClick, variant="primary", style={}}) => {
  const v = {
    primary:   {background:T.green,color:"#000",fontWeight:800},
    secondary: {background:T.surface3,color:T.text,border:`1px solid ${T.border2}`},
    danger:    {background:T.red,color:T.white,fontWeight:700},
    gold:      {background:T.gold,color:T.white,fontWeight:700},
    ghost:     {background:"transparent",color:T.muted,border:`1px solid ${T.border}`},
    cyan:      {background:"rgba(0,229,255,0.12)",color:T.cyan,border:`1px solid rgba(0,229,255,0.25)`,fontWeight:700},
  };
  return (
    <button onClick={onClick} style={{...v[variant],fontFamily:font,fontSize:13,borderRadius:8,padding:"8px 16px",border:"none",cursor:"pointer",...style}}>
      {children}
    </button>
  );
};

const Input = ({value, onChange, placeholder, style={}}) => (
  <input value={value} onChange={onChange} placeholder={placeholder} style={{
    background:T.surface3,border:`1px solid ${T.border}`,borderRadius:8,
    color:T.text,fontFamily:font,fontSize:13,padding:"8px 12px",
    width:"100%",outline:"none",boxSizing:"border-box",...style,
  }}/>
);

/* ─── BASEBALL CARD — SCRUM-62 Player Cursor UI ─────────────────────── */
function BaseballCard({player}) {
  const [note, setNote] = useState(player?.note||"");
  if (!player) return (
    <div style={{padding:32,textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:12}}>⚾</div>
      <div style={{color:T.muted,fontSize:13,fontFamily:font}}>Click any player to view their card</div>
    </div>
  );
  const isPitcher = player.pos?.some(p=>["SP","RP"].includes(p));
  return (
    <div style={{fontFamily:font}}>
      {/* Card header */}
      <div style={{
        background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%)",
        borderBottom:`2px solid ${T.green}`, padding:"18px 18px 0", position:"relative",
      }}>
        {player.injury&&(
          <div style={{position:"absolute",top:10,right:10,background:T.red,color:T.white,
            fontSize:9,fontWeight:800,padding:"3px 8px",borderRadius:4,letterSpacing:"0.08em"}}>
            ⚠ {player.injury}
          </div>
        )}
        <div style={{display:"flex",gap:14,alignItems:"flex-end",paddingBottom:16}}>
          {/* Avatar */}
          <div style={{
            width:76,height:96,borderRadius:12,flexShrink:0,
            background:"linear-gradient(180deg,#1e3a5f,#0d1b2a)",
            border:`2px solid ${T.border2}`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,
            position:"relative",overflow:"hidden",
          }}>
            🧑
            <div style={{position:"absolute",bottom:0,left:0,right:0,
              background:"linear-gradient(transparent,rgba(0,0,0,0.7))",height:32}}/>
          </div>
          <div style={{flex:1,paddingBottom:4}}>
            <div style={{fontSize:10,color:T.muted,fontWeight:700,letterSpacing:"0.12em",marginBottom:4}}>
              {player.team} · MLB · {player.league}
            </div>
            <div style={{fontSize:19,fontWeight:800,color:T.white,lineHeight:1.1,marginBottom:6}}>
              {player.name}
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
              {player.pos?.map(p=><PosBadge key={p} pos={p}/>)}
              <TierBadge tier={player.tier}/>
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:5}}>
              <span style={{fontSize:30,fontWeight:800,color:T.green,lineHeight:1}}>${player.maxBid}</span>
              <span style={{fontSize:10,color:T.muted}}>MAX BID</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`}}>
        <Label style={{marginBottom:10}}>STATISTICS</Label>
        {isPitcher ? (
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[["ERA",player.era],["SO",player.so],["WHIP","—"]].map(([k,v])=>(
              <div key={k} style={{background:T.surface2,borderRadius:8,padding:"8px 10px"}}>
                <div style={{fontSize:9,color:T.muted,fontWeight:700,letterSpacing:"0.08em"}}>{k}</div>
                <div style={{fontSize:18,fontWeight:800,color:T.text}}>{v??<span style={{color:T.muted}}>—</span>}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {[["AVG",player.avg],["HR",player.hr],["RBI",player.rbi],["SB",player.sb]].map(([k,v])=>(
              <div key={k} style={{background:T.surface2,borderRadius:8,padding:"8px 8px"}}>
                <div style={{fontSize:9,color:T.muted,fontWeight:700,letterSpacing:"0.08em"}}>{k}</div>
                <div style={{fontSize:16,fontWeight:800,color:T.text}}>{v??<span style={{color:T.muted}}>—</span>}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Valuation bar */}
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <Label>TRUE DOLLAR VALUE · SCRUM-44</Label>
          <span style={{fontSize:11,color:T.green,fontWeight:800,fontFamily:font}}>${player.maxBid}</span>
        </div>
        <div style={{height:5,background:T.surface3,borderRadius:3}}>
          <div style={{height:"100%",borderRadius:3,
            background:`linear-gradient(90deg,${T.green},${T.cyan})`,
            width:`${Math.min((player.maxBid/70)*100,100)}%`}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          <span style={{fontSize:9,color:T.muted}}>$1</span>
          <span style={{fontSize:9,color:T.muted}}>$70</span>
        </div>
      </div>

      {/* News — SCRUM-39/50 */}
      {NEWS.filter(n=>n.player===player.name).length>0&&(
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
          <Label style={{marginBottom:8}}>LIVE NEWS · SCRUM-39/50</Label>
          {NEWS.filter(n=>n.player===player.name).map((n,i)=>(
            <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:5}}>
              <span style={{fontSize:13}}>{n.type==="injury"?"🚑":n.type==="trade"?"🔄":"📰"}</span>
              <div>
                <div style={{fontSize:11,color:T.text,lineHeight:1.4,fontFamily:font}}>{n.text}</div>
                <div style={{fontSize:10,color:T.muted,marginTop:1,fontFamily:font}}>{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes — SCRUM-52 */}
      <div style={{padding:"12px 16px"}}>
        <Label style={{marginBottom:8}}>MY NOTES · SCRUM-52</Label>
        <textarea value={note} onChange={e=>setNote(e.target.value)}
          placeholder="Add pre-draft notes, strategy reminders..."
          style={{
            width:"100%",minHeight:72,background:T.surface3,
            border:`1px solid ${T.border}`,borderRadius:8,
            color:T.text,fontFamily:font,fontSize:12,padding:"8px 10px",
            resize:"vertical",outline:"none",boxSizing:"border-box",
          }}/>
      </div>
    </div>
  );
}

/* ─── TOP NAV ────────────────────────────────────────────────────────── */
function TopNav({league,activeTab,setActiveTab,apiStatus}) {
  return (
    <div style={{
      height:52,background:T.surface,borderBottom:`1px solid ${T.border}`,
      display:"flex",alignItems:"center",padding:"0 20px",gap:0,
      fontFamily:font,position:"sticky",top:0,zIndex:200,
    }}>
      <div style={{marginRight:28,flexShrink:0}}>
        <div style={{fontSize:13,fontWeight:800,color:T.text,letterSpacing:"-0.01em"}}>{league.name}</div>
        <div style={{fontSize:9,color:T.muted,fontWeight:700,letterSpacing:"0.08em"}}>SEASON {league.year}</div>
      </div>
      <div style={{display:"flex",gap:2,flex:1,overflow:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            padding:"6px 14px",borderRadius:7,fontFamily:font,
            fontSize:11,fontWeight:activeTab===t.id?800:400,
            cursor:"pointer",whiteSpace:"nowrap",border:"none",
            background:activeTab===t.id?"rgba(52,199,89,0.14)":"transparent",
            color:activeTab===t.id?T.green:T.muted,
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:7,height:7,borderRadius:"50%",
            background:apiStatus?T.green:T.red,
            boxShadow:`0 0 6px ${apiStatus?T.green:T.red}`}}/>
          <span style={{fontSize:10,color:T.muted,fontWeight:700,fontFamily:font}}>
            API {apiStatus?"ONLINE":"OFFLINE"}
          </span>
        </div>
        <div style={{background:T.greenDim,border:"1px solid rgba(52,199,89,0.3)",
          borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:800,color:T.green,fontFamily:font}}>
          IN PROGRESS
        </div>
      </div>
    </div>
  );
}

function OwnerBanner({owner}) {
  return (
    <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,
      padding:"10px 20px",display:"flex",alignItems:"center",gap:16,fontFamily:font}}>
      <div>
        <Label>YOUR OWNER NAME</Label>
        <div style={{fontSize:18,fontWeight:800,color:T.text,marginTop:2}}>{owner.name}</div>
      </div>
      <div style={{background:T.greenDim,border:"1px solid rgba(52,199,89,0.3)",
        borderRadius:8,padding:"5px 14px",display:"flex",alignItems:"center",gap:6}}>
        <span style={{color:T.green,fontWeight:800,fontSize:12}}>✓ VERIFIED</span>
        <span style={{color:T.muted,fontSize:11}}>${owner.budget} budget</span>
      </div>
      <div style={{flex:1}}/>
      <div style={{textAlign:"center"}}>
        <Label>MARKET INFLATION · SCRUM-33</Label>
        <div style={{fontSize:13,fontWeight:800,color:"#ff9f0a",marginTop:2}}>+4.2%</div>
      </div>
      <div style={{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,
        padding:"5px 14px",fontSize:12,fontFamily:font}}>
        <span style={{color:T.muted}}>Current Turn: </span>
        <span style={{color:T.text,fontWeight:700}}>{owner.name}</span>
        <span style={{marginLeft:8,background:T.green,color:"#000",
          fontSize:9,fontWeight:800,padding:"2px 6px",borderRadius:4}}>IT'S YOUR TURN!</span>
      </div>
    </div>
  );
}

/* ═══ SCREEN: CREATE DRAFT ══════════════════════════════════════════════ */
function CreateDraftScreen({onStart}) {
  const [name,setName]     = useState("Valuation Test League");
  const [year,setYear]     = useState("2025");
  const [numOwners,setNumOwners] = useState("12");
  const [budget,setBudget] = useState("260");
  const [pool,setPool]     = useState("MLB (All)");

  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font}}>
      <div style={{width:520}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontSize:11,letterSpacing:"0.3em",color:T.green,fontWeight:800,marginBottom:10}}>DARK BLUE SOFTWARE SOLUTIONS</div>
          <div style={{fontSize:52,fontWeight:800,color:T.white,lineHeight:1,letterSpacing:"-0.03em"}}>
            AUCTION<br/><span style={{color:T.green}}>DRAFT KIT</span>
          </div>
          <div style={{color:T.muted,fontSize:13,marginTop:10,letterSpacing:"0.04em"}}>
            Fantasy Baseball · Dynamic Valuation Engine · v2.0
          </div>
        </div>
        <Card style={{padding:36,borderRadius:20}}>
          <div style={{fontSize:16,fontWeight:800,color:T.text,marginBottom:24,letterSpacing:"0.06em"}}>
            CREATE NEW DRAFT INSTANCE · SCRUM-27
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div><Label style={{marginBottom:6}}>LEAGUE NAME</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="My Fantasy League"/></div>
            <div><Label style={{marginBottom:6}}>SEASON YEAR</Label><Input value={year} onChange={e=>setYear(e.target.value)} placeholder="2025"/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><Label style={{marginBottom:6}}>OWNERS</Label><Input value={numOwners} onChange={e=>setNumOwners(e.target.value)} placeholder="12"/></div>
              <div><Label style={{marginBottom:6}}>BUDGET / OWNER</Label><Input value={budget} onChange={e=>setBudget(e.target.value)} placeholder="260"/></div>
            </div>
            <div>
              <Label style={{marginBottom:8}}>PLAYER POOL · SCRUM-28</Label>
              <div style={{display:"flex",gap:8}}>
                {["MLB (All)","AL Only","NL Only"].map(opt=>(
                  <button key={opt} onClick={()=>setPool(opt)} style={{
                    flex:1,padding:"8px 0",borderRadius:8,fontFamily:font,
                    fontSize:12,fontWeight:700,cursor:"pointer",
                    background:pool===opt?T.greenDim:T.surface3,
                    color:pool===opt?T.green:T.muted,
                    border:`1px solid ${pool===opt?"rgba(52,199,89,0.3)":T.border}`,
                  }}>{opt}</button>
                ))}
              </div>
            </div>
          </div>
          <Btn onClick={()=>onStart({name,year,owners:parseInt(numOwners),budget:parseInt(budget)})}
            style={{width:"100%",marginTop:28,padding:"14px 0",fontSize:15,borderRadius:12,letterSpacing:"0.08em"}}>
            INITIALIZE DRAFT →
          </Btn>
          <div style={{marginTop:14,textAlign:"center",fontSize:11,color:T.muted}}>
            SCRUM-29: ~1,200 player pool auto-populated on initialization
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ═══ SCREEN: KEEPER SETUP ══════════════════════════════════════════════ */
function KeeperScreen({owners,onDone}) {
  const [keepers,setKeepers] = useState([]);
  const [owner,setOwner]     = useState(0);
  const [player,setPlayer]   = useState("");
  const [cost,setCost]       = useState("");

  const add = () => {
    if (!player||!cost) return;
    setKeepers(p=>[...p,{ownerId:owner+1,ownerName:owners[owner].name,player,cost:parseInt(cost)}]);
    setPlayer(""); setCost("");
  };

  return (
    <div style={{padding:28,fontFamily:font}}>
      <div style={{fontSize:26,fontWeight:800,color:T.text,letterSpacing:"0.04em",marginBottom:4}}>
        PRE-DRAFT KEEPER INITIALIZATION · SCRUM-41
      </div>
      <div style={{color:T.muted,fontSize:13,marginBottom:24}}>
        Enter keeper contracts. Budgets and roster slots auto-adjust per owner.
      </div>
      <div style={{display:"grid",gridTemplateColumns:"380px 1fr",gap:20}}>
        <Card style={{padding:24}}>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:16,letterSpacing:"0.08em"}}>ADD KEEPER CONTRACT</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <Label style={{marginBottom:6}}>OWNER</Label>
              <select value={owner} onChange={e=>setOwner(parseInt(e.target.value))} style={{
                background:T.surface3,border:`1px solid ${T.border}`,borderRadius:8,
                color:T.text,fontFamily:font,fontSize:13,padding:"8px 12px",width:"100%",outline:"none",
              }}>
                {owners.map((o,i)=><option key={i} value={i}>{o.name}</option>)}
              </select>
            </div>
            <div><Label style={{marginBottom:6}}>PLAYER NAME</Label><Input value={player} onChange={e=>setPlayer(e.target.value)} placeholder="e.g. Shohei Ohtani"/></div>
            <div><Label style={{marginBottom:6}}>CONTRACT COST ($)</Label><Input value={cost} onChange={e=>setCost(e.target.value)} placeholder="e.g. 25"/></div>
            <Btn onClick={add}>ADD KEEPER</Btn>
          </div>
          {keepers.length>0&&(
            <div style={{marginTop:20}}>
              <Label style={{marginBottom:10}}>ENTERED KEEPERS</Label>
              {keepers.map((k,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div>
                    <div style={{fontSize:13,color:T.text,fontWeight:700}}>{k.player}</div>
                    <div style={{fontSize:11,color:T.muted}}>{k.ownerName}</div>
                  </div>
                  <span style={{color:T.green,fontWeight:800,fontSize:16}}>${k.cost}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <div>
          <Label style={{marginBottom:12}}>ADJUSTED STARTING BUDGETS</Label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {owners.map(o=>{
              const ks=keepers.filter(k=>k.ownerId===o.id);
              const spend=ks.reduce((s,k)=>s+k.cost,0);
              return (
                <Card key={o.id} style={{padding:14,borderRadius:12}}>
                  <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:4}}>{o.name}</div>
                  <div style={{fontSize:11,color:T.muted}}>{ks.length} keeper{ks.length!==1?"s":""}</div>
                  <div style={{marginTop:8,display:"flex",justifyContent:"space-between"}}>
                    <div><div style={{fontSize:9,color:T.muted}}>DEDUCTED</div><div style={{color:T.red,fontWeight:800,fontFamily:font}}>-${spend}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:9,color:T.muted}}>STARTS WITH</div><div style={{color:T.green,fontWeight:800,fontFamily:font}}>${o.budget-spend}</div></div>
                  </div>
                </Card>
              );
            })}
          </div>
          <Btn onClick={onDone} style={{marginTop:20,padding:"12px 24px"}}>
            FINALIZE KEEPERS & START DRAFT →
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══ SCREEN: DRAFT BOARD ════════════════════════════════════════════════ */
function DraftBoardScreen({owners,players,myOwnerIdx}) {
  const [cursorPlayer,setCursorPlayer] = useState(PLAYERS[4]); // Gerrit Cole default
  const [search,setSearch]             = useState("");
  const [showBid,setShowBid]           = useState(false);
  const [taxiMode,setTaxiMode]         = useState(false);

  const myOwner = owners[myOwnerIdx];
  const maxBid  = myOwner.budget - myOwner.spent - (myOwner.roster.filter(s=>!s.player).length - 1);
  const available = players.filter(p=>!p.drafted&&
    (search===""||p.name.toLowerCase().includes(search.toLowerCase())||p.team.toLowerCase().includes(search.toLowerCase())));
  const suggestions = [...players].filter(p=>!p.drafted).sort((a,b)=>b.maxBid-a.maxBid).slice(0,4);

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 340px",height:"calc(100vh - 102px)",overflow:"hidden"}}>

      {/* LEFT */}
      <div style={{overflow:"auto",padding:18,display:"flex",flexDirection:"column",gap:14}}>

        {/* Turn banner */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,
          padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:T.green,boxShadow:`0 0 8px ${T.green}`}}/>
            <span style={{fontSize:12,color:T.muted,fontFamily:font}}>Current Turn:</span>
            <span style={{fontSize:12,color:T.text,fontWeight:700,fontFamily:font}}>{myOwner.name}</span>
            <GreenPill>IT'S YOUR TURN!</GreenPill>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn variant="ghost" style={{fontSize:10,padding:"4px 10px"}}>↩ UNDO · SCRUM-31</Btn>
            {!taxiMode
              ? <Btn variant="ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setTaxiMode(true)}>🚕 TAXI MODE · SCRUM-36</Btn>
              : <span style={{background:T.blue,color:T.white,fontSize:10,fontWeight:800,padding:"4px 12px",borderRadius:6,fontFamily:font}}>🚕 TAXI SQUAD ACTIVE</span>
            }
          </div>
        </div>

        {/* Current Auction + Nominate row */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {/* Current Auction */}
          <Card style={{padding:18}}>
            <Label style={{marginBottom:10}}>◄ CURRENT AUCTION · SCRUM-42</Label>
            <div style={{background:`linear-gradient(135deg,${T.goldBg},#1a1400)`,
              border:`1px solid ${T.gold}44`,borderRadius:12,padding:"12px 16px",marginBottom:12}}>
              <div style={{fontSize:18,fontWeight:800,color:T.white,fontFamily:font}}>Gerrit Cole</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontFamily:font,marginTop:2}}>Nominated by Owner 2</div>
            </div>
            <div style={{textAlign:"center",marginBottom:10}}>
              <Label style={{marginBottom:4}}>CURRENT BID</Label>
              <div style={{fontSize:40,fontWeight:800,color:T.white,fontFamily:font}}>$11</div>
              <div style={{fontSize:12,color:T.muted,fontFamily:font}}>by <span style={{color:T.green}}>Owner 3</span></div>
            </div>
            {/* SCRUM-32 */}
            <div style={{background:"rgba(255,159,10,0.1)",border:"1px solid rgba(255,159,10,0.25)",
              borderRadius:8,padding:"5px 10px",marginBottom:10}}>
              <div style={{fontSize:10,color:"#ff9f0a",fontWeight:700,fontFamily:font}}>⚠ SCRUM-32: SP — 1/2 slots filled</div>
            </div>
            <Btn onClick={()=>setShowBid(true)} style={{width:"100%",padding:"10px 0"}}>🔥 PLACE BID</Btn>
          </Card>

          {/* Nominate + AI Suggestions */}
          <Card style={{padding:18}}>
            <Label style={{marginBottom:10}}>📋 NOMINATE · SCRUM-47 AI SUGGESTIONS</Label>
            {suggestions.map(p=>(
              <div key={p.id} onClick={()=>setCursorPlayer(p)} style={{
                display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"8px 12px",background:T.surface2,borderRadius:8,marginBottom:6,
                cursor:"pointer",border:`1px solid ${cursorPlayer?.id===p.id?"rgba(52,199,89,0.3)":T.border}`,
              }}>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:T.text,fontFamily:font}}>{p.name}</div>
                  <div style={{display:"flex",gap:4,marginTop:3}}>{p.pos.slice(0,2).map(po=><PosBadge key={po} pos={po}/>)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:15,fontWeight:800,color:T.green,fontFamily:font}}>${p.maxBid}</div>
                  <TierBadge tier={p.tier}/>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Roster Gap Matrix — SCRUM-43 */}
        <Card style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:800,color:T.text,fontFamily:font,letterSpacing:"0.04em"}}>
              OPPONENT ROSTER GAPS MATRIX · SCRUM-43
            </div>
            <div style={{fontSize:11,color:"#ff9f0a",fontWeight:700,fontFamily:font}}>📈 Inflation: +4.2% · SCRUM-33</div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:font}}>
              <thead>
                <tr>
                  <th style={{padding:"5px 10px",textAlign:"left",color:T.muted,fontWeight:700,borderBottom:`1px solid ${T.border}`}}>OWNER</th>
                  <th style={{padding:"5px 8px",color:T.muted,fontWeight:700,borderBottom:`1px solid ${T.border}`}}>$LEFT</th>
                  {["C","1B","2B","3B","SS","OF","SP","RP","UTIL"].map(p=>(
                    <th key={p} style={{padding:"5px 8px",color:T.muted,fontWeight:700,borderBottom:`1px solid ${T.border}`}}>{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {owners.map((o,i)=>{
                  const isMe=i===myOwnerIdx;
                  return (
                    <tr key={o.id} style={{background:isMe?"rgba(52,199,89,0.05)":"transparent"}}>
                      <td style={{padding:"6px 10px",color:isMe?T.green:T.text,fontWeight:isMe?800:400}}>
                        {isMe?"★ ":""}{o.name}
                      </td>
                      <td style={{padding:"6px 8px",textAlign:"center",color:T.green,fontWeight:700}}>${o.budget-o.spent}</td>
                      {["C","1B","2B","3B","SS","OF","SP","RP","UTIL"].map(pos=>{
                        const filled=o.roster.filter(s=>s.pos===pos&&s.player).length;
                        const total=o.roster.filter(s=>s.pos===pos).length;
                        const empty=total-filled;
                        return (
                          <td key={pos} style={{padding:"6px 8px",textAlign:"center"}}>
                            {empty>0
                              ? <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
                                  width:20,height:20,background:T.redDim,border:"1px solid rgba(255,59,48,0.3)",
                                  borderRadius:4,fontSize:10,color:T.red,fontWeight:700}}>{empty}</span>
                              : <span style={{fontSize:12,color:"rgba(52,199,89,0.4)"}}>✓</span>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Player search — SCRUM-30 */}
        <Card style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:800,color:T.text,fontFamily:font}}>PLAYER SEARCH · SCRUM-30</div>
            <span style={{fontSize:11,color:T.muted,fontFamily:font}}>{available.length} available</span>
          </div>
          <Input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Type name or team for autocomplete..." style={{marginBottom:12}}/>
          <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:260,overflow:"auto"}}>
            {available.slice(0,10).map(p=>(
              <div key={p.id} onClick={()=>setCursorPlayer(p)} style={{
                display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"9px 12px",borderRadius:10,cursor:"pointer",
                background:cursorPlayer?.id===p.id?"rgba(52,199,89,0.08)":T.surface2,
                border:`1px solid ${cursorPlayer?.id===p.id?"rgba(52,199,89,0.3)":T.border}`,
              }}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{width:30,height:30,borderRadius:8,
                    background:"linear-gradient(135deg,#1e3a5f,#0d1b2a)",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🧑</div>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:T.text,fontFamily:font}}>{p.name}</div>
                    <div style={{display:"flex",gap:4,marginTop:2}}>
                      {p.pos.slice(0,2).map(po=><PosBadge key={po} pos={po}/>)}
                      <span style={{fontSize:10,color:T.muted,fontFamily:font}}>{p.team}</span>
                      {p.injury&&<span style={{fontSize:9,color:T.red,fontWeight:700}}>⚠ {p.injury}</span>}
                    </div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:14,fontWeight:800,color:T.green,fontFamily:font}}>${p.maxBid}</div>
                  <TierBadge tier={p.tier}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* RIGHT SIDEBAR */}
      <div style={{borderLeft:`1px solid ${T.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Budget */}
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <div>
              <Label>YOUR BUDGET</Label>
              <div style={{fontSize:24,fontWeight:800,color:T.green,fontFamily:font}}>${myOwner.budget-myOwner.spent}</div>
              <div style={{fontSize:10,color:T.muted,fontFamily:font}}>max bid: <span style={{color:T.green}}>${maxBid}</span></div>
            </div>
            <div style={{textAlign:"right"}}>
              <Label>SLOTS LEFT</Label>
              <div style={{fontSize:24,fontWeight:800,color:T.text,fontFamily:font}}>{myOwner.roster.filter(s=>!s.player).length}</div>
            </div>
          </div>
          <div style={{marginTop:8,height:4,background:T.surface3,borderRadius:2}}>
            <div style={{height:"100%",borderRadius:2,background:T.green,
              width:`${((myOwner.budget-myOwner.spent)/myOwner.budget)*100}%`}}/>
          </div>
        </div>

        {/* My Roster */}
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`}}>
          <Label style={{marginBottom:7}}>MY ROSTER</Label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
            {myOwner.roster.slice(0,10).map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 7px",borderRadius:6,
                background:s.player?"rgba(52,199,89,0.07)":T.surface2,
                border:`1px solid ${s.player?"rgba(52,199,89,0.15)":T.border}`}}>
                <span style={{fontSize:8,fontWeight:800,color:T.muted,minWidth:20,fontFamily:font}}>{s.pos}</span>
                <span style={{fontSize:10,color:s.player?T.text:T.muted,flex:1,overflow:"hidden",
                  textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:font}}>
                  {s.player?s.player.name:"—"}
                </span>
                {s.player&&<span style={{fontSize:9,color:T.green,fontWeight:700,fontFamily:font}}>${s.player.cost}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Baseball Card — SCRUM-62 */}
        <div style={{flex:1,overflow:"auto"}}>
          <div style={{padding:"8px 16px",borderBottom:`1px solid ${T.border}`,
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <Label>CURRENT PLAYER CARD · SCRUM-62</Label>
            {cursorPlayer&&<TierBadge tier={cursorPlayer.tier}/>}
          </div>
          <BaseballCard player={cursorPlayer}/>
        </div>
      </div>

      {/* Bid Modal */}
      {showBid&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,fontFamily:font}}>
          <div style={{background:T.goldBg,border:`2px solid ${T.gold}`,borderRadius:20,
            padding:32,width:420,boxShadow:`0 0 60px rgba(201,149,26,0.3)`}}>
            <div style={{background:T.gold,borderRadius:12,padding:"14px 20px",marginBottom:20,textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:800,color:T.white}}>Gerrit Cole</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:2}}>Nominated by Owner 2</div>
            </div>
            <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:18,marginBottom:14,textAlign:"center"}}>
              <Label style={{marginBottom:4}}>CURRENT BID</Label>
              <div style={{fontSize:48,fontWeight:800,color:T.white}}>$11</div>
              <div style={{fontSize:13,color:T.muted}}>by <span style={{color:T.green}}>Owner 3</span></div>
            </div>
            <Label style={{marginBottom:8}}>YOUR BID (minimum: $12)</Label>
            <Input value="12" onChange={()=>{}} style={{fontSize:20,textAlign:"center",fontWeight:700,marginBottom:12}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
              {[1,5,10].map(n=>(
                <button key={n} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,
                  color:T.text,fontFamily:font,fontSize:13,fontWeight:700,borderRadius:8,padding:"8px 0",cursor:"pointer"}}>+${n}</button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
              <Btn style={{padding:"12px 0"}}>🔥 Place Bid</Btn>
              <Btn variant="cyan" onClick={()=>setShowBid(false)} style={{padding:"12px 16px"}}>✓ Sold!</Btn>
            </div>
            <div style={{marginTop:12,padding:"8px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8,
              display:"flex",justifyContent:"space-between",fontSize:11}}>
              <span style={{color:T.muted,fontFamily:font}}>Remaining: <span style={{color:T.text}}>${myOwner.budget-myOwner.spent}</span></span>
              <span style={{color:T.muted,fontFamily:font}}>Max Bid: <span style={{color:T.green}}>${maxBid}</span></span>
            </div>
            <button onClick={()=>setShowBid(false)} style={{marginTop:10,background:"none",border:"none",
              color:T.muted,fontFamily:font,fontSize:12,cursor:"pointer",width:"100%"}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ SCREEN: PLAYER DICTIONARY ════════════════════════════════════════ */
function PlayerDictionaryScreen() {
  const [search,setSearch]   = useState("");
  const [pos,setPos]         = useState("ALL");
  const [tier,setTier]       = useState("ALL");
  const [selected,setSelected] = useState(PLAYERS[0]);

  const positions = ["ALL","C","1B","2B","3B","SS","OF","SP","RP","DH"];
  const tiers     = ["ALL","Elite","Starter","Bench"];
  const filtered  = PLAYERS.filter(p=>{
    const ms=p.name.toLowerCase().includes(search.toLowerCase())||p.team.toLowerCase().includes(search.toLowerCase());
    const mp=pos==="ALL"||p.pos.includes(pos);
    const mt=tier==="ALL"||p.tier===tier;
    return ms&&mp&&mt;
  });

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 360px",height:"calc(100vh - 102px)",overflow:"hidden",fontFamily:font}}>
      <div style={{overflow:"auto",padding:20}}>
        <div style={{fontSize:24,fontWeight:800,color:T.text,letterSpacing:"0.04em",marginBottom:4}}>PLAYER DICTIONARY</div>
        <div style={{color:T.muted,fontSize:12,marginBottom:18}}>SCRUM-48 · Browse, filter, and sort the full player pool. Click for baseball card.</div>

        <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or team..." style={{maxWidth:250}}/>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {positions.map(p=>(
              <button key={p} onClick={()=>setPos(p)} style={{
                padding:"5px 10px",borderRadius:6,fontFamily:font,fontSize:10,fontWeight:700,cursor:"pointer",
                background:pos===p?T.greenDim:T.surface2,color:pos===p?T.green:T.muted,
                border:`1px solid ${pos===p?"rgba(52,199,89,0.3)":T.border}`,
              }}>{p}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:4}}>
            {tiers.map(t=>(
              <button key={t} onClick={()=>setTier(t)} style={{
                padding:"5px 10px",borderRadius:6,fontFamily:font,fontSize:10,fontWeight:700,cursor:"pointer",
                background:tier===t?"rgba(201,149,26,0.15)":T.surface2,
                color:tier===t?T.gold:T.muted,
                border:`1px solid ${tier===t?"rgba(201,149,26,0.3)":T.border}`,
              }}>{t}</button>
            ))}
          </div>
          <span style={{marginLeft:"auto",fontSize:11,color:T.muted}}>{filtered.length} players</span>
        </div>

        {/* SCRUM-34: Grouped by tier */}
        {["Elite","Starter","Bench"].map(tierName=>{
          const group=filtered.filter(p=>p.tier===tierName);
          if(!group.length) return null;
          return (
            <div key={tierName}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,marginTop:16}}>
                <TierBadge tier={tierName}/>
                <div style={{flex:1,height:1,background:T.border}}/>
                <span style={{fontSize:10,color:T.muted}}>{group.length} players</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:4}}>
                {group.map(p=>(
                  <div key={p.id} onClick={()=>setSelected(p)} style={{
                    padding:"12px 14px",borderRadius:12,cursor:"pointer",
                    background:selected?.id===p.id?"rgba(52,199,89,0.08)":T.surface,
                    border:`2px solid ${selected?.id===p.id?T.green:T.border}`,
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:2}}>{p.name}</div>
                        <div style={{fontSize:10,color:T.muted,marginBottom:5}}>{p.team} · {p.league}</div>
                        <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                          {p.pos.map(po=><PosBadge key={po} pos={po}/>)}
                        </div>
                        {p.injury&&<div style={{fontSize:9,color:T.red,fontWeight:700,marginTop:4}}>⚠ {p.injury}</div>}
                        {p.note&&<div style={{fontSize:10,color:"#ff9f0a",marginTop:3}}>📝 {p.note.slice(0,28)}…</div>}
                      </div>
                      <div style={{textAlign:"right",marginLeft:8}}>
                        <div style={{fontSize:20,fontWeight:800,color:p.drafted?T.muted:T.green}}>${p.maxBid}</div>
                        {p.drafted&&<div style={{fontSize:9,color:T.red,fontWeight:700}}>DRAFTED</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: Baseball Card */}
      <div style={{borderLeft:`1px solid ${T.border}`,overflow:"auto"}}>
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <Label>PLAYER CARD · SCRUM-62</Label>
          {selected&&<TierBadge tier={selected.tier}/>}
        </div>
        <BaseballCard player={selected}/>
      </div>
    </div>
  );
}

/* ═══ SCREEN: ROSTERS ════════════════════════════════════════════════════ */
function RostersScreen({owners}) {
  return (
    <div style={{padding:24,fontFamily:font,overflow:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <div style={{fontSize:24,fontWeight:800,color:T.text,letterSpacing:"0.04em"}}>TEAM ROSTERS</div>
          <div style={{color:T.muted,fontSize:12,marginTop:2}}>SCRUM-49 · Click any slot to manually override (Commissioner mode)</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="secondary" style={{fontSize:11}}>📥 Export CSV · SCRUM-37</Btn>
          <Btn variant="secondary" style={{fontSize:11}}>🚕 Taxi Squad · SCRUM-45</Btn>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {owners.map(o=>{
          const spent=o.spent;
          const filled=o.roster.filter(s=>s.player).length;
          const maxBid=o.budget-spent-(o.roster.length-filled-1);
          return (
            <Card key={o.id} style={{padding:16,borderRadius:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:14,fontWeight:800,color:T.text}}>{o.name}</div>
                <span style={{fontSize:11,color:T.green,fontWeight:800,fontFamily:font}}>${o.budget-spent}</span>
              </div>
              <div style={{fontSize:10,color:T.muted,marginBottom:2,fontFamily:font}}>
                Slots: {o.roster.length-filled} empty · Max Bid: <span style={{color:T.green}}>${maxBid}</span>
              </div>
              <div style={{height:3,background:T.surface3,borderRadius:2,marginBottom:12}}>
                <div style={{height:"100%",borderRadius:2,background:T.green,width:`${((o.budget-spent)/o.budget)*100}%`}}/>
              </div>
              {o.roster.filter(s=>s.player).map((s,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"5px 8px",background:"rgba(52,199,89,0.07)",borderRadius:6,marginBottom:3}}>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <PosBadge pos={s.pos}/>
                    <span style={{fontSize:11,color:T.text,fontFamily:font}}>{s.player.name}</span>
                  </div>
                  <span style={{fontSize:11,color:T.green,fontWeight:700,fontFamily:font}}>${s.player.cost}</span>
                </div>
              ))}
              {!o.roster.some(s=>s.player)&&(
                <div style={{textAlign:"center",padding:"14px 0",color:T.muted,fontSize:12,fontFamily:font}}>No players yet</div>
              )}
              <button style={{marginTop:10,width:"100%",padding:"6px 0",background:"transparent",
                border:`1px dashed ${T.border}`,borderRadius:8,color:T.muted,fontFamily:font,fontSize:11,cursor:"pointer"}}>
                + Override / Add Player · SCRUM-49
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ SCREEN: LEAGUE SETTINGS ════════════════════════════════════════════ */
const H_CATS=["R","H","HR","RBI","SB","AVG","OBP","BB","TB","XBH"];
const P_CATS=["W","SV","ERA","WHIP","SO","HLD","K/9","BB/9","QS"];

function SettingsScreen() {
  const [active,setActive] = useState({R:true,H:true,HR:true,RBI:true,SB:true,AVG:true,W:true,SV:true,ERA:true,WHIP:true,SO:true});
  const [slots,setSlots]   = useState({C:1,"1B":1,"2B":1,"3B":1,SS:1,OF:3,SP:2,RP:2,UTIL:1,BN:2,TAXI:3});

  return (
    <div style={{padding:24,fontFamily:font,overflow:"auto",maxWidth:1200}}>
      <div style={{fontSize:24,fontWeight:800,color:T.text,letterSpacing:"0.04em",marginBottom:4}}>LEAGUE SETTINGS</div>
      <div style={{color:T.muted,fontSize:12,marginBottom:24}}>SCRUM-28 + 46 · Budget, roster, scoring categories, and player pool.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <Card style={{padding:24}}>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:4}}>SCORING CATEGORIES · SCRUM-46</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:16}}>Active categories weighted equally in Valuation API.</div>
          <Label style={{marginBottom:8}}>HITTING</Label>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:18}}>
            {H_CATS.map(c=>(
              <button key={c} onClick={()=>setActive(p=>({...p,[c]:!p[c]}))} style={{
                padding:"6px 12px",borderRadius:6,fontFamily:font,fontSize:12,fontWeight:700,cursor:"pointer",
                background:active[c]?T.greenDim:T.surface3,color:active[c]?T.green:T.muted,
                border:`1px solid ${active[c]?"rgba(52,199,89,0.3)":T.border}`,
              }}>{c}</button>
            ))}
          </div>
          <Label style={{marginBottom:8}}>PITCHING</Label>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {P_CATS.map(c=>(
              <button key={c} onClick={()=>setActive(p=>({...p,[c]:!p[c]}))} style={{
                padding:"6px 12px",borderRadius:6,fontFamily:font,fontSize:12,fontWeight:700,cursor:"pointer",
                background:active[c]?"rgba(0,229,255,0.1)":T.surface3,color:active[c]?T.cyan:T.muted,
                border:`1px solid ${active[c]?"rgba(0,229,255,0.25)":T.border}`,
              }}>{c}</button>
            ))}
          </div>
        </Card>
        <Card style={{padding:24}}>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:4}}>ROSTER CONFIGURATION</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:16}}>Taxi slots use $1 fixed cost (SCRUM-45).</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {Object.entries(slots).map(([pos,count])=>(
              <div key={pos} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                background:T.surface2,borderRadius:8,padding:"8px 12px"}}>
                <span style={{fontSize:13,color:T.text,fontWeight:700,fontFamily:font}}>{pos}</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={()=>setSlots(p=>({...p,[pos]:Math.max(0,p[pos]-1)}))}
                    style={{background:T.border,border:"none",color:T.text,borderRadius:4,width:22,height:22,cursor:"pointer",fontSize:14}}>−</button>
                  <span style={{color:T.green,fontWeight:800,minWidth:14,textAlign:"center",fontFamily:font}}>{count}</span>
                  <button onClick={()=>setSlots(p=>({...p,[pos]:p[pos]+1}))}
                    style={{background:T.border,border:"none",color:T.text,borderRadius:4,width:22,height:22,cursor:"pointer",fontSize:14}}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{marginTop:14,padding:12,background:T.surface2,borderRadius:8,display:"flex",justifyContent:"space-between"}}>
            <span style={{color:T.muted,fontSize:12,fontFamily:font}}>TOTAL SLOTS</span>
            <span style={{color:T.green,fontWeight:800,fontFamily:font}}>{Object.values(slots).reduce((a,b)=>a+b,0)}</span>
          </div>
          <Btn style={{marginTop:14,width:"100%"}}>SAVE SETTINGS</Btn>
        </Card>
      </div>
    </div>
  );
}

/* ═══ SCREEN: API SANDBOX ════════════════════════════════════════════════ */
const SAMPLE_PAYLOAD=`{
  "license_key": "DB-2026-XXXX-XXXX",
  "draft_state": {
    "total_teams": 12,
    "budget_per_team": 260,
    "scoring_categories": ["HR","RBI","AVG","SB","ERA","SO","WHIP"],
    "teams": [
      { "id": 1, "budget_remaining": 248, "roster": ["Garrett Crochet"] }
    ],
    "nominated_player": "Gerrit Cole"
  }
}`;
const SAMPLE_RESPONSE=`{
  "player": "Gerrit Cole",
  "true_dollar_value": 38,
  "max_bid_recommendation": 35,
  "market_inflation": 1.042,
  "scarcity_tier": "Starter",
  "position_scarcity": { "SP": "HIGH" },
  "draftability_score": 0.87,
  "reasoning": "SP scarce — 9/12 teams need ≥1 SP. Inflation +4.2%."
}`;

function ApiSandboxScreen() {
  const [payload,setPayload] = useState(SAMPLE_PAYLOAD);
  const [response,setResponse] = useState("");
  const [ran,setRan] = useState(false);

  return (
    <div style={{padding:24,fontFamily:font,overflow:"auto",maxWidth:1200}}>
      <div style={{fontSize:24,fontWeight:800,color:T.text,letterSpacing:"0.04em",marginBottom:4}}>API TESTING SANDBOX</div>
      <div style={{color:T.muted,fontSize:12,marginBottom:20}}>SCRUM-63 · Paste draft-state JSON and test valuation API interactively.</div>
      <Card style={{padding:16,marginBottom:20,borderRadius:12}}>
        <div style={{display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <Label style={{marginBottom:4}}>ENDPOINT · SCRUM-58</Label>
            <div style={{fontFamily:"monospace",fontSize:12,color:T.cyan,background:T.surface2,padding:"5px 10px",borderRadius:6}}>
              POST https://api.darkblue.io/v1/valuate
            </div>
          </div>
          <div>
            <Label style={{marginBottom:4}}>AUTH · SCRUM-59</Label>
            <div style={{fontFamily:"monospace",fontSize:12,color:"#ff9f0a",background:T.surface2,padding:"5px 10px",borderRadius:6}}>
              X-License-Key: DB-2026-XXXX-XXXX
            </div>
          </div>
          <div style={{marginLeft:"auto"}}>
            <Label style={{marginBottom:4}}>STATUS</Label>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:T.green,boxShadow:`0 0 6px ${T.green}`}}/>
              <span style={{color:T.green,fontWeight:800,fontSize:12,fontFamily:font}}>ONLINE</span>
            </div>
          </div>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div>
          <Label style={{marginBottom:8}}>REQUEST PAYLOAD · SCRUM-60 Stateless Sync</Label>
          <textarea value={payload} onChange={e=>setPayload(e.target.value)} style={{
            width:"100%",height:320,background:T.surface2,border:`1px solid ${T.border}`,
            borderRadius:12,color:T.cyan,fontFamily:"monospace",fontSize:12,
            padding:16,resize:"none",outline:"none",boxSizing:"border-box",lineHeight:1.6,
          }}/>
          <Btn onClick={()=>{setResponse(SAMPLE_RESPONSE);setRan(true);}} style={{marginTop:10,width:"100%",padding:"12px 0"}}>
            ▶ SEND REQUEST
          </Btn>
        </div>
        <div>
          <Label style={{marginBottom:8}}>API RESPONSE</Label>
          <div style={{height:320,background:T.surface2,
            border:`1px solid ${ran?"rgba(52,199,89,0.3)":T.border}`,
            borderRadius:12,padding:16,fontFamily:"monospace",fontSize:12,
            color:ran?T.green:T.muted,overflow:"auto",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
            {ran?response:"// Response will appear here..."}
          </div>
          {ran&&(
            <div style={{marginTop:10,padding:12,background:"rgba(52,199,89,0.06)",
              border:"1px solid rgba(52,199,89,0.2)",borderRadius:10}}>
              <div style={{fontSize:12,color:T.green,fontWeight:700,fontFamily:font}}>✓ 200 OK · 42ms</div>
              <div style={{fontSize:11,color:T.muted,fontFamily:font,marginTop:2}}>Max Bid: $35 · Inflation: +4.2% · Tier: Starter</div>
            </div>
          )}
        </div>
      </div>
      <Card style={{marginTop:20,padding:20,borderRadius:14}}>
        <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:12}}>API LICENSING DOCS · SCRUM-59</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {[
            {t:"Register",d:"Obtain a license key via Dark Blue developer portal. Tier-based (Hobby/Pro/Enterprise)."},
            {t:"Authenticate",d:"Include X-License-Key on every request. Invalid or missing key returns HTTP 401."},
            {t:"Send State",d:"POST full draft-state JSON each request. API is stateless — your app owns the state (SCRUM-60)."},
          ].map(d=>(
            <div key={d.t} style={{background:T.surface2,borderRadius:10,padding:14}}>
              <div style={{fontSize:12,fontWeight:800,color:T.green,marginBottom:6,fontFamily:font}}>{d.t}</div>
              <div style={{fontSize:11,color:T.muted,lineHeight:1.6,fontFamily:font}}>{d.d}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ═══ ROOT ═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [phase,setPhase]       = useState("create");
  const [league,setLeague]     = useState(null);
  const [activeTab,setActiveTab] = useState("draft");
  const myOwnerIdx = 2;

  if (phase==="create") return <CreateDraftScreen onStart={l=>{setLeague(l);setPhase("keepers");}}/>;

  if (phase==="keepers") return (
    <div style={{minHeight:"100vh",background:T.bg}}>
      <div style={{height:52,background:T.surface,borderBottom:`1px solid ${T.border}`,
        display:"flex",alignItems:"center",padding:"0 20px",fontFamily:font}}>
        <div style={{fontSize:13,fontWeight:800,color:T.text}}>{league?.name}</div>
        <div style={{marginLeft:10,fontSize:10,color:T.green,fontWeight:700,letterSpacing:"0.08em"}}>· KEEPER SETUP · SCRUM-41</div>
      </div>
      <KeeperScreen owners={OWNERS} onDone={()=>setPhase("draft")}/>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text}}>
      <TopNav league={league||{name:"Valuation Test League",year:"2025"}} activeTab={activeTab} setActiveTab={setActiveTab} apiStatus={true}/>
      <OwnerBanner owner={OWNERS[myOwnerIdx]}/>
      {activeTab==="draft"    && <DraftBoardScreen owners={OWNERS} players={PLAYERS} myOwnerIdx={myOwnerIdx}/>}
      {activeTab==="players"  && <PlayerDictionaryScreen/>}
      {activeTab==="rosters"  && <RostersScreen owners={OWNERS}/>}
      {activeTab==="settings" && <SettingsScreen/>}
      {activeTab==="keepers"  && <KeeperScreen owners={OWNERS} onDone={()=>{}}/>}
      {activeTab==="api"      && <ApiSandboxScreen/>}
    </div>
  );
}