"""
FastAPI backend for PyPI package management with intelligent caching
"""

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import httpx
import asyncio
from datetime import datetime, timedelta
import logging
from contextlib import asynccontextmanager
import time

from services.pypi_client import PyPIClient
from services.package_service import PackageService
from services.cache_service import CacheService
from models.package_models import (
    PackageSearchResult,
    PackageDetails,
    VersionInfo,
    DependencyInfo
)

# Configure logging
import sys

# Configure root logger to reduce noise
logging.basicConfig(
    level=logging.WARNING,  # Only show warnings and errors by default
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Set up our application logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)  # Our app logger shows info and above

# Reduce noise from uvicorn access logs
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("uvicorn").setLevel(logging.INFO)

# Reduce noise from httpx requests
logging.getLogger("httpx").setLevel(logging.WARNING)

# Keep important database/cache logs at info level
logging.getLogger("services").setLevel(logging.INFO)

# Initialize services
pypi_client = PyPIClient()
cache_service = CacheService()
package_service = PackageService(pypi_client, cache_service)

# Request deduplication for dependency resolution
from asyncio import Event
from typing import Tuple
resolution_cache: Dict[str, Tuple[Event, Any]] = {}
resolution_lock = asyncio.Lock()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting PyPI API backend...")
    await cache_service.initialize()
    
    # Start background tasks for cache warming
    asyncio.create_task(package_service.warm_popular_packages())
    
    yield
    
    # Shutdown
    logger.info("Shutting down PyPI API backend...")
    await cache_service.close()
    await pypi_client.close()

app = FastAPI(
    title="PyPI Requirements Manager API",
    description="Intelligent PyPI package management with caching and dependency resolution",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # React dev servers
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Custom logging middleware to reduce noise
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start_time = time.time()
    
    # Skip logging for health checks and frequent polling endpoints
    skip_logging = request.url.path in ["/api/health", "/health", "/"]
    
    response = await call_next(request)
    process_time = time.time() - start_time
    
    # Only log errors, slow requests, or manual API calls
    should_log = (
        response.status_code >= 400 or  # Errors
        process_time > 1.0 or          # Slow requests (> 1 second)
        not skip_logging               # Non-health check endpoints
    )
    
    if should_log:
        level = logging.ERROR if response.status_code >= 400 else logging.INFO
        logger.log(
            level,
            f"{request.method} {request.url.path} - {response.status_code} - {process_time:.2f}s"
        )
    
    return response

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    database_status: str
    cache_stats: Dict[str, Any]

class SearchQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=100)
    index_url: Optional[str] = Field(None, description="Custom package index URL")
    limit: int = Field(10, ge=1, le=50)

class DependencyResolutionRequest(BaseModel):
    packages: List[str] = Field(..., description="List of package specifications")
    index_url: Optional[str] = Field(None, description="Custom package index URL")
    python_version: Optional[str] = Field("3.9", description="Target Python version")

