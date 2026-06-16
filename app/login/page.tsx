"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loginMember, setMemberPin, createNomadMember } from "./actions";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface MemberOption {
  member_id: number;
  member_name: string;
  club_id: number;
  club_name: string;
}

type Screen = "login" | "select-club" | "set-pin";
type Tab = "member" | "nomad";

// ── Static sub-components ──

function BrandHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="text-center pb-4">
      <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-slate-400 mb-2">MyGolf-Digital</p>
      <div className="flex justify-center mb-3">
        <Image
          src="/images/mygolf-digital-logo.png"
          alt="MyGolf-Digital Logo"
          width={120}
          height={120}
          priority
          className="object-contain rounded-lg"
        />
      </div>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="p-2.5 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
      <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
    </div>
  );
}

function PageWrap({ children, bottomBanner }: { children: React.ReactNode; bottomBanner?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border border-slate-200 dark:border-slate-700 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm overflow-hidden">
          {children}
          {bottomBanner}
        </Card>
      </div>
    </div>
  );
}

// ── Types for modal data ──
interface PublicGame {
  id: string;
  venue: string;
  startTime: string;
  schoolName: string;
  organizerName?: string;
  availableSlots?: number;
}
interface GolfDay {
  id: string;
  venue: string;
  startTime: string;
  tournamentName: string;
  entryFee: number;
}

