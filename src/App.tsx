/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  AlertTriangle, 
  ChevronRight, 
  Terminal, 
  Cpu, 
  History, 
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Github
} from "lucide-react";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface RiskFlag {
  flag: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
}

interface VerificationResult {
  trust_score: number;
  confidence_level: number;
  verdict: "VERIFIED" | "PARTIALLY VERIFIED" | "UNVERIFIED" | "HIGH RISK";
  claim_summary: string;
  evidence_summary: string;
  risk_flags: RiskFlag[];
  verified_points: string[];
  unverified_points: string[];
  judge_recommendation: string;
}

const SYSTEM_INSTRUCTION = `You are TruthLens AI — an objective, evidence-based hackathon submission verification engine. Your job is to analyze startup claims and compare them against technical evidence from their GitHub repository.

Scoring logic you must follow:
- Start at 100. Deduct points for each mismatch found.
- Deduct 30 pts if claimed scale (users, revenue, downloads) has no infrastructure evidence in code (e.g., no database schema for scale, no analytics integration, no payment providers if revenue claimed).
- Deduct 20 pts if claimed AI/ML features have no model files, training scripts, or ML libraries (tensorFlow, pytorch, etc.) in repo.
- Deduct 15 pts if commit history is very low (<20 commits) but claim implies long-term development.
- Deduct 10 pts per unverifiable metric that cannot be confirmed from public repo data.
- Add 10 pts for each specific, verifiable technical detail in the claim that matches the repo (e.g., specific libraries used, architecture patterns).
- Never go below 5 or above 98.

Be skeptical but fair. Flag inconsistencies clearly but acknowledge genuine technical depth when present.

Return ONLY a valid JSON object matching the requested schema. No preamble.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    trust_score: { type: Type.INTEGER },
    confidence_level: { type: Type.INTEGER },
    verdict: { type: Type.STRING },
    claim_summary: { type: Type.STRING },
    evidence_summary: { type: Type.STRING },
    risk_flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          flag: { type: Type.STRING },
          severity: { type: Type.STRING },
          reason: { type: Type.STRING }
        },
        required: ["flag", "severity", "reason"]
      }
    },
    verified_points: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    unverified_points: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    judge_recommendation: { type: Type.STRING }
  },
  required: [
    "trust_score", 
    "confidence_level", 
    "verdict", 
    "claim_summary", 
    "evidence_summary", 
    "risk_flags", 
    "verified_points", 
    "unverified_points", 
    "judge_recommendation"
  ]
};

export default function App() {
  const [claim, setClaim] = useState("");
  const [evidence, setEvidence] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!claim.trim() || !evidence.trim()) {
      setError("Please provide both a claim and repository evidence.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            role: "user",
            parts: [
              { text: `CLAIM: ${claim}\n\nEVIDENCE: ${evidence}` }
            ]
          }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        }
      });

      if (response.text) {
        setResult(JSON.parse(response.text));
      } else {
        throw new Error("Empty response from AI engine.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during verification.");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "text-accent-red font-black";
      case "HIGH": return "text-accent-red";
      case "MEDIUM": return "text-accent-yellow";
      case "LOW": return "text-accent-green";
      default: return "";
    }
  };

  const getVerdictTagClass = (verdict: string) => {
    switch (verdict) {
      case "VERIFIED": return "bg-accent-green text-paper";
      case "PARTIALLY VERIFIED": return "bg-accent-yellow text-ink";
      case "UNVERIFIED": return "bg-ink text-paper";
      case "HIGH RISK": return "bg-accent-red text-paper";
      default: return "bg-ink text-paper";
    }
  };

  return (
    <div className="min-h-screen bg-paper p-4 md:p-10 flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-end border-b-2 border-ink pb-3 mb-8">
        <div className="font-serif text-2xl font-black tracking-tighter uppercase">
          TruthLens AI
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider opacity-60 hidden md:block">
          Verification Protokol // ID: {result ? `TL-${Math.floor(Math.random() * 9000) + 1000}` : "WAITING"}
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-10 flex-grow">
        {/* Sidebar Flow */}
        <section className="flex flex-col gap-8">
          {/* Main Controls (Input Mode) */}
          {!result || loading ? (
            <div className="space-y-6">
              <section className="">
                <h2 className="editorial-title">Submission Claim</h2>
                <textarea 
                  placeholder="Paste claimed metrics, growth, or technical breakthroughs..."
                  className="w-full h-32 bg-white border border-line p-4 font-serif italic text-sm focus:outline-none focus:border-ink transition-colors resize-none mb-4"
                  value={claim}
                  onChange={(e) => setClaim(e.target.value)}
                />
              </section>

              <section className="">
                <h2 className="editorial-title">Repository Evidence</h2>
                <textarea 
                  placeholder="Insert README content, dependency lists, and tree structures..."
                  className="w-full h-64 bg-white border border-line p-4 font-mono text-xs focus:outline-none focus:border-ink transition-colors resize-none"
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                />
              </section>

              <button 
                onClick={handleVerify}
                disabled={loading}
                className="w-full py-4 bg-ink text-paper font-bold uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {loading ? "ANALYZING..." : "GENERATE VERIFICATION REPORT"}
              </button>

              {error && (
                <div className="p-3 border border-accent-red text-accent-red text-[10px] font-mono uppercase bg-white">
                  ERROR: {error}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Score Box in Sidebar for Report Mode */}
              <div className="border border-ink p-8 text-center bg-white">
                <p className="text-[11px] uppercase tracking-[0.2em] mb-3 opacity-60">Trust Score</p>
                <div className="score-display">{result.trust_score}</div>
                <div className={`verdict-tag mt-4 ${getVerdictTagClass(result.verdict)}`}>
                  {result.verdict}
                </div>
                <div className="mt-6 flex justify-between items-center text-[10px] font-mono uppercase tracking-widest opacity-60 border-t border-line pt-4">
                  <span>Confidence</span>
                  <span className="font-bold text-ink">{result.confidence_level}%</span>
                </div>
                
                <button 
                  onClick={() => setResult(null)}
                  className="mt-6 text-[10px] font-mono uppercase tracking-widest underline opacity-40 hover:opacity-100"
                >
                  Reset Verification
                </button>
              </div>

              <div className="space-y-6">
                <section>
                  <h2 className="editorial-title">Claim Summary</h2>
                  <p className="font-serif text-sm leading-relaxed text-ink/80 italic">
                    "{result.claim_summary}"
                  </p>
                </section>

                <section>
                  <h2 className="editorial-title">Verification Basis</h2>
                  <p className="font-mono text-[11px] leading-relaxed opacity-70">
                    {result.evidence_summary}
                  </p>
                </section>
              </div>
            </>
          )}
        </section>

        {/* Detailed Report Section */}
        <section className="flex flex-col">
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                className="border-2 border-dashed border-line rounded flex items-center justify-center p-20 text-center h-full"
              >
                <div className="space-y-4">
                  <Terminal className="w-12 h-12 mx-auto mb-4" />
                  <p className="font-serif italic text-xl">Verification Engine Standby</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] max-w-xs">Waiting for startup credentials and repository link context.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="report"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-10 h-full flex flex-col"
              >
                {/* Risk Flags Grid */}
                <section>
                  <h2 className="editorial-title">Active Integrity Risks</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.risk_flags.length > 0 ? result.risk_flags.map((flag, i) => (
                      <div key={i} className="risk-item">
                        <div className={`text-[10px] font-black uppercase tracking-wider mb-1 ${getSeverityColor(flag.severity)}`}>
                          {flag.severity}
                        </div>
                        <div className="font-bold text-sm mb-1">{flag.flag}</div>
                        <p className="text-[11px] leading-snug opacity-70">{flag.reason}</p>
                      </div>
                    )) : (
                      <div className="col-span-full border border-line p-4 text-center font-serif italic text-sm opacity-40">
                        No critical risk flags detected during analysis.
                      </div>
                    )}
                  </div>
                </section>

                {/* Evidence Split */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <section>
                    <h2 className="editorial-title">Verified Truths</h2>
                    <ul className="space-y-3">
                      {result.verified_points.map((pt, i) => (
                        <li key={i} className="text-xs relative pl-5 flex items-start leading-relaxed">
                          <CheckCircle2 className="w-3 h-3 text-accent-green absolute left-0 top-0" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h2 className="editorial-title">Unverified Claims</h2>
                    <ul className="space-y-3">
                      {result.unverified_points.map((pt, i) => (
                        <li key={i} className="text-xs relative pl-5 flex items-start leading-relaxed">
                          <XCircle className="w-3 h-3 text-accent-red absolute left-0 top-0" />
                          <span className="opacity-80">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                {/* Recommendation Footer */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-auto bg-ink text-paper p-8 relative overflow-hidden group"
                >
                  <div className="absolute top-[-20px] right-4 text-[120px] font-serif opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">"</div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.3em] mb-4 opacity-70 border-b border-paper/20 pb-2">
                    Expert Recommendation
                  </div>
                  <p className="font-serif italic text-lg leading-relaxed relative z-10">
                    {result.judge_recommendation}
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-10 border-t border-line pt-4 flex justify-between items-center text-[10px] font-mono uppercase tracking-widest opacity-40">
        <div>OBJECTIVE_ANALYSIS // V4.2.0</div>
        <div>TIMESTAMP: {new Date().toISOString().replace('T', ' ').split('.')[0]} UTC</div>
      </footer>
    </div>
  );
}
