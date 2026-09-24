import React, { useState } from 'react';
import { Play, Square, Download, Sparkles, Code2, ChevronDown, Check } from 'lucide-react';
import { SupportedLanguage, ProjectTemplate } from '../types';
import { STARTER_TEMPLATES } from '../templates';

interface HeaderProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onRun: () => void;
  isRunning: boolean;
  onExportZip: () => void;
  onSelectTemplate: (template: ProjectTemplate) => void;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  onRun,
  isRunning,
  onExportZip,
  onSelectTemplate,
}) => {
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  return (
    <header className="h-14 bg-[#181825] border-b border-[#313244] flex items-center justify-between px-4 select-none z-20">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-lg text-white shadow-md">
          <Code2 size={20} />
        </div>
        <div>
          <h1 className="text-sm font-bold text-[#cdd6f4] tracking-wide flex items-center gap-2">
            Mini IDE <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#313244] text-[#89b4fa] font-mono">SANDBOX</span>
          </h1>
          <p className="text-[11px] text-[#a6adc8]">Docker-Isolated Execution Engine</p>
        </div>
      </div>

      {/* Center Controls: Language & Templates */}
      <div className="flex items-center gap-3">
        {/* Language Selector */}
        <div className="flex items-center gap-2 bg-[#1e1e2e] px-2.5 py-1 rounded-md border border-[#313244]">
          <span className="text-xs text-[#a6adc8] font-medium">Lang:</span>
          <select
            data-testid="language-selector"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
            className="bg-transparent text-xs text-[#89b4fa] font-medium outline-none cursor-pointer pr-1"
          >
            <option value="python" className="bg-[#1e1e2e] text-[#cdd6f4]">Python</option>
            <option value="javascript" className="bg-[#1e1e2e] text-[#cdd6f4]">JavaScript</option>
          </select>
        </div>

        {/* Template Gallery Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1e1e2e] hover:bg-[#313244] text-xs text-[#cdd6f4] border border-[#313244] transition-colors"
          >
            <Sparkles size={14} className="text-[#f9e2af]" />
            <span>Templates</span>
            <ChevronDown size={14} className="text-[#6c7086]" />
          </button>

          {templateMenuOpen && (
            <div className="absolute left-0 mt-1 w-64 bg-[#1e1e2e] border border-[#313244] rounded-lg shadow-xl py-1 z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-[#6c7086] uppercase tracking-wider border-b border-[#313244]">
                Starter Projects
              </div>
              {STARTER_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  data-testid={tmpl.testId}
                  onClick={() => {
                    onSelectTemplate(tmpl);
                    setTemplateMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#313244] transition-colors flex flex-col gap-0.5"
                >
                  <span className="font-medium text-[#cdd6f4]">{tmpl.name}</span>
                  <span className="text-[10px] text-[#6c7086] line-clamp-1">{tmpl.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Export & Run */}
      <div className="flex items-center gap-2.5">
        {/* Export Zip */}
        <button
          data-testid="export-zip-button"
          onClick={onExportZip}
          title="Download project as .zip"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1e1e2e] hover:bg-[#313244] text-xs text-[#cdd6f4] border border-[#313244] transition-colors"
        >
          <Download size={14} className="text-[#a6e3a1]" />
          <span>Export ZIP</span>
        </button>

        {/* Run Button */}
        <button
          data-testid="run-button"
          onClick={onRun}
          disabled={isRunning}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold shadow-md transition-all ${
            isRunning
              ? 'bg-[#fab387]/20 text-[#fab387] border border-[#fab387]/40 cursor-not-allowed animate-pulse'
              : 'bg-[#a6e3a1] hover:bg-[#94e2d5] text-[#11111b] active:scale-95'
          }`}
        >
          {isRunning ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-[#fab387] border-t-transparent rounded-full animate-spin" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play size={14} className="fill-current" />
              <span>Run Code</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