// Format an ISO date as e.g. "Mon, 15 Dec at 14:30"
function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} at ${time}`;
}

function Spinner() {
  return (
    <svg className="animate-spin h-6 w-6 text-slate-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// Shared modal shell
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full sm:max-w-md max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
          <button onClick={onClose} className="w-full h-9 text-sm font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PublicGamesModal({ onClose }: { onClose: () => void }) {
  const [games, setGames] = useState<PublicGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [joinNoticeId, setJoinNoticeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/public-games");
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setGames(data.games || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <ModalShell title="Public Games" onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-slate-500">Failed to load games. Please try again.</p>
          <button onClick={load} className="px-4 h-9 text-sm font-semibold rounded-md bg-[#1C3A2A] text-white hover:bg-[#16301f] transition-colors">Retry</button>
        </div>
      ) : games.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">{"\u{1F4ED}"} No games published</div>
      ) : (
        <ul className="space-y-3">
          {games.map(g => (
            <li key={g.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{"\u{1F4CD}"} {g.venue}</p>
              <p className="text-xs text-slate-500 mt-1">{"\u{1F550}"} {formatDateTime(g.startTime)}</p>
              <p className="text-xs text-slate-500 mt-0.5">{"\u{1F3CC}\u{FE0F}"} {g.schoolName}{g.organizerName ? ` \u2022 ${g.organizerName}` : ""}</p>
              {typeof g.availableSlots === "number" && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {g.availableSlots} {g.availableSlots === 1 ? "slot" : "slots"} available
                </p>
              )}
              <button
                type="button"
                onClick={() => setJoinNoticeId(prev => (prev === g.id ? null : g.id))}
                aria-expanded={joinNoticeId === g.id}
                className="mt-3 inline-flex items-center justify-center w-full h-9 text-sm font-semibold rounded-md bg-[#1C3A2A] text-white hover:bg-[#16301f] transition-colors"
              >
                Join Game
              </button>
              {joinNoticeId === g.id && (
                <div className="mt-2 rounded-md bg-[#1C3A2A]/10 border border-[#1C3A2A]/20 p-2.5 text-xs leading-snug text-[#1C3A2A] dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20">
                  Please log in to your profile, then open the <span className="font-semibold">Play</span> tab to join this public game.
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}

function GolfDaysModal({ onClose }: { onClose: () => void }) {
  const [golfDays, setGolfDays] = useState<GolfDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/golf-days");
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setGolfDays(data.golfDays || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function bookingMailto(gd: GolfDay) {
    const dateLabel = formatDateTime(gd.startTime);
    const subject = `Golf Day Booking Request - ${gd.tournamentName}`;
    const body = `I would like to book for ${gd.tournamentName} on ${dateLabel}. Please send me more information.`;
    return `mailto:info@mygolf-digital.co.za?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <ModalShell title="Golf Days" onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-slate-500">Failed to load golf days. Please try again.</p>
          <button onClick={load} className="px-4 h-9 text-sm font-semibold rounded-md bg-[#9a7c2e] text-white hover:bg-[#866a26] transition-colors">Retry</button>
        </div>
      ) : golfDays.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">{"\u{1F3CC}\u{FE0F}"} No golf days scheduled</div>
      ) : (
        <ul className="space-y-3">
          {golfDays.map(gd => (
            <li key={gd.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{"\u{1F3C6}"} {gd.tournamentName}</p>
              <p className="text-xs text-slate-500 mt-1">{"\u{1F4CD}"} {gd.venue}</p>
              <p className="text-xs text-slate-500 mt-0.5">{"\u{1F550}"} {formatDateTime(gd.startTime)}</p>
              <p className="text-xs font-medium mt-0.5 text-slate-600 dark:text-slate-300">
                {gd.entryFee > 0 ? `Entry: R${gd.entryFee}` : "Free"}
              </p>
              <a
                href={bookingMailto(gd)}
                className="mt-3 inline-flex items-center justify-center w-full h-9 text-sm font-semibold rounded-md bg-[#9a7c2e] text-white hover:bg-[#866a26] transition-colors"
              >
                Book Now
              </a>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}

// ── Promo Cards (open modals instead of navigating) ──
function PromoCards() {
  const [openModal, setOpenModal] = useState<"games" | "golfDays" | null>(null);

  return (
    <>
      <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Public Games */}
          <button
            type="button"
            onClick={() => setOpenModal("games")}
            className="group flex flex-col items-center text-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm transition-all hover:shadow-md hover:scale-[1.02] hover:border-[#1C3A2A]/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1C3A2A]/10 text-[#1C3A2A] dark:text-emerald-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V4l9 3-9 3M5 12h7" />
              </svg>
            </span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Public Games</span>
            <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">Find and join open games near you</span>
            <span className="mt-0.5 text-xs font-semibold text-[#1C3A2A] dark:text-emerald-400 group-hover:underline">View available games &rarr;</span>
          </button>

          {/* Golf Days */}
          <button
            type="button"
            onClick={() => setOpenModal("golfDays")}
            className="group flex flex-col items-center text-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm transition-all hover:shadow-md hover:scale-[1.02] hover:border-[#C9A84C]/60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C9A84C]/15 text-[#9a7c2e] dark:text-[#C9A84C]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m-5-17h10v3a5 5 0 01-10 0V4zm10 1h2.5a1.5 1.5 0 010 3H18M7 5H4.5a1.5 1.5 0 000 3H7" />
              </svg>
            </span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Golf Days</span>
            <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">Upcoming events and tournaments</span>
            <span className="mt-0.5 text-xs font-semibold text-[#9a7c2e] dark:text-[#C9A84C] group-hover:underline">View golf days &rarr;</span>
          </button>
        </div>
      </div>

      {openModal === "games" && <PublicGamesModal onClose={() => setOpenModal(null)} />}
      {openModal === "golfDays" && <GolfDaysModal onClose={() => setOpenModal(null)} />}
    </>
  );
}

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<Tab>("member");
  const [screen, setScreen] = useState<Screen>("login");
  const [error, setError]   = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Multi-club state
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);

  // Autocomplete state
  const [nameInput, setNameInput]             = useState("");
  const [suggestions, setSuggestions]         = useState<{ member_id: number; member_name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggLoading, setSuggLoading]         = useState(false);
  const suggDebounce                          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameWrapRef                           = useRef<HTMLDivElement>(null);

  // PIN setup state
  const [pendingMember, setPendingMember]     = useState<MemberOption | null>(null);
  const [newPin, setNewPin]                   = useState("");
  const [confirmPin, setConfirmPin]           = useState("");
  const [savingPin, setSavingPin]             = useState(false);
  const newPinRef = useRef<HTMLInputElement>(null);

  // Nomad signup state
  const [nomadName, setNomadName] = useState("");
  const [nomadPhone, setNomadPhone] = useState("");
  const [nomadPin, setNomadPin] = useState("");
  const [nomadConfirmPin, setNomadConfirmPin] = useState("");
  const [nomadGender, setNomadGender] = useState<"male" | "female">("male");
  const [nomadSaving, setNomadSaving] = useState(false);

  const bottomBanner = <PromoCards />;

  // Persist the chosen member session and redirect to the dashboard
  const persistSession = useCallback((member: MemberOption) => {
    localStorage.setItem("member_session", JSON.stringify(member));
    window.location.href = `/dashboard?member_id=${member.member_id}`;
  }, []);

  // Debounced member-name autocomplete
  const fetchSuggestions = useCallback((value: string) => {
    if (suggDebounce.current) clearTimeout(suggDebounce.current);
    const term = value.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggDebounce.current = setTimeout(async () => {
      try {
        setSuggLoading(true);
        const supabase = createClient();
        const { data } = await supabase
          .from("members")
          .select("member_id, member_name")
          .ilike("member_name", `%${term}%`)
          .order("member_name")
          .limit(8);
        // De-duplicate by name (a member can belong to multiple clubs)
        const seen = new Set<string>();
        const unique = (data || []).filter(m => {
          const key = m.member_name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setSuggestions(unique);
        setShowSuggestions(unique.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggLoading(false);
      }
    }, 250);
  }, []);

  // Close suggestion dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (nameWrapRef.current && !nameWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Member login submit
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const result = await loginMember(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.multipleClubs && result.members) {
        setMemberOptions(result.members);
        setScreen("select-club");
        return;
      }

      if (result.success && result.member) {
        if (result.needsPinSetup) {
          setPendingMember(result.member);
          setScreen("set-pin");
          return;
        }
        persistSession(result.member);
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Multi-club selection
  function selectClub(member: MemberOption) {
    persistSession(member);
  }

  // Save a new PIN, then enter
  async function handleSetPin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (newPin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }
    if (!pendingMember) {
      setError("Session expired. Please sign in again.");
      return;
    }
    setSavingPin(true);
    try {
      const result = await setMemberPin(pendingMember.member_id, newPin);
      if (result.error) {
        setError(result.error);
        return;
      }
      persistSession(pendingMember);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setSavingPin(false);
    }
  }

  // Nomad golfer signup
  async function handleNomadSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (nomadPin !== nomadConfirmPin) {
      setError("PINs do not match.");
      return;
    }
    setNomadSaving(true);
    try {
      const result = await createNomadMember({
        name: nomadName,
        phone: nomadPhone,
        pin: nomadPin,
        gender: nomadGender,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.success && result.member) {
        persistSession(result.member);
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setNomadSaving(false);
    }
  }

  // ── Screen: Set PIN ──
  if (screen === "set-pin") {
    return (
      <PageWrap bottomBanner={bottomBanner}>
        <CardHeader className="space-y-1 pb-2">
          <BrandHeader subtitle="One last step before you enter" />
          <CardTitle className="text-base font-bold text-blue-900 dark:text-blue-100 text-center">
            Set Your PIN
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 text-center leading-relaxed">
            Choose a 4-8 digit PIN. This replaces your contact number for future logins.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSetPin} className="space-y-3" autoComplete="off">
            <div className="space-y-1">
              <label htmlFor="newPin" className="text-xs font-medium text-slate-600 dark:text-slate-400 block">
                New PIN (4-8 digits)
              </label>
              <input
                id="newPin"
                ref={newPinRef}
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="Enter digits"
                value={newPin}
                autoComplete="off"
                onChange={e => setNewPin(e.target.value)}
                onBlur={e => setNewPin(e.target.value.replace(/\D/g, ""))}
                className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-[0.4em] font-mono"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPin" className="text-xs font-medium text-slate-600 dark:text-slate-400 block">
                Confirm PIN
              </label>
              <input
                id="confirmPin"
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="Repeat your PIN"
                value={confirmPin}
                autoComplete="off"
                onChange={e => setConfirmPin(e.target.value)}
                onBlur={e => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-[0.4em] font-mono"
              />
              {confirmPin.length > 0 && (
                <p className={`text-[10px] mt-0.5 ${confirmPin === newPin ? "text-emerald-600" : "text-red-500"}`}>
                  {confirmPin === newPin ? "PINs match" : "PINs do not match yet"}
                </p>
              )}
            </div>

            <ErrorBanner error={error} />

            <Button
              type="submit"
              className="w-full h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              disabled={savingPin || newPin.length < 4 || confirmPin.length < 4}
            >
              {savingPin ? "Saving..." : "Save PIN and Enter"}
            </Button>

            <button
              type="button"
              onClick={() => { if (pendingMember) persistSession(pendingMember); }}
              className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors mt-1"
            >
              Skip for now
            </button>
          </form>
        </CardContent>
      </PageWrap>
    );
  }

  // ── Screen: Select Club ──
  if (screen === "select-club" && memberOptions.length > 0) {
    return (
      <PageWrap bottomBanner={bottomBanner}>
        <CardHeader className="space-y-1 pb-4">
          <BrandHeader subtitle="You are a member of multiple clubs" />
          <CardTitle className="text-base font-bold text-blue-900 dark:text-blue-100 text-center">
            Select Your Club
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {memberOptions.map(member => (
            <button
              key={member.member_id}
              onClick={() => selectClub(member)}
              className="w-full p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-300 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 group-hover:text-blue-700">
                    {member.club_name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{member.member_name}</p>
                </div>
                <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => { setScreen("login"); setMemberOptions([]); }}
              className="w-full text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              Back to login
            </button>
          </div>
        </CardContent>
      </PageWrap>
    );
  }

  // ── Screen: Login / Nomad Signup ──
  return (
    <PageWrap bottomBanner={bottomBanner}>
      <CardHeader className="space-y-1 text-center pb-2">
        <BrandHeader subtitle="" />
        <CardTitle className="text-lg font-semibold text-blue-900 dark:text-blue-100">
          Your Digital Golf Home
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Tab Switcher */}
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 mb-4">
          <button
            onClick={() => { setActiveTab("member"); setError(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
              activeTab === "member"
                ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Member Login
          </button>
          <button
            onClick={() => { setActiveTab("nomad"); setError(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
              activeTab === "nomad"
                ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Nomad Golfer
          </button>
        </div>

        {/* Club Member Login */}
        {activeTab === "member" && (
          <>
            <CardDescription className="text-xs text-slate-500 text-center mb-3">
              Enter your name and PIN to sign in
            </CardDescription>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1" ref={nameWrapRef}>
                <Label htmlFor="memberName" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Member Name
                </Label>
                <div className="relative">
                  <Input
                    id="memberName"
                    name="memberName"
                    type="text"
                    placeholder="Start typing your name..."
                    required
                    value={nameInput}
                    autoComplete="off"
                    className="h-9 text-sm border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500"
                    onChange={e => {
                      setNameInput(e.target.value);
                      fetchSuggestions(e.target.value);
                    }}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    onKeyDown={e => { if (e.key === "Escape") setShowSuggestions(false); }}
                  />
                  {suggLoading && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <svg className="animate-spin h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    </div>
                  )}
                  {showSuggestions && suggestions.length > 0 && (
                    <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {suggestions.map(s => (
                        <li key={s.member_id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                            onMouseDown={e => {
                              e.preventDefault();
                              setNameInput(s.member_name);
                              setSuggestions([]);
                              setShowSuggestions(false);
                              setTimeout(() => document.getElementById("contactNumber")?.focus(), 50);
                            }}
                          >
                            {s.member_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="contactNumber" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  PIN / Contact Number
                </Label>
                <Input
                  id="contactNumber"
                  name="contactNumber"
                  type="password"
                  inputMode="numeric"
                  placeholder="Enter your PIN"
                  required
                  className="h-9 text-sm border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500 tracking-widest"
                  autoComplete="current-password"
                />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  New members: use your contact number until your PIN is set.
                </p>
              </div>

              <ErrorBanner error={error} />

              <Button
                type="submit"
                className="w-full h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </span>
                ) : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center space-y-2">
              <p className="text-xs text-slate-400">
                Forgotten your PIN? Contact your club administrator.
              </p>
              <Link href="/signup" className="text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors">
                Register a new golf club
              </Link>
            </div>
          </>
        )}

        {/* Nomad Golfer Signup */}
        {activeTab === "nomad" && (
          <>
            <CardDescription className="text-xs text-slate-500 text-center mb-3">
              Join as a Nomad - play anywhere, track your game
            </CardDescription>
            <form onSubmit={handleNomadSignup} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="nomadName" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Your Name
                </Label>
                <Input
                  id="nomadName"
                  type="text"
                  placeholder="Full name"
                  value={nomadName}
                  onChange={e => setNomadName(e.target.value)}
                  className="h-9 text-sm border-slate-200 dark:border-slate-700"
                  required
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="nomadPhone" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Phone Number
                </Label>
                <Input
                  id="nomadPhone"
                  type="tel"
                  placeholder="081 234 5678"
                  value={nomadPhone}
                  onChange={e => setNomadPhone(e.target.value)}
                  className="h-9 text-sm border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Gender
                </Label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      checked={nomadGender === "male"}
                      onChange={() => setNomadGender("male")}
                      className="accent-teal-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Male</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      checked={nomadGender === "female"}
                      onChange={() => setNomadGender("female")}
                      className="accent-teal-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Female</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="nomadPin" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Create PIN
                  </Label>
                  <Input
                    id="nomadPin"
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="4-8 digits"
                    value={nomadPin}
                    onChange={e => setNomadPin(e.target.value)}
                    className="h-9 text-sm border-slate-200 dark:border-slate-700 tracking-widest"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nomadConfirmPin" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Confirm PIN
                  </Label>
                  <Input
                    id="nomadConfirmPin"
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="Repeat"
                    value={nomadConfirmPin}
                    onChange={e => setNomadConfirmPin(e.target.value)}
                    className="h-9 text-sm border-slate-200 dark:border-slate-700 tracking-widest"
                    required
                  />
                </div>
              </div>
              {nomadConfirmPin.length > 0 && (
                <p className={`text-[10px] ${nomadConfirmPin === nomadPin ? "text-emerald-600" : "text-red-500"}`}>
                  {nomadConfirmPin === nomadPin ? "PINs match" : "PINs do not match"}
                </p>
              )}

              <ErrorBanner error={error} />

              <Button
                type="submit"
                className="w-full h-9 text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium"
                disabled={nomadSaving}
              >
                {nomadSaving ? "Creating Account..." : "Create Nomad Account"}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="bg-teal-50 dark:bg-teal-950/30 rounded-lg p-3">
                <p className="text-xs text-teal-800 dark:text-teal-200 font-medium mb-1">What is a Nomad Golfer?</p>
                <ul className="text-[10px] text-teal-700 dark:text-teal-300 space-y-0.5">
                  <li>Play at any course, join open games</li>
                  <li>Track your scores and handicap</li>
                  <li>No club membership required</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </PageWrap>
  );
}
