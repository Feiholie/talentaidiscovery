/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Users, 
  Sparkles, 
  Trash2, 
  Copy, 
  Check, 
  Plus, 
  FileText, 
  ArrowUpDown, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Info,
  Loader2,
  Bookmark,
  Upload
} from "lucide-react";
import { extractTextFromFile } from "../utils/cvTextExtraction";

interface CandidateInput {
  id: string;
  name: string;
  cvText: string;
}

interface BEIQuestion {
  question: string;
  whatToLookFor: string;
}

interface ScoreBreakdown {
  mustHaveSkillsScore: number;
  niceToHaveSkillsScore: number;
  experienceScore: number;
  ownershipScore: number;
  achievementsScore: number;
  stabilityPenalty: number;
  hardRequirementCapApplied: boolean;
}

interface RankedCandidate {
  candidateId: string;
  name: string;
  score: number;
  fitSummary: string;
  strengths?: string[];
  gaps?: string[];
  // Optional: present with the new deterministic scoring engine. Kept
  // optional so this type also tolerates older cached/sample results.
  scoreBreakdown?: ScoreBreakdown;
}

interface TopCandidate {
  candidateId: string;
  name: string;
  score: number;
  suitabilitySummary: string;
  beiQuestions: BEIQuestion[];
}

interface AnalysisResults {
  analysisSummary: string;
  rankings: RankedCandidate[];
  top3: TopCandidate[];
}

interface CVBulkAnalyzerProps {
  userId: string;
  addToast: (message: string, type: "success" | "error" | "info") => void;
  darkMode: boolean;
}

