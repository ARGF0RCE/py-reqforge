"""
Cache service using Prisma ORM for database operations
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import logging
import json
import sys
import os
import pytz
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from generated import Prisma
from generated.models import Package, Version, Dependency, IndexCache, SearchCache

logger = logging.getLogger(__name__)

class CacheService:
    """Service for managing cached package data using SQLite database"""
    
    def __init__(self):
        self.db = Prisma()
        self.is_connected = False
        
        # Cache expiration times
        self.package_cache_ttl = timedelta(hours=6)  # 6 hours for package data
        self.search_cache_ttl = timedelta(hours=1)   # 1 hour for search results
        self.index_cache_ttl = timedelta(hours=12)   # 12 hours for index lists
        
    async def initialize(self):
        """Initialize database connection and run migrations"""
        try:
            await self.db.connect()
            self.is_connected = True
            logger.info("Database connected successfully")
            
            # Optionally run migrations here if needed
            # In production, you'd run migrations separately
            
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    async def close(self):
        """Close database connection"""
        if self.is_connected:
            await self.db.disconnect()
            self.is_connected = False
            logger.info("Database disconnected")
    
    async def health_check(self) -> str:
        """Check database health"""
        try:
            # Simple query to check if database is responsive
            await self.db.package.count()
            return "healthy"
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return "unhealthy"
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get basic cache statistics"""
        try:
            package_count = await self.db.package.count()
            version_count = await self.db.version.count()
            search_cache_count = await self.db.searchcache.count()
            
            return {
                "packages": package_count,
                "versions": version_count,
                "search_cache_entries": search_cache_count,
                "cache_enabled": True
            }
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {"cache_enabled": False, "error": str(e)}
    
    async def get_detailed_stats(self) -> Dict[str, Any]:
        """Get detailed cache statistics"""
        try:
            stats = await self.get_cache_stats()
            
            # Get oldest and newest entries
            oldest_package = await self.db.package.find_first(
                order={"createdAt": "asc"}
            )
            newest_package = await self.db.package.find_first(
                order={"createdAt": "desc"}
            )
            
            # Calculate cache hit rate (simplified)
            # In a real implementation, you'd track hits/misses
            stats.update({
                "oldest_entry": oldest_package.createdAt if oldest_package else None,
                "newest_entry": newest_package.createdAt if newest_package else None,
                "cache_hit_rate": 0.85,  # Placeholder
                "database_file_size": "Unknown"  # Would require OS-level check
            })
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get detailed stats: {e}")
            return {"error": str(e)}
    
    async def get_package(self, package_name: str) -> Optional[Package]:
        """Get cached package information"""
        try:
            package = await self.db.package.find_unique(
                where={"name": package_name},
                include={
                    "versions": {
                        "order_by": {"releaseDate": "desc"}
                    },
                    "dependencies": True
                }
            )
            
            # Check if cache is still valid
            if package and self._is_cache_fresh(package.lastUpdated, self.package_cache_ttl):
                return package
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get cached package {package_name}: {e}")
            return None
    
    async def cache_package(self, package_data: Dict[str, Any]) -> Optional[Package]:
        """Cache package information"""
        try:
            package_name = package_data['info']['name']
            info = package_data['info']
            
            # Prepare package data
            package_input = {
                "id": package_name,
                "name": package_name,
                "summary": info.get('summary'),
                "description": info.get('description'),
                "author": info.get('author'),
                "authorEmail": info.get('author_email'),
                "maintainer": info.get('maintainer'),
                "maintainerEmail": info.get('maintainer_email'),
                "license": info.get('license'),
                "homepage": info.get('home_page'),
                "projectUrls": json.dumps(info.get('project_urls', {})),
                "keywords": ','.join(info.get('keywords', [])) if info.get('keywords') else None,
                "classifiers": json.dumps(info.get('classifiers', [])),
                "requiresPython": info.get('requires_python'),
            }
            
            # Upsert package
            package = await self.db.package.upsert(
                where={"name": package_name},
                data={
                    "create": package_input,
                    "update": package_input
                }
            )
            
            # Cache versions if available
            if 'releases' in package_data:
                await self._cache_versions(package_name, package_data['releases'])
            
            # Cache dependencies if available
            if 'info' in package_data and 'requires_dist' in package_data['info']:
                await self._cache_dependencies(package_name, package_data['info']['requires_dist'])
            
            return package
            
        except Exception as e:
            logger.error(f"Failed to cache package {package_data.get('info', {}).get('name', 'unknown')}: {e}")
            return None
    
    async def _cache_versions(self, package_id: str, releases: Dict[str, List[Dict]]):
        """Cache version information for a package"""
        try:
            for version_string, files in releases.items():
                if not files:  # Skip empty releases
                    continue
                
                # Get release date from first file
                release_date = None
                if files and 'upload_time' in files[0]:
                    try:
                        upload_time_str = files[0]['upload_time']
                        if upload_time_str.endswith('Z'):
                            upload_time_str = upload_time_str.replace('Z', '+00:00')
                        release_date = datetime.fromisoformat(upload_time_str)
                        
                        # Ensure timezone-aware
                        if release_date.tzinfo is None:
                            release_date = pytz.UTC.localize(release_date)
                    except Exception:
                        pass
                
                version_input = {
                    "packageId": package_id,
                    "version": version_string,
                    "releaseDate": release_date,
                    "files": json.dumps(files)
                }
                
                await self.db.version.upsert(
                    where={
                        "packageId_version": {
                            "packageId": package_id,
                            "version": version_string
                        }
                    },
                    data={
                        "create": version_input,
                        "update": version_input
                    }
                )
                
        except Exception as e:
            logger.error(f"Failed to cache versions for {package_id}: {e}")
    
    async def _cache_dependencies(self, package_id: str, requires_dist: Optional[List[str]]):
        """Cache dependency information for a package"""
        try:
            # Clear existing dependencies
            await self.db.dependency.delete_many(
                where={"packageId": package_id}
            )
            
            # Check if requires_dist is None or empty
            if not requires_dist:
                return
            
            # Add new dependencies
            for req in requires_dist:
                if not req:
                    continue
                
                # Basic parsing of requirement string
                dep_name, version_spec = self._parse_requirement_string(req)
                
                if dep_name:
                    await self.db.dependency.create(
                        data={
                            "packageId": package_id,
                            "dependencyName": dep_name,
                            "versionSpec": version_spec,
                            "optional": 'extra' in req.lower()  # Simplified detection
                        }
                    )
                    
        except Exception as e:
            logger.error(f"Failed to cache dependencies for {package_id}: {e}")
    
    def _parse_requirement_string(self, requirement: str) -> tuple[str, Optional[str]]:
        """Parse a requirement string to extract name and version spec"""
        try:
            # Split on semicolon to remove environment markers
            main_req = requirement.split(';')[0].strip()
            
            # Find version operators
            for op in ['>=', '<=', '==', '!=', '>', '<', '~=']:
                if op in main_req:
                    parts = main_req.split(op, 1)
                    if len(parts) == 2:
                        name = parts[0].strip()
                        version = f"{op}{parts[1].strip()}"
                        return name, version
            
            # No version specification
            return main_req.strip(), None
            
        except Exception:
            return requirement.strip(), None
    
    async def get_search_cache(self, query: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached search results"""
        try:
            cache_entry = await self.db.searchcache.find_unique(
                where={"query": query}
            )
            
            if cache_entry and self._is_cache_fresh(cache_entry.lastUpdated, self.search_cache_ttl):
                return json.loads(cache_entry.results)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get search cache for '{query}': {e}")
            return None
    
    async def cache_search_results(self, query: str, results: List[Dict[str, Any]]):
        """Cache search results"""
        try:
            await self.db.searchcache.upsert(
                where={"query": query},
                data={
                    "create": {
                        "query": query,
                        "results": json.dumps(results)
                    },
                    "update": {
                        "results": json.dumps(results)
                    }
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to cache search results for '{query}': {e}")
    
    async def get_partial_search_matches(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get cached search results that contain packages matching the query substring"""
        try:
            # Query all cached search results
            cache_entries = await self.db.searchcache.find_many()
            
            matching_results = []
            query_lower = query.lower()
            
            for cache_entry in cache_entries:
                # Skip expired entries
                if not self._is_cache_fresh(cache_entry.lastUpdated, self.search_cache_ttl):
                    continue
                
                # Skip dependency resolution cache entries (they have different structure)
                if cache_entry.query.startswith("resolution:"):
                    continue
                
                try:
                    cached_results = json.loads(cache_entry.results)
                    
                    # Ensure cached_results is a list of dictionaries
                    if not isinstance(cached_results, list):
                        continue
                    
                    # Find packages that match the query substring
                    for result in cached_results:
                        if not isinstance(result, dict):
                            continue  # Skip non-dict items
                            
                        package_name = result.get('name', '').lower()
                        package_summary = result.get('summary', '').lower()
                        
                        # Check if query matches package name or summary
                        if (query_lower in package_name or 
                            (package_summary and query_lower in package_summary)):
                            matching_results.append(result)
                            
                            # Stop if we have enough results
                            if len(matching_results) >= limit:
                                break
                    
                    if len(matching_results) >= limit:
                        break
                        
                except Exception as e:
                    logger.warning(f"Failed to parse cached search entry for {cache_entry.query}: {e}")
                    continue
            
            # Sort by relevance (exact name matches first, then partial matches)
            def sort_key(result):
                name = result.get('name', '').lower()
                if name == query_lower:
                    return 0  # Exact match
                elif name.startswith(query_lower):
                    return 1  # Starts with query
                else:
                    return 2  # Contains query
            
            matching_results.sort(key=sort_key)
            return matching_results[:limit]
            
        except Exception as e:
            logger.error(f"Failed to get partial search matches for '{query}': {e}")
            return []
    
    async def get_dependency_resolution_cache(self, packages: List[str], index_url: str, python_version: str) -> Optional[Dict[str, Any]]:
        """Get cached dependency resolution results"""
        try:
            # Create a consistent cache key from sorted packages
            sorted_packages = sorted(packages)
            cache_key = f"resolution:{':'.join(sorted_packages)}:{index_url}:{python_version}"
            
            cache_entry = await self.db.searchcache.find_unique(
                where={"query": cache_key}
            )
            
            if cache_entry and self._is_cache_fresh(cache_entry.lastUpdated, self.search_cache_ttl):
                logger.info(f"Using cached dependency resolution for {len(packages)} packages")
                return json.loads(cache_entry.results)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get dependency resolution cache: {e}")
            return None
    
    async def cache_dependency_resolution(self, packages: List[str], index_url: str, python_version: str, resolution: Dict[str, Any]):
        """Cache dependency resolution results"""
        try:
            # Create a consistent cache key from sorted packages
            sorted_packages = sorted(packages)
            cache_key = f"resolution:{':'.join(sorted_packages)}:{index_url}:{python_version}"
            
            await self.db.searchcache.upsert(
                where={"query": cache_key},
                data={
                    "create": {
                        "query": cache_key,
                        "results": json.dumps(resolution)
                    },
                    "update": {
                        "results": json.dumps(resolution)
                    }
                }
            )
            
            logger.info(f"Cached dependency resolution for {len(packages)} packages")
            
        except Exception as e:
            logger.error(f"Failed to cache dependency resolution: {e}")
    
    async def cache_version_hash(self, package_name: str, version: str, sha256_hash: str):
        """Cache hash information for a specific package version"""
        try:
            # Check if package exists in cache
            package = await self.db.package.find_unique(
                where={"name": package_name}
            )
            
            if package:
                # Update or create the version with hash
                await self.db.version.upsert(
                    where={
                        "packageId_version": {
                            "packageId": package.id,
                            "version": version
                        }
                    },
                    data={
                        "create": {
                            "packageId": package.id,
                            "version": version,
                            "sha256Hash": sha256_hash
                        },
                        "update": {
                            "sha256Hash": sha256_hash
                        }
                    }
                )
                logger.info(f"Cached hash for {package_name}=={version}")
            else:
                logger.warning(f"Package {package_name} not found in cache, cannot cache hash")
                
        except Exception as e:
            logger.error(f"Failed to cache hash for {package_name}=={version}: {e}")
    
    async def get_index_cache(self, index_url: str) -> Optional[List[str]]:
        """Get cached package list for an index"""
        try:
            cache_entry = await self.db.indexcache.find_unique(
                where={"indexUrl": index_url}
            )
            
            if cache_entry and self._is_cache_fresh(cache_entry.lastFetched, self.index_cache_ttl):
                return json.loads(cache_entry.packageList)
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get index cache for {index_url}: {e}")
            return None
    
    async def cache_index_packages(self, index_url: str, package_list: List[str]):
        """Cache package list for an index"""
        try:
            now_utc = datetime.now(pytz.UTC)
            await self.db.indexcache.upsert(
                where={"indexUrl": index_url},
                data={
                    "create": {
                        "indexUrl": index_url,
                        "packageList": json.dumps(package_list),
                        "lastFetched": now_utc
                    },
                    "update": {
                        "packageList": json.dumps(package_list),
                        "lastFetched": now_utc
                    }
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to cache index packages for {index_url}: {e}")
    
    async def clear_package_cache(self, package_name: str):
        """Clear cache for a specific package"""
        try:
            await self.db.package.delete(
                where={"name": package_name}
            )
            logger.info(f"Cleared cache for package {package_name}")
            
        except Exception as e:
            logger.error(f"Failed to clear cache for {package_name}: {e}")
    
    async def clear_all_cache(self):
        """Clear all cached data"""
        try:
            # Clear all tables
            await self.db.dependency.delete_many()
            await self.db.version.delete_many()
            await self.db.package.delete_many()
            await self.db.searchcache.delete_many()
            await self.db.indexcache.delete_many()
            
            logger.info("Cleared all cache data")
            
        except Exception as e:
            logger.error(f"Failed to clear all cache: {e}")
    
    async def cleanup_expired_cache(self):
        """Remove expired cache entries"""
        try:
            now_utc = datetime.now(pytz.UTC)
            cutoff_time = now_utc - self.package_cache_ttl
            
            # Remove expired packages
            await self.db.package.delete_many(
                where={"lastUpdated": {"lt": cutoff_time}}
            )
            
            # Remove expired search cache
            search_cutoff = now_utc - self.search_cache_ttl
            await self.db.searchcache.delete_many(
                where={"lastUpdated": {"lt": search_cutoff}}
            )
            
            # Remove expired index cache
            index_cutoff = now_utc - self.index_cache_ttl
            await self.db.indexcache.delete_many(
                where={"lastFetched": {"lt": index_cutoff}}
            )
            
            logger.info("Cleaned up expired cache entries")
            
        except Exception as e:
            logger.error(f"Failed to cleanup expired cache: {e}")
    
    def _is_cache_fresh(self, last_updated: datetime, ttl: timedelta) -> bool:
        """Check if cache entry is still fresh"""
        if not last_updated:
            return False
        
        # Ensure both datetimes are timezone-aware (UTC)
        now_utc = datetime.now(pytz.UTC)
        
        # If last_updated is naive, assume it's UTC
        if last_updated.tzinfo is None:
            last_updated = pytz.UTC.localize(last_updated)
        
        return now_utc - last_updated < ttl