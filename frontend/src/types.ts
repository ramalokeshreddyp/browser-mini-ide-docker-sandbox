export type SupportedLanguage = 'python' | 'javascript';

export interface ProjectFile {
  path: string;
  content: string;
}

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileTreeNode[];
}

export interface ExecutionLog {
  id: string;
  stream: 'stdout' | 'stderr' | 'system';
  data?: string;
  event?: 'exit' | 'error' | 'start';
  code?: number;
  message?: string;
  timestamp: Date;
}

export interface ProjectTemplate {
  id: string;
  testId: string;
  name: string;
  language: SupportedLanguage;
  description: string;
  files: ProjectFile[];
}
