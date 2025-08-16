"""
Pydantic models for package data structures
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

class FileInfo(BaseModel):
    """Information about a package file (wheel, tarball, etc.)"""
    filename: str
    url: str
    size: Optional[int] = None
    upload_time: Optional[datetime] = None
    python_version: Optional[str] = None
    requires_python: Optional[str] = None
    packagetype: Optional[str] = None  # wheel, sdist, etc.
    md5_digest: Optional[str] = None
    sha256_digest: Optional[str] = None
    blake2_256_digest: Optional[str] = None

class DependencyInfo(BaseModel):
    """Information about a package dependency"""
    name: str
    version_spec: Optional[str] = None  # e.g., ">=1.0.0,<2.0.0"
    optional: bool = False
    extra: Optional[str] = None  # Optional dependency group
    
    @validator('name')
    def validate_name(cls, v):
        if not v or not isinstance(v, str):
            raise ValueError('Dependency name must be a non-empty string')
        return v.strip()

class VersionInfo(BaseModel):
    """Detailed information about a specific package version"""
    version: str
    release_date: Optional[datetime] = None
    yanked: bool = False
    yanked_reason: Optional[str] = None
    
    # Metadata
    summary: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None
    author_email: Optional[str] = None
    maintainer: Optional[str] = None
    maintainer_email: Optional[str] = None
    license: Optional[str] = None
    homepage: Optional[str] = None
    project_urls: Optional[Dict[str, str]] = None
    keywords: Optional[List[str]] = None
    classifiers: Optional[List[str]] = None
    requires_python: Optional[str] = None
    
    # Files and dependencies
    files: Optional[List[FileInfo]] = None
    dependencies: Optional[List[DependencyInfo]] = None
    optional_dependencies: Optional[Dict[str, List[DependencyInfo]]] = None
    
    # Timestamps
    last_updated: Optional[datetime] = None

class PackageSearchResult(BaseModel):
    """Search result for a package"""
    name: str
    summary: Optional[str] = None
    description: Optional[str] = None
    version: str  # Latest version
    author: Optional[str] = None
    homepage: Optional[str] = None
    keywords: Optional[List[str]] = None
    score: Optional[float] = Field(None, description="Search relevance score")
    download_count: Optional[int] = None
    last_updated: Optional[datetime] = None

class PackageDetails(BaseModel):
    """Comprehensive package information"""
    name: str
    summary: Optional[str] = None
    description: Optional[str] = None
    
    # Authorship
    author: Optional[str] = None
    author_email: Optional[str] = None
    maintainer: Optional[str] = None
    maintainer_email: Optional[str] = None
    
    # Project information
    license: Optional[str] = None
    homepage: Optional[str] = None
    project_urls: Optional[Dict[str, str]] = None
    keywords: Optional[List[str]] = None
    classifiers: Optional[List[str]] = None
    requires_python: Optional[str] = None
    
    # Version information
    latest_version: str
    versions: Optional[List[VersionInfo]] = None
    
    # Dependencies (for latest version)
    dependencies: Optional[List[DependencyInfo]] = None
    optional_dependencies: Optional[Dict[str, List[DependencyInfo]]] = None
    
    # Statistics
    download_count: Optional[int] = None
    github_stars: Optional[int] = None
    
    # Timestamps
    first_release: Optional[datetime] = None
    last_updated: Optional[datetime] = None
    
    @validator('name')
    def validate_name(cls, v):
        if not v or not isinstance(v, str):
            raise ValueError('Package name must be a non-empty string')
        return v.strip().lower()

class DependencyTree(BaseModel):
    """Represents a resolved dependency tree"""
    name: str
    version: str
    dependencies: List['DependencyTree'] = []
    
    class Config:
        # Allow forward references for recursive model
        arbitrary_types_allowed = True

# Update forward references
DependencyTree.model_rebuild()

class ResolvedPackage(BaseModel):
    """Information about a resolved package"""
    version: str
    sha256_hash: Optional[str] = None

class DependencyResolution(BaseModel):
    """Result of dependency resolution"""
    packages: Dict[str, str]  # package_name -> resolved_version (for backward compatibility)
    resolved_packages: Dict[str, ResolvedPackage] = {}  # package_name -> full resolution info
    tree: List[DependencyTree]
    conflicts: List[Dict[str, Any]] = []
    warnings: List[str] = []
    resolution_time: Optional[float] = None

class IndexInfo(BaseModel):
    """Information about a package index"""
    url: str
    name: Optional[str] = None
    last_checked: Optional[datetime] = None
    package_count: Optional[int] = None
    accessible: bool = True
    error_message: Optional[str] = None

class CacheStats(BaseModel):
    """Cache performance statistics"""
    total_packages: int
    total_versions: int
    cache_hit_rate: float
    cache_size_mb: float
    last_updated: datetime
    oldest_entry: Optional[datetime] = None
    newest_entry: Optional[datetime] = None