// Highly realistic mock candidates for instant preview / load sample capability
const MOCK_SAMPLE_CANDIDATES: CandidateInput[] = [
  {
    id: "c_1",
    name: "Diana Wijaya",
    cvText: `DIANA WIJAYA
Email: diana.wijaya@email.com | Phone: +62 812-3456-7890 | Jakarta, Indonesia

SUMMARY
Lead Frontend Engineer with 8 years of professional experience specializing in React, Next.js, and TypeScript. Proven track record of architecting scalable web applications, optimizing performance (95+ Lighthouse scores), and mentoring high-performing engineering teams.

WORK EXPERIENCE
Lead Frontend Engineer | Shopee (2021 - Present)
- Led a team of 6 frontend engineers to rebuild the merchant dashboard using React 18 and Next.js, resulting in a 40% faster page load speed.
- Created Shopee's internal UI design system component library, used across 4 different engineering teams.
- Implemented robust state management strategies using Zustand and React Query, reducing API payload redundancy by 30%.

Senior Web Developer | Global Tech Startup (2018 - 2021)
- Spearheaded migration of legacy monolithic client-side application to React, Next.js, and Tailwind CSS.
- Handled SEO optimizations, server-side rendering configurations, and localized multi-language features.

SKILLS
Frontend: React, Next.js, React Native, TypeScript, JavaScript (ES6+), HTML5, CSS3, Tailwind CSS, SASS
State & Query: Zustand, Redux Toolkit, React Query, GraphQL
Tools & Operations: Webpack, Vite, Git, Jest, Testing Library, CI/CD pipelines`
  },
  {
    id: "c_2",
    name: "Andi Pratama",
    cvText: `ANDI PRATAMA
Email: andi.pratama@email.com | Phone: +62 821-9876-5432 | Bandung, Indonesia

SUMMARY
Senior Software Engineer with over 6 years of experience focused on building pixel-perfect, highly accessible user interfaces. Expert in React ecosystem, complex state handling, and interactive data visualization.

WORK EXPERIENCE
Senior Frontend Developer | GoTo Group (2020 - Present)
- Re-architected checkout flow using React Native and React, increasing conversion rate by 15%.
- Integrated complex D3.js and Recharts data visualizations for corporate merchant reporting tools.
- Mentored 4 junior and mid-level developers, enforcing modern clean code practices and rigorous code reviews.

React Developer | Software Solutions Lab (2018 - 2020)
- Designed and maintained custom CRM portals using React, Redux, and Bootstrap.
- Coordinated closely with backend teams to integrate RESTful APIs and WebSocket-based notification engines.

SKILLS
Core Technologies: React, TypeScript, JavaScript, HTML/CSS, Tailwind CSS
Libraries & Data: Redux, Context API, D3.js, Recharts, Axios
Testing: Jest, Cypress, Storybook`
  },
  {
    id: "c_3",
    name: "Siti Rahma",
    cvText: `SITI RAHMA
Email: siti.rahma@email.com | Bandung, Indonesia

SUMMARY
Enthusiastic Frontend Developer with 3 years of hands-on experience building web applications using React and Tailwind CSS. Passionate about creating responsive, beautiful, and intuitive user experiences.

WORK EXPERIENCE
React Developer | Creative Software House (2022 - Present)
- Developed and deployed over 12 fully responsive client web applications using React and Vite.
- Implemented modern UI/UX design components with Tailwind CSS and Framer Motion for smooth transitions.
- Improved web performance by optimizing image assets and lazy-loading heavy React components.

Junior Frontend Developer | Digital Marketing Agency (2021 - 2022)
- Coded semantic HTML layouts, custom landing pages, and interactive promotional micro-sites.

SKILLS
Technologies: React, JavaScript, HTML, CSS, Tailwind CSS, Sass, Git, Figma, Webflow`
  },
  {
    id: "c_4",
    name: "Budi Santoso",
    cvText: `BUDI SANTOSO
Email: budi.santoso@email.com | Jakarta, Indonesia

SUMMARY
Robust Senior Backend Engineer with 7 years of specialization in building scalable backend services, microservices architecture, API design, and cloud database optimization. Proficient in Node.js, Go, and PostgreSQL.

WORK EXPERIENCE
Senior Backend Engineer | Traveloka (2019 - Present)
- Designed and optimized high-concurrency search engines for hotel bookings using Node.js and Elasticsearch.
- Designed schema architectures and wrote optimized queries in PostgreSQL, reducing query latency by 50%.
- Deployed microservices on AWS using Docker, ECS, and Kubernetes.

Backend Developer | FinTech Pioneer (2017 - 2019)
- Developed secure transaction and billing APIs using Go (Golang) and MySQL.

SKILLS
Backend: Node.js, Go, Express, NestJS, RESTful APIs, gRPC
Databases: PostgreSQL, MySQL, Redis, MongoDB, Elasticsearch
DevOps: Docker, AWS (EC2, S3, RDS), Kubernetes, CI/CD`
  },
  {
    id: "c_5",
    name: "Eko Prasetyo",
    cvText: `EKO PRASETYO
Email: eko.pras@email.com | Surabaya, Indonesia

SUMMARY
Dedicated Junior Web Developer and recent Computer Science graduate. Eager to launch a career in software development. Possesses strong foundational knowledge of modern programming paradigms and basic web technologies.

EXPERIENCE
Frontend Developer Intern | local DevAgency (6 Months)
- Assisted in building simple static websites using HTML, CSS, and vanilla JavaScript.
- Learned basic React concepts and contributed to a simple responsive internal task-tracking app.

PROJECTS
Personal Todo App: Built a stateful Todo application using React, utilizing LocalStorage for data retention.
Portfolio Website: Designed and deployed personal portfolio site using React and Tailwind CSS.

SKILLS
Foundational: JavaScript, React (Basic), HTML5, CSS3, Git, Java, Python`
  }
];

