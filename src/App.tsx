import { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import ProjectTemplates from './components/ProjectTemplates';
import PackageSearch from './components/PackageSearch';
import PackageManager from './components/PackageManager';
import DependencyTree from './components/DependencyTree';
import SettingsPanel from './components/SettingsPanel';
import ExportManager from './components/ExportManager';

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

function App() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [settings, setSettings] = useState<Settings>({
    includeHashes: false,
    customIndex: '',
    autoResolve: true,
    showDependencies: true,
    exportFormat: 'standard',
  });

  const parseRequirementsContent = useCallback((content: string): Package[] => {
    const lines = content
      .split('\n')
      .filter(
        line =>
          line.trim() &&
          !line.trim().startsWith('#') &&
          !line.trim().startsWith('--')
      );

    return lines
      .map(line => {
        const hashMatch = line.match(/--hash=sha256:([a-f0-9]+)/);
        const hash = hashMatch ? hashMatch[1] : undefined;

        const cleanLine = line.replace(/\s*--hash=.*$/, '').trim();

        const versionMatch = cleanLine.match(/^([^>=<~!]+)([>=<~!].*)$/);
        if (versionMatch) {
          const name = versionMatch[1].trim();
          const versionSpec = versionMatch[2].trim();
          const version = versionSpec.replace(/[>=<~!=]+/, '');

          return {
            name,
            version,
            isDependency: false,
            hash,
          };
        }

        return {
          name: cleanLine,
          version: 'latest',
          isDependency: false,
          hash,
        };
      })
      .filter(pkg => pkg.name);
  }, []);

  const addDependencies = useCallback((packageName: string): Package[] => {
    const mockDependencies: Record<string, string[]> = {
      django: ['sqlparse', 'asgiref', 'pytz'],
      flask: ['werkzeug', 'jinja2', 'click', 'itsdangerous'],
      requests: ['urllib3', 'certifi', 'charset-normalizer', 'idna'],
      fastapi: ['pydantic', 'starlette', 'typing-extensions'],
      pandas: ['numpy', 'python-dateutil', 'pytz'],
      tensorflow: ['numpy', 'six', 'protobuf', 'h5py'],
      pytest: ['iniconfig', 'packaging', 'pluggy'],
      'scikit-learn': ['numpy', 'scipy', 'joblib', 'threadpoolctl'],
    };

    const dependencies = mockDependencies[packageName] || [];
    return dependencies.map(dep => ({
      name: dep,
      version: 'latest',
      isDependency: true,
    }));
  }, []);

  const handleFileUpload = useCallback(
    (content: string, fileName: string) => {
      console.log(`Uploading file: ${fileName}`);
      const parsedPackages = parseRequirementsContent(content);
      setPackages(parsedPackages);
    },
    [parseRequirementsContent]
  );

  const handleTemplateSelect = useCallback(
    (templatePackages: string[]) => {
      const newPackages: Package[] = [];

      templatePackages.forEach(pkgSpec => {
        const versionMatch = pkgSpec.match(/^([^>=<~!]+)([>=<~!].*)$/);
        const name = versionMatch ? versionMatch[1].trim() : pkgSpec;
        const versionSpec = versionMatch ? versionMatch[2].trim() : '>=0.0.0';
        const version = versionSpec.replace(/[>=<~!=]+/, '');

        newPackages.push({
          name,
          version,
          isDependency: false,
        });

        if (settings.autoResolve) {
          const dependencies = addDependencies(name);
          newPackages.push(...dependencies);
        }
      });

      setPackages(prev => {
        const existingNames = new Set(prev.map(p => p.name));
        const uniqueNewPackages = newPackages.filter(
          p => !existingNames.has(p.name)
        );
        return [...prev, ...uniqueNewPackages];
      });
    },
    [settings.autoResolve, addDependencies]
  );

  const handlePackageSelect = useCallback(
    (packageName: string, version: string) => {
      const newPackages: Package[] = [
        {
          name: packageName,
          version,
          isDependency: false,
        },
      ];

      if (settings.autoResolve) {
        const dependencies = addDependencies(packageName);
        newPackages.push(...dependencies);
      }

      setPackages(prev => {
        const existingNames = new Set(prev.map(p => p.name));
        const uniqueNewPackages = newPackages.filter(
          p => !existingNames.has(p.name)
        );
        return [...prev, ...uniqueNewPackages];
      });
    },
    [settings.autoResolve, addDependencies]
  );

  const handlePackageRemove = useCallback((packageName: string) => {
    setPackages(prev => prev.filter(pkg => pkg.name !== packageName));
  }, []);

  const handlePackageUpdate = useCallback(
    (packageName: string, newVersion: string) => {
      setPackages(prev =>
        prev.map(pkg =>
          pkg.name === packageName ? { ...pkg, version: newVersion } : pkg
        )
      );
    },
    []
  );

  return (
    <div className="min-h-screen bg-gradient-primary p-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Python Requirements Manager
          </h1>
          <p className="text-blue-200">
            Intelligent dependency management for Python projects
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <FileUpload onFileUpload={handleFileUpload} />
            <ProjectTemplates onTemplateSelect={handleTemplateSelect} />
            <PackageSearch onPackageSelect={handlePackageSelect} />
          </div>

          <div className="lg:col-span-1 space-y-6">
            <PackageManager
              packages={packages}
              onPackageRemove={handlePackageRemove}
              onPackageUpdate={handlePackageUpdate}
            />
          </div>

          <div className="lg:col-span-1 space-y-6">
            <DependencyTree packages={packages} />
            <SettingsPanel settings={settings} onSettingsChange={setSettings} />
            <ExportManager packages={packages} settings={settings} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
