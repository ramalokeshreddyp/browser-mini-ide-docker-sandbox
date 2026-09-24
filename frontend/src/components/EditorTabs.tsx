import React from 'react';
import { X, FileCode } from 'lucide-react';

interface EditorTabsProps {
  openTabs: string[];
  activeFile: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string, e: React.MouseEvent) => void;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  openTabs,
  activeFile,
  onSelectTab,
  onCloseTab,
}) => {
  return (
    <div
      data-testid="editor-tabs-container"
      className="flex items-center bg-[#181825] border-b border-[#313244] overflow-x-auto select-none no-scrollbar h-9"
    >
      {openTabs.map((filePath) => {
        const isActive = activeFile === filePath;
        const fileName = filePath.split('/').pop() || filePath;

        return (
          <div
            key={filePath}
            data-testid={`editor-tab-${filePath}`}
            onClick={() => onSelectTab(filePath)}
            className={`group flex items-center gap-2 px-3 py-1.5 h-full text-xs border-r border-[#313244] cursor-pointer transition-colors max-w-[200px] ${
              isActive
                ? 'bg-[#1e1e2e] text-[#89b4fa] border-t-2 border-t-[#89b4fa] font-medium'
                : 'bg-[#181825] text-[#a6adc8] hover:bg-[#1e1e2e]/60 hover:text-[#cdd6f4]'
            }`}
          >
            <FileCode size={13} className={isActive ? 'text-[#89b4fa]' : 'text-[#6c7086]'} />
            <span className="truncate flex-1">{fileName}</span>
            <button
              type="button"
              title="Close tab"
              onClick={(e) => onCloseTab(filePath, e)}
              className={`p-0.5 rounded hover:bg-[#313244] hover:text-[#f38ba8] transition-colors ${
                isActive ? 'opacity-80' : 'opacity-0 group-hover:opacity-80'
              }`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
