/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, ChangeEvent } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  AlertTriangle, 
  ChevronRight, 
  Terminal, 
  Cpu, 
  Plus,
  Upload,
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
  TrendingUp,
  User,
  Briefcase,
  Code2,
  Calendar,
  Globe,
  Stars,
  Layout
} from "lucide-react";

type Mode = "startup" | "developer";

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

interface ProfileData {
  username: string;
  bio: string;
  public_repos: number;
  followers: number;
  account_age_years: number;
  top_languages: string[];
  total_commits_approx: number;
  original_repos: number;
  forked_repos: number;
  has_pinned_repos: boolean;
  recent_activity: "active" | "moderate" | "low" | "dormant";
  longest_streak_days: number;
  readme_profile: "yes" | "no";
  notable_repos: {
    name: string;
    stars: number;
    description: string;
    language: string;
    commit_count: number;
  }[];
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
  trust_impact?: number;
  score_impact?: number;
}

interface ScoreAdjustment {
  reason: string;
  points: number;
}

interface VerificationResult {
  mode: Mode;
  // Startup specific fields
  overall_trust_score?: number;
  verdict?: "VERIFIED" | "PARTIALLY VERIFIED" | "UNVERIFIED" | "HIGH RISK";
  verdict_summary?: string;
  repo_health?: {
    assessment: "STRONG" | "MODERATE" | "WEAK" | "EMPTY";
    reason: string;
  };
  claim_verdicts?: ClaimVerdict[];
  judge_probe_questions?: string[];
  
  // Developer specific fields
  candidate_score?: number;
  hire_signal?: "STRONG YES" | "LEAN YES" | "NEUTRAL" | "LEAN NO" | "STRONG NO";
  summary_for_recruiter?: string;
  cv_claim_verdicts?: ClaimVerdict[];
  tech_stack_reality?: {
    claimed: string[];
    evidenced: string[];
    gaps: string[];
    bonuses: string[];
  };
  activity_assessment?: {
    pattern: "CONSISTENT" | "BURST" | "DEADLINE_DRIVEN" | "DORMANT" | "JUST_STARTED";
    interpretation: string;
  };
  depth_vs_breadth?: {
    profile: "DEEP_SPECIALIST" | "BROAD_GENERALIST" | "BALANCED" | "INSUFFICIENT_DATA";
    explanation: string;
  };
  red_flags?: RiskFlag[];
  interview_questions?: string[];

  // Shared fields
  confidence_level: number;
  risk_flags?: RiskFlag[];
  green_flags: string[];
  score_breakdown: {
    base: number;
    deductions: ScoreAdjustment[];
    additions: ScoreAdjustment[];
  };
}

