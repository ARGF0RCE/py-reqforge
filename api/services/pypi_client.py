"""
PyPI API client for fetching package information
"""

import httpx
import asyncio
from typing import Dict, List, Optional, Any, Set
from datetime import datetime
import logging
from urllib.parse import urljoin, quote
from bs4 import BeautifulSoup
import json
import re
from packaging.version import parse as parse_version, InvalidVersion
from packaging.specifiers import SpecifierSet
import time

logger = logging.getLogger(__name__)

class PyPIClient:
    """Client for interacting with PyPI and custom package indexes"""
    
    def __init__(self, timeout: int = 30, max_retries: int = 3):
        self.timeout = timeout
        self.max_retries = max_retries
        self.session = None
        self._session_initialized = False
        
        # Enhanced rate limiting
        self.last_request_time = 0
        self.min_request_interval = 0.2  # 200ms between requests (more conservative)
        self.request_count = 0
        self.request_window_start = time.time()
        self.max_requests_per_minute = 30  # Limit to 30 requests per minute
        
        # Cache for simple index package lists
        self._simple_index_cache: Dict[str, Dict] = {}
    
    async def _ensure_session(self):
        """Ensure HTTP session is initialized"""
        if not self._session_initialized or self.session is None or self.session.is_closed:
            if self.session and not self.session.is_closed:
                await self.session.aclose()
            
            self.session = httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                headers={
                    'User-Agent': 'py-reqforge/1.0.0 (PyPI package manager)'
                }
            )
            self._session_initialized = True
        
    async def __aenter__(self):
        await self._ensure_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Don't close session here - keep it persistent
        pass
    
    async def close(self):
        """Explicitly close the session"""
        if self.session and not self.session.is_closed:
            await self.session.aclose()
            self._session_initialized = False
    
    async def _rate_limit(self):
        """Enhanced rate limiting to be respectful to PyPI"""
        now = time.time()
        
        # Reset window if more than a minute has passed
        if now - self.request_window_start > 60:
            self.request_count = 0
            self.request_window_start = now
        
        # Check if we've exceeded the rate limit
        if self.request_count >= self.max_requests_per_minute:
            sleep_time = 60 - (now - self.request_window_start) + 1
            logger.warning(f"Rate limit exceeded, sleeping for {sleep_time:.1f}s")
            await asyncio.sleep(sleep_time)
            self.request_count = 0
            self.request_window_start = time.time()
        
        # Apply minimum interval between requests
        elapsed = now - self.last_request_time
        if elapsed < self.min_request_interval:
            await asyncio.sleep(self.min_request_interval - elapsed)
        
        self.last_request_time = time.time()
        self.request_count += 1
    
    async def _make_request(self, url: str, retries: int = None) -> Optional[httpx.Response]:
        """Make HTTP request with retry logic and rate limiting"""
        if retries is None:
            retries = self.max_retries
        
        await self._ensure_session()
        await self._rate_limit()
        
        for attempt in range(retries + 1):
            try:
                response = await self.session.get(url)
                if response.status_code == 200:
                    return response
                elif response.status_code == 404:
                    return None
                elif response.status_code == 429:  # Rate limited
                    wait_time = 2 ** attempt
                    logger.warning(f"Rate limited, waiting {wait_time}s before retry")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    logger.warning(f"HTTP {response.status_code} for {url}")
                    if attempt < retries:
                        await asyncio.sleep(1)
                        continue
                    return None
            except Exception as e:
                logger.error(f"Request failed for {url}: {e}")
                if attempt < retries:
                    await asyncio.sleep(2 ** attempt)
                    continue
                return None
        
        return None
    
    async def get_package_info(self, package_name: str, index_url: str = "https://pypi.org") -> Optional[Dict[str, Any]]:
        """
        Get package information from PyPI JSON API
        
        Args:
            package_name: Name of the package
            index_url: Base URL of the package index
            
        Returns:
            Package information dictionary or None if not found
        """
        if index_url.endswith('/'):
            index_url = index_url.rstrip('/')
            
        # Try JSON API first (PyPI only)
        if 'pypi.org' in index_url:
            json_url = f"{index_url}/pypi/{quote(package_name)}/json"
            response = await self._make_request(json_url)
            
            if response:
                try:
                    return response.json()
                except Exception as e:
                    logger.error(f"Failed to parse JSON for {package_name}: {e}")
        
        # Fall back to simple index parsing
        return await self._get_package_from_simple_index(package_name, index_url)
    
    async def get_package_version_info(self, package_name: str, version: str, index_url: str = "https://pypi.org") -> Optional[Dict[str, Any]]:
        """
        Get specific version information
        
        Args:
            package_name: Name of the package
            version: Specific version
            index_url: Base URL of the package index
            
        Returns:
            Version information dictionary or None if not found
        """
        if index_url.endswith('/'):
            index_url = index_url.rstrip('/')
            
        # Try JSON API first (PyPI only)
        if 'pypi.org' in index_url:
            json_url = f"{index_url}/pypi/{quote(package_name)}/{quote(version)}/json"
            response = await self._make_request(json_url)
            
            if response:
                try:
                    return response.json()
                except Exception as e:
                    logger.error(f"Failed to parse JSON for {package_name} {version}: {e}")
        
        # For custom indexes, get package info and extract version
        package_info = await self.get_package_info(package_name, index_url)
        if package_info and 'releases' in package_info:
            if version in package_info['releases']:
                return {
                    'info': package_info['info'],
                    'releases': {version: package_info['releases'][version]},
                    'urls': package_info['releases'][version]
                }
        
        return None
    
    async def _get_package_from_simple_index(self, package_name: str, index_url: str) -> Optional[Dict[str, Any]]:
        """
        Parse package information from simple index
        
        Uses JSON format (PEP 691) when available, falls back to HTML parsing
        """
        simple_url = urljoin(index_url, f"/simple/{quote(package_name)}/")
        
        # Try JSON format first (PEP 691)
        package_data = await self._get_package_simple_json(simple_url)
        if package_data:
            return package_data
        
        # Fall back to HTML parsing
        return await self._get_package_simple_html(simple_url, package_name)
    
    async def _get_package_simple_json(self, simple_url: str) -> Optional[Dict[str, Any]]:
        """Get package info using JSON API (PEP 691)"""
        await self._ensure_session()
        await self._rate_limit()
        
        try:
            response = await self.session.get(
                simple_url,
                headers={
                    'Accept': 'application/vnd.pypi.simple.v1+json',
                    'User-Agent': 'py-reqforge/1.0.0 (PyPI package manager)'
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Convert PEP 691 format to PyPI-like structure
                files = data.get('files', [])
                if not files:
                    return None
                
                # Group files by version
                files_by_version = {}
                versions = set()
                
                for file_info in files:
                    filename = file_info.get('filename', '')
                    package_name = data.get('name', '')
                    
                    # Extract version from filename
                    version = self._extract_version_from_filename(filename, package_name)
                    if version:
                        versions.add(version)
                        if version not in files_by_version:
                            files_by_version[version] = []
                        
                        # Convert to PyPI-like file info
                        pypi_file_info = {
                            'filename': filename,
                            'url': file_info.get('url', ''),
                            'packagetype': self._get_package_type(filename),
                            'size': file_info.get('size'),
                            'upload_time': file_info.get('upload-time'),
                            'requires_python': file_info.get('requires-python'),
                            'yanked': file_info.get('yanked', False),
                            'hashes': file_info.get('hashes', {})
                        }
                        
                        files_by_version[version].append(pypi_file_info)
                
                if not versions:
                    return None
                
                # Get latest version
                latest_version = max(versions, key=lambda v: parse_version(v) if self._is_valid_version(v) else parse_version("0.0.0"))
                
                return {
                    'info': {
                        'name': package_name,
                        'version': latest_version,
                        'summary': None,
                        'description': None,
                        'author': None,
                        'author_email': None,
                        'maintainer': None,
                        'maintainer_email': None,
                        'license': None,
                        'home_page': None,
                        'project_urls': {},
                        'keywords': None,
                        'classifiers': [],
                        'requires_python': None,
                    },
                    'releases': files_by_version,
                    'urls': files_by_version.get(latest_version, [])
                }
                
        except Exception as e:
            logger.debug(f"JSON package request failed for {simple_url}: {e}")
        
        return None
    
    async def _get_package_simple_html(self, simple_url: str, package_name: str) -> Optional[Dict[str, Any]]:
        """Get package info using HTML parsing (fallback)"""
        response = await self._make_request(simple_url)
        
        if not response:
            return None
            
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            links = soup.find_all('a')
            
            if not links:
                return None
            
            # Extract version information from file links
            versions = {}
            files_by_version = {}
            
            for link in links:
                href = link.get('href', '')
                filename = link.get_text().strip()
                
                # Extract version from filename
                version = self._extract_version_from_filename(filename, package_name)
                if version:
                    if version not in versions:
                        versions[version] = []
                        files_by_version[version] = []
                    
                    file_info = {
                        'filename': filename,
                        'url': href,
                        'packagetype': self._get_package_type(filename)
                    }
                    
                    # Extract additional metadata from attributes
                    for attr in ['data-requires-python', 'data-yanked']:
                        if link.get(attr):
                            file_info[attr.replace('data-', '').replace('-', '_')] = link.get(attr)
                    
                    files_by_version[version].append(file_info)
            
            if not versions:
                return None
            
            # Create PyPI-like structure
            latest_version = max(versions.keys(), key=lambda v: parse_version(v) if self._is_valid_version(v) else parse_version("0.0.0"))
            
            return {
                'info': {
                    'name': package_name,
                    'version': latest_version,
                    'summary': None,
                    'description': None,
                    'author': None,
                    'author_email': None,
                    'maintainer': None,
                    'maintainer_email': None,
                    'license': None,
                    'home_page': None,
                    'project_urls': {},
                    'keywords': None,
                    'classifiers': [],
                    'requires_python': None,
                },
                'releases': files_by_version,
                'urls': files_by_version.get(latest_version, [])
            }
            
        except Exception as e:
            logger.error(f"Failed to parse simple index HTML for {package_name}: {e}")
            return None
    
    def _extract_version_from_filename(self, filename: str, package_name: str) -> Optional[str]:
        """Extract version from package filename"""
        # Remove file extensions
        base_name = filename
        for ext in ['.tar.gz', '.zip', '.whl', '.egg']:
            if base_name.endswith(ext):
                base_name = base_name[:-len(ext)]
                break
        
        # Normalize package name for matching
        normalized_package = re.sub(r'[-_.]+', '_', package_name).lower()
        
        # Try various patterns to extract version
        patterns = [
            rf'{re.escape(normalized_package)}_(.+)',
            rf'{re.escape(normalized_package)}-(.+)',
            rf'{re.escape(package_name)}_(.+)',
            rf'{re.escape(package_name)}-(.+)',
        ]
        
        for pattern in patterns:
            match = re.match(pattern, base_name, re.IGNORECASE)
            if match:
                version_part = match.group(1)
                # Remove build/platform info from version
                version_part = re.split(r'[-_](py\d|cp\d|pp\d|win|linux|macos|any)', version_part)[0]
                if self._is_valid_version(version_part):
                    return version_part
        
        return None
    
    def _is_valid_version(self, version: str) -> bool:
        """Check if version string is valid"""
        try:
            parse_version(version)
            return True
        except InvalidVersion:
            return False
    
    def _get_package_type(self, filename: str) -> str:
        """Determine package type from filename"""
        if filename.endswith('.whl'):
            return 'bdist_wheel'
        elif filename.endswith('.tar.gz'):
            return 'sdist'
        elif filename.endswith('.zip'):
            return 'sdist'
        elif filename.endswith('.egg'):
            return 'bdist_egg'
        else:
            return 'unknown'
    
    async def search_packages(self, query: str, index_url: str = "https://pypi.org", limit: int = 20) -> List[Dict[str, Any]]:
        """
        Search for packages
        
        For PyPI, uses the search API. For custom indexes, searches through
        the simple index package list.
        """
        if 'pypi.org' in index_url:
            return await self._search_pypi(query, limit)
        else:
            return await self._search_simple_index(query, index_url, limit)
    
    async def _search_pypi(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """
        Search PyPI packages using improved search strategy
        
        Uses multiple approaches:
        1. Direct package name lookup if exact match
        2. Popular packages matching
        3. Simple index search for broader coverage
        """
        results = []
        query_lower = query.lower()
        seen_packages = set()
        
        # First, try direct lookup if it looks like an exact package name
        if re.match(r'^[a-zA-Z0-9][a-zA-Z0-9._-]*$', query) and len(query) > 1:
            try:
                package_info = await self.get_package_info(query)
                if package_info:
                    results.append({
                        'name': query,
                        'summary': package_info.get('info', {}).get('summary'),
                        'version': package_info.get('info', {}).get('version'),
                        'description': package_info.get('info', {}).get('description'),
                        'author': package_info.get('info', {}).get('author'),
                    })
                    seen_packages.add(query.lower())
            except Exception as e:
                logger.debug(f"Direct lookup failed for {query}: {e}")
        
        # Search through popular packages
        popular_packages = [
            'requests', 'numpy', 'pandas', 'django', 'flask', 'fastapi',
            'pytest', 'setuptools', 'wheel', 'pip', 'black', 'flake8',
            'mypy', 'click', 'pydantic', 'sqlalchemy', 'alembic', 'jinja2',
            'matplotlib', 'seaborn', 'scikit-learn', 'tensorflow', 'torch',
            'opencv-python', 'pillow', 'beautifulsoup4', 'lxml', 'httpx',
            'aiohttp', 'boto3', 'celery', 'redis', 'psycopg2', 'pymongo',
            'selenium', 'scrapy', 'jupyter', 'ipython', 'notebook', 'uvicorn',
            'gunicorn', 'asyncio', 'typing-extensions', 'pyyaml', 'toml',
            'rich', 'typer', 'poetry', 'pipenv', 'virtualenv', 'tox'
        ]
        
        for package_name in popular_packages:
            if (len(results) >= limit or 
                package_name.lower() in seen_packages or
                query_lower not in package_name.lower()):
                continue
                
            try:
                package_info = await self.get_package_info(package_name)
                if package_info:
                    results.append({
                        'name': package_name,
                        'summary': package_info.get('info', {}).get('summary'),
                        'version': package_info.get('info', {}).get('version'),
                        'description': package_info.get('info', {}).get('description'),
                        'author': package_info.get('info', {}).get('author'),
                    })
                    seen_packages.add(package_name.lower())
            except Exception as e:
                logger.debug(f"Failed to get info for popular package {package_name}: {e}")
                # Add basic entry even if we can't get full info
                if len(results) < limit:
                    results.append({
                        'name': package_name,
                        'summary': f"Popular Python package: {package_name}",
                        'version': 'latest',
                        'description': None,
                        'author': None,
                    })
                    seen_packages.add(package_name.lower())
        
        # If we haven't filled our limit, try searching common package patterns
        if len(results) < limit:
            await self._search_package_patterns(query, results, seen_packages, limit)
        
        return results[:limit]
    
    async def _search_package_patterns(self, query: str, results: List[Dict], seen_packages: Set[str], limit: int):
        """Search for packages using common naming patterns"""
        query_lower = query.lower()
        
        # Common patterns to try
        patterns = [
            query_lower,
            f"py{query_lower}",
            f"{query_lower}py",
            f"python-{query_lower}",
            f"{query_lower}-python",
            f"{query_lower}2",
            f"{query_lower}3"
        ]
        
        for pattern in patterns:
            if len(results) >= limit:
                break
                
            if pattern in seen_packages:
                continue
                
            try:
                package_info = await self.get_package_info(pattern)
                if package_info:
                    results.append({
                        'name': pattern,
                        'summary': package_info.get('info', {}).get('summary'),
                        'version': package_info.get('info', {}).get('version'),
                        'description': package_info.get('info', {}).get('description'),
                        'author': package_info.get('info', {}).get('author'),
                    })
                    seen_packages.add(pattern)
            except Exception as e:
                logger.debug(f"Pattern search failed for {pattern}: {e}")
    
    async def _search_simple_index(self, query: str, index_url: str, limit: int) -> List[Dict[str, Any]]:
        """Search through simple index package list"""
        package_list = await self.get_simple_index_packages(index_url)
        
        if not package_list:
            return []
        
        # Simple text-based search
        query_lower = query.lower()
        matches = []
        
        for package_name in package_list:
            if query_lower in package_name.lower():
                # Get basic package info
                package_info = await self.get_package_info(package_name, index_url)
                if package_info:
                    matches.append({
                        'name': package_name,
                        'summary': package_info.get('info', {}).get('summary'),
                        'version': package_info.get('info', {}).get('version'),
                        'description': package_info.get('info', {}).get('description'),
                    })
                
                if len(matches) >= limit:
                    break
        
        return matches
    
    async def get_simple_index_packages(self, index_url: str) -> List[str]:
        """
        Get list of all packages from simple index
        
        Uses JSON format (PEP 691) when available, falls back to HTML parsing
        """
        cache_key = index_url
        
        # Check cache first
        if cache_key in self._simple_index_cache:
            cache_entry = self._simple_index_cache[cache_key]
            # Cache for 1 hour
            if time.time() - cache_entry['timestamp'] < 3600:
                return cache_entry['packages']
        
        simple_url = urljoin(index_url, "/simple/")
        
        # Try JSON format first (PEP 691)
        packages = await self._get_simple_index_json(simple_url)
        if packages is not None:
            # Cache the result
            self._simple_index_cache[cache_key] = {
                'packages': packages,
                'timestamp': time.time()
            }
            logger.info(f"Found {len(packages)} packages in {index_url} (JSON)")
            return packages
        
        # Fall back to HTML parsing
        packages = await self._get_simple_index_html(simple_url)
        if packages:
            # Cache the result
            self._simple_index_cache[cache_key] = {
                'packages': packages,
                'timestamp': time.time()
            }
            logger.info(f"Found {len(packages)} packages in {index_url} (HTML)")
        
        return packages
    
    async def _get_simple_index_json(self, simple_url: str) -> Optional[List[str]]:
        """Get package list using JSON API (PEP 691)"""
        await self._ensure_session()
        await self._rate_limit()
        
        try:
            response = await self.session.get(
                simple_url,
                headers={
                    'Accept': 'application/vnd.pypi.simple.v1+json',
                    'User-Agent': 'py-reqforge/1.0.0 (PyPI package manager)'
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                projects = data.get('projects', [])
                return [project['name'] for project in projects if isinstance(project, dict) and 'name' in project]
            
        except Exception as e:
            logger.debug(f"JSON simple index request failed: {e}")
        
        return None
    
    async def _get_simple_index_html(self, simple_url: str) -> List[str]:
        """Get package list using HTML parsing (fallback)"""
        response = await self._make_request(simple_url)
        
        if not response:
            return []
        
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            links = soup.find_all('a')
            
            packages = []
            for link in links:
                href = link.get('href', '')
                package_name = link.get_text().strip()
                
                # Basic validation
                if package_name and not href.startswith('http'):
                    packages.append(package_name)
            
            return packages
            
        except Exception as e:
            logger.error(f"Failed to parse simple index HTML {simple_url}: {e}")
            return []
    
    async def validate_index(self, index_url: str) -> bool:
        """
        Validate that an index URL is accessible and appears to be a valid package index
        """
        try:
            # Try to access the simple index
            simple_url = urljoin(index_url, "/simple/")
            response = await self._make_request(simple_url)
            
            if not response:
                return False
            
            # Check if it looks like a package index
            soup = BeautifulSoup(response.text, 'html.parser')
            links = soup.find_all('a')
            
            # Should have at least some links that look like package names
            return len(links) > 0
            
        except Exception as e:
            logger.error(f"Index validation failed for {index_url}: {e}")
            return False
    
    async def extract_dependencies(self, package_info: Dict[str, Any], version: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Extract dependency information from package metadata
        
        Args:
            package_info: Package information from PyPI JSON API
            version: Specific version to get dependencies for (default: latest)
            
        Returns:
            List of dependency dictionaries
        """
        dependencies = []
        
        try:
            info = package_info.get('info', {})
            
            # Get requires_dist from package info
            requires_dist = info.get('requires_dist', [])
            if requires_dist:
                for req in requires_dist:
                    if isinstance(req, str):
                        dep_info = self._parse_requirement(req)
                        if dep_info:
                            dependencies.append(dep_info)
            
            return dependencies
            
        except Exception as e:
            logger.error(f"Failed to extract dependencies: {e}")
            return []
    
    def _parse_requirement(self, requirement: str) -> Optional[Dict[str, Any]]:
        """
        Parse a requirement string into structured data
        
        Example: "requests>=2.25.0,<3.0.0; python_version>='3.6'"
        """
        try:
            # Basic parsing - in production, use packaging.requirements
            parts = requirement.split(';')
            main_part = parts[0].strip()
            
            # Extract package name and version spec
            if '>=' in main_part or '<=' in main_part or '==' in main_part or '>' in main_part or '<' in main_part or '!=' in main_part:
                for op in ['>=', '<=', '==', '!=', '>', '<', '~=']:
                    if op in main_part:
                        name, version_spec = main_part.split(op, 1)
                        return {
                            'name': name.strip(),
                            'version_spec': f"{op}{version_spec.strip()}",
                            'optional': False,
                            'extra': None
                        }
            else:
                # No version specification
                return {
                    'name': main_part.strip(),
                    'version_spec': None,
                    'optional': False,
                    'extra': None
                }
                
        except Exception as e:
            logger.error(f"Failed to parse requirement '{requirement}': {e}")
            
        return None