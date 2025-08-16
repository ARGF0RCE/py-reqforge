/**
 * API client for communicating with the FastAPI backend
 */

const API_BASE_URL = 'http://localhost:8000/api';

export interface PackageSearchResult {
  name: string;
  summary?: string;
  description?: string;
  version: string;
  author?: string;
  homepage?: string;
  keywords?: string[];
  score?: number;
  download_count?: number;
  last_updated?: string;
}

export interface FileInfo {
  filename: string;
  url: string;
  size?: number;
  upload_time?: string;
  packagetype?: string;
  md5_digest?: string;
  sha256_digest?: string;
}

export interface DependencyInfo {
  name: string;
  version_spec?: string;
  optional: boolean;
  extra?: string;
}

export interface VersionInfo {
  version: string;
  release_date?: string;
  yanked: boolean;
  yanked_reason?: string;
  summary?: string;
  description?: string;
  author?: string;
  author_email?: string;
  license?: string;
  homepage?: string;
  project_urls?: Record<string, string>;
  keywords?: string[];
  classifiers?: string[];
  requires_python?: string;
  files?: FileInfo[];
  dependencies?: DependencyInfo[];
  last_updated?: string;
}

export interface PackageDetails {
  name: string;
  summary?: string;
  description?: string;
  author?: string;
  author_email?: string;
  maintainer?: string;
  maintainer_email?: string;
  license?: string;
  homepage?: string;
  project_urls?: Record<string, string>;
  keywords?: string[];
  classifiers?: string[];
  requires_python?: string;
  latest_version: string;
  versions?: VersionInfo[];
  dependencies?: DependencyInfo[];
  optional_dependencies?: Record<string, DependencyInfo[]>;
  download_count?: number;
  github_stars?: number;
  first_release?: string;
  last_updated?: string;
}

export interface DependencyTree {
  name: string;
  version: string;
  dependencies: DependencyTree[];
}

export interface ResolvedPackage {
  version: string;
  sha256_hash?: string;
}

export interface DependencyResolution {
  packages: Record<string, string>;
  resolved_packages?: Record<string, ResolvedPackage>;
  tree: DependencyTree[];
  conflicts: Array<Record<string, unknown>>;
  warnings: string[];
  resolution_time?: number;
}

export interface CacheStats {
  packages: number;
  versions: number;
  search_cache_entries: number;
  cache_enabled: boolean;
  oldest_entry?: string;
  newest_entry?: string;
  cache_hit_rate?: number;
  database_file_size?: string;
  error?: string;
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  }

  // Package search
  async searchPackages(
    query: string,
    indexUrl?: string,
    limit: number = 10
  ): Promise<PackageSearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });

    if (indexUrl) {
      params.append('index_url', indexUrl);
    }

    return this.request<PackageSearchResult[]>(`/packages/search?${params}`);
  }

  // Package details
  async getPackageDetails(
    packageName: string,
    indexUrl?: string,
    includeVersions: boolean = true,
    includeDependencies: boolean = true
  ): Promise<PackageDetails> {
    const params = new URLSearchParams({
      include_versions: includeVersions.toString(),
      include_dependencies: includeDependencies.toString(),
    });

    if (indexUrl) {
      params.append('index_url', indexUrl);
    }

    return this.request<PackageDetails>(
      `/packages/${encodeURIComponent(packageName)}?${params}`
    );
  }

  // Package versions
  async getPackageVersions(
    packageName: string,
    indexUrl?: string,
    includeYanked: boolean = false
  ): Promise<VersionInfo[]> {
    const params = new URLSearchParams({
      include_yanked: includeYanked.toString(),
    });

    if (indexUrl) {
      params.append('index_url', indexUrl);
    }

    return this.request<VersionInfo[]>(
      `/packages/${encodeURIComponent(packageName)}/versions?${params}`
    );
  }

  // Specific version details
  async getVersionDetails(
    packageName: string,
    version: string,
    indexUrl?: string
  ): Promise<VersionInfo> {
    const params = new URLSearchParams();

    if (indexUrl) {
      params.append('index_url', indexUrl);
    }

    const query = params.toString() ? `?${params}` : '';
    return this.request<VersionInfo>(
      `/packages/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}${query}`
    );
  }

  // Dependency resolution
  async resolveDependencies(
    packages: string[],
    indexUrl?: string,
    pythonVersion: string = '3.9'
  ): Promise<DependencyResolution> {
    return this.request<DependencyResolution>(
      '/packages/resolve-dependencies',
      {
        method: 'POST',
        body: JSON.stringify({
          packages,
          index_url: indexUrl,
          python_version: pythonVersion,
        }),
      }
    );
  }

  // Cache management
  async refreshCache(
    packageName?: string,
    indexUrl?: string
  ): Promise<{ message: string }> {
    const params = new URLSearchParams();

    if (packageName) {
      params.append('package_name', packageName);
    }

    if (indexUrl) {
      params.append('index_url', indexUrl);
    }

    const query = params.toString() ? `?${params}` : '';
    return this.request<{ message: string }>(`/cache/refresh${query}`, {
      method: 'POST',
    });
  }

  async getCacheStats(): Promise<CacheStats> {
    return this.request<CacheStats>('/cache/stats');
  }

  async clearCache(
    packageName?: string,
    confirm: boolean = false
  ): Promise<{ message: string }> {
    const params = new URLSearchParams({
      confirm: confirm.toString(),
    });

    if (packageName) {
      params.append('package_name', packageName);
    }

    return this.request<{ message: string }>(`/cache/clear?${params}`, {
      method: 'DELETE',
    });
  }

  // Index validation
  async validateIndex(indexUrl: string): Promise<{
    index_url: string;
    valid: boolean;
    checked_at: string;
    error?: string;
  }> {
    const params = new URLSearchParams({
      index_url: indexUrl,
    });

    return this.request(`/indexes/validate?${params}`);
  }

  // Health check
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    database_status: string;
    cache_stats: CacheStats;
  }> {
    return this.request('/health');
  }
}

// Export singleton instance
export const apiClient = new APIClient();
export default apiClient;