export function CVBulkAnalyzer({ userId, addToast, darkMode }: CVBulkAnalyzerProps) {
  const [positionCriteria, setPositionCriteria] = useState("Senior React Developer with 5+ years experience, Next.js, and strong team mentorship/leadership skills.");
  const [candidates, setCandidates] = useState<CandidateInput[]>([]);
  const [newName, setNewName] = useState("");
  const [newCVText, setNewCVText] = useState("");
  const [bulkPasteText, setBulkPasteText] = useState("");
  const [inputMode, setInputMode] = useState<"upload" | "bulk" | "single">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  // File Upload Helper Functions
  const cleanFileName = (filename: string): string => {
    // Remove extension
    let name = filename.replace(/\.[^/.]+$/, "");
    // Replace underscores, dashes with space
    name = name.replace(/[_-]/g, " ");
    // Capitalize each word
    name = name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return name.trim();
  };

  const handleFileUpload = async (files: FileList) => {
    if (candidates.length >= 150) {
      addToast("Maximum limit of 150 candidates reached.", "error");
      return;
    }

    const availableSlots = 150 - candidates.length;
    const filesToProcess = Array.from(files).slice(0, availableSlots);

    if (files.length > availableSlots) {
      addToast(`Only processing first ${availableSlots} files. Maximum candidate limit is 150.`, "info");
    }

    const newUploadedCandidates: CandidateInput[] = [];
    const warnings: string[] = [];
    let failedCount = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const parsedName = cleanFileName(file.name);

      try {
        // REAL extraction (pdfjs-dist / mammoth) — this is the fix for the
        // "candidates who meet all criteria still score ~5%" bug. Previously
        // this branch generated fake boilerplate text instead of reading the
        // actual file, so the AI never saw the real candidate's CV content.
        const { text, warning } = await extractTextFromFile(file);

        if (warning) {
          warnings.push(`${parsedName}: ${warning}`);
        }

        // Only queue the candidate if we actually got usable text. Queuing
        // an empty/near-empty CV would silently produce a meaningless score
        // instead of surfacing the real problem (unreadable file).
        if (text && text.trim().length >= 40) {
          newUploadedCandidates.push({
            id: `uploaded_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
            name: parsedName,
            cvText: text
          });
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error("Error reading file", file.name, err);
        failedCount++;
        warnings.push(`${parsedName}: Gagal memproses file ini.`);
      }
    }

    if (newUploadedCandidates.length > 0) {
      setCandidates((prev) => [...prev, ...newUploadedCandidates]);
      addToast(`Successfully uploaded & parsed ${newUploadedCandidates.length} CV files!`, "success");
    }

    if (failedCount > 0) {
      addToast(
        `${failedCount} file tidak dapat diproses otomatis dan TIDAK dimasukkan ke antrian (lihat detail di bawah). Gunakan mode 'Single Add' untuk menempel teks CV tersebut secara manual.`,
        "error"
      );
    }

    // Surface every extraction warning individually so the recruiter knows
    // exactly which candidates need manual attention, instead of silently
    // screening low-quality/empty CV text.
    warnings.forEach((w) => addToast(w, "info"));
  };
  
  // Loading & Results
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [copiedQuestionId, setCopiedQuestionId] = useState<string | null>(null);

  // Loading animation simulation steps
  const steps = [
    "Reading CV profiles and parsing applicant texts...",
    "Extracting competencies, technical stacks, and years of experience...",
    "Evaluating candidate fitness score against position criteria...",
    "Performing batch comparisons and ranking top 3 qualified candidates...",
    "Formulating tailored Behavioral Event Interview (BEI/STAR) questions..."
  ];

  const handleLoadSamples = () => {
    setCandidates(MOCK_SAMPLE_CANDIDATES);
    addToast("Loaded 5 sample candidates of various experience levels!", "success");
  };

  const handleClearCandidates = () => {
    setCandidates([]);
    setResults(null);
    addToast("Cleared candidate queue.", "info");
  };

  const handleAddCandidateSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCVText.trim()) {
      addToast("Please fill in both candidate name and CV text.", "error");
      return;
    }
    if (candidates.length >= 150) {
      addToast("Maximum limit of 150 candidates reached.", "error");
      return;
    }

    const newCand: CandidateInput = {
      id: `c_${Date.now()}`,
      name: newName.trim(),
      cvText: newCVText.trim()
    };

    setCandidates((prev) => [...prev, newCand]);
    setNewName("");
    setNewCVText("");
    addToast(`Added ${newCand.name} to the screening queue.`, "success");
  };

  const handleAddBulkPaste = () => {
    if (!bulkPasteText.trim()) {
      addToast("Please paste CV text first.", "error");
      return;
    }

    // Split candidates by '===' or '---' lines, or double newline of format (Candidate Name: ...)
    const sections = bulkPasteText.split(/(?:===+|---+)/g);
    const addedList: CandidateInput[] = [];

    sections.forEach((sect, idx) => {
      const trimmed = sect.trim();
      if (!trimmed) return;

      // Extract first line as name, or check if we can parse Candidate Name
      const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      let name = `Candidate #${candidates.length + addedList.length + 1}`;
      
      // Attempt to extract name intelligently from first line
      const firstLine = lines[0];
      if (firstLine.toLowerCase().startsWith("name:") || firstLine.toLowerCase().startsWith("nama:")) {
        name = firstLine.replace(/^(?:name|nama):\s*/i, "").trim();
      } else if (firstLine.length < 40) {
        name = firstLine;
      }

      addedList.push({
        id: `c_${Date.now()}_${idx}`,
        name,
        cvText: trimmed
      });
    });

    if (addedList.length === 0) {
      addToast("No valid candidate formats detected. Try separating with '==='", "error");
      return;
    }

    if (candidates.length + addedList.length > 150) {
      addToast(`Cannot add ${addedList.length} items. Sourcing limit is 150.`, "error");
      return;
    }

    setCandidates((prev) => [...prev, ...addedList]);
    setBulkPasteText("");
    setInputMode("upload");
    addToast(`Successfully imported ${addedList.length} candidates in bulk!`, "success");
  };

  const handleRemoveCandidate = (id: string) => {
    setCandidates((prev) => prev.filter(c => c.id !== id));
    addToast("Removed candidate from queue.", "info");
  };

  const runAIBulkAnalysis = async () => {
    if (!positionCriteria.trim()) {
      addToast("Please specify the position criteria.", "error");
      return;
    }
    if (candidates.length === 0) {
      addToast("Please add at least one candidate CV to analyze.", "error");
      return;
    }

    setLoading(true);
    setLoadingStep(0);
    setResults(null);

    // Simulate stepping through stages for a high-quality humanized loader feel
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 2800);

    try {
      const response = await fetch("/api/cv-bulk-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionCriteria,
          candidates
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis request failed.");
      }

      const resJson = await response.json();
      setResults(resJson.data);
      addToast("AI Bulk Analysis completed! Sourcing rankings updated.", "success");
    } catch (err: any) {
      console.error(err);
      addToast(err.message || "Failed to analyze candidate CVs.", "error");
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  const copyQuestionToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestionId(id);
    setTimeout(() => setCopiedQuestionId(null), 2000);
    addToast("Copied BEI interview guide to clipboard!", "success");
  };

  const getScoreBreakdownTooltip = (breakdown?: ScoreBreakdown): string => {
    if (!breakdown) return "";
    const lines = [
      `Kompetensi inti (must-have): ${breakdown.mustHaveSkillsScore}`,
      `Nilai tambah (nice-to-have): ${breakdown.niceToHaveSkillsScore}`,
      `Kesesuaian pengalaman: ${breakdown.experienceScore}`,
      `Kepemilikan/senioritas: ${breakdown.ownershipScore}`,
      `Pencapaian terukur: ${breakdown.achievementsScore}`,
      `Penalti stabilitas kerja: -${breakdown.stabilityPenalty}`,
    ];
    if (breakdown.hardRequirementCapApplied) {
      lines.push("⚠ Skor dibatasi: persyaratan wajib tidak terverifikasi");
    }
    return lines.join("\n");
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40";
    if (score >= 60) return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40";
    return "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40";
  };

  return (
    <div id="cv_bulk_sourcing_section" className="space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-blue-600" />
            Bulk CV Screening & AI Ranking Center
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Upload up to 150 CVs in bulk, rank suitability against position requirements, and instantly generate customized Behavioral Event Interview (BEI/STAR) guides.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadSamples}
            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Load Sample Candidates
          </button>
          {candidates.length > 0 && (
            <button
              onClick={handleClearCandidates}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Queue ({candidates.length})
            </button>
          )}
        </div>
      </div>

      {/* CORE INPUT & QUEUE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* INPUT PANEL: CRITERIA & CANDIDATE ADDITION */}
        <div className="lg:col-span-5 space-y-6">
          {/* POSITION CRITERIA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              1. Position / Criteria (Kriteria Posisi)
            </label>
            <textarea
              value={positionCriteria}
              onChange={(e) => setPositionCriteria(e.target.value)}
              placeholder="Describe criteria (e.g., Senior React Developer with 5+ years experience, Next.js, and team leadership skills.)"
              rows={3}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs leading-relaxed"
            />
          </div>

          {/* CHOOSE METHOD */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                2. Input Candidates CV (Max 150)
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-100 dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => setInputMode("upload")}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    inputMode === "upload"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-100 dark:border-slate-850"
                      : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload files
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("bulk")}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    inputMode === "bulk"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-100 dark:border-slate-850"
                      : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Bulk Paste
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("single")}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    inputMode === "single"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-100 dark:border-slate-850"
                      : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Single Add
                </button>
              </div>
            </div>

            {inputMode === "upload" && (
              /* DRAG AND DROP FILE UPLOAD */
              <div 
                className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                  isDragging 
                    ? "border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 scale-[0.99]" 
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50/50 dark:hover:bg-slate-950/20"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) {
                    handleFileUpload(e.dataTransfer.files);
                  }
                }}
              >
                <input
                  type="file"
                  id="cv-file-uploader"
                  multiple
                  accept=".pdf,.docx,.doc,.txt,.md,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFileUpload(e.target.files);
                    }
                  }}
                />
                <label 
                  htmlFor="cv-file-uploader" 
                  className="flex flex-col items-center justify-center cursor-pointer space-y-2.5"
                >
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Drag & drop CV files here, or <span className="text-blue-600 dark:text-blue-400 hover:underline">browse</span>
                    </p>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Supports PDF, DOCX, TXT (Multiple selection up to 150 CVs)
                    </p>
                  </div>
                </label>
              </div>
            )}

            {inputMode === "bulk" && (
              /* BULK PASTE MODE */
              <div className="space-y-3 animate-fadeIn">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Paste multiple CVs. Separate each candidate with <code className="font-mono bg-slate-100 dark:bg-slate-800 text-blue-600 px-1 py-0.5 rounded">===</code> divider. Include the candidate's name on the first line.
                </p>
                <textarea
                  value={bulkPasteText}
                  onChange={(e) => setBulkPasteText(e.target.value)}
                  placeholder="Diana Wijaya&#10;Shopee Lead Engineer with React experience...&#10;===&#10;Andi Pratama&#10;Senior Web Developer GoTo..."
                  rows={8}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white font-mono text-xs placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddBulkPaste}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1 shadow cursor-pointer transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Parse & Import Bulk CVs
                </button>
              </div>
            )}

            {inputMode === "single" && (
              /* SINGLE ADD MODE */
              <form onSubmit={handleAddCandidateSingle} className="space-y-4 animate-fadeIn">
                <div className="space-y-1">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Candidate Name (Nama Lengkap)"
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <textarea
                    value={newCVText}
                    onChange={(e) => setNewCVText(e.target.value)}
                    placeholder="Paste individual CV text content or resume details..."
                    rows={5}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-slate-850 hover:bg-slate-950 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add to Sourcing Queue
                </button>
              </form>
            )}
          </div>

          {/* RUN ACTION TRIGGER */}
          <button
            onClick={runAIBulkAnalysis}
            disabled={loading || candidates.length === 0}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/10 disabled:opacity-50 transition-all text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing CVs & Generating Guides...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-300" />
                Screen & Rank {candidates.length} Candidate{candidates.length !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>

        {/* QUEUE LIST DISPLAY */}
        <div className="lg:col-span-7">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-full min-h-[420px] justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Candidates Screening Queue</h3>
                </div>
                <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg">
                  {candidates.length} / 150 CVs
                </span>
              </div>

              {candidates.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <Users className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto" />
                  <h4 className="font-bold text-slate-800 dark:text-slate-350 text-xs">Sourcing queue is empty</h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                    Load our curated sample candidates or import your custom CV files to run comparisons instantly.
                  </p>
                </div>
              ) : (
                <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-2 custom-scrollbar">
                  {candidates.map((candidate, index) => (
                    <div
                      key={candidate.id}
                      className="group flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-800 hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold font-mono">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{candidate.name}</p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {candidate.cvText.substring(0, 95)}...
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveCandidate(candidate.id)}
                        className="p-1.5 hover:bg-rose-100 hover:text-rose-600 text-slate-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="Remove candidate"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {candidates.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span>Ready to execute. Candidates will be ranked securely based on their relevant skills and background criteria.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LOADER INTERMEDIATE OVERLAY */}
      {loading && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-6 animate-pulse">
          <div className="inline-flex p-4 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h4 className="font-bold text-slate-950 dark:text-white text-base">Gemini Engine Running Analysis</h4>
            <div className="flex items-center justify-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-semibold font-mono">
              <Sparkles className="h-3.5 w-3.5 animate-bounce" />
              <span>Step {loadingStep + 1} of {steps.length}:</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850 font-medium italic transition-all duration-300">
              {steps[loadingStep]}
            </p>
          </div>
        </div>
      )}

      {/* ANALYSIS RESULTS STAGE */}
      {results && !loading && (
        <div className="space-y-8 animate-fadeIn">
          {/* EXECUTIVE OVERALL BATCH SUMMARY */}
          <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-blue-600">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider">AI Executive Batch Sourcing Summary</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
              {results.analysisSummary}
            </p>
          </div>

          {/* TOP 3 HIGHLIGHTS SHOWCASE */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-amber-500 fill-amber-500" />
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Top 3 Recommended Qualified Candidates
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {results.top3.map((top, idx) => {
                const isSelected = activeAccordion === top.candidateId;
                return (
                  <div
                    key={top.candidateId}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-blue-500 relative"
                  >
                    {/* Rank Badge */}
                    <div className="absolute top-4 right-4 h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold font-mono">
                      #{idx + 1}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-extrabold text-slate-950 dark:text-white text-base truncate pr-6">{top.name}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border rounded-lg ${getScoreColor(top.score)}`}>
                            Score: {top.score}/100
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4 italic">
                        "{top.suitabilitySummary}"
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/85">
                      <button
                        onClick={() => setActiveAccordion(isSelected ? null : top.candidateId)}
                        className="w-full py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isSelected ? (
                          <>
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                            Hide STAR Interview Guide
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                            View STAR Interview Guide ({top.beiQuestions.length})
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DYNAMIC STAR BEI ACCORDION QUESTIONS DETAILS */}
          {activeAccordion && (() => {
            const activeTop = results.top3.find(t => t.candidateId === activeAccordion);
            if (!activeTop) return null;

            return (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">Behavioral Event Interview Guide (BEI/STAR)</span>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">Customized Interview Questions for {activeTop.name}</h4>
                  </div>
                  <button
                    onClick={() => {
                      const questionsText = activeTop.beiQuestions.map((q, idx) => 
                        `[Question ${idx + 1}] ${q.question}\n\n[What to Look For (STAR Framework)]\n${q.whatToLookFor}\n\n=================================\n`
                      ).join("\n");
                      copyQuestionToClipboard(questionsText, activeTop.candidateId);
                    }}
                    className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {copiedQuestionId === activeTop.candidateId ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        Copied Questions
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                        Copy Full Interview Guide
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-5">
                  {activeTop.beiQuestions.map((q, qidx) => (
                    <div
                      key={qidx}
                      className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-850 space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold font-mono shrink-0 mt-0.5">
                          {qidx + 1}
                        </span>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
                          {q.question}
                        </p>
                      </div>

                      <div className="pl-8 pt-1 space-y-2">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">STAR Assessment Rubric:</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                          {q.whatToLookFor}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* FULL SCREENED CANDIDATE RANKINGS LIST */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5 text-blue-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Full Sourcing Rankings & Analysis</h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Sorted by Fit Score
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-2">Rank</th>
                    <th className="py-3 px-2">Candidate Name</th>
                    <th className="py-3 px-2">Fit Score</th>
                    <th className="py-3 px-2">Evaluation Fit Summary</th>
                    <th className="py-3 px-2">Key Strengths</th>
                    <th className="py-3 px-2">Missing/Gaps</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {results.rankings
                    .sort((a, b) => b.score - a.score)
                    .map((item, idx) => {
                      const scoreBadgeColor = 
                        item.score >= 80 ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" :
                        item.score >= 60 ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300" :
                        "bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300";

                      return (
                        <tr key={item.candidateId} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition-colors">
                          <td className="py-3.5 px-2 font-mono font-bold text-slate-500">#{idx + 1}</td>
                          <td className="py-3.5 px-2 font-bold text-slate-900 dark:text-white">{item.name}</td>
                          <td className="py-3.5 px-2">
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] cursor-help ${scoreBadgeColor}`}
                              title={getScoreBreakdownTooltip(item.scoreBreakdown) || undefined}
                            >
                              {item.score}%
                            </span>
                          </td>
                          <td className="py-3.5 px-2 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={item.fitSummary}>
                            {item.fitSummary}
                          </td>
                          <td className="py-3.5 px-2">
                            <div className="flex flex-wrap gap-1">
                              {item.strengths && item.strengths.length > 0 ? (
                                item.strengths.slice(0, 2).map((str, sidx) => (
                                  <span key={sidx} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 font-medium">
                                    <CheckCircle2 className="h-2 w-2" />
                                    {str}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[9px]">None</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-2">
                            <div className="flex flex-wrap gap-1">
                              {item.gaps && item.gaps.length > 0 ? (
                                item.gaps.slice(0, 2).map((gap, gidx) => (
                                  <span key={gidx} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 font-medium">
                                    <XCircle className="h-2 w-2" />
                                    {gap}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[9px]">None</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
