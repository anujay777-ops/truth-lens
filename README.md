# 🔍 TruthLens AI

**Objective Evidence-Based Verification for Startups & Developers.**

[**Live Demo »**](https://truth-lens7.vercel.app/)

TruthLens AI is a high-performance verification engine designed to bridge the gap between "what is claimed" and "what is built." Whether you're an investor reviewing a startup's pitch deck or an engineer verifying a candidate's GitHub profile, TruthLens uses the Gemini 1.5 Pro API to provide an objective, data-driven cross-examination of digital artifacts.

![Banner](https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2070)

---

## 🚀 Core Features

### 1. Dual Verification Modes
- **Startup Mode (Pitch Deck Audit):** Analyzes repository metadata (codebase, commit density, release history) against specific technical claims found in pitch decks or whitepapers.
- **Developer Mode (CV Validation):** Cross-references GitHub profile activity (contributions, original works, language proficiency) with claims found in resumes or LinkedIn profiles.

### 2. Intelligent Data Extraction
- **GitHub URL Parsing:** Automatically distinguishes between repository and user profile URLs.
- **Rich Metadata Acquisition:** Fetches everything from commit counts and stars to full README analysis and project topics.
- **Document Support:** Upload text or PDF artifacts to automatically extract claims using AI.

### 3. AI-Powered Verdict Engine
- Powered by **Google Gemini 1.5 Pro**.
- Provides a "Truth Score" for every individual claim.
- Generates detailed reasoning explaining *why* a claim was supported or refuted based on the evidence found.
- Differentiates between "Matches Evidence," "Partial Evidence," and "Contradicts Evidence."

---

## 🛠️ Tech Stack

- **Frontend:** React 18 with TypeScript.
- **Styling:** Tailwind CSS (Modern Editorial Aesthetic).
- **Backend:** Express.js (Node.js).
- **AI Engine:** Google Generative AI (Gemini 1.5 Pro).
- **Animations:** Motion (Framer Motion).
- **Icons:** Lucide React.

---

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- A Google AI Studio API Key (GEMINI_API_KEY)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/truthlens-ai.git
   cd truthlens-ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

---

## 📖 Usage Guide

1. **Paste a Link:** Enter any GitHub repository or profile URL.
2. **Fetch Metrics:** Click "Fetch Metrics" to pull the latest metadata.
3. **Define Claims:** Add the claims you wish to verify (or upload a PDF/Text file to extract them).
4. **Analyze:** Hit "RUN VERIFICATION" to let the AI process the correlation between the claims and the evidence.
5. **Review:** Look through the detailed report, including the evidence snippets used for the verdict.

---

## 🎨 Design Philosophy

TruthLens follows a **"Technical Editorial"** aesthetic:
- **Swiss Grid Layout:** Clean, structured information density.
- **Subtle Motion:** Purposeful transitions that mirror the "scanning" and "verification" process.
- **High Contrast:** Focus on readability and data clarity.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

This project is licensed under the MIT License.

---

*Built with ❤️ for the future of objective assessment.*