const SYSTEM_INSTRUCTION = `You are TruthLens AI — a dual-mode, evidence-based verification engine.

MODE 1 — STARTUP VERIFY: Cross-references what a startup *claims* in their pitch against their GitHub repo.
Scoring Rules (Startup):
Start at 100.
DEDUCTIONS:
- Claimed scale (users/revenue) with no backend or infra evidence → -30
- Claimed AI/ML feature with no model files or ML libraries in repo → -25
- Commit count < 15 but pitch implies months of work → -20
- Unverifiable metric (%, speed, users) per instance → -10 each (max -30)
- README missing or template only → -15
- No releases + claims production-ready → -10
- Repo description contradicts pitch claims → -20
ADDITIONS:
- Technical detail in claim matches repo structure exactly → +10 (max +20)
- 50+ commits → +10
- Working demo link in README → +10
- Appropriately scoped claims for a hackathon → +10
- Dependencies match claimed stack → +5

MODE 2 — DEVELOPER VERIFY: Cross-references what a developer *claims* on their CV or LinkedIn against their GitHub profile activity.
Scoring Rules (Developer):
Start at 100.
DEDUCTIONS:
- Claims expertise in a language with zero repos in that language → -25 per gap (max -50)
- Account age < 1 year but CV claims years of experience → -20
- >80% of repos are forks with no original work → -25
- All repos have <5 commits (tutorial or throwaway code) → -20
- Claims "open source contributor" with no stars, forks, or PRs → -15
- No activity in past 6 months → -10
- Pinned repos are all forks → -10
ADDITIONS:
- Repo with 20+ stars in claimed specialty → +15
- Consistent contribution activity (no 3-month gaps) → +10
- Original projects that match job description requirements → +15 (max +20)
- Has a README profile (shows professional presentation) → +5
- Contributions to well-known open source repos → +15
- Diverse languages showing real-world adaptability → +10

TONE RULES (BOTH MODES):
- Be analytical, never harsh. Surface evidence, not verdicts about character.
- summary_for_recruiter and verdict_summary must be readable by a non-technical person.
- interview_questions and judge_probe_questions should sound professional and curious.
- Acknowledge genuine effort before listing gaps.
- Return ONLY raw JSON matching the requested mode's schema. No preamble.`;

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const STARTUP_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING },
    overall_trust_score: { type: Type.INTEGER },
    confidence_level: { type: Type.INTEGER },
    verdict: { type: Type.STRING },
    verdict_summary: { type: Type.STRING },
    repo_health: {
      type: Type.OBJECT,
      properties: {
        assessment: { type: Type.STRING },
        reason: { type: Type.STRING }
      }
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
        }
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
        }
      }
    },
    green_flags: { type: Type.ARRAY, items: { type: Type.STRING } },
    judge_probe_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    score_breakdown: {
      type: Type.OBJECT,
      properties: {
        base: { type: Type.INTEGER },
        deductions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { reason: { type: Type.STRING }, points: { type: Type.INTEGER } } } },
        additions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { reason: { type: Type.STRING }, points: { type: Type.INTEGER } } } }
      }
    }
  },
  required: ["mode", "overall_trust_score", "verdict", "verdict_summary", "claim_verdicts", "confidence_level", "green_flags", "score_breakdown"]
};

const DEVELOPER_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING },
    candidate_score: { type: Type.INTEGER },
    hire_signal: { type: Type.STRING },
    summary_for_recruiter: { type: Type.STRING },
    confidence_level: { type: Type.INTEGER },
    cv_claim_verdicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          claim: { type: Type.STRING },
          status: { type: Type.STRING },
          evidence_found: { type: Type.STRING },
          score_impact: { type: Type.INTEGER }
        }
      }
    },
    tech_stack_reality: {
      type: Type.OBJECT,
      properties: {
        claimed: { type: Type.ARRAY, items: { type: Type.STRING } },
        evidenced: { type: Type.ARRAY, items: { type: Type.STRING } },
        gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
        bonuses: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    activity_assessment: {
      type: Type.OBJECT,
      properties: {
        pattern: { type: Type.STRING },
        interpretation: { type: Type.STRING }
      }
    },
    depth_vs_breadth: {
      type: Type.OBJECT,
      properties: {
        profile: { type: Type.STRING },
        explanation: { type: Type.STRING }
      }
    },
    red_flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          flag: { type: Type.STRING },
          severity: { type: Type.STRING },
          reason: { type: Type.STRING }
        }
      }
    },
    green_flags: { type: Type.ARRAY, items: { type: Type.STRING } },
    interview_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    score_breakdown: {
      type: Type.OBJECT,
      properties: {
        base: { type: Type.INTEGER },
        deductions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { reason: { type: Type.STRING }, points: { type: Type.INTEGER } } } },
        additions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { reason: { type: Type.STRING }, points: { type: Type.INTEGER } } } }
      }
    }
  },
  required: ["mode", "candidate_score", "hire_signal", "summary_for_recruiter", "cv_claim_verdicts", "confidence_level", "green_flags", "score_breakdown"]
};

