import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ProjectFile } from '../types';

export async function exportProjectAsZip(files: ProjectFile[], projectName = 'project'): Promise<void> {
  const zip = new JSZip();

  files.forEach((file) => {
    // Normalize path separators
    const cleanPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
    zip.file(cleanPath, file.content);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${projectName}.zip`);
}
