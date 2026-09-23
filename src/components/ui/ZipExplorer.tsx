import { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  FolderOpen,
  FolderClosed,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Type,
  X,
} from 'lucide-react';
import { downloadFileAs, loadArrayBufferFromUrl } from '../../utils/files';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZipEntry {
  name: string;       // full path
  baseName: string;   // just filename
  ext: string;        // lowercase, no dot
  isDir: boolean;
  sizeByte: number;
  /** Lazy-loaded blob URL (only created on demand) */
  blobUrl?: string;
  /** Raw JSZip file reference */
  _file?: JSZip.JSZipObject;
}

interface FolderNode {
  name: string;
  fullPath: string;
  children: (FolderNode | ZipEntry)[];
  isDir: true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXT_GROUPS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
  pdf: ['pdf'],
  ai: ['ai', 'eps'],
  font: ['ttf', 'otf', 'woff', 'woff2'],
  zip: ['zip'],
  doc: ['doc', 'docx', 'xls', 'xlsx', 'txt', 'xml', 'csv'],
  links: ['tif', 'tiff', 'psd', 'psb', 'indd'],
};

type ExtGroup = keyof typeof EXT_GROUPS | 'other';

function extGroup(ext: string): ExtGroup {
  for (const [group, exts] of Object.entries(EXT_GROUPS)) {
    if ((exts as string[]).includes(ext)) return group as ExtGroup;
  }
  return 'other';
}

const GROUP_COLOR: Record<ExtGroup, string> = {
  image: 'bg-purple-100 text-purple-700',
  pdf: 'bg-red-100 text-red-700',
  ai: 'bg-orange-100 text-orange-700',
  font: 'bg-teal-100 text-teal-700',
  zip: 'bg-yellow-100 text-yellow-700',
  doc: 'bg-blue-100 text-blue-700',
  links: 'bg-pink-100 text-pink-700',
  other: 'bg-slate-100 text-slate-600',
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ExtBadge: React.FC<{ ext: string }> = ({ ext }) => {
  const group = extGroup(ext);
  return (
    <span className={`inline-block text-[9px] font-bold uppercase px-1 py-0.5 rounded ${GROUP_COLOR[group]}`}>
      {ext || '?'}
    </span>
  );
};

/** Returns a lucide icon for a file entry */
function FileIcon({ ext }: { ext: string }) {
  const group = extGroup(ext);
  if (group === 'image') return <ImageIcon size={15} className="text-purple-500 shrink-0" />;
  if (group === 'pdf') return <FileText size={15} className="text-red-500 shrink-0" />;
  if (group === 'ai') return <FileText size={15} className="text-orange-500 shrink-0" />;
  if (group === 'font') return <Type size={15} className="text-teal-500 shrink-0" />;
  return <FileText size={15} className="text-slate-400 shrink-0" />;
}

// ─── Build tree ───────────────────────────────────────────────────────────────

function buildTree(entries: ZipEntry[]): FolderNode {
  const root: FolderNode = { name: '', fullPath: '', children: [], isDir: true };

  for (const entry of entries) {
    if (entry.isDir) continue;
    const parts = entry.name.split('/').filter(Boolean);
    let node: FolderNode = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      let child = node.children.find(
        (c): c is FolderNode => (c as FolderNode).isDir && (c as FolderNode).name === folderName,
      );
      if (!child) {
        child = {
          name: folderName,
          fullPath: parts.slice(0, i + 1).join('/'),
          children: [],
          isDir: true,
        };
        node.children.push(child);
      }
      node = child;
    }
    node.children.push(entry);
  }
  return root;
}

// ─── Preview panel ────────────────────────────────────────────────────────────

interface PreviewState {
  type: 'image' | 'pdf' | 'ai' | 'font' | 'unsupported';
  src?: string; // object URL
  fileName: string;
  ext: string;
}

