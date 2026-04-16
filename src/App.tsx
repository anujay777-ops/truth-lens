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
  Plus,
  Trash2,
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Github,
  Award,
  HelpCircle,
  TrendingDown,
  TrendingUp
} from "lucide-react";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Claim {
  text: string;
}

interface RepoData {
  name: string;
  description: string;
  language: string;
  commit_count: number;
  stars: number;
  forks: number;
  open_issues: number;
  has_releases: boolean;
  last_pushed: string;
  topics: string[];
  readme: string;
}

interface RiskFlag {
  flag: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
}

interface ClaimVerdict {
  claim: string;
  status: "SUPPORTED" | "PARTIAL" | "UNSUPPORTED" | "UNVERIFIABLE";
  evidence_found: string;
  trust_impact: number;
}

interface ScoreAdjustment {
  reason: string;
  points: number;
}

interface VerificationResult {
  overall_trust_score: number;
  confidence_level: number;
  verdict: "VERIFIED" | "PARTIALLY VERIFIED" | "UNVERIFIED" | "HIGH RISK";
  verdict_summary: string;
  repo_health: {
    assessment: "STRONG" | "MODERATE" | "WEAK" | "EMPTY";
    reason: string;
  };
  claim_verdicts: ClaimVerdict[];
  risk_flags: RiskFlag[];
  green_flags: string[];
  judge_probe_questions: string[];
  score_breakdown: {
    base: number;
    deductions: ScoreAdjustment[];
    additions: ScoreAdjustment[];
  };
}

