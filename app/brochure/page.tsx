"use client";

const features = [
  {
    title: "Game Organisation",
    desc: "Stableford, Medal & multi-round competitions. Manage tee times, pairings and courses.",
    icon: <svg width="18" height="18" fill="none" stroke="#1a3a2a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    title: "Live Scoring",
    desc: "Hole-by-hole entry by captains. Live leaderboards update in real time for all members.",
    icon: <svg width="18" height="18" fill="none" stroke="#1a3a2a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  },
  {
    title: "Handicap Calculation",
    desc: "Playing handicaps auto-calculated per format. Points and net scores computed instantly.",
    icon: <svg width="18" height="18" fill="none" stroke="#1a3a2a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    title: "Multi-Round Events",
    desc: "Weekend tournaments with cumulative leaderboards and per-round score breakdowns.",
    icon: <svg width="18" height="18" fill="none" stroke="#1a3a2a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
  },
  {
    title: "Member Profiles",
    desc: "Every member has a profile with handicap history, stats, past results and fixtures.",
    icon: <svg width="18" height="18" fill="none" stroke="#1a3a2a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    title: "Captain Workflow",
    desc: "Captains manage fourballs, enter scores and finalise with a review-and-approval flow.",
    icon: <svg width="18" height="18" fill="none" stroke="#1a3a2a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
];

const steps = [
  { n: "1", title: "Create Game", body: "Set format, course, date and players." },
  { n: "2", title: "Generate Pairings", body: "Fourballs and captains assigned instantly." },
  { n: "3", title: "Score Live", body: "Captains enter hole scores from their phones." },
  { n: "4", title: "Finalise Results", body: "Captain reviews, approves and publishes." },
];

const benefits = [
  { title: "No app install needed", body: "Works in any smartphone browser — nothing to download." },
  { title: "Real-time leaderboard", body: "Members and spectators follow the round live." },
  { title: "Captain score approval", body: "Scorecards are locked after captain sign-off." },
  { title: "Your club, your branding", body: "Club names, logos and full member management." },
  { title: "Multi-club ready", body: "One platform, multiple clubs and societies." },
];

export default function BrochurePage() {
  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #b0a898; padding: 30px 0; min-height: 100vh; }
          .a4 { box-shadow: 0 8px 48px rgba(0,0,0,0.3); }
        }
        .a4 {
          width: 210mm;
          height: 297mm;
          margin: 0 auto;
          background: #f7f4ef;
          font-family: 'Helvetica Neue', Arial, sans-serif;
          color: #1a3a2a;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
      `}</style>

      {/* Print button */}
      <div className="no-print" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99 }}>
        <button
          onClick={() => window.print()}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a3a2a", color: "#fff", fontWeight: 700, fontSize: 13, padding: "11px 22px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Print / Download PDF
        </button>
      </div>

      <div className="a4">

        {/* ── HEADER ── */}
        <div style={{ background: "#1a3a2a", padding: "16px 24px 18px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -40, top: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(201,168,76,0.08)" }} />
          <div style={{ position: "absolute", right: 20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(201,168,76,0.06)" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src="/images/mygolf-digital-logo.png" alt="MyGolf-Digital" style={{ width: 80, height: 80, borderRadius: 12, background: "white", padding: 5, objectFit: "contain" }} />
              <div>
                <div style={{ color: "white", fontWeight: 800, fontSize: 26, letterSpacing: "-0.5px", lineHeight: 1 }}>MyGolf-Digital</div>
                <div style={{ color: "#c9a84c", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.18em", marginTop: 6 }}>Golf Club Management Platform</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              {[{ v: "18", l: "Holes" }, { v: "4+", l: "Formats" }, { v: "Live", l: "Scoring" }, { v: "∞", l: "Members" }].map(s => (
                <div key={s.l} style={{ textAlign: "center" }}>
                  <div style={{ color: "#c9a84c", fontWeight: 800, fontSize: 17, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 3 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, position: "relative" }}>
            <h1 style={{ color: "white", fontWeight: 800, fontSize: 23, lineHeight: 1.25, marginBottom: 8 }}>
              Run Your Club. Score Every Round. Know Every Player.
            </h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, lineHeight: 1.65, maxWidth: "78%" }}>
              MyGolf is a purpose-built platform for golf clubs — from pairing fourballs to publishing live leaderboards, all from a smartphone. No apps. No complexity. Just golf.
            </p>
          </div>
        </div>

        {/* ── HERO IMAGE STRIP ── */}
        <div style={{ height: 58, overflow: "hidden", flexShrink: 0 }}>
          <img src="/brochure-hero.jpg" alt="Golf course" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%" }} />
        </div>

        {/* ── FEATURES GRID ── takes half the remaining height */}
        <div style={{ padding: "14px 24px 10px", background: "#f7f4ef", flex: "1 1 0", display: "flex", flexDirection: "column" }}>
          <p style={{ color: "#c9a84c", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 10, flexShrink: 0 }}>Platform Features</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, flex: 1 }}>
            {features.map(f => (
              <div key={f.title} style={{ background: "white", borderRadius: 10, padding: "16px 16px", border: "1px solid #e5dfd4", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "#f0ece2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="22" height="22" fill="none" stroke="#1a3a2a" viewBox="0 0 24 24">{f.icon.props.children}</svg>
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#1a3a2a", marginBottom: 6, lineHeight: 1.2 }}>{f.title}</p>
                  <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div style={{ height: 1, background: "#e5dfd4", margin: "0 24px", flexShrink: 0 }} />

        {/* ── HOW IT WORKS + WHY MYGOLF ── takes the other half */}
        <div style={{ display: "flex", flex: "1 1 0", overflow: "hidden" }}>

          {/* How it works */}
          <div style={{ flex: 1, padding: "14px 16px 14px 24px", borderRight: "1px solid #e5dfd4", display: "flex", flexDirection: "column" }}>
            <p style={{ color: "#c9a84c", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 10, flexShrink: 0 }}>How It Works</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
              {steps.map(s => (
                <div key={s.n} style={{ background: "#1a3a2a", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#c9a84c", fontSize: 28, fontWeight: 900, lineHeight: 1, opacity: 0.6, flexShrink: 0 }}>{s.n}</span>
                    <p style={{ color: "white", fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{s.title}</p>
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, lineHeight: 1.55 }}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Why MyGolf + Formats */}
          <div style={{ flex: 1, padding: "14px 24px 14px 16px", display: "flex", flexDirection: "column" }}>
            <p style={{ color: "#c9a84c", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 10, flexShrink: 0 }}>Why Clubs Choose MyGolf</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {benefits.map(b => (
                <div key={b.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#c9a84c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <svg width="10" height="10" fill="none" stroke="#1a3a2a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p style={{ fontSize: 11, color: "#1a3a2a", lineHeight: 1.55 }}>
                    <strong style={{ fontWeight: 700, fontSize: 12 }}>{b.title}</strong>
                    <span style={{ color: "#6b7280" }}> — {b.body}</span>
                  </p>
                </div>
              ))}
            </div>


          </div>
        </div>

        {/* ── SUPPORTED FORMATS — full width, justified ── */}
        <div style={{ borderTop: "1px solid #e5dfd4", padding: "7px 24px", flexShrink: 0, background: "#f0ece2" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <p style={{ color: "#c9a84c", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", flexShrink: 0 }}>Supported Formats:</p>
            <div style={{ display: "flex", flex: 1, justifyContent: "space-between", gap: 8 }}>
              {["Stableford", "Medal / Stroke Play", "Fourball Better Ball", "Multi-Round Tournament"].map(f => (
                <div key={f} style={{ flex: 1, background: "#1a3a2a", color: "white", fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 7, textAlign: "center", lineHeight: 1.2 }}>{f}</div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA FOOTER ── */}
        <div style={{ background: "#c9a84c", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <p style={{ color: "#1a3a2a", fontWeight: 800, fontSize: 17, marginBottom: 5 }}>Ready to bring your club online?</p>
            <p style={{ color: "rgba(26,58,42,0.75)", fontSize: 12 }}>Contact us for a personalised walkthrough — up and running in minutes.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            <img src="/images/mygolf-digital-logo.png" alt="MyGolf-Digital" style={{ width: 56, height: 56, borderRadius: 10, background: "white", padding: 5, objectFit: "contain" }} />
            <div style={{ textAlign: "right" }}>
              <p style={{ color: "#1a3a2a", fontWeight: 700, fontSize: 14, marginBottom: 3 }}>mygolf-digital.co.za</p>
              <p style={{ color: "rgba(26,58,42,0.8)", fontSize: 12, marginBottom: 3 }}>info@mygolf-digital.co.za</p>
              <a href="https://wa.me/27829029144" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#1a3a2a", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#1a3a2a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                +27 82 902 9144
              </a>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