const PreviewPanel: React.FC<{
  preview: PreviewState | null;
  onClose: () => void;
}> = ({ preview, onClose }) => {
  if (!preview) return null;

  return (
    <div className="flex flex-col bg-slate-900 rounded-xl overflow-hidden h-full min-h-[320px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 shrink-0">
        <p className="text-xs text-white/80 font-medium truncate max-w-[200px]">{preview.fileName}</p>
        <div className="flex items-center gap-2">
          {preview.src && (
            <button
              type="button"
              onClick={() => void downloadFileAs(preview.src!, preview.fileName)}
              className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Descargar"
            >
              <Download size={14} />
            </button>
          )}
          {preview.src && (preview.type === 'image' || preview.type === 'pdf') && (
            <button
              type="button"
              onClick={() => window.open(preview.src, '_blank')}
              className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Abrir en nueva pestaña"
            >
              <Maximize2 size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-900">
        {preview.type === 'image' && preview.src && (
          <img
            src={preview.src}
            alt={preview.fileName}
            className="max-w-full max-h-[420px] object-contain rounded-lg shadow-xl"
          />
        )}
        {preview.type === 'pdf' && preview.src && (
          <iframe
            src={preview.src}
            className="w-full h-[420px] rounded-lg border border-white/10"
            title={preview.fileName}
          />
        )}
        {preview.type === 'ai' && (
          <div className="text-center text-white/60 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto">
              <span className="text-orange-400 font-black text-xl">Ai</span>
            </div>
              <p className="text-sm font-medium text-white/80">{preview.fileName}</p>
                <p className="text-xs text-white/40 max-w-xs">
                  Listo para descargar y abrir en Adobe Illustrator.
                </p>
            {preview.src && (
              <button
                type="button"
                onClick={() => void downloadFileAs(preview.src!, preview.fileName)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors"
              >
                <Download size={14} /> Descargar .ai
              </button>
            )}
          </div>
        )}
        {preview.type === 'font' && (
          <div className="text-center text-white/60 space-y-3">
            <Type size={48} className="mx-auto text-teal-400/60" />
            <p className="text-sm font-medium text-white/80">{preview.fileName}</p>
            <p className="text-xs text-white/40">Archivo de fuente · listo para descargar e instalar.</p>
            {preview.src && (
              <button
                type="button"
                onClick={() => void downloadFileAs(preview.src!, preview.fileName)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold transition-colors"
              >
                <Download size={14} /> Descargar fuente
              </button>
            )}
          </div>
        )}
        {preview.type === 'unsupported' && (
          <div className="text-center text-white/60 space-y-3">
            <FileText size={48} className="mx-auto text-white/20" />
            <p className="text-sm font-medium text-white/80">{preview.fileName}</p>
            <p className="text-xs text-white/40">Archivo listo para descargar.</p>
            {preview.src && (
              <button
                type="button"
                onClick={() => void downloadFileAs(preview.src!, preview.fileName)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold transition-colors"
              >
                <Download size={14} /> Descargar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Folder row ───────────────────────────────────────────────────────────────

const FolderRow: React.FC<{
  node: FolderNode;
  depth: number;
  onSelectEntry: (entry: ZipEntry) => void;
  selectedPath?: string;
}> = ({ node, depth, onSelectEntry, selectedPath }) => {
  const [open, setOpen] = useState(depth < 2);
  const indent = depth * 16;

  return (
    <div>
      {node.name !== '' && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100 transition-colors text-sm"
          style={{ paddingLeft: `${12 + indent}px` }}
        >
          {open ? (
            <>
              <ChevronDown size={13} className="text-slate-400 shrink-0" />
              <FolderOpen size={14} className="text-amber-500 shrink-0" />
            </>
          ) : (
            <>
              <ChevronRight size={13} className="text-slate-400 shrink-0" />
              <FolderClosed size={14} className="text-amber-500 shrink-0" />
            </>
          )}
          <span className="font-medium text-slate-700">{node.name}</span>
          <span className="ml-auto text-[10px] text-slate-400">
            {node.children.filter((c): c is ZipEntry => !(c as FolderNode).isDir).length} archivos
          </span>
        </button>
      )}
      {(open || node.name === '') &&
        node.children.map((child) =>
          (child as FolderNode).isDir ? (
            <FolderRow
              key={(child as FolderNode).fullPath}
              node={child as FolderNode}
              depth={depth + 1}
              onSelectEntry={onSelectEntry}
              selectedPath={selectedPath}
            />
          ) : (
            <FileRow
              key={(child as ZipEntry).name}
              entry={child as ZipEntry}
              depth={depth + 1}
              onSelect={onSelectEntry}
              isSelected={selectedPath === (child as ZipEntry).name}
            />
          ),
        )}
    </div>
  );
};

// ─── File row ─────────────────────────────────────────────────────────────────

const FileRow: React.FC<{
  entry: ZipEntry;
  depth: number;
  onSelect: (e: ZipEntry) => void;
  isSelected: boolean;
}> = ({ entry, depth, onSelect, isSelected }) => {
  const indent = depth * 16;
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      style={{ paddingLeft: `${12 + indent}px` }}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
        isSelected
          ? 'bg-accent/10 text-accent'
          : 'hover:bg-slate-50 text-slate-700'
      }`}
    >
      <span className="w-3 shrink-0" /> {/* spacer for arrow */}
      <FileIcon ext={entry.ext} />
      <span className="flex-1 truncate font-medium">{entry.baseName}</span>
      <ExtBadge ext={entry.ext} />
      <span className="text-[10px] text-slate-400 w-14 text-right shrink-0">
        {entry.sizeByte > 0 ? formatBytes(entry.sizeByte) : ''}
      </span>
    </button>
  );
};

// ─── Main ZipExplorer ─────────────────────────────────────────────────────────

/** Carpetas/archivos de sistema de macOS que no aportan contenido útil. */
function isMacOsJunkPath(path: string): boolean {
  const parts = path.split('/').filter(Boolean);
  return parts.some(
    (part) =>
      part === '__MACOSX' ||
      part === '.DS_Store' ||
      part.startsWith('._'),
  );
}

export interface ZipExplorerProps {
  /** The arte final ZIP file as a base64 data URL */
  dataUrl: string;
  fileName: string;
}

export const ZipExplorer: React.FC<ZipExplorerProps> = ({ dataUrl, fileName }) => {
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);

  // Object URLs created — clean up on unmount
  const createdUrls = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      createdUrls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  // Parse ZIP on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const bytes = await loadArrayBufferFromUrl(dataUrl);
        const zip = await JSZip.loadAsync(bytes);
        const list: ZipEntry[] = [];

        for (const [name, file] of Object.entries(zip.files)) {
          if (isMacOsJunkPath(name)) continue;
          const baseName = name.split('/').filter(Boolean).at(-1) ?? name;
          const ext = baseName.includes('.') ? baseName.split('.').at(-1)!.toLowerCase() : '';
          list.push({
            name,
            baseName,
            ext,
            isDir: file.dir,
            sizeByte: 0, // JSZip doesn't expose uncompressed size easily without decompressing
            _file: file,
          });
        }

        if (!cancelled) setEntries(list.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e) {
        if (!cancelled) setError('No se pudo leer el ZIP: ' + (e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [dataUrl]);

  const tree = useMemo(() => buildTree(entries), [entries]);

  const handleSelectEntry = async (entry: ZipEntry) => {
    if (!entry._file) return;
    setSelectedPath(entry.name);
    setPreviewLoading(true);

    try {
      const group = extGroup(entry.ext);
      const blob = await entry._file.async('blob');
      const mimeMap: Record<ExtGroup, string> = {
        image: entry.ext === 'svg' ? 'image/svg+xml' : `image/${entry.ext === 'jpg' ? 'jpeg' : entry.ext}`,
        pdf: 'application/pdf',
        ai: 'application/postscript',
        font: entry.ext === 'ttf' ? 'font/ttf' : entry.ext === 'otf' ? 'font/otf' : 'font/woff',
        zip: 'application/zip',
        doc: 'application/octet-stream',
        links: 'image/tiff',
        other: 'application/octet-stream',
      };
      const mime = mimeMap[group] ?? 'application/octet-stream';
      const typedBlob = new Blob([blob], { type: mime });
      const url = URL.createObjectURL(typedBlob);
      createdUrls.current.push(url);

      // For PDFs, render page 1 via pdfjs for inline display
      if (group === 'pdf') {
        const reader = new FileReader();
        reader.onload = () => {
          setPreview({ type: 'pdf', src: url, fileName: entry.baseName, ext: entry.ext });
          setPreviewLoading(false);
        };
        reader.readAsDataURL(typedBlob);
        return;
      }

      setPreview({
        type: group === 'image' ? 'image' : group === 'ai' ? 'ai' : group === 'font' ? 'font' : 'unsupported',
        src: url,
        fileName: entry.baseName,
        ext: entry.ext,
      });
    } catch {
      setPreview({ type: 'unsupported', fileName: entry.baseName, ext: entry.ext });
    } finally {
      setPreviewLoading(false);
    }
  };

  const totalFiles = entries.filter((e) => !e.isDir).length;
  const totalFolders = entries.filter((e) => e.isDir).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-yellow-100 flex items-center justify-center shrink-0">
            <span className="text-yellow-700 font-black text-[10px]">ZIP</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{fileName}</p>
            {!loading && !error && (
              <p className="text-[11px] text-slate-400">
                {totalFiles} archivo{totalFiles !== 1 ? 's' : ''} · {totalFolders} carpeta{totalFolders !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        {loading && <Loader2 size={16} className="text-slate-400 animate-spin shrink-0" />}
      </div>

      {error && (
        <p className="px-4 py-6 text-sm text-red-600 text-center">{error}</p>
      )}

      {loading && !error && (
        <div className="flex items-center justify-center py-12 gap-3 text-sm text-slate-400">
          <Loader2 size={18} className="animate-spin" /> Leyendo ZIP…
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col lg:flex-row">
          {/* File tree */}
          <div className="lg:w-80 lg:border-r border-border overflow-auto max-h-[440px] py-1">
            <FolderRow
              node={tree}
              depth={0}
              onSelectEntry={handleSelectEntry}
              selectedPath={selectedPath}
            />
            {entries.filter((e) => !e.isDir).length === 0 && (
              <p className="px-4 py-6 text-xs text-slate-400 text-center">ZIP vacío o sin archivos legibles.</p>
            )}
          </div>

          {/* Preview pane */}
          <div className="flex-1 p-4 bg-slate-800 min-h-[280px] flex flex-col">
            {previewLoading ? (
              <div className="flex-1 flex items-center justify-center text-white/40 gap-3">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Cargando previsualización…</span>
              </div>
            ) : preview ? (
              <PreviewPanel
                preview={preview}
                onClose={() => { setPreview(null); setSelectedPath(undefined); }}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-3">
                <FolderOpen size={40} />
                <p className="text-sm">Selecciona un archivo para previsualizarlo</p>
                <p className="text-xs text-white/20">Imágenes y PDFs se muestran inline</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
