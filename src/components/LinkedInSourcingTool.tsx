/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Search, 
  Briefcase, 
  MapPin, 
  ExternalLink, 
  Sparkles, 
  Check, 
  Copy,
  Building2,
  Calendar,
  Info,
  Globe,
  Github,
  FileText,
  Palette,
  ArrowRight
} from "lucide-react";

interface LinkedInSourcingToolProps {
  userId: string;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
  darkMode: boolean;
}

// Preset templates for quick filling
interface SourcingTemplate {
  name: string;
  description: string;
  jobTitle: string;
  skills: string;
  skillsOperator: "AND" | "OR";
  location: string;
  company: string;
  exclude: string;
  targetType: "linkedin" | "github" | "drive" | "design";
}

const TEMPLATES: SourcingTemplate[] = [
  {
    name: "LinkedIn React Lead in Indonesia",
    description: "Search for Senior/Lead React developers currently based in Indonesia.",
    jobTitle: "Senior React Developer",
    skills: "React, TypeScript, Redux",
    skillsOperator: "AND",
    location: "Indonesia",
    company: "",
    exclude: "Intern, Junior",
    targetType: "linkedin"
  },
  {
    name: "GitHub Elixir Engineers",
    description: "Find Elixir & Erlang contributors active on GitHub.",
    jobTitle: "",
    skills: "Elixir, Erlang, Phoenix",
    skillsOperator: "OR",
    location: "Jakarta",
    company: "",
    exclude: "",
    targetType: "github"
  },
  {
    name: "Google Drive UI/UX Resumes",
    description: "Hunt public resume PDFs for UI/UX Designers on Google Drive.",
    jobTitle: "UI/UX Designer",
    skills: "Figma, Design System, Wireframe",
    skillsOperator: "AND",
    location: "Indonesia",
    company: "",
    exclude: "Intern",
    targetType: "drive"
  },
  {
    name: "Design Portfolio Search",
    description: "Find creative Product Designers directly on Behance and Dribbble.",
    jobTitle: "Product Designer",
    skills: "UX Research, Interaction Design",
    skillsOperator: "AND",
    location: "Bandung",
    company: "",
    exclude: "",
    targetType: "design"
  }
];

