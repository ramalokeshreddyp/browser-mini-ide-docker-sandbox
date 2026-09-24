import React, { useState } from 'react';
import {
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  FolderPlus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  Check,
  X
} from 'lucide-react';
import { ProjectFile } from '../types';

interface FileTreeProps {
  files: ProjectFile[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onRenameItem: (oldPath: string, newPath: string) => void;
  onDeleteItem: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: { [key: string]: TreeNode };
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFile,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameItem,
  onDeleteItem,
}) => {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFileInput, setNewFileInput] = useState('');
  const [newFolderInput, setNewFolderInput] = useState('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Build tree from files list
  const rootNode: TreeNode = { name: 'root', path: '', isFolder: true, children: {} };

  files.forEach((file) => {
    const parts = file.path.replace(/\\/g, '/').split('/');
    let current = rootNode;
    let accumulatedPath = '';

    parts.forEach((part, index) => {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isLast = index === parts.length - 1;

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: accumulatedPath,
          isFolder: !isLast,
          children: {},
        };
      }
      current = current.children[part];
    });
  });

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleCreateFileSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newFileInput.trim()) {
      setIsCreatingFile(false);
      return;
    }
    const cleanPath = newFileInput.trim().replace(/\\/g, '/');
    onCreateFile(cleanPath);
    setNewFileInput('');
    setIsCreatingFile(false);
  };

  const handleCreateFolderSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newFolderInput.trim()) {
      setIsCreatingFolder(false);
      return;
    }
    const cleanPath = newFolderInput.trim().replace(/\\/g, '/');
    onCreateFolder(cleanPath);
    setNewFolderInput('');
    setIsCreatingFolder(false);
  };

  const handleRenameSubmit = (oldPath: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renameInput.trim() || renameInput === oldPath) {
      setRenamingPath(null);
      return;
    }
    onRenameItem(oldPath, renameInput.trim());
    setRenamingPath(null);
    setRenameInput('');
  };

  const renderTree = (node: TreeNode, depth = 0) => {
    const sortedEntries = Object.values(node.children).sort((a, b) => {
      if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
      return a.isFolder ? -1 : 1;
    });

    return sortedEntries.map((item) => {
      const isFolder = item.isFolder;
      const isCollapsed = collapsedFolders.has(item.path);
      const isActive = !isFolder && activeFile === item.path;
      const isRenaming = renamingPath === item.path;

      return (
        <div key={item.path} className="select-none">
          {/* Node Row */}
          <div
            data-testid={isFolder ? `folder-item-${item.path}` : `file-item-${item.path}`}
            onClick={() => {
              if (isFolder) {
                toggleFolder(item.path);
              } else {
                onSelectFile(item.path);
              }
            }}
            className={`group flex items-center justify-between px-2 py-1.5 text-xs rounded cursor-pointer transition-colors ${
              isActive
                ? 'bg-[#313244] text-[#89b4fa] font-medium'
                : 'text-[#cdd6f4] hover:bg-[#1e1e2e]'
            }`}
            style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
          >
            <div className="flex items-center gap-1.5 truncate flex-1 mr-2">
              {isFolder ? (
                <>
                  <span className="text-[#6c7086]">
                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  </span>
                  {isCollapsed ? (
                    <Folder size={14} className="text-[#89b4fa] flex-shrink-0" />
                  ) : (
                    <FolderOpen size={14} className="text-[#89b4fa] flex-shrink-0" />
                  )}
                </>
              ) : (
                <FileCode size={14} className="text-[#a6adc8] flex-shrink-0 ml-3.5" />
              )}

              {isRenaming ? (
                <form
                  onSubmit={(e) => handleRenameSubmit(item.path, e)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 w-full"
                >
                  <input
                    data-testid="rename-item-input"
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onBlur={() => handleRenameSubmit(item.path)}
                    autoFocus
                    className="bg-[#11111b] text-xs text-[#cdd6f4] px-1.5 py-0.5 rounded border border-[#89b4fa] outline-none w-full"
                  />
                  <button
                    type="submit"
                    className="text-[#a6e3a1] hover:text-white p-0.5"
                    title="Confirm rename"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingPath(null)}
                    className="text-[#f38ba8] hover:text-white p-0.5"
                    title="Cancel"
                  >
                    <X size={12} />
                  </button>
                </form>
              ) : (
                <span className="truncate">{item.name}</span>
              )}
            </div>

            {/* Quick Actions (Rename & Delete) */}
            {!isRenaming && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <button
                  type="button"
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingPath(item.path);
                    setRenameInput(item.path);
                  }}
                  className="p-1 hover:text-[#89b4fa] text-[#6c7086] rounded"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  data-testid="delete-item-button"
                  type="button"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem(item.path);
                  }}
                  className="p-1 hover:text-[#f38ba8] text-[#6c7086] rounded"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Child Nodes */}
          {isFolder && !isCollapsed && renderTree(item, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div
      data-testid="file-tree-container"
      className="w-60 bg-[#181825] border-r border-[#313244] flex flex-col h-full overflow-hidden"
    >
      {/* File Tree Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#313244]">
        <span className="text-[11px] font-semibold text-[#a6adc8] uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            data-testid="create-file-button"
            type="button"
            title="New File"
            onClick={() => {
              setIsCreatingFile(true);
              setIsCreatingFolder(false);
              setNewFileInput('');
            }}
            className="p-1 text-[#a6adc8] hover:text-[#89b4fa] hover:bg-[#313244] rounded transition-colors"
          >
            <Plus size={14} />
          </button>
          <button
            data-testid="create-folder-button"
            type="button"
            title="New Folder"
            onClick={() => {
              setIsCreatingFolder(true);
              setIsCreatingFile(false);
              setNewFolderInput('');
            }}
            className="p-1 text-[#a6adc8] hover:text-[#89b4fa] hover:bg-[#313244] rounded transition-colors"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      {/* Input row for creating new file */}
      {isCreatingFile && (
        <form
          onSubmit={handleCreateFileSubmit}
          className="p-2 bg-[#1e1e2e] border-b border-[#313244] flex items-center gap-1.5"
        >
          <FileCode size={14} className="text-[#89b4fa] flex-shrink-0" />
          <input
            type="text"
            placeholder="filename.ext"
            value={newFileInput}
            onChange={(e) => setNewFileInput(e.target.value)}
            onBlur={() => {
              if (newFileInput.trim()) handleCreateFileSubmit();
              else setIsCreatingFile(false);
            }}
            autoFocus
            className="bg-[#11111b] text-xs text-[#cdd6f4] px-2 py-1 rounded border border-[#89b4fa] outline-none w-full"
          />
        </form>
      )}

      {/* Input row for creating new folder */}
      {isCreatingFolder && (
        <form
          onSubmit={handleCreateFolderSubmit}
          className="p-2 bg-[#1e1e2e] border-b border-[#313244] flex items-center gap-1.5"
        >
          <Folder size={14} className="text-[#89b4fa] flex-shrink-0" />
          <input
            type="text"
            placeholder="folder/subfolder"
            value={newFolderInput}
            onChange={(e) => setNewFolderInput(e.target.value)}
            onBlur={() => {
              if (newFolderInput.trim()) handleCreateFolderSubmit();
              else setIsCreatingFolder(false);
            }}
            autoFocus
            className="bg-[#11111b] text-xs text-[#cdd6f4] px-2 py-1 rounded border border-[#89b4fa] outline-none w-full"
          />
        </form>
      )}

      {/* File List Tree */}
      <div className="flex-1 overflow-y-auto py-1 px-1.5">
        {files.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#6c7086]">
            No files in project.<br />Click + to create one.
          </div>
        ) : (
          renderTree(rootNode)
        )}
      </div>
    </div>
  );
};
