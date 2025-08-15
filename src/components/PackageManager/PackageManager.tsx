import { useState, useCallback } from 'react';

interface Package {
  name: string;
  version: string;
  isDependency: boolean;
  hash?: string;
}

interface PackageManagerProps {
  packages: Package[];
  onPackageRemove: (packageName: string) => void;
  onPackageUpdate: (packageName: string, newVersion: string) => void;
}

export default function PackageManager({
  packages,
  onPackageRemove,
  onPackageUpdate,
}: PackageManagerProps) {
  const [expandedPackage, setExpandedPackage] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState('');

  const mainPackages = packages.filter(pkg => !pkg.isDependency);
  const dependencies = packages.filter(pkg => pkg.isDependency);

  const handleVersionEdit = useCallback(
    (packageName: string, currentVersion: string) => {
      setEditingVersion(packageName);
      setNewVersion(currentVersion);
    },
    []
  );

  const handleVersionSave = useCallback(
    (packageName: string) => {
      if (newVersion.trim()) {
        onPackageUpdate(packageName, newVersion);
      }
      setEditingVersion(null);
      setNewVersion('');
    },
    [newVersion, onPackageUpdate]
  );

  const handleVersionCancel = useCallback(() => {
    setEditingVersion(null);
    setNewVersion('');
  }, []);

  const toggleExpanded = useCallback(
    (packageName: string) => {
      setExpandedPackage(expandedPackage === packageName ? null : packageName);
    },
    [expandedPackage]
  );

  const renderPackageItem = useCallback(
    (pkg: Package) => (
      <div
        key={pkg.name}
        className="bg-white/10 backdrop-blur-sm p-3 rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-white">{pkg.name}</h4>
              {pkg.isDependency && (
                <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-1 rounded">
                  dependency
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1">
              {editingVersion === pkg.name ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newVersion}
                    onChange={e => setNewVersion(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="Version"
                  />
                  <button
                    onClick={() => handleVersionSave(pkg.name)}
                    className="text-xs bg-green-500/20 text-green-200 px-2 py-1 rounded hover:bg-green-500/30 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleVersionCancel}
                    className="text-xs bg-gray-500/20 text-gray-200 px-2 py-1 rounded hover:bg-gray-500/30 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-blue-300">v{pkg.version}</span>
                  <button
                    onClick={() => handleVersionEdit(pkg.name, pkg.version)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleExpanded(pkg.name)}
              className="text-xs bg-blue-500/20 text-blue-200 px-2 py-1 rounded hover:bg-blue-500/30 transition-colors"
            >
              {expandedPackage === pkg.name ? 'Hide' : 'Info'}
            </button>
            {!pkg.isDependency && (
              <button
                onClick={() => onPackageRemove(pkg.name)}
                className="text-xs bg-red-500/20 text-red-200 px-2 py-1 rounded hover:bg-red-500/30 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {expandedPackage === pkg.name && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <div className="text-sm text-blue-200">
              <p>
                <strong>Name:</strong> {pkg.name}
              </p>
              <p>
                <strong>Version:</strong> {pkg.version}
              </p>
              <p>
                <strong>Type:</strong>{' '}
                {pkg.isDependency ? 'Dependency' : 'Main package'}
              </p>
              {pkg.hash && (
                <p>
                  <strong>Hash:</strong>{' '}
                  <span className="font-mono text-xs">{pkg.hash}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    ),
    [
      editingVersion,
      newVersion,
      expandedPackage,
      handleVersionEdit,
      handleVersionSave,
      handleVersionCancel,
      toggleExpanded,
      onPackageRemove,
    ]
  );

  return (
    <div className="bg-gradient-manager p-6 rounded-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Package Manager</h2>

      {packages.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">📦</div>
          <p className="text-blue-200">No packages added yet</p>
          <p className="text-sm text-blue-300 mt-2">
            Upload a requirements file or search for packages to get started
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {mainPackages.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-3">
                Main Packages ({mainPackages.length})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {mainPackages.map(renderPackageItem)}
              </div>
            </div>
          )}

          {dependencies.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-white mb-3">
                Dependencies ({dependencies.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {dependencies.map(renderPackageItem)}
              </div>
            </div>
          )}
        </div>
      )}

      {packages.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/20">
          <div className="flex justify-between text-sm text-blue-300">
            <span>Total packages: {packages.length}</span>
            <span>
              Main: {mainPackages.length} | Dependencies: {dependencies.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
