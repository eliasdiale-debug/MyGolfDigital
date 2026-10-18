"use client"

import { useRef, useState } from "react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

const tabs = [
  {
    name: "Home",
    icon: "⌂",
    color: "bg-emerald-50 border-emerald-200",
    labelColor: "text-emerald-700",
    description:
      "Your home base. Displays your club information, handicap index, upcoming games and your League standings.",
  },
  {
    name: "Records",
    icon: "📋",
    color: "bg-blue-50 border-blue-200",
    labelColor: "text-blue-700",
    description:
      "Your personal scoring history, handicap progression and achievements — a permanent record of your game.",
  },
  {
    name: "Play",
    icon: "⛳",
    color: "bg-green-50 border-green-200",
    labelColor: "text-green-700",
    description:
      "All upcoming games, who has joined and pairing information. This is where you book your spot and opt in to WWB.",
  },
  {
    name: "Live",
    icon: "▶",
    color: "bg-red-50 border-red-200",
    labelColor: "text-red-700",
    description:
      "Active during a round. Shows the live leaderboard, your scorecard for hole-by-hole entry and GPS distance to the green.",
  },
  {
    name: "WWB",
    icon: "🏆",
    color: "bg-amber-50 border-amber-200",
    labelColor: "text-amber-700",
    description:
      "Where your club participates in WWB, this tab shows the full entrant list and live tracking of the three side competition leaders.",
  },
  {
    name: "Feed",
    icon: "📣",
    color: "bg-purple-50 border-purple-200",
    labelColor: "text-purple-700",
    description: "Club announcements and updates — more features coming soon.",
  },
  {
    name: "Club",
    icon: "🏠",
    color: "bg-slate-50 border-slate-200",
    labelColor: "text-slate-700",
    description:
      "Club information and the contact details of your administrators for handicap queries and PIN resets.",
  },
]