@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint with API information"""
    return {
        "message": "PyPI Requirements Manager API",
        "version": "1.0.0",
        "documentation": "/docs"
    }

@app.get("/health")
async def simple_health_check():
    """Simple health check endpoint for Render"""
    return {"status": "ok"}

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint with detailed status"""
    try:
        db_status = await cache_service.health_check()
        cache_stats = await cache_service.get_cache_stats()
        
        return HealthResponse(
            status="healthy",
            timestamp=datetime.utcnow().isoformat(),
            database_status=db_status,
            cache_stats=cache_stats
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

@app.get("/api/packages/search", response_model=List[PackageSearchResult])
async def search_packages(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    index_url: Optional[str] = Query(None, description="Custom package index URL"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results")
):
    """
    Search for packages by name or description
    
    This endpoint searches through cached package data and falls back to
    live PyPI search if needed. Results are cached for performance.
    """
    try:
        results = await package_service.search_packages(
            query=q,
            index_url=index_url,
            limit=limit
        )
        return results
    except Exception as e:
        logger.error(f"Package search failed: {e}")
        raise HTTPException(status_code=500, detail="Search failed")

@app.get("/api/packages/{package_name}", response_model=PackageDetails)
async def get_package_details(
    package_name: str,
    index_url: Optional[str] = Query(None, description="Custom package index URL"),
    include_versions: bool = Query(True, description="Include version history"),
    include_dependencies: bool = Query(True, description="Include dependency information")
):
    """
    Get detailed information about a specific package
    
    Returns comprehensive package metadata including versions, dependencies,
    and project information. Data is cached and updated intelligently.
    """
    try:
        package_details = await package_service.get_package_details(
            package_name=package_name,
            index_url=index_url,
            include_versions=include_versions,
            include_dependencies=include_dependencies
        )
        
        if not package_details:
            raise HTTPException(status_code=404, detail="Package not found")
            
        return package_details
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get package details for {package_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve package details")

@app.get("/api/packages/{package_name}/versions", response_model=List[VersionInfo])
async def get_package_versions(
    package_name: str,
    index_url: Optional[str] = Query(None, description="Custom package index URL"),
    include_yanked: bool = Query(False, description="Include yanked versions")
):
    """
    Get all available versions for a package
    
    Returns a list of all versions with metadata, optionally including
    yanked (removed) versions.
    """
    try:
        versions = await package_service.get_package_versions(
            package_name=package_name,
            index_url=index_url,
            include_yanked=include_yanked
        )
        return versions
    except Exception as e:
        logger.error(f"Failed to get versions for {package_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve package versions")

@app.get("/api/packages/{package_name}/{version}", response_model=VersionInfo)
async def get_specific_version(
    package_name: str,
    version: str,
    index_url: Optional[str] = Query(None, description="Custom package index URL")
):
    """
    Get detailed information about a specific package version
    
    Returns comprehensive metadata for a specific version including
    dependencies, file information, and release details.
    """
    try:
        version_info = await package_service.get_version_details(
            package_name=package_name,
            version=version,
            index_url=index_url
        )
        
        if not version_info:
            raise HTTPException(status_code=404, detail="Version not found")
            
        return version_info
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get version {version} for {package_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve version details")

@app.post("/api/packages/resolve-dependencies", response_model=Dict[str, Any])
async def resolve_dependencies(request: DependencyResolutionRequest):
    """
    Resolve dependencies for a list of packages with request deduplication
    
    Takes a list of package specifications and returns a complete
    dependency tree with version constraints resolved.
    """
    # Create cache key for deduplication
    cache_key = f"{sorted(request.packages)}:{request.index_url}:{request.python_version}"
    
    async with resolution_lock:
        if cache_key in resolution_cache:
            # Wait for existing resolution to complete
            event, result = resolution_cache[cache_key]
            logger.info(f"Waiting for existing resolution: {cache_key}")
        else:
            # Create new resolution task
            event = Event()
            resolution_cache[cache_key] = (event, None)
            logger.info(f"Starting new resolution: {cache_key}")
    
    if cache_key in resolution_cache and resolution_cache[cache_key][1] is not None:
        # Return cached result
        _, result = resolution_cache[cache_key]
        return result
    
    try:
        # Perform resolution
        resolution = await package_service.resolve_dependencies(
            packages=request.packages,
            index_url=request.index_url,
            python_version=request.python_version
        )
        
        # Convert Pydantic model to dict to avoid FastAPI validation error
        result = resolution.dict()
        
        # Cache result and notify waiters
        async with resolution_lock:
            if cache_key in resolution_cache:
                event, _ = resolution_cache[cache_key]
                resolution_cache[cache_key] = (event, result)
                event.set()
                
                # Clean up after 60 seconds
                asyncio.create_task(cleanup_resolution_cache(cache_key))
        
        return result
        
    except Exception as e:
        logger.error(f"Dependency resolution failed: {e}")
        
        # Clean up failed resolution
        async with resolution_lock:
            if cache_key in resolution_cache:
                event, _ = resolution_cache[cache_key]
                event.set()
                del resolution_cache[cache_key]
        
        raise HTTPException(status_code=500, detail="Dependency resolution failed")

async def cleanup_resolution_cache(cache_key: str):
    """Clean up resolution cache after delay"""
    await asyncio.sleep(60)  # Cache for 1 minute
    async with resolution_lock:
        if cache_key in resolution_cache:
            del resolution_cache[cache_key]

@app.post("/api/cache/refresh")
async def refresh_cache(
    background_tasks: BackgroundTasks,
    package_name: Optional[str] = Query(None, description="Specific package to refresh"),
    index_url: Optional[str] = Query(None, description="Custom package index URL")
):
    """
    Refresh cached package data
    
    Triggers a background refresh of cached data. Can refresh specific
    packages or the entire cache.
    """
    if package_name:
        background_tasks.add_task(
            package_service.refresh_package_cache,
            package_name,
            index_url
        )
        return {"message": f"Refresh triggered for {package_name}"}
    else:
        background_tasks.add_task(
            package_service.refresh_popular_packages_cache,
            index_url
        )
        return {"message": "Full cache refresh triggered"}

@app.get("/api/cache/stats", response_model=Dict[str, Any])
async def get_cache_stats():
    """
    Get cache statistics and performance metrics
    
    Returns information about cache hit rates, database size,
    and other performance metrics.
    """
    try:
        stats = await cache_service.get_detailed_stats()
        return stats
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve cache statistics")

@app.delete("/api/cache/clear")
async def clear_cache(
    confirm: bool = Query(False, description="Confirmation required"),
    package_name: Optional[str] = Query(None, description="Specific package to clear")
):
    """
    Clear cached data
    
    Clears cached package data. Requires confirmation parameter.
    Can clear specific packages or entire cache.
    """
    if not confirm:
        raise HTTPException(
            status_code=400, 
            detail="Confirmation required. Add ?confirm=true to proceed."
        )
    
    try:
        if package_name:
            await cache_service.clear_package_cache(package_name)
            return {"message": f"Cache cleared for {package_name}"}
        else:
            await cache_service.clear_all_cache()
            return {"message": "All cache cleared"}
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear cache")

@app.get("/api/indexes/validate")
async def validate_index(index_url: str = Query(..., description="Package index URL to validate")):
    """
    Validate a custom package index
    
    Checks if a custom package index is accessible and compatible.
    """
    try:
        is_valid = await package_service.validate_index(index_url)
        return {
            "index_url": index_url,
            "valid": is_valid,
            "checked_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Index validation failed for {index_url}: {e}")
        return {
            "index_url": index_url,
            "valid": False,
            "error": str(e),
            "checked_at": datetime.utcnow().isoformat()
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="warning"  # Reduce noise from Prisma and other dependencies
    )