export default function App() {
  const [mode, setMode] = useState<Mode>("startup");
  const [githubUrl, setGithubUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [startupClaims, setStartupClaims] = useState<string[]>([""]);
  const [cvClaims, setCvClaims] = useState<string[]>([""]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const text = await file.text();
      const prompt = mode === "startup" 
        ? `Extract exactly 5 key technical or business claims from this pitch deck transcript. Return them as a simple numbered list of sentences. 
           TRANSCRIPT: ${text.substring(0, 5000)}`
        : `Extract exactly 5 key professional claims/achievements from this CV. Return them as a simple numbered list of sentences.
           CV CONTENT: ${text.substring(0, 5000)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      const claimsStr = response.text || "";
      const extracted = claimsStr.split('\n').filter(l => l.match(/^\d\./)).map(l => l.replace(/^\d\.\s*/, '').trim());
      
      if (extracted.length > 0) {
        if (mode === "startup") setStartupClaims(extracted.slice(0, 5));
        else setCvClaims(extracted.slice(0, 5));
      }
    } catch (err: any) {
      setError("File extraction failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleExtract = async () => {
    if (!githubUrl.trim() || !githubUrl.includes("github.com")) {
      setError("Please provide a valid GitHub profile or repository URL.");
      return;
    }

    setIsExtracting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/github/extract?url=${encodeURIComponent(githubUrl)}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch metadata");
      }
      
      const result = await res.json();

      if (result.mode === "startup") {
        setMode("startup");
        setRepo(result.data);
      } else {
        setMode("developer");
        setProfile(result.data);
      }
    } catch (err: any) {
      setError("Extraction failed: " + err.message);
    } finally {
      setIsExtracting(false);
    }
  };

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

  const [profile, setProfile] = useState<ProfileData>({
    username: "",
    bio: "",
    public_repos: 0,
    followers: 0,
    account_age_years: 1,
    top_languages: [],
    total_commits_approx: 0,
    original_repos: 0,
    forked_repos: 0,
    has_pinned_repos: false,
    recent_activity: "moderate",
    longest_streak_days: 0,
    readme_profile: "no",
    notable_repos: []
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addClaim = () => {
    if (mode === "startup" && startupClaims.length < 5) setStartupClaims([...startupClaims, ""]);
    if (mode === "developer" && cvClaims.length < 5) setCvClaims([...cvClaims, ""]);
  };

  const updateClaim = (index: number, value: string) => {
    if (mode === "startup") {
      const newClaims = [...startupClaims];
      newClaims[index] = value;
      setStartupClaims(newClaims);
    } else {
      const newClaims = [...cvClaims];
      newClaims[index] = value;
      setCvClaims(newClaims);
    }
  };

  const removeClaim = (index: number) => {
    if (mode === "startup" && startupClaims.length > 1) {
      setStartupClaims(startupClaims.filter((_, i) => i !== index));
    } else if (mode === "developer" && cvClaims.length > 1) {
      setCvClaims(cvClaims.filter((_, i) => i !== index));
    }
  };

  const addNotableRepo = () => {
    setProfile({
      ...profile,
      notable_repos: [...profile.notable_repos, { name: "", stars: 0, description: "", language: "", commit_count: 0 }]
    });
  };

  const updateNotableRepo = (index: number, field: string, value: any) => {
    const newRepos = [...profile.notable_repos];
    newRepos[index] = { ...newRepos[index], [field]: value };
    setProfile({ ...profile, notable_repos: newRepos });
  };

  const handleVerify = async () => {
    setLoading(true);
    setError(null);

    try {
      let input: any;
      let schema: any;
      
      if (mode === "startup") {
        const validClaims = startupClaims.filter(c => c.trim().length > 0);
        if (validClaims.length === 0 || !repo.name.trim()) {
           throw new Error("Please provide at least one claim and repository name.");
        }
        input = { mode: "startup", claims: validClaims, repo: { ...repo, readme: repo.readme.substring(0, 1500) } };
        schema = STARTUP_RESPONSE_SCHEMA;
      } else {
        const validClaims = cvClaims.filter(c => c.trim().length > 0);
        if (validClaims.length === 0 || !profile.username.trim()) {
           throw new Error("Please provide at least one CV claim and GitHub username.");
        }
        input = { mode: "developer", cv_claims: validClaims, profile };
        schema = DEVELOPER_RESPONSE_SCHEMA;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `VERIFY THIS DATA FOR MODE: ${mode}\n\n${JSON.stringify(input, null, 2)}`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: schema as any,
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

  const getVerdictTagClass = (verdict?: string) => {
    switch (verdict) {
      case "VERIFIED": case "STRONG YES": return "bg-accent-green text-paper";
      case "PARTIALLY VERIFIED": case "LEAN YES": return "bg-accent-yellow text-ink";
      case "UNVERIFIED": case "NEUTRAL": return "bg-ink text-paper";
      case "HIGH RISK": case "LEAN NO": case "STRONG NO": return "bg-accent-red text-paper";
      default: return "bg-ink text-paper";
    }
  };

  return (
    <div className="min-h-screen bg-paper p-4 md:p-10 flex flex-col font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-ink pb-4 mb-8 gap-4">
        <div>
          <div className="font-serif text-3xl font-black tracking-tighter uppercase leading-none mb-1">
            TruthLens AI
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest opacity-60">
            Professional Verification Protokol // v3.0.0
          </div>
        </div>

        <div className="flex bg-line/20 p-1 border border-line">
           <button 
            onClick={() => { setMode("startup"); setResult(null); }}
            className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-all ${mode === "startup" ? 'bg-ink text-paper' : 'hover:bg-line/30'}`}
           >
             Startup Verify
           </button>
           <button 
            onClick={() => { setMode("developer"); setResult(null); }}
            className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-all ${mode === "developer" ? 'bg-ink text-paper' : 'hover:bg-line/30'}`}
           >
             Developer Verify
           </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-12 flex-grow">
        {/* Input Area */}
        <section className="space-y-10 order-2 lg:order-1">
          {/* URL Extraction Bar */}
          <div className="bg-ink text-paper p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 opacity-70" />
              <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] font-bold">Automated Evidence Source</h3>
            </div>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="https://github.com/username/repo OR https://github.com/username"
                className="flex-grow bg-white/10 border border-paper/20 p-3 font-mono text-xs focus:outline-none focus:border-paper/40 transition-colors"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />
              <button 
                onClick={handleExtract}
                disabled={isExtracting}
                className="bg-paper text-ink px-6 py-3 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50"
              >
                {isExtracting ? "SEARCHING..." : "FETCH METRICS"}
              </button>
            </div>
            <p className="text-[9px] opacity-40 font-mono italic">
              * TruthLens will automatically distinguish between repository and profile links.
            </p>
          </div>

          {/* Claims Section */}
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-line pb-2">
              <h2 className="font-serif italic text-xl">
                {mode === "startup" ? "Pitch Deck Claims" : "CV & Experience Claims"}
              </h2>
              <div className="flex gap-2">
                <label className="cursor-pointer p-1 hover:bg-ink hover:text-paper rounded transition-colors" title="Upload Transcript/CV">
                   {isUploading ? <Activity className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                   <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.pdf" />
                </label>
                <button 
                  onClick={addClaim}
                  disabled={(mode === "startup" ? startupClaims.length : cvClaims.length) >= 5}
                  className="p-1 hover:bg-ink hover:text-paper rounded transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              {(mode === "startup" ? startupClaims : cvClaims).map((claim, index) => (
                <div key={index} className="flex gap-4 group">
                  <div className="font-mono text-xs opacity-30 mt-3">{index + 1}</div>
                  <textarea 
                    value={claim || ""}
                    onChange={(e) => updateClaim(index, e.target.value)}
                    placeholder={mode === "startup" ? "e.g. 'Proprietary AI model with 99% accuracy'" : "e.g. 'Expert in React with 5+ years experience'"}
                    className="flex-grow bg-white border border-line p-3 font-serif text-sm italic focus:outline-none focus:border-ink resize-none h-16 shadow-sm"
                  />
                  <button 
                    onClick={() => removeClaim(index)}
                    className="opacity-0 group-hover:opacity-40 hover:opacity-100 p-1 self-start text-accent-red"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence/Artifacts Section */}
          <div className="space-y-6">
            <h2 className="editorial-title">
              {mode === "startup" ? "Repository Artifacts" : "GitHub Profile Activity"}
            </h2>
            
            <div className="bg-white/40 p-6 border border-line">
              {mode === "startup" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Name</label>
                        <input className="w-full bg-white border border-line p-2 text-sm" value={repo.name || ""} onChange={e => setRepo({...repo, name: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Language</label>
                        <input className="w-full bg-white border border-line p-2 text-sm" value={repo.language || ""} onChange={e => setRepo({...repo, language: e.target.value})} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Brief Description</label>
                      <textarea className="w-full bg-white border border-line p-2 text-sm h-16" value={repo.description || ""} onChange={e => setRepo({...repo, description: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Commits</label>
                        <input type="number" className="w-full bg-white border border-line p-2 text-sm" value={repo.commit_count || 0} onChange={e => setRepo({...repo, commit_count: parseInt(e.target.value) || 0})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Stars</label>
                        <input type="number" className="w-full bg-white border border-line p-2 text-sm" value={repo.stars || 0} onChange={e => setRepo({...repo, stars: parseInt(e.target.value) || 0})} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">README Data (First 1200 chars)</label>
                    <textarea 
                      className="w-full h-full min-h-[150px] bg-white border border-line p-3 font-mono text-[10px]" 
                      value={repo.readme || ""} 
                      onChange={e => setRepo({...repo, readme: e.target.value})}
                      placeholder="Paste README content here..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Basic Profile Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Username</label>
                      <input className="w-full bg-white border border-line p-2 text-sm" value={profile.username || ""} onChange={e => setProfile({...profile, username: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Total Commits (Approx)</label>
                      <input type="number" className="w-full bg-white border border-line p-2 text-sm" value={profile.total_commits_approx || 0} onChange={e => setProfile({...profile, total_commits_approx: parseInt(e.target.value) || 0})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Account Age (Years)</label>
                      <input type="number" className="w-full bg-white border border-line p-2 text-sm" value={profile.account_age_years || 0} onChange={e => setProfile({...profile, account_age_years: parseInt(e.target.value) || 0})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Original Repos</label>
                          <input type="number" className="w-full bg-white border border-line p-2 text-sm" value={profile.original_repos || 0} onChange={e => setProfile({...profile, original_repos: parseInt(e.target.value) || 0})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Forked Repos</label>
                          <input type="number" className="w-full bg-white border border-line p-2 text-sm" value={profile.forked_repos || 0} onChange={e => setProfile({...profile, forked_repos: parseInt(e.target.value) || 0})} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Recent Activity</label>
                        <select 
                          className="w-full bg-white border border-line p-2 text-sm" 
                          value={profile.recent_activity || "moderate"} 
                          onChange={e => setProfile({...profile, recent_activity: e.target.value as any})}
                        >
                          <option value="active">Active</option>
                          <option value="moderate">Moderate</option>
                          <option value="low">Low</option>
                          <option value="dormant">Dormant</option>
                        </select>
                      </div>
                   
                      <div className="grid grid-cols-2 gap-4">
                         <div className="flex items-center gap-2">
                           <input 
                            type="checkbox" 
                            id="pinned" 
                            checked={profile.has_pinned_repos} 
                            onChange={e => setProfile({...profile, has_pinned_repos: e.target.checked})} 
                           />
                           <label htmlFor="pinned" className="text-[10px] font-mono uppercase tracking-widest">Has Pinned Repos</label>
                         </div>
                         <div className="flex items-center gap-2">
                           <input 
                            type="checkbox" 
                            id="readme_p" 
                            checked={profile.readme_profile === "yes"} 
                            onChange={e => setProfile({...profile, readme_profile: e.target.checked ? "yes" : "no"})} 
                           />
                           <label htmlFor="readme_p" className="text-[10px] font-mono uppercase tracking-widest">README Profile</label>
                         </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                       <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Notable Repositories (Stars / Description / Commits)</label>
                       <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                          {profile.notable_repos?.map((nr, idx) => (
                            <div key={idx} className="p-3 border border-line bg-white space-y-2">
                               <input 
                                placeholder="Repo Name" 
                                className="w-full text-xs font-bold border-b border-line focus:outline-none" 
                                value={nr.name || ""} 
                                onChange={e => updateNotableRepo(idx, 'name', e.target.value)}
                               />
                               <div className="grid grid-cols-2 gap-2">
                                  <input type="number" placeholder="Stars" className="w-full text-[10px] border border-line p-1" value={nr.stars || 0} onChange={e => updateNotableRepo(idx, 'stars', parseInt(e.target.value) || 0)} />
                                  <input type="number" placeholder="Commits" className="w-full text-[10px] border border-line p-1" value={nr.commit_count || 0} onChange={e => updateNotableRepo(idx, 'commit_count', parseInt(e.target.value) || 0)} />
                               </div>
                            </div>
                          ))}
                          <button onClick={addNotableRepo} className="w-full py-2 border-2 border-dashed border-line text-[10px] uppercase font-bold opacity-40 hover:opacity-100 transition-opacity">
                            + Add Notable Project
                          </button>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleVerify}
              disabled={loading}
              className="w-full py-4 bg-ink text-paper font-bold uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <Activity className="w-4 h-4" />
                  </motion.div>
                  AUDITING EVIDENCE...
                </>
              ) : `RUN ${mode.toUpperCase()} VERIFICATION`}
            </button>
            {error && <p className="text-accent-red font-mono text-[10px] uppercase text-center">{error}</p>}
          </div>
        </section>

        {/* Results Sidebar */}
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
                <div className="flex gap-4 opacity-50">
                   {mode === "startup" ? <Briefcase className="w-10 h-10" /> : <User className="w-10 h-10" />}
                   <ShieldCheck className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif italic text-xl">System Standby</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest max-w-xs mx-auto">
                    {mode === "startup" 
                      ? "Cross-referencing pitch deck metrics against repository technical evidence." 
                      : "Verifying professional developer experience against GitHub activity signals."}
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
                {/* Score and Signal */}
                <div className="editorial-card relative overflow-hidden">
                   {/* Background Gauge Visual */}
                   <div 
                     className="absolute bottom-0 left-0 h-1 bg-ink/10 transition-all duration-1000" 
                     style={{ width: `${result.mode === "startup" ? result.overall_trust_score : result.candidate_score}%` }}
                   />
                   
                   <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">
                          {result.mode === "startup" ? "Trust Integrity Score" : "Candidate Evidence Score"}
                        </span>
                        <div className="score-display flex items-baseline gap-2">
                          {result.mode === "startup" ? result.overall_trust_score : result.candidate_score}
                          <span className="text-sm font-mono opacity-20">/100</span>
                        </div>
                      </div>
                      <div className="text-right">
                         <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">Confidence</span>
                         <div className="font-serif italic text-xl">{result.confidence_level}%</div>
                         {/* Confidence Dot Matrix Visual */}
                         <div className="flex gap-0.5 mt-1 justify-end">
                            {[...Array(10)].map((_, i) => (
                              <div key={i} className={`w-1 h-3 border ${i < (result.confidence_level/10) ? 'bg-ink border-ink' : 'border-ink/20'}`} />
                            ))}
                         </div>
                      </div>
                   </div>

                   <div className={`verdict-tag ${getVerdictTagClass(result.mode === "startup" ? result.verdict : result.hire_signal)}`}>
                      {result.mode === "startup" ? result.verdict : result.hire_signal}
                   </div>

                   <div className="mt-6 font-serif italic text-base leading-relaxed border-t border-line pt-4 text-ink/90">
                      {result.mode === "startup" ? result.verdict_summary : result.summary_for_recruiter}
                   </div>
                </div>

                {/* Mode Specific Assessments */}
                {result.mode === "startup" && result.repo_health && (
                  <div className="p-4 border border-line bg-white space-y-2">
                    <h4 className="text-[9px] font-mono uppercase tracking-widest font-black opacity-40">Repo Health</h4>
                    <div className="flex justify-between items-baseline">
                      <span className="font-serif text-lg italic">{result.repo_health.assessment}</span>
                      <span className="text-[10px] opacity-60">{result.repo_health.reason}</span>
                    </div>
                  </div>
                )}

                {result.mode === "developer" && (
                  <div className="space-y-6">
                    {/* Tech Stack Reality */}
                    <div className="p-5 border border-line bg-white space-y-4">
                       <h4 className="editorial-title text-sm">Tech Stack Reality Check</h4>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <p className="text-[9px] font-mono uppercase opacity-40">Evidenced</p>
                             <div className="flex flex-wrap gap-1">
                                {result.tech_stack_reality?.evidenced?.map((s, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-accent-green/10 text-accent-green text-[9px] font-mono border border-accent-green/20">{s}</span>
                                ))}
                             </div>
                          </div>
                          <div className="space-y-2">
                             <p className="text-[9px] font-mono uppercase opacity-40">Gaps/Missing</p>
                             <div className="flex flex-wrap gap-1">
                                {result.tech_stack_reality?.gaps?.map((s, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-accent-red/10 text-accent-red text-[9px] font-mono border border-accent-red/20">{s}</span>
                                ))}
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Activity Pattern */}
                    <div className="p-5 border border-line bg-white flex justify-between items-center group">
                       <div>
                         <h4 className="text-[9px] font-mono uppercase opacity-40 mb-1">Activity Pattern</h4>
                         <p className="font-serif italic text-lg leading-none">{result.activity_assessment?.pattern}</p>
                       </div>
                       <p className="text-[10px] text-right max-w-[150px] italic opacity-60 leading-tight">
                         {result.activity_assessment?.interpretation}
                       </p>
                    </div>
                  </div>
                )}

                {/* Claims Verification */}
                <div className="space-y-4">
                  <h3 className="editorial-title">Evidence Cross-Reference</h3>
                  <div className="space-y-3">
                    {(result.mode === "startup" ? result.claim_verdicts : result.cv_claim_verdicts)?.map((v, i) => (
                      <div key={i} className="p-3 border border-line bg-white/50 space-y-2 group">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono uppercase tracking-widest font-black opacity-60">Audit Trace {i+1}</span>
                            <span className={`px-1 text-[8px] font-bold ${v.status === 'SUPPORTED' ? 'text-accent-green' : v.status === 'UNSUPPORTED' ? 'text-accent-red' : 'text-accent-yellow'}`}>{v.status}</span>
                          </div>
                          <span className={`text-[10px] font-mono ${(v.trust_impact ?? v.score_impact ?? 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                            {(v.trust_impact ?? v.score_impact ?? 0) > 0 ? '+' : ''}{v.trust_impact ?? v.score_impact ?? 0}
                          </span>
                        </div>
                        <p className="font-serif italic text-xs leading-tight opacity-90">"{v.claim}"</p>
                        <p className="text-[10px] leading-snug opacity-40 group-hover:opacity-100 transition-opacity italic">
                          <span className="font-bold">Evidence:</span> {v.evidence_found}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score Table */}
                <div className="bg-ink text-paper p-6 space-y-4 shadow-xl">
                   <h3 className="text-[9px] font-mono uppercase tracking-[0.3em] border-b border-paper/20 pb-2">Scoring Decomposition</h3>
                   <div className="space-y-2 font-mono text-[10px]">
                      <div className="flex justify-between opacity-40">
                         <span>CREDIT_BASE_ALLOCATION</span>
                         <span>+100</span>
                      </div>
                      {result.score_breakdown.deductions?.map((d, i) => (
                        <div key={i} className="flex justify-between text-accent-red/80">
                           <span className="truncate pr-4">— {d.reason}</span>
                           <span>{d.points}</span>
                        </div>
                      ))}
                      {result.score_breakdown.additions?.map((a, i) => (
                        <div key={i} className="flex justify-between text-accent-green/80">
                           <span className="truncate pr-4">+ {a.reason}</span>
                           <span>+{a.points}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-paper/30 pt-3 font-bold text-lg leading-none mt-2">
                         <span>AUDIT_FINAL</span>
                         <span>{result.mode === "startup" ? result.overall_trust_score : result.candidate_score}</span>
                      </div>
                   </div>
                </div>

                {/* Interview / Probe Questions */}
                <div className="space-y-4">
                  <h3 className="editorial-title">
                     {result.mode === "startup" ? "Judge Probe Questions" : "Technical Interview Probes"}
                  </h3>
                  <div className="space-y-2">
                    {(result.mode === "startup" ? result.judge_probe_questions : result.interview_questions)?.map((q, i) => (
                      <div key={i} className="bg-white border-l-2 border-accent-yellow p-4 text-xs font-serif italic leading-relaxed shadow-sm">
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

      <footer className="mt-12 border-t border-line pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] font-mono uppercase tracking-[0.3em] opacity-40">
        <div className="flex items-center gap-3">
          <Terminal className="w-3 h-3" />
          <span>PROTC_MOD_6 // OBJECTIVE_VERIFICATION</span>
          <span>::</span>
          <span>{new Date().toISOString().replace('T', ' ').split('.')[0]}</span>
        </div>
        <div className="flex gap-8">
           <a href="#" className="hover:text-ink transition-colors">ETHICS_GUIDE</a>
           <a href="#" className="hover:text-ink transition-colors text-ink opacity-100 font-bold">MODE: {mode.toUpperCase()}</a>
        </div>
      </footer>
    </div>
  );
}
