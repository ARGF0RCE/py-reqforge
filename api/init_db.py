#!/usr/bin/env python3
"""
Database initialization script for py-reqforge API
"""

import asyncio
import logging
from services.cache_service import CacheService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_database():
    """Initialize the database and run any necessary setup"""
    logger.info("Initializing database...")
    
    cache_service = CacheService()
    
    try:
        await cache_service.initialize()
        logger.info("Database initialized successfully")
        
        # Run a simple test
        stats = await cache_service.get_cache_stats()
        logger.info(f"Database test successful: {stats}")
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise
    finally:
        await cache_service.close()

if __name__ == "__main__":
    asyncio.run(init_database())