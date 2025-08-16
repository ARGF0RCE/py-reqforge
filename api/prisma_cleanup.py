#!/usr/bin/env python
"""
Prisma cleanup script to ensure the query engine binary is available at runtime.
"""
import subprocess
import sys
import os

def main():
    """Ensure Prisma is properly set up before starting the app."""
    try:
        # Fetch the Prisma query engine binary
        print("Fetching Prisma query engine binary...")
        result = subprocess.run(
            ["prisma", "py", "fetch"],
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode != 0:
            print(f"Warning: Failed to fetch Prisma binary: {result.stderr}")
        else:
            print("Successfully fetched Prisma binary")
            
        # Also try to generate if needed
        print("Ensuring Prisma client is generated...")
        result = subprocess.run(
            ["prisma", "generate", "--schema=schema.prisma"],
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode != 0:
            print(f"Warning: Failed to generate Prisma client: {result.stderr}")
        else:
            print("Successfully generated Prisma client")
            
    except Exception as e:
        print(f"Error during Prisma setup: {e}")
        # Don't fail - let the app try to start anyway
    
    print("Prisma setup complete")

if __name__ == "__main__":
    main()