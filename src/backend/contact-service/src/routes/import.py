# External imports with version specifications
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks  # fastapi ^0.104.0
from fastapi.responses import JSONResponse
import uuid
import aiofiles  # aiofiles ^23.0.0
import logging
import asyncio
import os
from typing import Dict, Any
from prometheus_client import Counter, Histogram  # prometheus_client ^0.17.0

# Internal imports
from ..services.import_manager import ImportManager
from ..models.contact import ContactSchema

# Initialize router with prefix and tags
router = APIRouter(prefix='/import', tags=['import'])

# Configure logging
logger = logging.getLogger(__name__)

# Global constants
UPLOAD_DIR = './uploads'
MAX_FILE_SIZE = 1024 * 1024 * 16  # 16MB
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'json'}
BATCH_SIZE = 1000

# Initialize metrics
import_metrics = {
    'upload_duration': Histogram(
        'contact_import_upload_duration_seconds',
        'Duration of contact file uploads'
    ),
    'import_requests': Counter(
        'contact_import_requests_total',
        'Total number of import requests',
        ['status', 'file_type']
    )
}

async def get_import_manager() -> ImportManager:
    """
    FastAPI dependency for getting ImportManager instance.
    
    Returns:
        ImportManager: Configured import manager instance
    """
    try:
        # Note: Actual implementation would get this from your dependency injection system
        import_manager = ImportManager()
        return import_manager
    except Exception as e:
        logger.error(f"Failed to initialize ImportManager: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to initialize import service"
        )

@router.post('/upload')
@router.post('/upload/')
async def upload_contacts(
    file: UploadFile = File(...),
    organization_id: uuid.UUID = None,
    import_manager: ImportManager = Depends(get_import_manager),
    background_tasks: BackgroundTasks = None
) -> Dict[str, Any]:
    """
    Handle contact file upload and initiate import process.
    
    Args:
        file: Uploaded file (CSV, Excel, or JSON)
        organization_id: Organization identifier
        import_manager: Import manager instance
        background_tasks: FastAPI background tasks handler
    
    Returns:
        Dict containing import job ID and status information
    
    Raises:
        HTTPException: For validation or processing errors
    """
    try:
        # Validate organization ID
        if not organization_id:
            raise HTTPException(
                status_code=400,
                detail="Organization ID is required"
            )

        # Validate file extension
        file_extension = os.path.splitext(file.filename)[1].lower().lstrip('.')
        if file_extension not in ALLOWED_EXTENSIONS:
            import_metrics['import_requests'].labels(
                status='error',
                file_type=file_extension
            ).inc()
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        # Create upload directory if it doesn't exist
        os.makedirs(UPLOAD_DIR, exist_ok=True)

        # Generate unique file name
        import_id = uuid.uuid4()
        file_path = os.path.join(UPLOAD_DIR, f"{import_id}.{file_extension}")

        # Stream and save file with size validation
        file_size = 0
        async with aiofiles.open(file_path, 'wb') as f:
            while chunk := await file.read(8192):
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    await f.close()
                    os.remove(file_path)
                    raise HTTPException(
                        status_code=400,
                        detail=f"File size exceeds maximum limit of {MAX_FILE_SIZE/1024/1024}MB"
                    )
                await f.write(chunk)

        # Validate file structure
        validation_result = await import_manager.validate_file(file_path, file_extension)
        if not validation_result['valid']:
            os.remove(file_path)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file structure: {validation_result['error']}"
            )

        # Initialize import tracking
        import_metrics['import_requests'].labels(
            status='success',
            file_type=file_extension
        ).inc()

        # Schedule background import task
        background_tasks.add_task(
            import_manager.import_contacts,
            file_path=file_path,
            file_type=file_extension,
            organization_id=organization_id,
            import_id=import_id
        )

        # Return import job information
        return {
            "import_id": str(import_id),
            "status": "processing",
            "status_url": f"/import/status/{import_id}",
            "organization_id": str(organization_id),
            "file_name": file.filename,
            "file_size": file_size
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Import error: {str(e)}", exc_info=True)
        import_metrics['import_requests'].labels(
            status='error',
            file_type=file_extension if 'file_extension' in locals() else 'unknown'
        ).inc()
        raise HTTPException(
            status_code=500,
            detail="Internal server error during import process"
        )

@router.get('/status/{import_id}')
async def get_import_status(
    import_id: uuid.UUID,
    organization_id: uuid.UUID,
    import_manager: ImportManager = Depends(get_import_manager)
) -> Dict[str, Any]:
    """
    Get status and progress of an import operation.
    
    Args:
        import_id: Import job identifier
        organization_id: Organization identifier
        import_manager: Import manager instance
    
    Returns:
        Dict containing detailed import status and progress information
    
    Raises:
        HTTPException: When import job is not found or access is denied
    """
    try:
        # Get import progress
        progress = await import_manager.get_import_progress(str(import_id))
        
        if not progress:
            raise HTTPException(
                status_code=404,
                detail="Import job not found"
            )

        # Verify organization access
        if progress['organization_id'] != str(organization_id):
            raise HTTPException(
                status_code=403,
                detail="Access denied to import job"
            )

        return {
            "import_id": str(import_id),
            "status": progress['status'],
            "organization_id": str(organization_id),
            "progress": {
                "total_records": progress.get('total_records', 0),
                "processed_records": progress.get('processed_records', 0),
                "success_count": progress.get('success_count', 0),
                "error_count": progress.get('error_count', 0),
                "percentage": progress.get('percentage', 0)
            },
            "started_at": progress.get('started_at'),
            "completed_at": progress.get('completed_at'),
            "errors": progress.get('errors', [])[:10],  # Return first 10 errors
            "has_more_errors": len(progress.get('errors', [])) > 10
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving import status: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error while retrieving import status"
        )