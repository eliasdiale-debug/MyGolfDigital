"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createGolfClub, addMembersToClub } from "./actions";
import Link from "next/link";

interface MemberEntry {
  name: string;
  contact_number: string;
  official_handicap: string;
  remmoho_handicap: string;
}

const STEP_LABELS = ["Club Details", "Logo", "Members", "Done"];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-6">
      {STEP_LABELS.map((label, i) => {
        const s = i + 1;
        const done = s < step;
        const active = s === step;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                active ? "bg-teal-600 text-white shadow-md shadow-teal-200 dark:shadow-teal-900" :
                done ? "bg-teal-100 text-teal-700 dark:bg-teal-800 dark:text-teal-200" :
                "bg-slate-100 text-slate-400 dark:bg-slate-800"
              }`}>
                {done ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> : s}
              </div>
              <span className={`text-[9px] font-medium ${active ? "text-teal-600 dark:text-teal-400" : done ? "text-teal-400" : "text-slate-400"}`}>{label}</span>
            </div>
            {s < 4 && <div className={`w-6 h-0.5 rounded mb-3 ${done ? "bg-teal-400" : "bg-slate-200 dark:bg-slate-700"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function parseCsv(text: string): MemberEntry[] {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length === 0) return [];
  // Detect header row
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes("name") || firstLine.includes("member") || firstLine.includes("contact");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map(line => {
      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      return {
        name: cols[0] || "",
        contact_number: cols[1] || "",
        official_handicap: cols[2] || "",
        remmoho_handicap: cols[3] || "",
      };
    })
    .filter(m => m.name);
}

export default function SignUpPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Club details
  const [clubName, setClubName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [primaryName, setPrimaryName] = useState("");
  const [primarySurname, setPrimarySurname] = useState("");
  const [primaryNumber, setPrimaryNumber] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [secondaryName, setSecondaryName] = useState("");
  const [secondarySurname, setSecondarySurname] = useState("");
  const [secondaryNumber, setSecondaryNumber] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");

  // Created club
  const [clubId, setClubId] = useState<number | null>(null);
  const [createdClubName, setCreatedClubName] = useState("");

  // Step 2: Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Members
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvMembers, setCsvMembers] = useState<MemberEntry[]>([]);
  const [manualMembers, setManualMembers] = useState<MemberEntry[]>([
    { name: "", contact_number: "", official_handicap: "", remmoho_handicap: "" },
    { name: "", contact_number: "", official_handicap: "", remmoho_handicap: "" },
    { name: "", contact_number: "", official_handicap: "", remmoho_handicap: "" },
  ]);
  const [inputMode, setInputMode] = useState<"csv" | "manual">("csv");
  const [addedCount, setAddedCount] = useState(0);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const members = inputMode === "csv" ? csvMembers : manualMembers;

  function updateManualMember(idx: number, field: keyof MemberEntry, value: string) {
    setManualMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  function handleLogoChange(file: File | null) {
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleCsvChange(file: File | null) {
    if (!file) return;
    setCsvFile(file);
    const text = await file.text();
    const parsed = parseCsv(text);
    setCsvMembers(parsed);
    setError(null);
  }

  async function handleCreateClub() {
    setError(null);
    if (!clubName.trim()) { setError("Club name is required."); return; }
    if (!password) { setError("Password is required."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (!primaryName.trim() || !primarySurname.trim()) { setError("Primary contact name and surname are required."); return; }
    if (!primaryNumber.trim()) { setError("Primary contact number is required."); return; }
    if (!primaryEmail.trim()) { setError("Primary contact email is required."); return; }

    setSaving(true);
    const result = await createGolfClub({
      club_name: clubName,
      password,
      primary_contact_name: primaryName,
      primary_contact_surname: primarySurname,
      primary_contact_number: primaryNumber,
      primary_contact_email: primaryEmail,
      secondary_contact_name: secondaryName || undefined,
      secondary_contact_surname: secondarySurname || undefined,
      secondary_contact_number: secondaryNumber || undefined,
      secondary_contact_email: secondaryEmail || undefined,
    });
    setSaving(false);

    if (result.error) { setError(result.error); return; }
    if (result.success && result.club) {
      setClubId(result.club.club_id);
      setCreatedClubName(result.club.club_name);
      setStep(2);
    }
  }

  async function handleUploadLogo() {
    if (!logoFile || !clubId) { setStep(3); return; }
    setUploadingLogo(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", logoFile);
      fd.append("club_id", String(clubId));
      const res = await fetch("/api/upload-club-logo", { method: "POST", body: fd });
      const json = await res.json();
      if (json.error) setError(json.error);
    } catch {
      setError("Failed to upload logo. You can update it later.");
    }
    setUploadingLogo(false);
    setStep(3);
  }

  async function handleAddMembers() {
    setError(null);
    const validMembers = members.filter(m => m.name.trim());
    if (validMembers.length === 0) { setError("Please add at least one member."); return; }
    if (!clubId) return;

    setSaving(true);
    const result = await addMembersToClub(clubId, validMembers);
    setSaving(false);

    if (result.error) { setError(result.error); return; }
    if (result.success) {
      setAddedCount(result.count);
      setStep(4);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-slate-100 dark:from-slate-950 dark:via-teal-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="flex justify-center mb-3">
            <img src="/images/mygolf-digital-logo.png" alt="MyGolf-Digital" width={100} height={100} className="object-contain" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">New Golf Club Registration</h1>
          <p className="text-xs text-slate-500 mt-1">Set up your club, upload your logo and member list</p>
        </div>

        <StepIndicator step={step} />

        {/* ── STEP 1: Club Details ── */}
        {step === 1 && (
          <Card className="border border-teal-200 dark:border-teal-800 shadow-xl bg-white/95 dark:bg-slate-900/95">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                Club Details
              </CardTitle>
              <CardDescription className="text-[10px]">Enter your club information and set up credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Club / Group Name</Label>
                  <Input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="e.g. Tuesday Clinique Golf Society" className="h-9 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Club Password</Label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Set a password" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Confirm Password</Label>
                    <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter" className="h-9 text-sm" />
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide mb-2">Primary Contact (Chairman / Captain)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-[10px] text-slate-500">First Name</Label><Input value={primaryName} onChange={e => setPrimaryName(e.target.value)} placeholder="First name" className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-[10px] text-slate-500">Surname</Label><Input value={primarySurname} onChange={e => setPrimarySurname(e.target.value)} placeholder="Surname" className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-[10px] text-slate-500">Contact Number</Label><Input value={primaryNumber} onChange={e => setPrimaryNumber(e.target.value)} placeholder="081 234 5678" className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-[10px] text-slate-500">Email</Label><Input type="email" value={primaryEmail} onChange={e => setPrimaryEmail(e.target.value)} placeholder="email@example.com" className="h-8 text-xs" /></div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Secondary Contact (Optional)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-[10px] text-slate-500">First Name</Label><Input value={secondaryName} onChange={e => setSecondaryName(e.target.value)} placeholder="First name" className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-[10px] text-slate-500">Surname</Label><Input value={secondarySurname} onChange={e => setSecondarySurname(e.target.value)} placeholder="Surname" className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-[10px] text-slate-500">Contact Number</Label><Input value={secondaryNumber} onChange={e => setSecondaryNumber(e.target.value)} placeholder="081 234 5678" className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-[10px] text-slate-500">Email</Label><Input type="email" value={secondaryEmail} onChange={e => setSecondaryEmail(e.target.value)} placeholder="email@example.com" className="h-8 text-xs" /></div>
                </div>
              </div>
              {error && <div className="p-2 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"><p className="text-xs text-red-600 dark:text-red-400">{error}</p></div>}
              <Button className="w-full h-9 text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium" onClick={handleCreateClub} disabled={saving}>
                {saving ? "Creating Club..." : "Create Club & Continue"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 2: Logo Upload ── */}
        {step === 2 && (
          <Card className="border border-violet-200 dark:border-violet-800 shadow-xl bg-white/95 dark:bg-slate-900/95">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Club Logo
              </CardTitle>
              <CardDescription className="text-[10px]">Upload your club's logo — it will appear on the dashboard for all members of {createdClubName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop zone */}
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className={`w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-8 transition-colors cursor-pointer ${
                  logoPreview
                    ? "border-violet-300 bg-violet-50 dark:bg-violet-950/30"
                    : "border-slate-200 dark:border-slate-700 hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/20"
                }`}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="h-24 w-auto object-contain rounded-lg" />
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                      <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Click to upload logo</p>
                      <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, SVG up to 5MB</p>
                    </div>
                  </>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={e => handleLogoChange(e.target.files?.[0] || null)}
                />
              </button>
              {logoPreview && (
                <button
                  type="button"
                  onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors w-full text-center"
                >
                  Remove logo
                </button>
              )}
              {error && <div className="p-2 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"><p className="text-xs text-red-600 dark:text-red-400">{error}</p></div>}
              <div className="flex gap-2">
                <Button variant="outline" className="h-9 text-sm px-4 bg-transparent" onClick={() => setStep(3)}>Skip for now</Button>
                <Button className="flex-1 h-9 text-sm bg-violet-600 hover:bg-violet-700 text-white font-medium" onClick={handleUploadLogo} disabled={uploadingLogo}>
                  {uploadingLogo ? "Uploading..." : logoFile ? "Upload Logo & Continue" : "Continue without Logo"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 3: Members ── */}
        {step === 3 && (
          <Card className="border border-sky-200 dark:border-sky-800 shadow-xl bg-white/95 dark:bg-slate-900/95">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Add Members
                  </CardTitle>
                  <CardDescription className="text-[10px]">Upload a CSV or enter members manually for {createdClubName}</CardDescription>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-800 dark:text-sky-200">
                  {members.filter(m => m.name.trim()).length} members
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Mode tabs */}
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 gap-0.5">
                {(["csv", "manual"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setInputMode(mode)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${inputMode === mode ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                  >
                    {mode === "csv" ? "Upload CSV File" : "Enter Manually"}
                  </button>
                ))}
              </div>

              {/* CSV Upload */}
              {inputMode === "csv" && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => csvInputRef.current?.click()}
                    className={`w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-6 transition-colors cursor-pointer ${
                      csvFile ? "border-sky-300 bg-sky-50 dark:bg-sky-950/30" : "border-slate-200 dark:border-slate-700 hover:border-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/20"
                    }`}
                  >
                    {csvFile ? (
                      <div className="text-center">
                        <svg className="w-8 h-8 text-sky-600 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">{csvFile.name}</p>
                        <p className="text-xs text-sky-500 mt-0.5">{csvMembers.length} members detected</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center">
                          <svg className="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Click to upload CSV</p>
                          <p className="text-xs text-slate-400 mt-0.5">Columns: Name, Contact, Official HCP, Club HCP</p>
                        </div>
                      </>
                    )}
                    <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => handleCsvChange(e.target.files?.[0] || null)} />
                  </button>

                  {/* CSV Format hint */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 text-[10px] text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Expected CSV format:</p>
                    <code className="block font-mono text-[9px] bg-white dark:bg-slate-900 rounded px-2 py-1 border border-slate-200 dark:border-slate-700">
                      Name, Contact Number, Official HCP, Club HCP<br />
                      John Smith, 0812345678, 14.2, 12<br />
                      Jane Doe, 0723456789, 18.4,
                    </code>
                    <p className="text-[9px] text-slate-400">Header row is optional. Handicap columns are optional.</p>
                  </div>

                  {/* Preview parsed members */}
                  {csvMembers.length > 0 && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-12 gap-1 px-1 text-[8px] font-semibold text-slate-400 uppercase tracking-wide">
                        <div className="col-span-1">#</div>
                        <div className="col-span-4">Name</div>
                        <div className="col-span-3">Contact</div>
                        <div className="col-span-2">Off. HCP</div>
                        <div className="col-span-2">Club HCP</div>
                      </div>
                      {csvMembers.map((m, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-1 items-center text-[10px] py-0.5 px-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
                          <div className="col-span-1 text-slate-400">{idx + 1}</div>
                          <div className="col-span-4 font-medium text-slate-700 dark:text-slate-300 truncate">{m.name}</div>
                          <div className="col-span-3 text-slate-500 truncate">{m.contact_number || "-"}</div>
                          <div className="col-span-2 text-center text-slate-500">{m.official_handicap || "-"}</div>
                          <div className="col-span-2 text-center text-slate-500">{m.remmoho_handicap || "-"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Manual Entry */}
              {inputMode === "manual" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-1 px-1 text-[8px] font-semibold text-slate-400 uppercase tracking-wide">
                    <div className="col-span-1">#</div>
                    <div className="col-span-3">Name</div>
                    <div className="col-span-3">Contact</div>
                    <div className="col-span-2">Off. HCP</div>
                    <div className="col-span-2">Club HCP</div>
                    <div className="col-span-1" />
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {manualMembers.map((m, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                        <div className="col-span-1 text-[10px] text-slate-400 text-center font-medium">{idx + 1}</div>
                        <div className="col-span-3"><Input value={m.name} onChange={e => updateManualMember(idx, "name", e.target.value)} placeholder="Full name" className="h-7 text-xs px-2" /></div>
                        <div className="col-span-3"><Input value={m.contact_number} onChange={e => updateManualMember(idx, "contact_number", e.target.value)} placeholder="Contact" className="h-7 text-xs px-2" /></div>
                        <div className="col-span-2"><Input value={m.official_handicap} onChange={e => updateManualMember(idx, "official_handicap", e.target.value)} placeholder="14.2" className="h-7 text-xs px-2 text-center" /></div>
                        <div className="col-span-2"><Input value={m.remmoho_handicap} onChange={e => updateManualMember(idx, "remmoho_handicap", e.target.value)} placeholder="12" className="h-7 text-xs px-2 text-center" /></div>
                        <div className="col-span-1 flex justify-center">
                          {manualMembers.length > 1 && (
                            <button onClick={() => setManualMembers(prev => prev.filter((_, i) => i !== idx))} className="w-5 h-5 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 transition-colors" aria-label="Remove">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs border-dashed border-sky-300 dark:border-sky-700 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950 bg-transparent" onClick={() => setManualMembers(prev => [...prev, { name: "", contact_number: "", official_handicap: "", remmoho_handicap: "" }])}>
                    + Add Row
                  </Button>
                </div>
              )}

              {error && <div className="p-2 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"><p className="text-xs text-red-600 dark:text-red-400">{error}</p></div>}

              <div className="flex gap-2">
                <Button variant="outline" className="h-9 text-sm px-4 bg-transparent" onClick={() => { setAddedCount(0); setStep(4); }}>Skip for now</Button>
                <Button
                  className="flex-1 h-9 text-sm bg-sky-600 hover:bg-sky-700 text-white font-medium"
                  onClick={handleAddMembers}
                  disabled={saving || members.filter(m => m.name.trim()).length === 0}
                >
                  {saving ? "Adding Members..." : `Add ${members.filter(m => m.name.trim()).length} Member${members.filter(m => m.name.trim()).length !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 4: Success ── */}
        {step === 4 && (
          <Card className="border border-emerald-200 dark:border-emerald-800 shadow-xl bg-white/95 dark:bg-slate-900/95">
            <CardContent className="py-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Welcome to MyGolf-Digital!</h2>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-semibold text-teal-600 dark:text-teal-400">{createdClubName}</span> has been registered successfully.
                </p>
              </div>
              {addedCount > 0 && (
                <div className="px-4 py-2 rounded-lg bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800 inline-block">
                  <p className="text-xs text-sky-700 dark:text-sky-300">
                    <span className="font-bold">{addedCount}</span> member{addedCount !== 1 ? "s" : ""} added with handicap indices
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-2 pt-2">
                <Link href="/login">
                  <Button className="w-full h-9 text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium">Go to Login</Button>
                </Link>
                <p className="text-[10px] text-slate-400">Members can now log in with their name and contact number</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-4 text-center">
          <Link href="/login" className="text-xs text-slate-400 hover:text-teal-600 transition-colors">
            Already have a club? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
