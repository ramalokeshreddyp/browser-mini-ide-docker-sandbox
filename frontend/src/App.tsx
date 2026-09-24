import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { FileTree } from './components/FileTree';
import { EditorTabs } from './components/EditorTabs';
import { CodeEditor } from './components/CodeEditor';
import { Terminal } from './components/Terminal';
import { ProjectFile, SupportedLanguage, ExecutionLog, ProjectTemplate } from './types';
import { STARTER_TEMPLATES } from './templates';
import { exportProjectAsZip } from './utils/exportZip';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
const WS_BASE_URL = (import.meta as any).env?.VITE_WS_URL || 'ws://localhost:8000';

export const App: React.FC = () => {
  const defaultTemplate = STARTER_TEMPLATES[0]; // Python Math Script
  const [language, setLanguage] = useState<SupportedLanguage>(defaultTemplate.language);
  const [files, setFiles] = useState<ProjectFile[]>(defaultTemplate.files);
  const [openTabs, setOpenTabs] = useState<string[]>(['main.py', 'utils.py']);
  const [activeFile, setActiveFile] = useState<string | null>('main.py');
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('Ready');
  const [exitCode, setExitCode] = useState<number | null>(null);

  const activeWsRef = useRef<WebSocket | null>(null);

  // Switch template
  const handleSelectTemplate = (template: ProjectTemplate) => {
    setFiles(template.files);
    setLanguage(template.language);
    const firstFile = template.files[0]?.path || null;
    const tabList = template.files.slice(0, 3).map((f) => f.path);
    setOpenTabs(tabList);
    setActiveFile(firstFile);
    setLogs([]);
    setExitCode(null);
    setStatusText(`Loaded template: ${template.name}`);
  };

  // Select file in tree
  const handleSelectFile = (path: string) => {
    if (!openTabs.includes(path)) {
      setOpenTabs((prev) => [...prev, path]);
    }
    setActiveFile(path);
  };

  // Create file
  const handleCreateFile = (path: string) => {
    const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (files.some((f) => f.path === cleanPath)) {
      alert('A file with this name already exists.');
      return;
    }

    const newFile: ProjectFile = {
      path: cleanPath,
      content: '',
    };

    setFiles((prev) => [...prev, newFile]);
    if (!openTabs.includes(cleanPath)) {
      setOpenTabs((prev) => [...prev, cleanPath]);
    }
    setActiveFile(cleanPath);
  };

  // Create folder
  const handleCreateFolder = (folderPath: string) => {
    const cleanPath = folderPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const placeholderFile: ProjectFile = {
      path: `${cleanPath}/.keep`,
      content: '',
    };
    if (!files.some((f) => f.path === placeholderFile.path)) {
      setFiles((prev) => [...prev, placeholderFile]);
    }
  };

  // Rename file or folder
  const handleRenameItem = (oldPath: string, newPath: string) => {
    const cleanOld = oldPath.replace(/\\/g, '/');
    const cleanNew = newPath.replace(/\\/g, '/');

    setFiles((prev) =>
      prev.map((f) => {
        if (f.path === cleanOld) {
          return { ...f, path: cleanNew };
        }
        if (f.path.startsWith(`${cleanOld}/`)) {
          return { ...f, path: f.path.replace(cleanOld, cleanNew) };
        }
        return f;
      })
    );

    setOpenTabs((prev) =>
      prev.map((t) => (t === cleanOld ? cleanNew : t.startsWith(`${cleanOld}/`) ? t.replace(cleanOld, cleanNew) : t))
    );

    if (activeFile === cleanOld) {
      setActiveFile(cleanNew);
    } else if (activeFile && activeFile.startsWith(`${cleanOld}/`)) {
      setActiveFile(activeFile.replace(cleanOld, cleanNew));
    }
  };

  // Delete file or folder
  const handleDeleteItem = (path: string) => {
    const cleanPath = path.replace(/\\/g, '/');
    const remainingFiles = files.filter(
      (f) => f.path !== cleanPath && !f.path.startsWith(`${cleanPath}/`)
    );

    setFiles(remainingFiles);

    // Remove closed tabs
    const updatedTabs = openTabs.filter(
      (t) => t !== cleanPath && !t.startsWith(`${cleanPath}/`)
    );
    setOpenTabs(updatedTabs);

    if (activeFile === cleanPath || (activeFile && activeFile.startsWith(`${cleanPath}/`))) {
      setActiveFile(updatedTabs.length > 0 ? updatedTabs[0] : remainingFiles[0]?.path || null);
    }
  };

  // Close tab
  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTabs = openTabs.filter((t) => t !== path);
    setOpenTabs(updatedTabs);

    if (activeFile === path) {
      const closedIndex = openTabs.indexOf(path);
      const nextTab = updatedTabs[closedIndex] || updatedTabs[closedIndex - 1] || null;
      setActiveFile(nextTab);
    }
  };

  // Update content of active file
  const handleContentChange = (newContent: string) => {
    if (!activeFile) return;
    setFiles((prev) =>
      prev.map((f) => (f.path === activeFile ? { ...f, content: newContent } : f))
    );
  };

  // Export as zip
  const handleExportZip = async () => {
    try {
      await exportProjectAsZip(files, `${language}-project`);
    } catch (err) {
      console.error('Export zip failed:', err);
      alert('Failed to generate zip file.');
    }
  };

  // Trigger Code Execution
  const handleRun = async () => {
    if (isRunning) return;

    if (activeWsRef.current) {
      activeWsRef.current.close();
      activeWsRef.current = null;
    }

    setIsRunning(true);
    setExitCode(null);
    setStatusText('Enqueueing execution job...');
    setLogs([
      {
        id: Math.random().toString(),
        stream: 'system',
        event: 'start',
        message: `Submitting ${files.length} project file(s) for ${language.toUpperCase()} execution...`,
        timestamp: new Date(),
      },
    ]);

    try {
      // 1. POST to /api/v1/run
      const res = await fetch(`${API_BASE_URL}/api/v1/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language,
          files: files.filter((f) => !f.path.endsWith('.keep')),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'API Error' }));
        throw new Error(errorData.detail || `Request failed with status ${res.status}`);
      }

      const { job_id } = await res.json();
      setStatusText(`Job #${job_id.slice(0, 8)} created. Connecting WebSocket...`);

      // 2. Open WebSocket stream
      const wsUrl = `${WS_BASE_URL}/ws/run/${job_id}`;
      const socket = new WebSocket(wsUrl);
      activeWsRef.current = socket;

      socket.onopen = () => {
        setStatusText(`Sandbox container running (${job_id.slice(0, 8)})...`);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const newLog: ExecutionLog = {
            id: Math.random().toString(),
            stream: payload.stream || 'stdout',
            data: payload.data,
            event: payload.event,
            code: payload.code,
            message: payload.message,
            timestamp: new Date(),
          };

          setLogs((prev) => [...prev, newLog]);

          if (payload.stream === 'system') {
            if (payload.event === 'exit') {
              setExitCode(payload.code ?? 0);
              setIsRunning(false);
              setStatusText(`Exited with code ${payload.code}`);
            } else if (payload.event === 'error') {
              setIsRunning(false);
              setStatusText('Execution error');
            }
          }
        } catch (e) {
          // If non-json raw text received
          setLogs((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              stream: 'stdout',
              data: event.data,
              timestamp: new Date(),
            },
          ]);
        }
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        setLogs((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            stream: 'system',
            event: 'error',
            message: 'Real-time WebSocket stream error occurred.',
            timestamp: new Date(),
          },
        ]);
        setIsRunning(false);
        setStatusText('WebSocket error');
      };

      socket.onclose = () => {
        setIsRunning(false);
      };
    } catch (err: any) {
      console.error('Run failed:', err);
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          stream: 'system',
          event: 'error',
          message: `Failed to execute: ${err.message}`,
          timestamp: new Date(),
        },
      ]);
      setIsRunning(false);
      setStatusText('Execution failed');
    }
  };

  const activeContent = files.find((f) => f.path === activeFile)?.content || '';

  return (
    <div className="flex flex-col h-screen w-screen bg-[#11111b] text-[#cdd6f4] overflow-hidden">
      {/* Top Header */}
      <Header
        language={language}
        onLanguageChange={setLanguage}
        onRun={handleRun}
        isRunning={isRunning}
        onExportZip={handleExportZip}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: File Tree Explorer */}
        <FileTree
          files={files}
          activeFile={activeFile}
          onSelectFile={handleSelectFile}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onRenameItem={handleRenameItem}
          onDeleteItem={handleDeleteItem}
        />

        {/* Center/Right: Editor Tabs + Monaco Editor + Terminal Output */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e2e]">
          {/* Editor Tabs Bar */}
          <EditorTabs
            openTabs={openTabs}
            activeFile={activeFile}
            onSelectTab={setActiveFile}
            onCloseTab={handleCloseTab}
          />

          {/* Code Editor */}
          <div className="flex-1 overflow-hidden relative">
            <CodeEditor
              filePath={activeFile}
              content={activeContent}
              onChange={handleContentChange}
            />
          </div>

          {/* Terminal Output Panel */}
          <Terminal
            logs={logs}
            isRunning={isRunning}
            onClear={() => setLogs([])}
            statusText={statusText}
            exitCode={exitCode}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