const SYSTEM_INSTRUCTION = `You are TruthLens AI — a rigorous, evidence-based verification engine for hackathon submissions. You cross-reference what teams *claim* in their pitch against what they *actually built* in their GitHub repository.

Scoring Rules:
Start at 100.
DEDUCTIONS:
- Claimed scale (users/revenue/downloads) with no backend, DB, or infra evidence → -30
- Claimed AI/ML feature with no model files, training scripts, or ML libraries → -25
- Commit count < 15 but pitch implies months of work → -20
- Metric (speed, accuracy, %, users) that is totally unverifiable from public repo → -10 each (max -30)
- README is missing, empty, or just a template → -15
- No releases + claims production-ready product → -10
- Repo description contradicts pitch deck claims → -20

ADDITIONS:
- Specific technical architecture detail in claim matches repo structure → +10 each (max +20)
- Commit history is active (50+ commits) → +10
- Has working demo link in README → +10
- Claim is appropriately scoped for a hackathon (not overclaiming) → +10
- Open source dependencies match claimed tech stack → +5

HARD LIMITS: Score never below 5 or above 97.

Return ONLY a valid JSON object matching the requested schema. No preamble.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overall_trust_score: { type: Type.INTEGER },
    confidence_level: { type: Type.INTEGER },
    verdict: { type: Type.STRING },
    verdict_summary: { type: Type.STRING },
    repo_health: {
      type: Type.OBJECT,
      properties: {
        assessment: { type: Type.STRING },
        reason: { type: Type.STRING }
      },
      required: ["assessment", "reason"]
    },
    claim_verdicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          claim: { type: Type.STRING },
          status: { type: Type.STRING },
          evidence_found: { type: Type.STRING },
          trust_impact: { type: Type.INTEGER }
        },
        required: ["claim", "status", "evidence_found", "trust_impact"]
      }
    },
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
    green_flags: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    judge_probe_questions: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    score_breakdown: {
      type: Type.OBJECT,
      properties: {
        base: { type: Type.INTEGER },
        deductions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              reason: { type: Type.STRING },
              points: { type: Type.INTEGER }
            },
            required: ["reason", "points"]
          }
        },
        additions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              reason: { type: Type.STRING },
              points: { type: Type.INTEGER }
            },
            required: ["reason", "points"]
          }
        }
      },
      required: ["base", "deductions", "additions"]
    }
  },
  required: [
    "overall_trust_score",
    "confidence_level",
    "verdict",
    "verdict_summary",
    "repo_health",
    "claim_verdicts",
    "risk_flags",
    "green_flags",
    "judge_probe_questions",
    "score_breakdown"
  ]
};

export default function App() {
  const [claims, setClaims] = useState<string[]>([""]);
  const [repo, setRepo] = useState<RepoData>({
    name: "",
    description: "",
    language: "",
    commit_count: 0,
    stars: 0,
    forks: 0,
    open_issues: 0,
    has_releases: false,
    last_pushed: new Date().toISOString().split('T')[0],
    topics: [],
    readme: ""
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addClaim = () => {
    if (claims.length < 5) setClaims([...claims, ""]);
  };

  const updateClaim = (index: number, value: string) => {
    const newClaims = [...claims];
    newClaims[index] = value;
    setClaims(newClaims);
  };

  const removeClaim = (index: number) => {
    if (claims.length > 1) {
      setClaims(claims.filter((_, i) => i !== index));
    }
  };

  const handleVerify = async () => {
    const validClaims = claims.filter(c => c.trim().length > 0);
    if (validClaims.length === 0 || !repo.name.trim()) {
      setError("Please provide at least one claim and repository name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const input = {
        claims: validClaims,
        repo: {
          ...repo,
          readme: repo.readme.substring(0, 1200) // Truncate as per request
        }
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            role: "user",
            parts: [
              { text: JSON.stringify(input, null, 2) }
            ]
          }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA as any,
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SUPPORTED": return <CheckCircle2 className="w-4 h-4 text-accent-green" />;
      case "PARTIAL": return <AlertTriangle className="w-4 h-4 text-accent-yellow" />;
      case "UNSUPPORTED": return <XCircle className="w-4 h-4 text-accent-red" />;
      case "UNVERIFIABLE": return <HelpCircle className="w-4 h-4 opacity-40" />;
      default: return null;
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
    <div className="min-h-screen bg-paper p-4 md:p-10 flex flex-col font-sans">
      <header className="flex justify-between items-end border-b-2 border-ink pb-3 mb-8">
        <div className="font-serif text-3xl font-black tracking-tighter uppercase leading-none">
          TruthLens AI
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest opacity-60 hidden md:block">
          Evidence-First Verification Protokol // v2.1.0
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-12 flex-grow">
        {/* Input Interface */}
        <section className="space-y-10 order-2 lg:order-1">
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-line pb-2">
              <h2 className="font-serif italic text-xl">Pitch Deck Claims</h2>
              <button 
                onClick={addClaim}
                disabled={claims.length >= 5}
                className="p-1 hover:bg-ink hover:text-paper rounded transition-colors"
                title="Add Claim"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {claims.map((claim, index) => (
                <div key={index} className="flex gap-4 group">
                  <div className="font-mono text-xs opacity-30 mt-3">{index + 1}</div>
                  <textarea 
                    value={claim}
                    onChange={(e) => updateClaim(index, e.target.value)}
                    placeholder="Enter a specific claim from the pitch deck (e.g. 'Serves 10k daily users')"
                    className="flex-grow bg-white border border-line p-3 font-serif text-sm italic focus:outline-none focus:border-ink transition-colors resize-none h-20 shadow-sm"
                  />
                  <button 
                    onClick={() => removeClaim(index)}
                    className="opacity-0 group-hover:opacity-40 hover:opacity-100 p-1 self-start transition-opacity text-accent-red"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="editorial-title">Repository Artifacts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/40 p-6 border border-line">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Repo Name</label>
                  <input 
                    className="w-full bg-white border border-line p-2 text-sm focus:outline-none focus:border-ink" 
                    value={repo.name}
                    onChange={e => setRepo({...repo, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Description</label>
                  <textarea 
                    className="w-full bg-white border border-line p-2 text-sm focus:outline-none focus:border-ink h-20 resize-none"
                    value={repo.description}
                    onChange={e => setRepo({...repo, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Commits</label>
                    <input 
                      type="number"
                      className="w-full bg-white border border-line p-2 text-sm focus:outline-none focus:border-ink" 
                      value={repo.commit_count}
                      onChange={e => setRepo({...repo, commit_count: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Stars</label>
                    <input 
                      type="number"
                      className="w-full bg-white border border-line p-2 text-sm focus:outline-none focus:border-ink" 
                      value={repo.stars}
                      onChange={e => setRepo({...repo, stars: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Language</label>
                    <input 
                      className="w-full bg-white border border-line p-2 text-sm focus:outline-none focus:border-ink" 
                      value={repo.language}
                      onChange={e => setRepo({...repo, language: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                   <input 
                    type="checkbox" 
                    id="releases"
                    checked={repo.has_releases}
                    onChange={e => setRepo({...repo, has_releases: e.target.checked})}
                    className="accent-ink w-4 h-4 cursor-pointer"
                   />
                   <label htmlFor="releases" className="text-[10px] font-mono uppercase tracking-widest cursor-pointer">Has Official Releases</label>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">README (First 1200 Chars)</label>
                <textarea 
                  className="w-full h-[220px] bg-white border border-line p-3 font-mono text-[11px] focus:outline-none focus:border-ink transition-colors resize-none overflow-y-auto"
                  value={repo.readme}
                  onChange={e => setRepo({...repo, readme: e.target.value})}
                  placeholder="Paste the repository README here for AI inspection..."
                />
                <div className="text-right text-[9px] font-mono opacity-30">
                  {repo.readme.length} / 1200 CHARS
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleVerify}
              disabled={loading}
              className="w-full py-4 bg-ink text-paper font-bold uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Activity className="w-4 h-4" />
                  </motion.div>
                  AUDITING...
                </>
              ) : "RUN MULTI-CLAIM AUDIT"}
            </button>
            {error && <p className="text-accent-red font-mono text-[10px] uppercase text-center">{error}</p>}
          </div>
        </section>

        {/* Results / Sidebar */}
        <section className="order-1 lg:order-2">
          <AnimatePresence mode="wait">
            {!result || loading ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                className="border-2 border-dashed border-line p-10 text-center h-full flex flex-col items-center justify-center space-y-6"
              >
                <div className="grid grid-cols-2 gap-2 opacity-50">
                   <ShieldCheck className="w-8 h-8 mx-auto" />
                   <Github className="w-8 h-8 mx-auto" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif italic text-xl">Verification Pending</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest max-w-xs mx-auto">
                    Input hackathon claims and repository metadata to generate an evidence-based audit report.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                {/* Score Card */}
                <div className="editorial-card relative overflow-hidden">
                  <div className="absolute right-[-10px] top-[-10px] opacity-5">
                    <Award className="w-32 h-32" />
                  </div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">Overall Trust Score</span>
                      <div className="score-display">{result.overall_trust_score}</div>
                    </div>
                    <div className="text-right">
                       <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">Confid.</span>
                       <div className="font-serif italic text-xl">{result.confidence_level}%</div>
                    </div>
                  </div>
                  <div className={`verdict-tag ${getVerdictTagClass(result.verdict)}`}>
                    {result.verdict}
                  </div>
                  <div className="mt-6 font-serif italic text-base leading-relaxed border-t border-line pt-4">
                    {result.verdict_summary}
                  </div>
                </div>

                {/* Repo Health */}
                <div className="border border-line p-5 bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 opacity-40" />
                    <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold">Repo Health Assessment</h3>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                     <span className="font-serif italic text-lg">{result.repo_health.assessment}</span>
                  </div>
                  <p className="text-[11px] opacity-60 leading-tight">{result.repo_health.reason}</p>
                </div>

                {/* Individual Claims */}
                <div className="space-y-4">
                  <h3 className="editorial-title">Evidence Cross-Reference</h3>
                  <div className="space-y-3">
                    {result.claim_verdicts.map((v, i) => (
                      <div key={i} className="p-3 border border-line bg-white/50 space-y-2 group">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(v.status)}
                            <span className="text-[9px] font-mono uppercase tracking-widest font-bold">{v.status}</span>
                          </div>
                          <div className={`text-[10px] font-mono ${v.trust_impact >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                            {v.trust_impact > 0 ? '+' : ''}{v.trust_impact}
                          </div>
                        </div>
                        <p className="font-serif italic text-xs leading-tight opacity-90">"{v.claim}"</p>
                        <p className="text-[10px] leading-snug opacity-40 group-hover:opacity-100 transition-opacity italic">
                          <span className="font-bold">Proof:</span> {v.evidence_found}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score Breakdown Table */}
                <div className="bg-ink text-paper p-5 space-y-4">
                   <h3 className="text-[9px] font-mono uppercase tracking-[0.3em] border-b border-paper/20 pb-2 flex items-center gap-2">
                     <Award className="w-3 h-3" /> Audit Score Breakdown
                   </h3>
                   <div className="space-y-2 font-mono text-[10px]">
                      <div className="flex justify-between opacity-40">
                         <span>BASE_SCORE_CREDIT</span>
                         <span>+100</span>
                      </div>
                      {result.score_breakdown.deductions.map((d, i) => (
                        <div key={i} className="flex justify-between text-accent-red">
                           <span className="truncate pr-4 flex items-center gap-1"><TrendingDown className="w-2 h-2" /> {d.reason}</span>
                           <span className="flex-shrink-0">{d.points}</span>
                        </div>
                      ))}
                      {result.score_breakdown.additions.map((a, i) => (
                        <div key={i} className="flex justify-between text-accent-green">
                           <span className="truncate pr-4 flex items-center gap-1"><TrendingUp className="w-2 h-2" /> {a.reason}</span>
                           <span className="flex-shrink-0">+{a.points}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-paper/30 pt-2 font-bold text-base">
                         <span>TOTAL_AUDIT_SCORE</span>
                         <span>{result.overall_trust_score}</span>
                      </div>
                   </div>
                </div>

                {/* Judge Probes */}
                <div className="space-y-4">
                  <h3 className="editorial-title">Judge Probe Questions</h3>
                  <div className="space-y-3">
                    {result.judge_probe_questions.map((q, i) => (
                      <div key={i} className="bg-white border-l-2 border-accent-yellow p-3 text-xs font-serif italic leading-relaxed shadow-sm">
                        {q}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <footer className="mt-12 border-t border-line pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] font-mono uppercase tracking-[0.2em] opacity-40">
        <div className="flex items-center gap-4">
          <span>OBJECTIVE_ANALYSIS_MOD_4</span>
          <span>//</span>
          <span>TIMESTAMP: {new Date().toISOString().replace('T', ' ').split('.')[0]} UTC</span>
        </div>
        <div className="flex gap-6">
           <a href="#" className="hover:text-ink transition-colors flex items-center gap-1"><ExternalLink className="w-2 h-2" /> Verification Ethics</a>
           <a href="#" className="hover:text-ink transition-colors flex items-center gap-1"><ExternalLink className="w-2 h-2" /> Audit Log</a>
        </div>
      </footer>
    </div>
  );
}
