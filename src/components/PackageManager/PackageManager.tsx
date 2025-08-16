import { useState, useCallback } from 'react';
import { apiClient, PackageDetails } from '../../api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Trash2, Info, Edit, Check, X } from 'lucide-react';

interface Package {
  name: string;
  version: string;
  isDependency: boolean;
  hash?: string;
  fullName?: string; // For packages with extras like 'package[extra]'
  details?: PackageDetails;
}

interface PackageManagerProps {
  packages: Package[];
  onPackageRemove: (packageName: string) => Promise<void>;
  onPackageUpdate: (packageName: string, newVersion: string) => void;
  indexUrl?: string;
}

export default function PackageManager({
  packages,
  onPackageRemove,
  onPackageUpdate,
  indexUrl,
}: PackageManagerProps) {
  const [expandedPackage, setExpandedPackage] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState('');
  const [packageDetails, setPackageDetails] = useState<
    Map<string, PackageDetails>
  >(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [removingPackages, setRemovingPackages] = useState<Set<string>>(
    new Set()
  );

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

  const handleRemovePackage = useCallback(
    async (packageName: string) => {
      if (removingPackages.has(packageName)) return; // Prevent duplicate calls

      setRemovingPackages(prev => new Set(prev).add(packageName));
      try {
        await onPackageRemove(packageName);
      } catch (error) {
        console.error('Failed to remove package:', error);
      } finally {
        setRemovingPackages(prev => {
          const newSet = new Set(prev);
          newSet.delete(packageName);
          return newSet;
        });
      }
    },
    [onPackageRemove, removingPackages]
  );

  const toggleExpanded = useCallback(
    async (packageName: string) => {
      const isExpanding = expandedPackage !== packageName;
      setExpandedPackage(isExpanding ? packageName : null);

      // Fetch package details if expanding and not already cached
      if (
        isExpanding &&
        !packageDetails.has(packageName) &&
        !loadingDetails.has(packageName)
      ) {
        setLoadingDetails(prev => new Set(prev).add(packageName));
        try {
          const details = await apiClient.getPackageDetails(
            packageName,
            indexUrl,
            false,
            true
          );
          setPackageDetails(prev => new Map(prev).set(packageName, details));
        } catch (error) {
          console.error(`Failed to load details for ${packageName}:`, error);
        } finally {
          setLoadingDetails(prev => {
            const newSet = new Set(prev);
            newSet.delete(packageName);
            return newSet;
          });
        }
      }
    },
    [expandedPackage, packageDetails, loadingDetails, indexUrl]
  );

  const renderPackageItem = useCallback(
    (pkg: Package) => (
      <Card
        key={pkg.name}
        className="transition-all duration-200 hover:bg-zinc-800/50 bg-zinc-900/50 border-zinc-700/50 hover:border-zinc-600/50"
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <h4 className="font-semibold text-gray-100 mono text-lg truncate">
                  {pkg.name}
                </h4>
                {pkg.isDependency && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-zinc-700/50 text-zinc-300 shrink-0"
                  >
                    dependency
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3">
                {editingVersion === pkg.name ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={newVersion}
                      onChange={e => setNewVersion(e.target.value)}
                      className="h-8 w-28 bg-zinc-800 border-zinc-600 text-gray-200 mono text-sm"
                      placeholder="Version"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleVersionSave(pkg.name)}
                      className="h-8 px-3"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleVersionCancel}
                      className="h-8 px-3"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="border-zinc-600 text-zinc-300 mono px-3 py-1"
                    >
                      v{pkg.version}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleVersionEdit(pkg.name, pkg.version)}
                      className="h-8 px-3 hover:bg-zinc-700 text-gray-400 hover:text-gray-200"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleExpanded(pkg.name)}
                className="h-9 px-3 border-zinc-600 text-gray-300 hover:bg-zinc-700 hover:text-gray-100"
              >
                <Info className="h-4 w-4 mr-2" />
                {expandedPackage === pkg.name ? 'Hide' : 'Info'}
              </Button>
              {!pkg.isDependency && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleRemovePackage(pkg.name)}
                  disabled={removingPackages.has(pkg.name)}
                  className="h-9 px-3 bg-red-700 hover:bg-red-600 border-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {removingPackages.has(pkg.name) ? 'Removing...' : 'Remove'}
                </Button>
              )}
            </div>
          </div>

          {expandedPackage === pkg.name && (
            <>
              <Separator className="my-4" />
              {loadingDetails.has(pkg.name) ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <div className="text-sm space-y-4 text-gray-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="font-semibold text-gray-200">Name:</span>{' '}
                      <span className="mono text-blue-400 break-all">
                        {pkg.name}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-200">
                        Version:
                      </span>{' '}
                      <span className="mono text-green-400">{pkg.version}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-200">Type:</span>{' '}
                      <span className="text-gray-300">
                        {pkg.isDependency ? 'Dependency' : 'Main package'}
                      </span>
                    </div>
                    {packageDetails.get(pkg.name)?.requires_python && (
                      <div>
                        <span className="font-semibold text-gray-200">
                          Python:
                        </span>{' '}
                        <span className="text-purple-400 mono">
                          {packageDetails.get(pkg.name)?.requires_python}
                        </span>
                      </div>
                    )}
                  </div>

                  {packageDetails.has(pkg.name) && (
                    <>
                      {packageDetails.get(pkg.name)?.summary && (
                        <div>
                          <span className="font-semibold text-gray-200 block mb-1">
                            Summary:
                          </span>
                          <span className="text-gray-300 italic leading-relaxed">
                            {packageDetails.get(pkg.name)?.summary}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {packageDetails.get(pkg.name)?.author && (
                          <div>
                            <span className="font-semibold text-gray-200">
                              Author:
                            </span>{' '}
                            <span className="text-gray-300">
                              {packageDetails.get(pkg.name)?.author}
                            </span>
                          </div>
                        )}
                        {packageDetails.get(pkg.name)?.license && (
                          <div>
                            <span className="font-semibold text-gray-200">
                              License:
                            </span>{' '}
                            <span className="text-yellow-400 mono">
                              {packageDetails.get(pkg.name)?.license}
                            </span>
                          </div>
                        )}
                      </div>

                      {packageDetails.get(pkg.name)?.dependencies &&
                        packageDetails.get(pkg.name)!.dependencies!.length >
                          0 && (
                          <div>
                            <span className="font-semibold text-gray-200 block mb-2">
                              Dependencies:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {packageDetails
                                .get(pkg.name)!
                                .dependencies!.slice(0, 8)
                                .map(dep => (
                                  <Badge
                                    key={dep.name}
                                    variant="secondary"
                                    className="text-xs bg-zinc-700/50 text-zinc-300 mono"
                                  >
                                    {dep.name}
                                    {dep.version_spec && ` ${dep.version_spec}`}
                                  </Badge>
                                ))}
                              {packageDetails.get(pkg.name)!.dependencies!
                                .length > 8 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-zinc-600 text-zinc-400"
                                >
                                  +
                                  {packageDetails.get(pkg.name)!.dependencies!
                                    .length - 8}{' '}
                                  more...
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                    </>
                  )}

                  {pkg.hash && (
                    <div>
                      <span className="font-semibold text-gray-200 block mb-1">
                        Hash:
                      </span>
                      <span className="mono text-xs text-amber-400 break-all block">
                        {pkg.hash}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    ),
    [
      editingVersion,
      newVersion,
      expandedPackage,
      handleVersionEdit,
      handleVersionSave,
      handleVersionCancel,
      toggleExpanded,
      handleRemovePackage,
      removingPackages,
      packageDetails,
      loadingDetails,
    ]
  );

  return (
    <Card className="w-full bg-zinc-900 border-zinc-800 h-fit">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-gray-100 text-xl font-bold">
          <Package className="h-6 w-6" />
          Package Manager
        </CardTitle>
        <CardDescription className="text-gray-400">
          Manage your Python packages and dependencies
        </CardDescription>
        {packages.length > 0 && (
          <div className="flex gap-4 text-sm font-mono pt-2">
            <span className="text-gray-400">
              Total: <span className="text-blue-400">{packages.length}</span>
            </span>
            <span className="text-gray-400">
              Main: <span className="text-blue-400">{mainPackages.length}</span>
            </span>
            <span className="text-gray-400">
              Dependencies:{' '}
              <span className="text-green-400">{dependencies.length}</span>
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {packages.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg">
              No packages added yet
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Upload a requirements file or search for packages to get started
            </p>
          </div>
        ) : (
          <>
            {mainPackages.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-4 text-gray-100 flex items-center gap-2">
                  Main Packages
                  <Badge
                    variant="secondary"
                    className="bg-blue-500/20 text-blue-400 border-blue-500/30"
                  >
                    {mainPackages.length}
                  </Badge>
                </h3>
                <ScrollArea className="h-[400px] w-full rounded-md border border-zinc-700 p-3">
                  <div className="space-y-3">
                    {mainPackages.map(renderPackageItem)}
                  </div>
                </ScrollArea>
              </div>
            )}

            {dependencies.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-4 text-gray-100 flex items-center gap-2">
                  Dependencies
                  <Badge
                    variant="secondary"
                    className="bg-green-500/20 text-green-400 border-green-500/30"
                  >
                    {dependencies.length}
                  </Badge>
                </h3>
                <ScrollArea className="h-[300px] w-full rounded-md border border-zinc-700 p-3">
                  <div className="space-y-3">
                    {dependencies.map(renderPackageItem)}
                  </div>
                </ScrollArea>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
