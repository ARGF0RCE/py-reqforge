import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Copy, Eye, Package2 } from 'lucide-react';

interface Package {
  name: string;
  version: string;
  isDependency: boolean;
  hash?: string;
  fullName?: string; // For packages with extras like 'package[extra]'
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
        // Use fullName if available (for packages with extras), otherwise use name
        let line = pkg.fullName || pkg.name;

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
    const packagesWithHashes = packages.filter(pkg => pkg.hash).length;
    const packagesWithoutHashes = packages.filter(pkg => !pkg.hash).length;
    const packagesInExport = settings.showDependencies
      ? totalPackages
      : mainPackages;

    return {
      totalPackages,
      mainPackages,
      dependencies,
      packagesWithHashes,
      packagesWithoutHashes,
      packagesInExport,
    };
  };

  const summary = getExportSummary();

  return (
    <div className="container">
      <Card className="w-full bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100 text-xl font-bold">
            <Download className="h-6 w-6" />
            Export Manager
          </CardTitle>
          <CardDescription className="text-gray-400 text-base">
            Generate and download your requirements.txt file
          </CardDescription>
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex justify-center mb-4">
                <Package2 className="h-16 w-16 text-zinc-500" />
              </div>
              <p className="text-gray-400 font-semibold">
                No packages to export
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Add packages to generate{' '}
                <span className="mono text-blue-400">requirements.txt</span>
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <Card className="bg-zinc-800 border-zinc-700">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-gray-100">
                    Export Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <p className="text-gray-300">
                        Total packages:{' '}
                        <span className="text-blue-400 font-mono font-bold">
                          {summary.totalPackages}
                        </span>
                      </p>
                      <p className="text-gray-300">
                        Main packages:{' '}
                        <span className="text-blue-400 font-mono font-bold">
                          {summary.mainPackages}
                        </span>
                      </p>
                      <p className="text-gray-300">
                        With hashes:{' '}
                        <span className="text-amber-400 font-mono font-bold">
                          {summary.packagesWithHashes}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-gray-300">
                        Dependencies:{' '}
                        <span className="text-green-400 font-mono font-bold">
                          {summary.dependencies}
                        </span>
                      </p>
                      <p className="text-gray-300">
                        Without hashes:{' '}
                        <span className="text-red-400 font-mono font-bold">
                          {summary.packagesWithoutHashes}
                        </span>
                      </p>
                      <p className="text-gray-300">
                        Will export:{' '}
                        <span className="text-yellow-400 font-mono font-bold">
                          {summary.packagesInExport}
                        </span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-800 border-zinc-700">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-gray-100">
                    Export Options
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 font-semibold">
                        Format:
                      </span>
                      <Badge
                        variant="outline"
                        className="border-zinc-600 text-zinc-300 mono capitalize"
                      >
                        {settings.exportFormat}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 font-semibold">
                        Include hashes:
                      </span>
                      <Badge
                        variant={
                          settings.includeHashes ? 'default' : 'secondary'
                        }
                        className="mono"
                      >
                        {settings.includeHashes ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 font-semibold">
                        Show dependencies:
                      </span>
                      <Badge
                        variant={
                          settings.showDependencies ? 'default' : 'secondary'
                        }
                        className="mono"
                      >
                        {settings.showDependencies ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    {settings.customIndex && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 font-semibold">
                          Custom index:
                        </span>
                        <span className="text-blue-400 text-xs mono truncate ml-2 max-w-xs">
                          {settings.customIndex}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handlePreview}
                  variant="outline"
                  className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>

                <Button
                  onClick={handleCopyToClipboard}
                  variant="outline"
                  className="border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </Button>

                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Download requirements.txt'}
                </Button>
              </div>
            </div>
          )}

          {exportPreview && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
              <Card className="bg-zinc-900 border-zinc-700 max-w-4xl w-full max-h-[90vh] overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex justify-between items-center text-gray-100">
                    <span className="mono text-lg font-bold">
                      requirements.txt Preview
                    </span>
                    <Button
                      onClick={closePreview}
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-gray-100"
                    >
                      ✕
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96 w-full rounded-md border border-zinc-700 p-4">
                    <pre className="text-sm text-green-400 mono whitespace-pre-wrap">
                      {exportPreview}
                    </pre>
                  </ScrollArea>

                  <div className="flex gap-3 justify-end mt-6">
                    <Button
                      onClick={closePreview}
                      variant="outline"
                      className="border-zinc-600 text-gray-300 hover:bg-zinc-700"
                    >
                      Close
                    </Button>
                    <Button
                      onClick={handleCopyToClipboard}
                      variant="outline"
                      className="border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      onClick={handleExport}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
