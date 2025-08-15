import { useState, useCallback } from 'react';

interface Package {
  name: string;
  version: string;
  isDependency: boolean;
  hash?: string;
}

interface Settings {
  includeHashes: boolean;
  customIndex: string;
  autoResolve: boolean;
  showDependencies: boolean;
  exportFormat: 'standard' | 'pinned' | 'loose';
}

interface ExportManagerProps {
  packages: Package[];
  settings: Settings;
}

export default function ExportManager({
  packages,
  settings,
}: ExportManagerProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportPreview, setExportPreview] = useState<string | null>(null);

  const generateRequirementsContent = useCallback(() => {
    const lines: string[] = [];

    if (settings.customIndex) {
      lines.push(`--index-url ${settings.customIndex}`);
      lines.push('');
    }

    const packagesToExport = settings.showDependencies
      ? packages
      : packages.filter(pkg => !pkg.isDependency);

    packagesToExport
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(pkg => {
        let line = pkg.name;

        switch (settings.exportFormat) {
          case 'standard':
            line += `==${pkg.version}`;
            break;
          case 'pinned':
            line += `>=${pkg.version}`;
            break;
          case 'loose':
            break;
        }

        if (settings.includeHashes && pkg.hash) {
          line += ` --hash=sha256:${pkg.hash}`;
        }

        lines.push(line);
      });

    return lines.join('\n');
  }, [packages, settings]);

  const handlePreview = useCallback(() => {
    const content = generateRequirementsContent();
    setExportPreview(content);
  }, [generateRequirementsContent]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);

    try {
      const content = generateRequirementsContent();
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'requirements.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  }, [generateRequirementsContent]);

  const handleCopyToClipboard = useCallback(async () => {
    const content = generateRequirementsContent();
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Copy error:', error);
    }
  }, [generateRequirementsContent]);

  const closePreview = useCallback(() => {
    setExportPreview(null);
  }, []);

  const getExportSummary = () => {
    const totalPackages = packages.length;
    const mainPackages = packages.filter(pkg => !pkg.isDependency).length;
    const dependencies = packages.filter(pkg => pkg.isDependency).length;
    const packagesInExport = settings.showDependencies
      ? totalPackages
      : mainPackages;

    return {
      totalPackages,
      mainPackages,
      dependencies,
      packagesInExport,
    };
  };

  const summary = getExportSummary();

  return (
    <div className="bg-gradient-export p-6 rounded-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Export Manager</h2>

      {packages.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">📤</div>
          <p className="text-blue-200">No packages to export</p>
          <p className="text-sm text-blue-300 mt-2">
            Add packages to generate requirements.txt
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
            <h3 className="text-lg font-medium text-white mb-3">
              Export Summary
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-200">
                  Total packages:{' '}
                  <span className="text-white">{summary.totalPackages}</span>
                </p>
                <p className="text-blue-200">
                  Main packages:{' '}
                  <span className="text-white">{summary.mainPackages}</span>
                </p>
              </div>
              <div>
                <p className="text-blue-200">
                  Dependencies:{' '}
                  <span className="text-white">{summary.dependencies}</span>
                </p>
                <p className="text-blue-200">
                  Will export:{' '}
                  <span className="text-white">{summary.packagesInExport}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
            <h3 className="text-lg font-medium text-white mb-3">
              Export Options
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-200">Format:</span>
                <span className="text-white capitalize">
                  {settings.exportFormat}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-200">Include hashes:</span>
                <span className="text-white">
                  {settings.includeHashes ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-200">Show dependencies:</span>
                <span className="text-white">
                  {settings.showDependencies ? 'Yes' : 'No'}
                </span>
              </div>
              {settings.customIndex && (
                <div className="flex justify-between">
                  <span className="text-blue-200">Custom index:</span>
                  <span className="text-white text-xs truncate ml-2">
                    {settings.customIndex}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handlePreview}
              className="px-4 py-2 bg-blue-500/20 text-blue-200 rounded hover:bg-blue-500/30 transition-colors"
            >
              Preview
            </button>

            <button
              onClick={handleCopyToClipboard}
              className="px-4 py-2 bg-purple-500/20 text-purple-200 rounded hover:bg-purple-500/30 transition-colors"
            >
              Copy to Clipboard
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 bg-green-500/20 text-green-200 rounded hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? 'Exporting...' : 'Download requirements.txt'}
            </button>
          </div>
        </div>
      )}

      {exportPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-primary p-6 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">
                Requirements.txt Preview
              </h3>
              <button
                onClick={closePreview}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                {exportPreview}
              </pre>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={closePreview}
                className="px-4 py-2 bg-gray-500/20 text-gray-200 rounded hover:bg-gray-500/30 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleCopyToClipboard}
                className="px-4 py-2 bg-purple-500/20 text-purple-200 rounded hover:bg-purple-500/30 transition-colors"
              >
                Copy
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-green-500/20 text-green-200 rounded hover:bg-green-500/30 transition-colors"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
