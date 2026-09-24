import React from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  filePath: string | null;
  content: string;
  onChange: (value: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  filePath,
  content,
  onChange,
}) => {
  if (!filePath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#1e1e2e] text-[#6c7086] text-xs">
        <p>No file selected</p>
        <p className="text-[11px] mt-1 text-[#45475a]">Select a file from the explorer or create a new one</p>
      </div>
    );
  }

  // Detect language based on extension
  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'py':
        return 'python';
      case 'js':
      case 'jsx':
      case 'mjs':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'json':
        return 'json';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'md':
        return 'markdown';
      case 'sh':
        return 'shell';
      default:
        return 'plaintext';
    }
  };

  return (
    <div className="flex-1 w-full h-full bg-[#1e1e2e] overflow-hidden">
      <Editor
        height="100%"
        path={filePath}
        language={getLanguage(filePath)}
        value={content}
        theme="vs-dark"
        onChange={(val) => onChange(val || '')}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'Fira Code', monospace",
          fontLigatures: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          wordWrap: 'on',
          lineNumbers: 'on',
          padding: { top: 8, bottom: 8 },
        }}
      />
    </div>
  );
};
