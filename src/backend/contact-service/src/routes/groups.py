# External imports with version specifications
from fastapi import APIRouter, Depends, HTTPException, Query, Path  # fastapi ^0.104.0
from fastapi.responses import JSONResponse  # fastapi ^0.104.0
from pydantic import BaseModel, UUID4, constr, validator  # pydantic ^2.0.0
from typing import List, Dict, Optional
import uuid
from datetime import datetime

# Internal imports
from ..models.group import Group, GroupSchema
from ..services.group_manager import GroupManager
from ..config import ServiceConfig
from ..middleware.auth import validate_organization, get_current_user
from ..middleware.rate_limit import rate_limit
from ..middleware.cache import cache_response

# Initialize router with prefix and tags
router = APIRouter(prefix='/groups', tags=['groups'])

# Constants for pagination and batch operations
BATCH_SIZE_LIMIT = 1000
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200

# Request/Response Models
class GroupCreate(BaseModel):
    """Enhanced group creation request model with validation."""
    name: constr(min_length=1, max_length=100)
    description: Optional[str] = None
    metadata: Dict = {}

    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("Group name cannot be empty")
        return v.strip()

class GroupUpdate(BaseModel):
    """Group update request model with version control."""
    name: Optional[constr(min_length=1, max_length=100)]
    description: Optional[str]
    metadata: Optional[Dict]
    version: int

    @validator('version')
    def validate_version(cls, v):
        if v < 1:
            raise ValueError("Invalid version number")
        return v

class ContactBulkOperation(BaseModel):
    """Bulk contact operation request model."""
    contact_ids: List[UUID4]

    @validator('contact_ids')
    def validate_contact_ids(cls, v):
        if not v:
            raise ValueError("Contact IDs list cannot be empty")
        if len(v) > BATCH_SIZE_LIMIT:
            raise ValueError(f"Maximum {BATCH_SIZE_LIMIT} contacts allowed per operation")
        return v

@router.post('/', status_code=201)
@validate_organization
@rate_limit(limit=100, period=3600)  # 100 group creations per hour
async def create_group(
    group_data: GroupCreate,
    organization_id: UUID4 = Depends(get_current_user),
    group_manager: GroupManager = Depends()
) -> JSONResponse:
    """
    Create a new contact group with enhanced validation.
    
    Args:
        group_data: Group creation data
        organization_id: Organization ID from auth
        group_manager: Injected group manager service
    
    Returns:
        JSONResponse with created group data
    """
    try:
        group = group_manager.create_group(
            name=group_data.name,
            description=group_data.description,
            metadata=group_data.metadata,
            organization_id=organization_id,
            created_by=organization_id  # Using org_id as created_by for this example
        )
        
        return JSONResponse(
            status_code=201,
            content={
                "status": "success",
                "data": group.to_dict(),
                "metadata": {
                    "created_at": datetime.utcnow().isoformat(),
                    "version": group.version
                }
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create group")

@router.get('/{group_id}')
@validate_organization
@cache_response(ttl=300)  # 5-minute cache
async def get_group(
    group_id: UUID4 = Path(...),
    organization_id: UUID4 = Depends(get_current_user),
    group_manager: GroupManager = Depends()
) -> JSONResponse:
    """
    Retrieve a specific group by ID with caching.
    
    Args:
        group_id: Group UUID
        organization_id: Organization ID from auth
        group_manager: Injected group manager service
    
    Returns:
        JSONResponse with group details
    """
    try:
        # Check cache first
        cached_group = group_manager._get_cached_group(group_id)
        if cached_group:
            return JSONResponse(content={
                "status": "success",
                "data": cached_group,
                "metadata": {"cache_hit": True}
            })

        # Get from database
        group = group_manager.get_group(group_id, organization_id)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")

        # Cache the result
        group_manager._cache_group(group)
        
        return JSONResponse(content={
            "status": "success",
            "data": group.to_dict(),
            "metadata": {"cache_hit": False}
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to retrieve group")

@router.put('/{group_id}')
@validate_organization
@rate_limit(limit=200, period=3600)  # 200 updates per hour
async def update_group(
    group_id: UUID4,
    update_data: GroupUpdate,
    organization_id: UUID4 = Depends(get_current_user),
    group_manager: GroupManager = Depends()
) -> JSONResponse:
    """
    Update group information with version control.
    """
    try:
        success = group_manager.update_group(
            group_id=group_id,
            update_data=update_data.dict(exclude_unset=True),
            organization_id=organization_id
        )
        
        return JSONResponse(content={
            "status": "success",
            "message": "Group updated successfully",
            "metadata": {
                "updated_at": datetime.utcnow().isoformat(),
                "version": update_data.version + 1
            }
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to update group")

@router.post('/{group_id}/contacts')
@validate_organization
@rate_limit(limit=50, period=3600)  # 50 bulk operations per hour
async def add_contacts(
    group_id: UUID4,
    contact_data: ContactBulkOperation,
    organization_id: UUID4 = Depends(get_current_user),
    group_manager: GroupManager = Depends()
) -> JSONResponse:
    """
    Add multiple contacts to a group with batch processing.
    """
    try:
        results = group_manager.bulk_add_contacts(
            group_id=group_id,
            contact_ids=contact_data.contact_ids,
            organization_id=organization_id
        )
        
        return JSONResponse(content={
            "status": "success",
            "data": results,
            "metadata": {
                "processed_at": datetime.utcnow().isoformat(),
                "batch_size": len(contact_data.contact_ids)
            }
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to add contacts to group")

@router.get('/')
@validate_organization
@cache_response(ttl=300)  # 5-minute cache
async def list_groups(
    organization_id: UUID4 = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, le=MAX_PAGE_SIZE),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    group_manager: GroupManager = Depends()
) -> JSONResponse:
    """
    List groups with pagination, search, and sorting.
    """
    try:
        groups, total = group_manager.list_groups(
            organization_id=organization_id,
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by
        )
        
        return JSONResponse(content={
            "status": "success",
            "data": [group.to_dict() for group in groups],
            "metadata": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size
            }
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to list groups")