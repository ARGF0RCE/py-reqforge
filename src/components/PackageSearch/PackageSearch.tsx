import { useState, useCallback, useEffect } from 'react';

interface PackageInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage: string;
  versions: string[];
}

interface PackageSearchProps {
  onPackageSelect: (packageName: string, version: string) => void;
}

export default function PackageSearch({ onPackageSelect }: PackageSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PackageInfo[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageInfo | null>(
    null
  );
  const [selectedVersion, setSelectedVersion] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const mockSearch = useCallback(
    async (term: string): Promise<PackageInfo[]> => {
      const mockPackages = [
        {
          name: 'requests',
          version: '2.31.0',
          description: 'Python HTTP for Humans.',
          author: 'Kenneth Reitz',
          license: 'Apache 2.0',
          homepage: 'https://requests.readthedocs.io',
          versions: ['2.31.0', '2.30.0', '2.29.0', '2.28.2'],
        },
        {
          name: 'flask',
          version: '2.3.3',
          description:
            'A simple framework for building complex web applications.',
          author: 'Armin Ronacher',
          license: 'BSD-3-Clause',
          homepage: 'https://palletsprojects.com/p/flask',
          versions: ['2.3.3', '2.3.2', '2.3.1', '2.2.5'],
        },
        {
          name: 'django',
          version: '4.2.5',
          description: 'A high-level Python Web framework.',
          author: 'Django Software Foundation',
          license: 'BSD-3-Clause',
          homepage: 'https://www.djangoproject.com',
          versions: ['4.2.5', '4.2.4', '4.1.12', '3.2.21'],
        },
      ];

      return mockPackages.filter(
        pkg =>
          pkg.name.toLowerCase().includes(term.toLowerCase()) ||
          pkg.description.toLowerCase().includes(term.toLowerCase())
      );
    },
    []
  );

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await mockSearch(searchTerm);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, mockSearch]);

  useEffect(() => {
    const timeoutId = setTimeout(handleSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [handleSearch]);

  const handlePackageClick = useCallback(async (pkg: PackageInfo) => {
    setIsLoadingDetails(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setSelectedPackage(pkg);
      setSelectedVersion(pkg.version);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

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
    <div className="bg-gradient-search p-6 rounded-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Package Search</h2>

      <div className="mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search PyPI packages..."
          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {isSearching && (
        <div className="text-center text-blue-300 py-4">
          Searching packages...
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="mb-4 max-h-60 overflow-y-auto">
          <h3 className="text-sm font-medium text-white mb-2">
            Search Results
          </h3>
          <div className="space-y-2">
            {searchResults.map(pkg => (
              <div
                key={pkg.name}
                onClick={() => handlePackageClick(pkg)}
                className="bg-white/10 backdrop-blur-sm p-3 rounded-lg border border-white/20 cursor-pointer hover:bg-white/20 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-white">{pkg.name}</h4>
                    <p className="text-sm text-blue-200">{pkg.description}</p>
                  </div>
                  <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-1 rounded">
                    v{pkg.version}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedPackage && (
        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
          {isLoadingDetails ? (
            <div className="text-center text-blue-300 py-4">
              Loading package details...
            </div>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-white mb-2">
                {selectedPackage.name}
              </h3>

              <div className="space-y-2 mb-4">
                <p className="text-blue-200">{selectedPackage.description}</p>
                <div className="text-sm text-blue-300">
                  <p>Author: {selectedPackage.author}</p>
                  <p>License: {selectedPackage.license}</p>
                  {selectedPackage.homepage && (
                    <p>
                      Homepage:{' '}
                      <a
                        href={selectedPackage.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {selectedPackage.homepage}
                      </a>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <label className="text-sm text-white">Version:</label>
                <select
                  value={selectedVersion}
                  onChange={e => setSelectedVersion(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {selectedPackage.versions.map(version => (
                    <option
                      key={version}
                      value={version}
                      className="bg-gray-800"
                    >
                      {version}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedPackage(null)}
                  className="px-4 py-2 bg-gray-500/20 text-gray-200 rounded hover:bg-gray-500/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPackage}
                  className="px-4 py-2 bg-green-500/20 text-green-200 rounded hover:bg-green-500/30 transition-colors"
                >
                  Add Package
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