export default function LinkedInSourcingTool({ userId, addToast, darkMode }: LinkedInSourcingToolProps) {
  // Sourcing form fields
  const [jobTitle, setJobTitle] = useState("");
  const [skills, setSkills] = useState("");
  const [skillsOperator, setSkillsOperator] = useState<"AND" | "OR">("AND");
  const [location, setLocation] = useState("");
  const [company, setCompany] = useState("");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [targetType, setTargetType] = useState<"linkedin" | "github" | "drive" | "design">("linkedin");
  
  // Custom Dork generated
  const [customDork, setCustomDork] = useState("");
  const [isEditingDork, setIsEditingDork] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Dynamic Dork generator
  useEffect(() => {
    if (!isEditingDork) {
      let baseSite = "site:linkedin.com/in";
      let formatQuery = "";

      if (targetType === "linkedin") {
        baseSite = "site:linkedin.com/in";
      } else if (targetType === "github") {
        baseSite = 'site:github.com "joined on"';
      } else if (targetType === "drive") {
        baseSite = 'site:drive.google.com/file/d inurl:pdf "resume" OR "cv"';
      } else if (targetType === "design") {
        baseSite = '(site:behance.net OR site:dribbble.com)';
      }

      formatQuery = baseSite;

      if (jobTitle.trim()) {
        formatQuery += ` "${jobTitle.trim()}"`;
      }

      if (skills.trim()) {
        const skillList = skills.split(",").map(s => s.trim()).filter(Boolean);
        if (skillList.length > 0) {
          if (skillList.length === 1) {
            formatQuery += ` "${skillList[0]}"`;
          } else {
            const joinedSkills = skillList.map(s => `"${s}"`).join(` ${skillsOperator} `);
            formatQuery += ` (${joinedSkills})`;
          }
        }
      }

      if (location.trim()) {
        formatQuery += ` "${location.trim()}"`;
      }

      if (company.trim()) {
        formatQuery += ` "${company.trim()}"`;
      }

      if (excludeKeywords.trim()) {
        const excludes = excludeKeywords.split(",").map(s => s.trim()).filter(Boolean);
        excludes.forEach(kw => {
          formatQuery += ` -"${kw}"`;
        });
      }

      setCustomDork(formatQuery);
    }
  }, [jobTitle, skills, skillsOperator, location, company, excludeKeywords, targetType, isEditingDork]);

  // Load template
  const handleApplyTemplate = (tpl: SourcingTemplate) => {
    setJobTitle(tpl.jobTitle);
    setSkills(tpl.skills);
    setSkillsOperator(tpl.skillsOperator);
    setLocation(tpl.location);
    setCompany(tpl.company);
    setExcludeKeywords(tpl.exclude);
    setTargetType(tpl.targetType);
    setIsEditingDork(false);
    addToast(`Applied Preset: ${tpl.name}`, "success");
  };

  // Launch Google Search in a new window/tab
  const handleLaunchSearch = () => {
    if (!customDork.trim()) {
      addToast("No query generated to run search.", "error");
      return;
    }
    const url = `https://www.google.com/search?q=${encodeURIComponent(customDork)}`;
    window.open(url, "_blank");
    addToast("Launching high-precision candidate search...", "info");
  };

  // Copy to clipboard
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(customDork);
      setIsCopied(true);
      addToast("Search query copied to clipboard!", "success");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      addToast("Failed to copy search query.", "error");
    }
  };

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Globe className="h-6 w-6 text-blue-600" />
          AI Candidate Search & Discovery Engine
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Construct optimized, high-precision search queries designed to instantly locate publicly active candidates matching your exact criteria.
        </p>
      </div>

      {/* SOURCING PRESETS / TEMPLATES */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Sourcing Search Presets
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEMPLATES.map((tpl, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyTemplate(tpl)}
              className="text-left p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all group flex flex-col justify-between h-36 cursor-pointer"
            >
              <div>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">
                  {tpl.targetType === "linkedin" && <Globe className="h-3 w-3" />}
                  {tpl.targetType === "github" && <Github className="h-3 w-3" />}
                  {tpl.targetType === "drive" && <FileText className="h-3 w-3" />}
                  {tpl.targetType === "design" && <Palette className="h-3 w-3" />}
                  {tpl.targetType} preset
                </span>
                <h4 className="font-bold text-slate-800 dark:text-white text-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                  {tpl.name}
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {tpl.description}
                </p>
              </div>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 mt-2">
                Apply Preset
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* SOURCING PANEL - DORK GENERATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* PARAMETERS FORM */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Target Sourcing Criteria</h3>
          </div>

          <div className="space-y-4">
            {/* TARGET SELECTION */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Sourcing Source Platform
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "linkedin", label: "LinkedIn Profiles", icon: Globe },
                  { id: "github", label: "GitHub Users", icon: Github },
                  { id: "drive", label: "Drive Resumes", icon: FileText },
                  { id: "design", label: "Designer portfolios", icon: Palette },
                ].map((plat) => (
                  <button
                    key={plat.id}
                    type="button"
                    onClick={() => {
                      setTargetType(plat.id as any);
                      setIsEditingDork(false);
                    }}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                      targetType === plat.id
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <plat.icon className="h-4 w-4" />
                    {plat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* JOB TITLE & LOCATION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Job Title Keyword
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => { setJobTitle(e.target.value); setIsEditingDork(false); }}
                    placeholder="e.g. Senior React Developer"
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Location / Region
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => { setLocation(e.target.value); setIsEditingDork(false); }}
                    placeholder="e.g. Jakarta OR Bandung"
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* SKILLS */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Required Skills (comma-separated)
                </label>
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Operator:</span>
                  <button
                    type="button"
                    onClick={() => { setSkillsOperator("AND"); setIsEditingDork(false); }}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                      skillsOperator === "AND" 
                        ? "bg-blue-600 text-white" 
                        : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    AND
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSkillsOperator("OR"); setIsEditingDork(false); }}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                      skillsOperator === "OR" 
                        ? "bg-blue-600 text-white" 
                        : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    OR
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={skills}
                onChange={(e) => { setSkills(e.target.value); setIsEditingDork(false); }}
                placeholder="e.g. React, TypeScript, Node.js"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* EXCLUDE KEYWORDS & CURRENT COMPANY */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Target Company (Optional)
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => { setCompany(e.target.value); setIsEditingDork(false); }}
                    placeholder="e.g. Tokopedia"
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Exclude Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={excludeKeywords}
                  onChange={(e) => { setExcludeKeywords(e.target.value); setIsEditingDork(false); }}
                  placeholder="e.g. Intern, Junior, Recruiter"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-950 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* REAL-TIME QUERY DISPLAY */}
        <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Optimized Search Query</h4>
              </div>
              <button
                onClick={() => setIsEditingDork(!isEditingDork)}
                className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
              >
                {isEditingDork ? "Auto Compile" : "Edit Syntax"}
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Copy this search string directly or click the launch button below to run high-precision discovery on Google instantly.
            </p>

            <div className="relative">
              <textarea
                value={customDork}
                onChange={(e) => setCustomDork(e.target.value)}
                disabled={!isEditingDork}
                rows={6}
                className="w-full p-4 rounded-xl font-mono text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed resize-none disabled:opacity-85"
                placeholder="AI Search Syntax"
              />
              {!isEditingDork && (
                <div className="absolute top-2 right-2 bg-slate-100 dark:bg-slate-800 text-[9px] text-slate-500 px-1.5 py-0.5 rounded font-mono select-none">
                  Optimized
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {/* ACTION ACTIONS */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleCopyToClipboard}
                className="flex-1 py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
              >
                {isCopied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-slate-500" />
                    Copy Sourcing Query
                  </>
                )
                }
              </button>

              <button
                type="button"
                onClick={handleLaunchSearch}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-500/10"
              >
                <ExternalLink className="h-4 w-4" />
                Launch Search Engine
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/15 text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <p className="font-bold flex items-center gap-1 text-[11px]">
                <Info className="h-4 w-4 text-blue-500 shrink-0" />
                High-Precision Sourcing Method
              </p>
              <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-400">
                This platform utilizes indexing operators like <code className="font-mono text-blue-600 dark:text-blue-400">site:</code> to isolate platforms, exact phrases like <code className="font-mono text-blue-600 dark:text-blue-400">"quotes"</code> for skills, and <code className="font-mono text-blue-600 dark:text-blue-400">-minus</code> signs to filter noise, bypassing social paywalls natively.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