export default function WelcomeLetter() {
  const printRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)

  const handleDownloadPDF = async () => {
    if (!printRef.current) return
    setGenerating(true)
    try {
      // Fetch logos as base64 via same-origin API to avoid html2canvas CORS blocks
      let wsoeLogoBase64 = ""
      let appLogoBase64 = ""
      try {
        const res = await fetch("/api/welcome-pdf")
        if (res.ok) {
          const data = await res.json()
          wsoeLogoBase64 = data.wsoeLogoBase64
          appLogoBase64 = data.appLogoBase64
        }
      } catch {}

      // Swap external image srcs to base64 inline so html2canvas can render them
      const wsoeImg = printRef.current.querySelector<HTMLImageElement>("[data-logo='wsoe']")
      const appImg = printRef.current.querySelector<HTMLImageElement>("[data-logo='app']")
      const prevWsoe = wsoeImg?.src ?? ""
      const prevApp = appImg?.src ?? ""
      if (wsoeImg && wsoeLogoBase64) wsoeImg.src = wsoeLogoBase64
      if (appImg && appLogoBase64) appImg.src = appLogoBase64

      // Wait a tick for images to load
      await new Promise(r => setTimeout(r, 300))

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: false,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      })

      // Restore original srcs
      if (wsoeImg) wsoeImg.src = prevWsoe
      if (appImg) appImg.src = prevApp

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * pageWidth) / canvas.width
      let yOffset = 0
      let remainingHeight = imgHeight
      while (remainingHeight > 0) {
        pdf.addImage(imgData, "PNG", 0, -yOffset, imgWidth, imgHeight)
        remainingHeight -= pageHeight
        yOffset += pageHeight
        if (remainingHeight > 0) pdf.addPage()
      }
      pdf.save("MyGolfDigital-Welcome-WSOE.pdf")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8 px-4 print:bg-white print:p-0 print:block">

      {/* Print button — hidden in print */}
      <div className="mb-6 w-full max-w-[760px] flex justify-end">
        <button
          onClick={handleDownloadPDF}
          disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {generating ? "Generating PDF..." : "Download PDF"}
        </button>
      </div>

      {/* Letter */}
      <div
        ref={printRef}
        className="bg-white w-full max-w-[760px] shadow-lg print:shadow-none print:max-w-full"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        {/* Header bar */}
        <div className="bg-emerald-700 px-10 py-6 flex items-center justify-between print:px-10 print:py-6">
          {/* Left: MyGolf-Digital branding */}
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img data-logo="app" src="/images/mygolf-digital-logo.png" alt="MyGolf-Digital logo" className="w-full h-full object-contain p-1" />
            </div>
            <div>
              <div className="text-white font-bold text-xl tracking-tight leading-tight">MyGolf-Digital</div>
              <div className="text-emerald-200 text-xs tracking-wide mt-0.5">Your Club&apos;s Digital Golf Companion</div>
              <div className="text-emerald-300 text-[10px] mt-1">www.mygolf-digital.co.za</div>
            </div>
          </div>
          {/* Right: WSOE club logo */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-20 h-20 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-logo="wsoe"
                src="https://bhgbuyzjgpeavspgrxvh.supabase.co/storage/v1/object/public/public-assets/club-logos/club_13.jpg"
                alt="WSOE logo"
                className="w-full h-full object-contain p-1"
              />
            </div>
            <span className="text-emerald-200 text-[10px] font-semibold tracking-widest uppercase">WSOE</span>
          </div>
        </div>

        {/* Thin accent line */}
        <div className="h-1 bg-emerald-500" />

        {/* Body */}
        <div className="px-10 py-9 space-y-7 text-slate-700 print:px-10 [&_p]:text-justify [&_li]:text-justify">

          {/* Greeting */}
          <div>
            <h1 className="text-2xl font-bold text-slate-800 leading-tight tracking-tight">
              Welcome to MyGolf-Digital
            </h1>
            <p className="text-sm text-slate-500 mt-1">Member Onboarding Guide</p>
          </div>

          <p className="text-sm leading-relaxed text-slate-700">
            We are excited to have you on board. Please take a few minutes to read through this guide so you can get the most out of the app.
          </p>

          {/* Divider */}
          <div className="border-t border-slate-200" />

          {/* Getting Started */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block" />
              Getting Started — Signing In
            </h2>
            <p className="text-sm leading-relaxed">
              Open the app at{" "}
              <span className="font-semibold text-emerald-700">www.mygolf-digital.co.za</span>{" "}
              and enter your <span className="font-semibold">Name and Surname</span> as your username, with the temporary password{" "}
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 text-xs">1234567890</span>.
            </p>
            <div className="mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 leading-relaxed">
                <span className="font-bold">Important:</span> On your first login you will be prompted to set a personal{" "}
                <span className="font-bold">4-digit PIN code</span>. This PIN replaces your password for all future logins — keep it safe. If you ever forget your PIN, contact your club organiser to have it reset.
              </p>
            </div>
          </section>

          <div className="border-t border-slate-200" />

          {/* The Seven Tabs */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
              <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block" />
              The Seven Tabs
            </h2>
            <p className="text-sm text-slate-500 mb-4">After logging in you will see seven tabs at the bottom of the screen:</p>

            <div className="space-y-2">
              {tabs.map((tab) => (
                <div
                  key={tab.name}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${tab.color}`}
                >
                  <div className="shrink-0 w-16">
                    <span className={`text-xs font-bold uppercase tracking-wide ${tab.labelColor}`}>{tab.name}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed text-justify">{tab.description}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="border-t border-slate-200" />

          {/* Joining a Game */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block" />
              Getting Into a Game
            </h2>
            <p className="text-sm leading-relaxed">
              Scheduled games appear on the <span className="font-semibold">Play</span> tab. Tap{" "}
              <span className="font-semibold">Join</span> to book your spot. You will also be able to opt in to the{" "}
              <span className="font-semibold">WWB</span> (WafaWafa / Birdie Pool) competition at the same time. Your fourball pairing and tee-off time will be displayed on this tab once pairings are generated.
            </p>
          </section>

          <div className="border-t border-slate-200" />

          {/* Live Tab */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block" />
              During the Game — Live Tab
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  title: "Live Leaderboard",
                  desc: "Full field leaderboard updated in real time. Scroll to see how your fourball and the rest of the field are performing.",
                  color: "border-red-200 bg-red-50",
                  titleColor: "text-red-700",
                },
                {
                  title: "Scorecard",
                  desc: "Active hole details — hole number, par and stroke index — with hole-by-hole score entry.",
                  color: "border-blue-200 bg-blue-50",
                  titleColor: "text-blue-700",
                },
                {
                  title: "Course GPS",
                  desc: "Live GPS with a full hole map showing key distances and your distance to the green.",
                  color: "border-green-200 bg-green-50",
                  titleColor: "text-green-700",
                },
              ].map((item) => (
                <div key={item.title} className={`p-3 rounded-lg border ${item.color}`}>
                  <p className={`text-xs font-bold mb-1.5 ${item.titleColor}`}>{item.title}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="border-t border-slate-200" />

          {/* After the Round */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block" />
              After the Round — Results
            </h2>
            <p className="text-sm leading-relaxed">
              Once all scores have been submitted the organiser will finalise the game. Your results — gross score, points, and any special achievements such as birdies, eagles or a hole-in-one — are automatically saved to your{" "}
              <span className="font-semibold">Records</span> tab and your handicap index is updated accordingly. Final results remain part of your permanent club history.
            </p>
          </section>

          <div className="border-t border-slate-200" />

          {/* Save to Home Screen */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block" />
              Save to Your Home Screen
            </h2>
            <p className="text-sm leading-relaxed mb-4">
              MyGolf-Digital is a web app — no download from an app store is required. You can however add it directly to your phone&apos;s home screen for instant access, exactly like a native app.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* iPhone */}
              <div className="p-3.5 rounded-lg border border-blue-200 bg-blue-50">
                <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  iPhone / iPad
                </p>
                <ol className="space-y-1">
                  {[
                    "Open Safari and go to www.mygolf-digital.co.za",
                    "Tap the Share button (the square with an arrow pointing up) at the bottom of the screen",
                    "Scroll down and tap \"Add to Home Screen\"",
                    "Tap \"Add\" in the top right corner",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-blue-200 text-blue-700 text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Android */}
              <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50">
                <p className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-1.44-.7-3.05-1.09-4.79-1.09-1.74 0-3.35.39-4.79 1.09L4.89 5.67c-.19-.29-.54-.37-.83-.22-.3.16-.42.54-.26.85L5.64 9.48C3.34 11.01 1.82 13.51 1.82 16.4H22.2c0-2.89-1.52-5.39-3.8-6.92zm-9.45 3.84c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm7.6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                  </svg>
                  Android
                </p>
                <ol className="space-y-1">
                  {[
                    "Open Chrome and go to www.mygolf-digital.co.za",
                    "Tap the three-dot menu (⋮) in the top right corner",
                    "Tap \"Add to Home screen\"",
                    "Tap \"Add\" to confirm",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-emerald-200 text-emerald-700 text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              Once added, the MyGolf-Digital icon will appear on your home screen and the app will open full screen — no browser address bar — just like any other app on your phone.
            </p>
          </section>

          <div className="border-t border-slate-200" />

          {/* Sign off */}
          <section className="pb-2">
            <p className="text-sm leading-relaxed text-slate-700">
              Thank you for taking the time to get familiar with the app. We hope you enjoy using it as much as we enjoyed developing it for you — for any queries, please email us at{" "}
              <span className="font-semibold text-emerald-700">info@mygolf-digital.co.za</span>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-10 py-4 flex items-center justify-between bg-slate-50 print:bg-white">
          <span className="text-xs text-slate-400">© 2026 MyGolf-Digital. All rights reserved.</span>
          <span className="text-xs text-slate-400">www.mygolf-digital.co.za</span>
        </div>
      </div>


    </div>
  )
}
