import { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import ProjectTemplates from './components/ProjectTemplates';
import PackageSearch from './components/PackageSearch';
import PackageManager from './components/PackageManager';
import DependencyTree from './components/DependencyTree';
import SettingsPanel from './components/SettingsPanel';
import ExportManager from './components/ExportManager';
import { apiClient, DependencyResolution } from './api/client';

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

function App() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [settings, setSettings] = useState<Settings>({
    includeHashes: false,
    customIndex: '',
    autoResolve: true,
    showDependencies: true,
    exportFormat: 'standard',
  });
  const [isResolvingDependencies, setIsResolvingDependencies] = useState(false);
  const [dependencyResolution, setDependencyResolution] =
    useState<DependencyResolution | null>(null);

  const parseRequirementsContent = useCallback((content: string): Package[] => {
    // First, handle multiline entries with backslashes
    const normalizedContent = content
      .replace(/\\\s*\n\s*/g, ' ') // Replace backslash + newline with space
      .replace(/\\\s*$/gm, ' '); // Replace trailing backslashes

    const lines = normalizedContent
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

        // Strip environment markers (everything after ';')
        const packageSpec = cleanLine.split(';')[0].trim();

        const versionMatch = packageSpec.match(/^([^>=<~!]+)([>=<~!].*)$/);
        if (versionMatch) {
          const fullName = versionMatch[1].trim();
          const versionSpec = versionMatch[2].trim();
          const version = versionSpec.replace(/[>=<~!=]+/, '');

          // Handle optional dependencies with square brackets
          // Extract base package name for PyPI lookup while preserving full name for requirements.txt
          const basePackageName = fullName.includes('[')
            ? fullName.substring(0, fullName.indexOf('['))
            : fullName;

          return {
            name: basePackageName, // Use base package name for PyPI lookups
            version,
            isDependency: false,
            hash,
            fullName: fullName, // Preserve full name with extras for export
          };
        }

        // Handle packages without version constraints
        const fullName = packageSpec;
        const basePackageName = fullName.includes('[')
          ? fullName.substring(0, fullName.indexOf('['))
          : fullName;

        return {
          name: basePackageName,
          version: 'latest',
          isDependency: false,
          hash,
          fullName: fullName,
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
    async (content: string, fileName: string) => {
      if (isResolvingDependencies) return; // Prevent duplicate calls

      console.log(`Uploading file: ${fileName}`);
      const parsedPackages = parseRequirementsContent(content);

      if (settings.autoResolve && parsedPackages.length > 0) {
        setIsResolvingDependencies(true);
        try {
          // Use API to resolve dependencies
          const packageSpecs = parsedPackages.map(pkg =>
            pkg.version === 'latest' ? pkg.name : `${pkg.name}==${pkg.version}`
          );

          const resolution = await apiClient.resolveDependencies(
            packageSpecs,
            settings.customIndex || undefined
          );

          setDependencyResolution(resolution);

          // Convert API response to our package format using dependency tree info
          const allPackages: Package[] = [];
          const mainPackageNames = new Set(
            resolution.tree?.map(tree => tree.name.toLowerCase()) || []
          );

          // Create a map of original packages to preserve hash data
          const originalPackageMap = new Map(
            parsedPackages.map(pkg => [pkg.name.toLowerCase(), pkg])
          );

          // Add all packages from resolution with proper categorization
          Object.entries(resolution.packages).forEach(([name, version]) => {
            const originalPkg = originalPackageMap.get(name.toLowerCase());
            const resolvedPkg = resolution.resolved_packages?.[name];
            allPackages.push({
              name,
              version,
              isDependency: !mainPackageNames.has(name.toLowerCase()),
              hash: originalPkg?.hash || resolvedPkg?.sha256_hash, // Use original hash or API hash
              fullName: originalPkg?.fullName, // Preserve original fullName with extras
            });
          });

          setPackages(allPackages);
        } catch (error) {
          console.error('Failed to resolve dependencies:', error);
          // Fallback to just the parsed packages
          setPackages(parsedPackages);
          setDependencyResolution(null);
        } finally {
          setIsResolvingDependencies(false);
        }
      } else {
        setPackages(parsedPackages);
        setDependencyResolution(null);
      }
    },
    [
      parseRequirementsContent,
      settings.autoResolve,
      settings.customIndex,
      isResolvingDependencies,
    ]
  );

  const handleTemplateSelect = useCallback(
    async (templatePackages: string[]) => {
      if (isResolvingDependencies) return; // Prevent duplicate calls

      setIsResolvingDependencies(true);
      try {
        if (settings.autoResolve) {
          // Get all existing main packages
          const existingMainPackages = packages.filter(
            pkg => !pkg.isDependency
          );

          // Filter out template packages that already exist
          const newTemplatePackages = templatePackages.filter(templatePkg => {
            const templateName = templatePkg.split(/[>=<~!]/)[0].trim();
            return !packages.some(pkg => pkg.name === templateName);
          });

          if (newTemplatePackages.length === 0) {
            console.log('All template packages already exist');
            return;
          }

          // Combine existing main packages with new template packages
          const allMainPackageSpecs = [
            ...existingMainPackages.map(pkg =>
              pkg.version === 'latest'
                ? pkg.name
                : `${pkg.name}==${pkg.version}`
            ),
            ...newTemplatePackages,
          ];

          // Re-resolve all main packages together
          const resolution = await apiClient.resolveDependencies(
            allMainPackageSpecs,
            settings.customIndex || undefined
          );

          setDependencyResolution(resolution);

          const allPackages: Package[] = [];
          const mainPackageNames = new Set(
            resolution.tree?.map(tree => tree.name.toLowerCase()) || []
          );

          // Create a map to preserve existing hash data
          const existingPackageMap = new Map(
            packages.map(pkg => [pkg.name.toLowerCase(), pkg])
          );

          // Build complete package list from resolution
          Object.entries(resolution.packages).forEach(([name, version]) => {
            const existingPkg = existingPackageMap.get(name.toLowerCase());
            const resolvedPkg = resolution.resolved_packages?.[name];
            allPackages.push({
              name,
              version,
              isDependency: !mainPackageNames.has(name.toLowerCase()),
              hash: existingPkg?.hash || resolvedPkg?.sha256_hash,
              fullName: existingPkg?.fullName,
            });
          });

          setPackages(allPackages);
        } else {
          // Just add main packages without dependencies
          const newPackages: Package[] = templatePackages.map(pkgSpec => {
            const versionMatch = pkgSpec.match(/^([^>=<~!]+)([>=<~!].*)$/);
            const name = versionMatch ? versionMatch[1].trim() : pkgSpec;
            const versionSpec = versionMatch
              ? versionMatch[2].trim()
              : '>=0.0.0';
            const version = versionSpec.replace(/[>=<~!=]+/, '');

            return {
              name,
              version,
              isDependency: false,
            };
          });

          setPackages(prev => {
            const existingNames = new Set(prev.map(p => p.name));
            const uniqueNewPackages = newPackages.filter(
              p => !existingNames.has(p.name)
            );
            return [...prev, ...uniqueNewPackages];
          });
        }
      } catch (error) {
        console.error('Failed to resolve template dependencies:', error);
        // Fallback to mock dependencies
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
      } finally {
        setIsResolvingDependencies(false);
      }
    },
    [
      packages,
      settings.autoResolve,
      settings.customIndex,
      addDependencies,
      isResolvingDependencies,
    ]
  );

  const handlePackageSelect = useCallback(
    async (packageName: string, version: string) => {
      if (isResolvingDependencies) return; // Prevent duplicate calls

      setIsResolvingDependencies(true);
      try {
        if (settings.autoResolve) {
          // Get all existing main packages plus the new one
          const existingMainPackages = packages.filter(
            pkg => !pkg.isDependency
          );
          const newPackageSpec =
            version === 'latest' ? packageName : `${packageName}==${version}`;

          // Check if package already exists
          const packageExists = packages.some(pkg => pkg.name === packageName);
          if (packageExists) {
            console.log(`Package ${packageName} already exists`);
            return;
          }

          // Combine existing main packages with the new one
          const allMainPackageSpecs = [
            ...existingMainPackages.map(pkg =>
              pkg.version === 'latest'
                ? pkg.name
                : `${pkg.name}==${pkg.version}`
            ),
            newPackageSpec,
          ];

          // Re-resolve all main packages together
          const resolution = await apiClient.resolveDependencies(
            allMainPackageSpecs,
            settings.customIndex || undefined
          );

          setDependencyResolution(resolution);

          const allPackages: Package[] = [];
          const mainPackageNames = new Set(
            resolution.tree?.map(tree => tree.name.toLowerCase()) || []
          );

          // Create a map to preserve existing hash data
          const existingPackageMap = new Map(
            packages.map(pkg => [pkg.name.toLowerCase(), pkg])
          );

          // Build complete package list from resolution
          Object.entries(resolution.packages).forEach(
            ([name, resolvedVersion]) => {
              const existingPkg = existingPackageMap.get(name.toLowerCase());
              const resolvedPkg = resolution.resolved_packages?.[name];
              allPackages.push({
                name,
                version: resolvedVersion,
                isDependency: !mainPackageNames.has(name.toLowerCase()),
                hash: existingPkg?.hash || resolvedPkg?.sha256_hash,
                fullName: existingPkg?.fullName,
              });
            }
          );

          setPackages(allPackages);
        } else {
          // Just add the main package without dependencies
          const newPackage: Package = {
            name: packageName,
            version,
            isDependency: false,
          };

          setPackages(prev => {
            const existingNames = new Set(prev.map(p => p.name));
            if (!existingNames.has(packageName)) {
              return [...prev, newPackage];
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Failed to resolve package dependencies:', error);
        // Fallback to mock dependencies
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
      } finally {
        setIsResolvingDependencies(false);
      }
    },
    [
      packages,
      settings.autoResolve,
      settings.customIndex,
      addDependencies,
      isResolvingDependencies,
    ]
  );

  const handlePackageRemove = useCallback(
    async (packageName: string) => {
      if (isResolvingDependencies) return; // Prevent concurrent operations

      setIsResolvingDependencies(true);

      try {
        setPackages(prev => {
          const packageToRemove = prev.find(pkg => pkg.name === packageName);

          if (!packageToRemove) {
            return prev; // Package not found
          }

          // Remove the target package first
          const withoutTarget = prev.filter(pkg => pkg.name !== packageName);

          // If this was a dependency (not a main package), just remove it
          if (packageToRemove.isDependency) {
            return withoutTarget;
          }

          // If this was a main package, we need to clean up its dependencies
          // Get all remaining main packages
          const remainingMainPackages = withoutTarget.filter(
            pkg => !pkg.isDependency
          );

          if (remainingMainPackages.length === 0) {
            // No main packages left, remove everything
            return [];
          }

          // For now, return the filtered list and trigger re-resolution
          // The re-resolution will properly categorize remaining packages
          return withoutTarget;
        });

        // Re-resolve dependencies for remaining main packages if auto-resolve is enabled
        if (settings.autoResolve) {
          // Small delay to let state update
          setTimeout(async () => {
            try {
              const currentPackages = packages.filter(
                pkg => pkg.name !== packageName
              );
              const mainPackages = currentPackages.filter(
                pkg => !pkg.isDependency
              );

              if (mainPackages.length > 0) {
                // Re-resolve with remaining main packages
                const packageSpecs = mainPackages.map(pkg =>
                  pkg.version === 'latest'
                    ? pkg.name
                    : `${pkg.name}==${pkg.version}`
                );

                const resolution = await apiClient.resolveDependencies(
                  packageSpecs,
                  settings.customIndex || undefined
                );

                setDependencyResolution(resolution);

                // Rebuild package list from resolution
                const allPackages: Package[] = [];
                const mainPackageNames = new Set(
                  resolution.tree?.map(tree => tree.name.toLowerCase()) || []
                );

                // Create a map to preserve hash data
                const existingPackageMap = new Map(
                  currentPackages.map(pkg => [pkg.name.toLowerCase(), pkg])
                );

                Object.entries(resolution.packages).forEach(
                  ([name, version]) => {
                    const existingPkg = existingPackageMap.get(
                      name.toLowerCase()
                    );
                    const resolvedPkg = resolution.resolved_packages?.[name];
                    allPackages.push({
                      name,
                      version,
                      isDependency: !mainPackageNames.has(name.toLowerCase()),
                      hash: existingPkg?.hash || resolvedPkg?.sha256_hash,
                      fullName: existingPkg?.fullName,
                    });
                  }
                );

                setPackages(allPackages);
              }
            } catch (error) {
              console.error(
                'Failed to re-resolve dependencies after package removal:',
                error
              );
            } finally {
              setIsResolvingDependencies(false);
            }
          }, 100);
        } else {
          setIsResolvingDependencies(false);
        }
      } catch (error) {
        console.error('Error removing package:', error);
        setIsResolvingDependencies(false);
      }
    },
    [
      packages,
      settings.autoResolve,
      settings.customIndex,
      isResolvingDependencies,
    ]
  );

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
    <div className="min-h-screen bg-background text-foreground dark">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-100 tracking-tight">
                <span className="text-blue-400">py</span>
                <span className="text-gray-300">-</span>
                <span className="text-green-400">reqforge</span>
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Intelligent dependency management for Python projects
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">
                <span className="mono text-blue-400">requirements.txt</span>{' '}
                generation
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Full Width Layout */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-12 gap-8 max-w-[2000px] mx-auto">
          {/* Left Sidebar - Project Templates Only */}
          <div className="col-span-12 lg:col-span-2 xl:col-span-2">
            <ProjectTemplates onTemplateSelect={handleTemplateSelect} />
          </div>

          {/* Center Column - File Upload + Package Manager */}
          <div className="col-span-12 lg:col-span-7 xl:col-span-7 space-y-6">
            <FileUpload onFileUpload={handleFileUpload} />
            <PackageManager
              packages={packages}
              onPackageRemove={handlePackageRemove}
              onPackageUpdate={handlePackageUpdate}
            />
          </div>

          {/* Right Sidebar - Visualization & Export */}
          <div className="col-span-12 lg:col-span-3 xl:col-span-3 space-y-6">
            <DependencyTree
              packages={packages}
              dependencyResolution={dependencyResolution}
            />
            <SettingsPanel settings={settings} onSettingsChange={setSettings} />
            <ExportManager packages={packages} settings={settings} />
          </div>

          {/* Bottom Section - Package Search */}
          <div className="col-span-12 mt-8">
            <PackageSearch onPackageSelect={handlePackageSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
