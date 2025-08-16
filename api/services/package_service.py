"""
Package service combining PyPI client and cache for intelligent package management
"""

import asyncio
from typing import List, Optional, Dict, Any, Set
from datetime import datetime
import logging
from packaging.version import parse as parse_version, InvalidVersion
from packaging.specifiers import SpecifierSet

from .pypi_client import PyPIClient
from .cache_service import CacheService
from models.package_models import (
    PackageSearchResult,
    PackageDetails,
    VersionInfo,
    DependencyInfo,
    FileInfo,
    DependencyResolution,
    DependencyTree,
    ResolvedPackage
)

logger = logging.getLogger(__name__)

class PackageService:
    """High-level service for package operations with intelligent caching"""
    
    def __init__(self, pypi_client: PyPIClient, cache_service: CacheService):
        self.pypi_client = pypi_client
        self.cache_service = cache_service
        
        # Popular packages to warm cache with
        self.popular_packages = [
            'requests', 'numpy', 'pandas', 'django', 'flask', 'fastapi',
            'pytest', 'setuptools', 'wheel', 'pip', 'black', 'flake8',
            'mypy', 'click', 'pydantic', 'sqlalchemy', 'alembic', 'jinja2',
            'matplotlib', 'seaborn', 'scikit-learn', 'tensorflow', 'torch',
            'opencv-python', 'pillow', 'beautifulsoup4', 'lxml', 'httpx'
        ]
    
    async def search_packages(
        self, 
        query: str, 
        index_url: Optional[str] = None, 
        limit: int = 10
    ) -> List[PackageSearchResult]:
        """
        Search for packages with intelligent caching
        
        First checks cache, then falls back to live search if needed
        """
        if not index_url:
            index_url = "https://pypi.org"
        
        # Check cache first - exact match
        cache_key = f"{query}:{index_url}:{limit}"
        cached_results = await self.cache_service.get_search_cache(cache_key)
        
        if cached_results:
            logger.info(f"Returning cached search results for '{query}'")
            return [PackageSearchResult(**result) for result in cached_results]
        
        # Check for partial matches in cache (for incremental search)
        partial_matches = await self.cache_service.get_partial_search_matches(query.lower(), limit)
        if partial_matches:
            logger.info(f"Found {len(partial_matches)} partial matches in cache for '{query}'")
            # If we have enough partial matches, return them
            if len(partial_matches) >= limit // 2:  # Return if we have at least half the requested amount
                # Still do a live search but with a smaller limit to supplement
                live_limit = max(1, limit - len(partial_matches))
                try:
                    async with self.pypi_client as client:
                        additional_results = await client.search_packages(query, index_url, live_limit)
                    
                    # Combine and deduplicate
                    all_results = partial_matches[:]
                    existing_names = {result['name'].lower() for result in partial_matches}
                    
                    for raw_result in additional_results:
                        if raw_result['name'].lower() not in existing_names:
                            try:
                                result = {
                                    'name': raw_result['name'],
                                    'summary': raw_result.get('summary'),
                                    'description': raw_result.get('description'),
                                    'version': raw_result.get('version', '0.0.0'),
                                    'author': raw_result.get('author'),
                                    'homepage': raw_result.get('homepage'),
                                    'keywords': raw_result.get('keywords', []) if isinstance(raw_result.get('keywords'), list) else None,
                                    'last_updated': datetime.utcnow().isoformat()
                                }
                                all_results.append(result)
                            except Exception as e:
                                logger.warning(f"Failed to parse additional result: {e}")
                                continue
                    
                    # Cache the combined results (ensure serializable)
                    serializable_combined = []
                    for result in all_results[:limit]:
                        if isinstance(result, dict):
                            # Convert any datetime objects to strings
                            for key, value in result.items():
                                if isinstance(value, datetime):
                                    result[key] = value.isoformat()
                            serializable_combined.append(result)
                    
                    await self.cache_service.cache_search_results(cache_key, serializable_combined)
                    return [PackageSearchResult(**result) for result in all_results[:limit]]
                    
                except Exception as e:
                    logger.warning(f"Failed to get additional results, returning cached partial matches: {e}")
                    return [PackageSearchResult(**result) for result in partial_matches[:limit]]
        
        # Perform live search
        logger.info(f"Performing live search for '{query}' on {index_url}")
        
        async with self.pypi_client as client:
            raw_results = await client.search_packages(query, index_url, limit)
        
        # Convert to our model format
        results = []
        for raw_result in raw_results:
            try:
                result = PackageSearchResult(
                    name=raw_result['name'],
                    summary=raw_result.get('summary'),
                    description=raw_result.get('description'),
                    version=raw_result.get('version', '0.0.0'),
                    author=raw_result.get('author'),
                    homepage=raw_result.get('homepage'),
                    keywords=raw_result.get('keywords', []) if isinstance(raw_result.get('keywords'), list) else None,
                    last_updated=datetime.utcnow().isoformat()  # Convert to string
                )
                results.append(result)
            except Exception as e:
                logger.warning(f"Failed to parse search result for {raw_result.get('name', 'unknown')}: {e}")
                continue
        
        # Cache the results (serialize manually to handle datetime objects)
        serializable_results = []
        for result in results:
            result_dict = result.dict()
            # Convert any datetime objects to strings
            for key, value in result_dict.items():
                if isinstance(value, datetime):
                    result_dict[key] = value.isoformat()
            serializable_results.append(result_dict)
        
        await self.cache_service.cache_search_results(cache_key, serializable_results)
        
        return results
    
    async def get_package_details(
        self,
        package_name: str,
        index_url: Optional[str] = None,
        include_versions: bool = True,
        include_dependencies: bool = True
    ) -> Optional[PackageDetails]:
        """
        Get comprehensive package details with caching
        """
        if not index_url:
            index_url = "https://pypi.org"
        
        # Check cache first
        cached_package = await self.cache_service.get_package(package_name)
        
        if cached_package:
            logger.info(f"Returning cached package details for {package_name}")
            return await self._convert_cached_to_package_details(
                cached_package, include_versions, include_dependencies
            )
        
        # Fetch from PyPI
        logger.info(f"Fetching live package details for {package_name} from {index_url}")
        
        async with self.pypi_client as client:
            package_data = await client.get_package_info(package_name, index_url)
        
        if not package_data:
            return None
        
        # Cache the package data
        await self.cache_service.cache_package(package_data)
        
        # Convert to our model
        return await self._convert_raw_to_package_details(
            package_data, include_versions, include_dependencies
        )
    
    async def get_package_versions(
        self,
        package_name: str,
        index_url: Optional[str] = None,
        include_yanked: bool = False
    ) -> List[VersionInfo]:
        """Get all versions for a package"""
        package_details = await self.get_package_details(
            package_name, index_url, include_versions=True
        )
        
        if not package_details or not package_details.versions:
            return []
        
        versions = package_details.versions
        
        if not include_yanked:
            versions = [v for v in versions if not v.yanked]
        
        # Sort by version (newest first)
        try:
            versions.sort(
                key=lambda v: parse_version(v.version), 
                reverse=True
            )
        except Exception as e:
            logger.warning(f"Failed to sort versions for {package_name}: {e}")
        
        return versions
    
    async def get_version_details(
        self,
        package_name: str,
        version: str,
        index_url: Optional[str] = None
    ) -> Optional[VersionInfo]:
        """Get details for a specific package version"""
        if not index_url:
            index_url = "https://pypi.org"
        
        async with self.pypi_client as client:
            version_data = await client.get_package_version_info(
                package_name, version, index_url
            )
        
        if not version_data:
            return None
        
        return await self._convert_raw_to_version_info(version_data, version)
    
    async def get_package_hash(
        self,
        package_name: str,
        version: str,
        index_url: Optional[str] = None
    ) -> Optional[str]:
        """Get SHA256 hash for a specific package version"""
        try:
            # First check if we have cached hash information
            cached_package = await self.cache_service.get_package(package_name)
            if cached_package and cached_package.versions:
                for cached_version in cached_package.versions:
                    if cached_version.version == version and cached_version.sha256Hash:
                        logger.info(f"Using cached hash for {package_name}=={version}")
                        return cached_version.sha256Hash
            
            # If not cached, fetch from PyPI
            version_details = await self.get_version_details(package_name, version, index_url)
            if version_details and version_details.files:
                found_hash = None
                
                # Prefer wheel files, fall back to source distributions
                for file_info in version_details.files:
                    if file_info.packagetype == "bdist_wheel" and file_info.sha256_digest:
                        logger.info(f"Found wheel hash for {package_name}=={version}")
                        found_hash = file_info.sha256_digest
                        break
                
                # If no wheel with hash found, try any file with hash
                if not found_hash:
                    for file_info in version_details.files:
                        if file_info.sha256_digest:
                            logger.info(f"Found source hash for {package_name}=={version}")
                            found_hash = file_info.sha256_digest
                            break
                
                # Cache the hash if we found one
                if found_hash:
                    try:
                        await self.cache_service.cache_version_hash(package_name, version, found_hash)
                    except Exception as e:
                        logger.warning(f"Failed to cache hash for {package_name}=={version}: {e}")
                
                return found_hash
            
            return None
        except Exception as e:
            logger.warning(f"Failed to get hash for {package_name}=={version}: {e}")
            return None

    async def resolve_dependencies(
        self,
        packages: List[str],
        index_url: Optional[str] = None,
        python_version: str = "3.9"
    ) -> DependencyResolution:
        """
        Resolve dependencies for a list of packages
        
        For large package lists (like requirements.txt), analyze relationships
        to identify main packages vs dependencies.
        """
        if not index_url:
            index_url = "https://pypi.org"
        
        # Check cache first
        cached_resolution = await self.cache_service.get_dependency_resolution_cache(
            packages, index_url, python_version
        )
        
        if cached_resolution:
            # Convert cached data back to DependencyResolution object
            try:
                return DependencyResolution(**cached_resolution)
            except Exception as e:
                logger.warning(f"Failed to deserialize cached resolution: {e}")
                # Fall through to fresh resolution
        
        start_time = asyncio.get_event_loop().time()
        
        # For large package lists, use dependency analysis
        if len(packages) > 15:
            logger.info(f"Using dependency analysis for {len(packages)} packages")
            resolution = await self._analyze_package_relationships(packages, index_url, start_time)
        else:
            # For smaller lists, use the original approach
            logger.info(f"Using traditional resolution for {len(packages)} packages")
            resolution = await self._resolve_packages_traditional(packages, index_url, start_time)
        
        # Cache the resolution
        try:
            await self.cache_service.cache_dependency_resolution(
                packages, index_url, python_version, resolution.dict()
            )
        except Exception as e:
            logger.warning(f"Failed to cache dependency resolution: {e}")
        
        return resolution
    
    async def _analyze_package_relationships(
        self,
        packages: List[str],
        index_url: str,
        start_time: float
    ) -> DependencyResolution:
        """
        Analyze relationships between packages to identify main vs dependencies
        """
        resolved_packages = {}
        warnings = []
        conflicts = []
        
        # Step 1: Parse all package names and versions
        parsed_packages = {}
        for package_spec in packages:
            try:
                package_name, version_constraint = self._parse_package_spec(package_spec)
                if version_constraint and version_constraint.startswith('=='):
                    version = version_constraint[2:].strip()
                else:
                    version = "latest"
                parsed_packages[package_name] = version
                resolved_packages[package_name] = version
            except Exception as e:
                logger.warning(f"Failed to parse package spec '{package_spec}': {e}")
                continue
        
        # Step 2: Get dependency information for all packages
        package_dependencies = {}
        for package_name in parsed_packages.keys():
            try:
                package_details = await self.get_package_details(package_name, index_url, include_dependencies=True)
                if package_details and package_details.dependencies:
                    # Extract dependency names (ignore version constraints)
                    deps = set()
                    for dep in package_details.dependencies:
                        deps.add(dep.name.lower())
                    package_dependencies[package_name.lower()] = deps
                    logger.info(f"Found {len(deps)} dependencies for {package_name}: {sorted(deps)}")
                else:
                    package_dependencies[package_name.lower()] = set()
                    logger.info(f"No dependencies found for {package_name}")
            except Exception as e:
                logger.warning(f"Failed to get dependencies for {package_name}: {e}")
                package_dependencies[package_name.lower()] = set()
        
        # Step 3: Identify main packages vs dependencies
        all_package_names = set(p.lower() for p in parsed_packages.keys())
        dependencies_mentioned = set()
        
        # Collect all packages that are mentioned as dependencies by other packages in our list
        for package_name, deps in package_dependencies.items():
            # Only consider dependencies that are also in our package list
            dependencies_mentioned.update(dep for dep in deps if dep in all_package_names)
        
        # Main packages are those in our list that are NOT dependencies of other packages in our list
        main_packages = []
        for package_name in parsed_packages.keys():
            if package_name.lower() not in dependencies_mentioned:
                main_packages.append(package_name)
        
        logger.info(f"Analysis results: {len(parsed_packages)} total packages, {len(dependencies_mentioned)} found as dependencies, {len(main_packages)} identified as main packages")
        logger.info(f"Dependencies found in package list: {sorted(dependencies_mentioned)}")
        logger.info(f"Main packages identified: {sorted(main_packages)}")
        
        # If we couldn't identify any main packages, fall back to treating first few as main
        if not main_packages:
            main_packages = list(parsed_packages.keys())[:5]
            warnings.append("Could not determine main packages from dependency analysis")
        
        # Step 4: Build dependency trees for main packages only
        dependency_trees = []
        for main_package in main_packages:
            try:
                if main_package.lower() in package_dependencies:
                    tree = self._build_tree_from_analysis(
                        main_package, 
                        parsed_packages[main_package],
                        package_dependencies,
                        parsed_packages,
                        visited=set()
                    )
                    if tree:
                        dependency_trees.append(tree)
            except Exception as e:
                logger.warning(f"Failed to build tree for main package {main_package}: {e}")
        
        # Step 5: Get hash information for all resolved packages
        resolved_packages_with_hash = {}
        for package_name, version in resolved_packages.items():
            try:
                package_hash = await self.get_package_hash(package_name, version, index_url)
                resolved_packages_with_hash[package_name] = ResolvedPackage(
                    version=version,
                    sha256_hash=package_hash
                )
                logger.info(f"Hash for {package_name}=={version}: {'found' if package_hash else 'not found'}")
            except Exception as e:
                logger.warning(f"Failed to get hash for {package_name}=={version}: {e}")
                resolved_packages_with_hash[package_name] = ResolvedPackage(
                    version=version,
                    sha256_hash=None
                )

        end_time = asyncio.get_event_loop().time()
        
        return DependencyResolution(
            packages=resolved_packages,  # Keep for backward compatibility
            resolved_packages=resolved_packages_with_hash,
            tree=dependency_trees,
            conflicts=conflicts,
            warnings=warnings,
            resolution_time=end_time - start_time
        )
    
    def _build_tree_from_analysis(
        self,
        package_name: str,
        version: str,
        package_dependencies: Dict[str, Set[str]],
        all_packages: Dict[str, str],
        visited: Set[str],
        max_depth: int = 3
    ) -> Optional[DependencyTree]:
        """Build dependency tree from pre-analyzed dependency data"""
        if len(visited) >= max_depth or package_name.lower() in visited:
            return DependencyTree(name=package_name, version=version)
        
        visited.add(package_name.lower())
        tree = DependencyTree(name=package_name, version=version)
        
        # Get dependencies for this package that are also in our package list
        deps = package_dependencies.get(package_name.lower(), set())
        
        for dep_name in deps:
            if dep_name in all_packages:
                # This dependency is in our package list
                subtree = self._build_tree_from_analysis(
                    dep_name,
                    all_packages[dep_name],
                    package_dependencies,
                    all_packages,
                    visited.copy(),
                    max_depth
                )
                if subtree:
                    tree.dependencies.append(subtree)
        
        return tree
    
    async def _resolve_packages_traditional(
        self,
        packages: List[str],
        index_url: str,
        start_time: float
    ) -> DependencyResolution:
        """Traditional dependency resolution for smaller package lists"""
        resolved_packages = {}
        dependency_trees = []
        conflicts = []
        warnings = []
        
        try:
            for package_spec in packages:
                try:
                    # Parse package specification
                    package_name, version_constraint = self._parse_package_spec(package_spec)
                    logger.info(f"Resolving {package_name} with constraint: {version_constraint}")
                    
                    # Get package details
                    package_details = await self.get_package_details(package_name, index_url)
                    
                    if not package_details:
                        warnings.append(f"Package '{package_name}' not found")
                        continue
                    
                    # Select version based on constraint
                    selected_version = None
                    if version_constraint:
                        selected_version = self._select_version(
                            package_details.versions or [],
                            version_constraint
                        )
                    
                    # If no version selected with constraint, try using latest version directly
                    if not selected_version:
                        if version_constraint:
                            # Try fallback for exact version matching
                            if version_constraint.startswith('=='):
                                target_version = version_constraint[2:].strip()
                                selected_version = VersionInfo(version=target_version)
                                logger.info(f"Using fallback exact version {target_version} for {package_name}")
                            else:
                                warnings.append(f"No suitable version found for '{package_spec}' with constraint '{version_constraint}'")
                                continue
                        else:
                            # No constraint, use latest version
                            selected_version = VersionInfo(version=package_details.latest_version)
                    
                    if selected_version:
                        resolved_packages[package_name] = selected_version.version
                        logger.info(f"Resolved {package_name} to version {selected_version.version}")
                        
                        # Build dependency tree (simplified) - only for successfully resolved packages
                        try:
                            dep_tree = await self._build_dependency_tree(
                                package_name, selected_version, index_url, depth=0, max_depth=2
                            )
                            
                            if dep_tree:
                                dependency_trees.append(dep_tree)
                        except Exception as tree_error:
                            logger.warning(f"Failed to build dependency tree for {package_name}: {tree_error}")
                            # Continue without dependency tree
                    
                except Exception as package_error:
                    logger.error(f"Failed to resolve package '{package_spec}': {package_error}")
                    warnings.append(f"Failed to resolve package '{package_spec}': {str(package_error)}")
                    continue
            
            # Get hash information for resolved packages
            resolved_packages_with_hash = {}
            for package_name, version in resolved_packages.items():
                try:
                    package_hash = await self.get_package_hash(package_name, version, index_url)
                    resolved_packages_with_hash[package_name] = ResolvedPackage(
                        version=version,
                        sha256_hash=package_hash
                    )
                    logger.info(f"Hash for {package_name}=={version}: {'found' if package_hash else 'not found'}")
                except Exception as e:
                    logger.warning(f"Failed to get hash for {package_name}=={version}: {e}")
                    resolved_packages_with_hash[package_name] = ResolvedPackage(
                        version=version,
                        sha256_hash=None
                    )

            end_time = asyncio.get_event_loop().time()
            
            return DependencyResolution(
                packages=resolved_packages,  # Keep for backward compatibility
                resolved_packages=resolved_packages_with_hash,
                tree=dependency_trees,
                conflicts=conflicts,
                warnings=warnings,
                resolution_time=end_time - start_time
            )
            
        except Exception as e:
            logger.error(f"Dependency resolution failed: {e}")
            raise
    
    async def _build_dependency_tree(
        self,
        package_name: str,
        version_info: VersionInfo,
        index_url: str,
        depth: int = 0,
        max_depth: int = 2,
        visited: Optional[Set[str]] = None
    ) -> Optional[DependencyTree]:
        """Build dependency tree recursively (simplified)"""
        if visited is None:
            visited = set()
        
        # Prevent circular dependencies and excessive depth
        if depth >= max_depth or package_name in visited:
            return DependencyTree(name=package_name, version=version_info.version)
        
        visited.add(package_name)
        tree = DependencyTree(name=package_name, version=version_info.version)
        
        if version_info.dependencies and depth < max_depth - 1:
            for dep in version_info.dependencies[:3]:  # Reduced limit to prevent explosion
                try:
                    if dep.name not in visited:  # Skip if already visited
                        dep_details = await self.get_package_details(dep.name, index_url)
                        if dep_details:
                            # Use latest version for simplicity
                            latest_version = VersionInfo(version=dep_details.latest_version)
                            
                            subtree = await self._build_dependency_tree(
                                dep.name, latest_version, index_url, depth + 1, max_depth, visited.copy()
                            )
                            
                            if subtree:
                                tree.dependencies.append(subtree)
                except Exception as e:
                    logger.warning(f"Failed to resolve dependency {dep.name}: {e}")
                    continue
        
        return tree
    
    def _parse_package_spec(self, package_spec: str) -> tuple[str, Optional[str]]:
        """Parse package specification like 'requests>=2.25.0' or 'package[extra]==1.0.0'"""
        # First, strip environment markers (everything after ';')
        clean_spec = package_spec.split(';')[0].strip()
        
        for op in ['>=', '<=', '==', '!=', '>', '<', '~=']:
            if op in clean_spec:
                parts = clean_spec.split(op, 1)
                if len(parts) == 2:
                    package_name_with_extras = parts[0].strip()
                    # Extract base package name for PyPI lookup (remove extras in square brackets)
                    if '[' in package_name_with_extras:
                        base_package_name = package_name_with_extras[:package_name_with_extras.index('[')]
                        logger.info(f"Extracted base package '{base_package_name}' from '{package_name_with_extras}'")
                        return base_package_name, f"{op}{parts[1].strip()}"
                    else:
                        return package_name_with_extras, f"{op}{parts[1].strip()}"
        
        # Handle packages without version constraints
        package_name = clean_spec.strip()
        if '[' in package_name:
            base_package_name = package_name[:package_name.index('[')]
            logger.info(f"Extracted base package '{base_package_name}' from '{package_name}'")
            return base_package_name, None
        
        return package_name, None
    
    def _select_version(
        self, 
        versions: List[VersionInfo], 
        constraint: Optional[str]
    ) -> Optional[VersionInfo]:
        """Select the best version based on constraint"""
        if not versions:
            return None
        
        if not constraint:
            # Return latest version
            try:
                return max(versions, key=lambda v: parse_version(v.version))
            except Exception:
                return versions[0]
        
        try:
            spec_set = SpecifierSet(constraint)
            
            # Filter versions that match the constraint
            matching_versions = []
            for v in versions:
                try:
                    if spec_set.contains(v.version):
                        matching_versions.append(v)
                except Exception as version_error:
                    logger.debug(f"Failed to check version {v.version} against constraint {constraint}: {version_error}")
                    continue
            
            if matching_versions:
                # Return the latest matching version
                try:
                    return max(matching_versions, key=lambda v: parse_version(v.version))
                except Exception as sort_error:
                    logger.debug(f"Failed to sort matching versions, returning first match: {sort_error}")
                    return matching_versions[0]
            else:
                logger.warning(f"No versions found matching constraint '{constraint}' for package")
            
        except Exception as e:
            logger.warning(f"Failed to parse version constraint '{constraint}': {e}")
            # Fallback: try direct string matching for exact constraints
            if constraint.startswith('=='):
                target_version = constraint[2:].strip()
                for v in versions:
                    if v.version == target_version:
                        return v
        
        return None
    
    async def _convert_cached_to_package_details(
        self,
        cached_package,
        include_versions: bool,
        include_dependencies: bool
    ) -> PackageDetails:
        """Convert cached package data to PackageDetails model"""
        # This would need to be implemented based on your Prisma model structure
        # For now, returning a simplified version
        
        latest_version = "1.0.0"  # Placeholder
        if cached_package.versions:
            try:
                latest_version = max(
                    cached_package.versions,
                    key=lambda v: parse_version(v.version)
                ).version
            except Exception:
                latest_version = cached_package.versions[0].version
        
        # Convert cached versions to VersionInfo objects if needed
        versions_list = []
        if include_versions and cached_package.versions:
            for cached_version in cached_package.versions:
                versions_list.append(VersionInfo(
                    version=cached_version.version,
                    release_date=cached_version.releaseDate,
                    yanked=cached_version.yanked or False,
                    yanked_reason=None  # Not stored in cache schema
                ))

        # Convert cached dependencies
        dependencies = []
        if include_dependencies and cached_package.dependencies:
            dependencies = [
                DependencyInfo(
                    name=dep.dependencyName,
                    version_spec=dep.versionSpec,
                    optional=dep.optional,
                    extra=dep.extra
                ) for dep in cached_package.dependencies
            ]

        return PackageDetails(
            name=cached_package.name,
            summary=cached_package.summary,
            description=cached_package.description,
            author=cached_package.author,
            author_email=cached_package.authorEmail,
            maintainer=cached_package.maintainer,
            maintainer_email=cached_package.maintainerEmail,
            license=cached_package.license,
            homepage=cached_package.homepage,
            latest_version=latest_version,
            versions=versions_list if include_versions else None,
            dependencies=dependencies if include_dependencies else None,
            last_updated=cached_package.lastUpdated
        )
    
    async def _convert_raw_to_package_details(
        self,
        package_data: Dict[str, Any],
        include_versions: bool,
        include_dependencies: bool
    ) -> PackageDetails:
        """Convert raw PyPI data to PackageDetails model"""
        info = package_data.get('info', {})
        
        # Convert versions
        versions = []
        if include_versions and 'releases' in package_data:
            for version_str, files in package_data['releases'].items():
                version_info = VersionInfo(
                    version=version_str,
                    files=[
                        FileInfo(
                            filename=f.get('filename', ''),
                            url=f.get('url', ''),
                            size=f.get('size'),
                            packagetype=f.get('packagetype'),
                            md5_digest=f.get('md5_digest'),
                            sha256_digest=f.get('digests', {}).get('sha256')
                        ) for f in files
                    ] if files else []
                )
                versions.append(version_info)
        
        # Convert dependencies
        dependencies = []
        if include_dependencies and info.get('requires_dist'):
            async with self.pypi_client as client:
                raw_deps = await client.extract_dependencies(package_data)
                dependencies = [
                    DependencyInfo(
                        name=dep['name'],
                        version_spec=dep.get('version_spec'),
                        optional=dep.get('optional', False),
                        extra=dep.get('extra')
                    ) for dep in raw_deps
                ]
        
        return PackageDetails(
            name=info['name'],
            summary=info.get('summary'),
            description=info.get('description'),
            author=info.get('author'),
            author_email=info.get('author_email'),
            maintainer=info.get('maintainer'),
            maintainer_email=info.get('maintainer_email'),
            license=info.get('license'),
            homepage=info.get('home_page'),
            project_urls=info.get('project_urls', {}),
            keywords=info.get('keywords', '').split(',') if info.get('keywords') else None,
            classifiers=info.get('classifiers', []),
            requires_python=info.get('requires_python'),
            latest_version=info['version'],
            versions=versions if include_versions else None,
            dependencies=dependencies if include_dependencies else None
        )
    
    async def _convert_raw_to_version_info(
        self,
        version_data: Dict[str, Any],
        version: str
    ) -> VersionInfo:
        """Convert raw version data to VersionInfo model"""
        info = version_data.get('info', {})
        urls = version_data.get('urls', [])
        
        files = [
            FileInfo(
                filename=url.get('filename', ''),
                url=url.get('url', ''),
                size=url.get('size'),
                upload_time=datetime.fromisoformat(url['upload_time'].replace('Z', '+00:00')) if url.get('upload_time') else None,
                packagetype=url.get('packagetype'),
                md5_digest=url.get('md5_digest'),
                sha256_digest=url.get('digests', {}).get('sha256')
            ) for url in urls
        ]
        
        return VersionInfo(
            version=version,
            summary=info.get('summary'),
            description=info.get('description'),
            author=info.get('author'),
            author_email=info.get('author_email'),
            license=info.get('license'),
            homepage=info.get('home_page'),
            project_urls=info.get('project_urls', {}),
            keywords=info.get('keywords', '').split(',') if info.get('keywords') else None,
            classifiers=info.get('classifiers', []),
            requires_python=info.get('requires_python'),
            files=files
        )
    
    async def validate_index(self, index_url: str) -> bool:
        """Validate that a package index is accessible"""
        async with self.pypi_client as client:
            return await client.validate_index(index_url)
    
    async def warm_popular_packages(self):
        """Background task to warm cache with popular packages"""
        logger.info("Starting to warm cache with popular packages")
        
        async with self.pypi_client as client:
            for i, package_name in enumerate(self.popular_packages[:10]):  # Limit to prevent overload
                try:
                    logger.info(f"Warming cache for package {i+1}/10: {package_name}")
                    await self.get_package_details(package_name)
                    await asyncio.sleep(1.0)  # Increased rate limiting
                except Exception as e:
                    logger.warning(f"Failed to warm cache for {package_name}: {e}")
        
        logger.info("Finished warming cache")
    
    async def refresh_package_cache(self, package_name: str, index_url: Optional[str] = None):
        """Force refresh cache for a specific package"""
        await self.cache_service.clear_package_cache(package_name)
        await self.get_package_details(package_name, index_url)
    
    async def refresh_popular_packages_cache(self, index_url: Optional[str] = None):
        """Refresh cache for all popular packages"""
        for package_name in self.popular_packages:
            try:
                await self.refresh_package_cache(package_name, index_url)
                await asyncio.sleep(0.2)  # Rate limiting
            except Exception as e:
                logger.warning(f"Failed to refresh cache for {package_name}: {e}")