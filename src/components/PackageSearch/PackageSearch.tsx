import { useState, useCallback, useEffect } from 'react';
import {
  apiClient,
  PackageSearchResult,
  PackageDetails,
} from '../../api/client';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Search } from 'lucide-react';

interface PackageSearchProps {
  onPackageSelect: (
    packageName: string,
    version: string
  ) => void | Promise<void>;
  indexUrl?: string;
}

export default function PackageSearch({
  onPackageSelect,
  indexUrl,
}: PackageSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PackageSearchResult[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageDetails | null>(
    null
  );
  const [selectedVersion, setSelectedVersion] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const results = await apiClient.searchPackages(searchTerm, indexUrl, 10);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setError(error instanceof Error ? error.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, indexUrl]);

  useEffect(() => {
    const timeoutId = setTimeout(handleSearch, 3000); // 3 second delay
    return () => clearTimeout(timeoutId);
  }, [handleSearch]);

  const handlePackageClick = useCallback(
    async (pkg: PackageSearchResult) => {
      setIsLoadingDetails(true);
      setError(null);
      try {
        const packageDetails = await apiClient.getPackageDetails(
          pkg.name,
          indexUrl,
          true,
          true
        );
        setSelectedPackage(packageDetails);
        setSelectedVersion(packageDetails.latest_version);
      } catch (error) {
        console.error('Failed to load package details:', error);
        setError(
          error instanceof Error
            ? error.message
            : 'Failed to load package details'
        );
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [indexUrl]
  );

  const handleAddPackage = useCallback(() => {
    if (selectedPackage && selectedVersion) {
      onPackageSelect(selectedPackage.name, selectedVersion);
      setSelectedPackage(null);
      setSelectedVersion('');
      setSearchTerm('');
      setSearchResults([]);
    }
  }, [selectedPackage, selectedVersion, onPackageSelect]);

  return (
    <Card className="w-full bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-100 text-xl font-bold">
          <Search className="h-6 w-6" />
          Package Search
        </CardTitle>
        <CardDescription className="text-gray-400 text-base">
          Search PyPI packages - type at least 2 characters to start searching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search PyPI packages..."
            className="w-full bg-zinc-800 border-zinc-600 text-gray-200 placeholder:text-gray-500 text-base"
          />
          {searchTerm.length > 0 && searchTerm.length < 2 && (
            <p className="text-sm text-gray-500 mt-1">
              Type at least 2 characters to search
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isSearching && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Searching packages...</p>
            <Skeleton className="h-4 w-full bg-zinc-700" />
            <Skeleton className="h-4 w-3/4 bg-zinc-700" />
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold mb-2 text-gray-100">
              Search Results{' '}
              <span className="text-blue-400">({searchResults.length})</span>
            </h3>
            <ScrollArea className="h-48 w-full rounded-md border border-zinc-700 p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {searchResults.map(pkg => (
                  <Card
                    key={pkg.name}
                    className="cursor-pointer hover:bg-zinc-800/50 transition-all duration-200 bg-zinc-900/50 border-zinc-700/50 hover:border-zinc-600/50 h-fit"
                    onClick={() => handlePackageClick(pkg)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-gray-200 mono text-sm truncate">
                            {pkg.name}
                          </h4>
                          <Badge
                            variant="secondary"
                            className="bg-zinc-700/50 text-zinc-300 mono text-xs shrink-0"
                          >
                            v{pkg.version}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                          {pkg.summary ||
                            pkg.description ||
                            'No description available'}
                        </p>
                        {pkg.author && (
                          <p className="text-xs text-gray-500 truncate">
                            by{' '}
                            <span className="text-gray-400">{pkg.author}</span>
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {selectedPackage && (
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-gray-100">
                <span className="mono text-lg font-bold">
                  {selectedPackage.name}
                </span>
                <Badge
                  variant="outline"
                  className="border-zinc-600 text-zinc-300"
                >
                  Package Details
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingDetails ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full bg-zinc-700" />
                  <Skeleton className="h-4 w-3/4 bg-zinc-700" />
                  <Skeleton className="h-8 w-1/3 bg-zinc-700" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400 italic text-base">
                      {selectedPackage.summary || selectedPackage.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                    {selectedPackage.author && (
                      <div>
                        <span className="font-semibold text-gray-200">
                          Author:
                        </span>{' '}
                        <span className="text-gray-300">
                          {selectedPackage.author}
                        </span>
                      </div>
                    )}
                    {selectedPackage.license && (
                      <div>
                        <span className="font-semibold text-gray-200">
                          License:
                        </span>{' '}
                        <span className="text-yellow-400 mono">
                          {selectedPackage.license}
                        </span>
                      </div>
                    )}
                    {selectedPackage.requires_python && (
                      <div>
                        <span className="font-semibold text-gray-200">
                          Requires Python:
                        </span>{' '}
                        <span className="text-purple-400 mono">
                          {selectedPackage.requires_python}
                        </span>
                      </div>
                    )}
                    {selectedPackage.homepage && (
                      <div>
                        <span className="font-semibold text-gray-200">
                          Homepage:
                        </span>{' '}
                        <a
                          href={selectedPackage.homepage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 break-all"
                        >
                          {selectedPackage.homepage}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="text-sm font-semibold text-gray-200">
                      Version:
                    </label>
                    <select
                      value={selectedVersion}
                      onChange={e => setSelectedVersion(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1 text-sm text-gray-200 mono shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {selectedPackage.versions?.map(versionInfo => (
                        <option
                          key={versionInfo.version}
                          value={versionInfo.version}
                        >
                          {versionInfo.version}
                          {versionInfo.yanked && ' (yanked)'}
                        </option>
                      )) || (
                        <option value={selectedPackage.latest_version}>
                          {selectedPackage.latest_version}
                        </option>
                      )}
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedPackage(null)}
                      className="border-zinc-600 text-gray-300 hover:bg-zinc-700 hover:text-gray-100"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddPackage}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      Add Package
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
