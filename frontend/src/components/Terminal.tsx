import React, { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Trash2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { ExecutionLog } from '../types';

interface TerminalProps {
  logs: ExecutionLog[];
  isRunning: boolean;
  onClear: () => void;
  statusText?: string;
  exitCode?: number | null;
}

export const Terminal: React.FC<TerminalProps> = ({
  logs,
  isRunning,
  onClear,
  statusText,
  exitCode,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="h-64 bg-[#11111b] border-t border-[#313244] flex flex-col select-text font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="h-8 bg-[#181825] border-b border-[#313244] flex items-center justify-between px-3 select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-[#89b4fa]" />
          <span className="text-[11px] font-semibold text-[#a6adc8] uppercase tracking-wider">
            Terminal / Output
          </span>

          {/* Status Badge */}
          {isRunning ? (
            <span className="flex items-center gap-1 text-[10px] text-[#fab387] bg-[#fab387]/10 px-2 py-0.5 rounded border border-[#fab387]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fab387] animate-ping" />
              Executing in Sandbox...
            </span>
          ) : exitCode !== null && exitCode !== undefined ? (
            <span
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${
                exitCode === 0
                  ? 'text-[#a6e3a1] bg-[#a6e3a1]/10 border-[#a6e3a1]/30'
                  : 'text-[#f38ba8] bg-[#f38ba8]/10 border-[#f38ba8]/30'
              }`}
            >
              {exitCode === 0 ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
              Process finished (Exit code {exitCode})
            </span>
          ) : statusText ? (
            <span className="text-[10px] text-[#6c7086]">{statusText}</span>
          ) : (
            <span className="text-[10px] text-[#6c7086]">Idle</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            title="Clear terminal"
            className="flex items-center gap-1 text-[#6c7086] hover:text-[#cdd6f4] text-[11px] px-2 py-0.5 rounded hover:bg-[#313244] transition-colors"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Terminal Output Stream */}
      <div
        data-testid="terminal-output"
        ref={scrollRef}
        className="flex-1 p-3 overflow-y-auto font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all select-text"
      >
        {logs.length === 0 ? (
          <div className="text-[#6c7086] italic">
            Click 'Run Code' to execute project in isolated Docker sandbox...
          </div>
        ) : (
          logs.map((log) => {
            if (log.stream === 'stdout') {
              return (
                <span key={log.id} className="text-[#cdd6f4]">
                  {log.data}
                </span>
              );
            }

            if (log.stream === 'stderr') {
              return (
                <span key={log.id} className="text-[#f38ba8] font-medium">
                  {log.data}
                </span>
              );
            }

            if (log.stream === 'system') {
              if (log.event === 'error') {
                return (
                  <div
                    key={log.id}
                    className="text-[#f38ba8] bg-[#f38ba8]/10 border-l-2 border-[#f38ba8] px-2 py-1 my-1 rounded-r font-sans text-xs"
                  >
                    [System Error] {log.message || log.data}
                  </div>
                );
              }
              if (log.event === 'exit') {
                return (
                  <div
                    key={log.id}
                    className={`px-2 py-0.5 my-1 text-[11px] font-sans border-l-2 ${
                      log.code === 0
                        ? 'text-[#a6e3a1] border-[#a6e3a1] bg-[#a6e3a1]/5'
                        : 'text-[#f38ba8] border-[#f38ba8] bg-[#f38ba8]/5'
                    }`}
                  >
                    --- Process completed with exit code {log.code} ---
                  </div>
                );
              }
              return (
                <div key={log.id} className="text-[#89b4fa] text-[11px] my-0.5 font-sans">
                  [System] {log.message || log.data}
                </div>
              );
            }

            return null;
          })
        )}
      </div>
    </div>
  );
};
