// components/WhatsAppImport.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ParsedPlayer {
  name: string;
  wwb: boolean;
  birdie: boolean;
  et?: boolean;
  lt?: boolean;
  notes?: string;
  member_id?: number | null;
  guest_name?: string;
  isGuest?: boolean;
  unmatched?: boolean;
}

interface ParsedFourball {
  tee_time: string;
  tee_box: 'F' | 'B';
  fourball_number: number;
  players: ParsedPlayer[];
  members?: ParsedPlayer[];
}

export function WhatsAppImport({ gameId, onSuccess }: { gameId: number | null; onSuccess: () => void }) {
  const [whatsappText, setWhatsappText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ParsedFourball[]>([]);
  const [unmatchedPlayers, setUnmatchedPlayers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [showManualMatch, setShowManualMatch] = useState(false);

  const parseAndPreview = async () => {
    if (!gameId) {
      setError("Please select a game first");
      return;
    }
    setParsing(true);
    setError("");
    
    const res = await fetch("/api/admin/parse-whatsapp-pairings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: whatsappText, gameId }),
    });
    
    const data = await res.json();
    if (res.ok) {
      setPreview(data.fourballs);
      setUnmatchedPlayers(data.unmatched || []);
      if (data.unmatched?.length > 0) {
        setShowManualMatch(true);
      }
    } else {
      setError(data.error);
    }
    setParsing(false);
  };

  const confirmImport = async () => {
    if (!gameId) {
      setError("Please select a game first");
      return;
    }
    const res = await fetch("/api/admin/import-whatsapp-pairings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fourballs: preview, gameId }),
    });
    
    if (res.ok) {
      alert(`Successfully imported ${preview.length} fourballs!`);
      onSuccess();
      setWhatsappText("");
      setPreview([]);
    } else {
      const data = await res.json();
      alert(`Error: ${data.error}`);
    }
  };

  return (
    <Card className="mb-4 border-2 border-green-200 dark:border-green-800">
      <CardHeader className="bg-green-50 dark:bg-green-950/30 py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.04 2.5c-5.27 0-9.54 4.27-9.54 9.54 0 1.68.44 3.33 1.27 4.78L2.5 21.5l4.68-1.27c1.45.83 3 1.27 4.78 1.27 5.27 0 9.54-4.27 9.54-9.54 0-5.27-4.27-9.54-9.54-9.54z"/>
          </svg>
          Import Pairings from WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="text-xs text-slate-500 mb-2">
          Copy the WhatsApp message and paste below. The system will automatically detect:
          <ul className="list-disc ml-4 mt-1">
            <li>Tee times (7:16, 7:24, etc.)</li>
            <li>Tee boxes (F = Front, B = Back)</li>
            <li>Player names with WWB, (B), ET, LT markers</li>
            <li>Guest markers: (Guest), [G], or &quot;Guest&quot; in name</li>
            <li>Checkmarks for opt-ins</li>
          </ul>
        </div>
        
        <Textarea
          placeholder={`Paste WhatsApp message here...
          
Example:
7:16 F
1. Mandla Msimang (WWB)
2. Lungile Ludada ET
3. Kiran Bhika ET (B) 
4. Matlaba Machaka WWB (ET)

7:16 B
5. Lesiba Ramashala (WWB) ET
...`}
          value={whatsappText}
          onChange={(e) => setWhatsappText(e.target.value)}
          rows={10}
          className="font-mono text-sm mb-3"
        />
        
        {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
        
        <div className="flex gap-2">
          <Button onClick={parseAndPreview} disabled={parsing || !whatsappText.trim() || !gameId} size="sm">
            {parsing ? "Parsing..." : "Preview Pairings"}
          </Button>
          {preview.length > 0 && (
            <Button onClick={confirmImport} variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
              Import {preview.length} Fourballs
            </Button>
          )}
        </div>
        
        {preview.length > 0 && (
          <div className="mt-4 border rounded-lg overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 font-semibold text-sm">
              Preview ({preview.length} fourballs)
            </div>
            <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
              {preview.map((fb) => (
                <div key={`${fb.tee_time}-${fb.tee_box}-${fb.fourball_number}`} className="border-b pb-2 last:border-0">
                  <div className="font-medium text-sm">
                    {fb.tee_time} {fb.tee_box === 'F' ? 'Front' : 'Back'} | 4Ball {fb.fourball_number}
                  </div>
                  <div className="text-xs mt-1 space-y-0.5">
                    {(fb.members || fb.players).map((p, idx) => (
                      <div key={idx} className={`flex items-center gap-2 ${p.unmatched ? 'text-red-500' : ''}`}>
                        <span className="w-4">{idx + 1}.</span>
                        <span>{p.name}</span>
                        {p.isGuest && <span className="text-[9px] px-1 bg-green-100 text-green-700 rounded">GUEST</span>}
                        {p.unmatched && <span className="text-[9px] px-1 bg-red-100 text-red-700 rounded">UNMATCHED</span>}
                        {p.wwb && <span className="text-[9px] px-1 bg-blue-100 text-blue-700 rounded">WWB</span>}
                        {p.birdie && <span className="text-[9px] px-1 bg-amber-100 text-amber-700 rounded">B</span>}
                        {p.et && <span className="text-[9px] px-1 bg-purple-100 text-purple-700 rounded">ET</span>}
                        {p.lt && <span className="text-[9px] px-1 bg-orange-100 text-orange-700 rounded">LT</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
      {/* Manual Match Dialog for Unmatched Players */}
      <Dialog open={showManualMatch} onOpenChange={setShowManualMatch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Match Required</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p>The following players could not be automatically matched:</p>
            <ul className="list-disc ml-4">
              {unmatchedPlayers.map((name, i) => (
                <li key={i} className="text-red-600">{name}</li>
              ))}
            </ul>
            <p className="text-sm text-slate-500">These players will be skipped during import. You can add them manually after.</p>
            <Button onClick={() => setShowManualMatch(false)}>Continue with Import</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
