# External imports with version specifications
from fastapi import APIRouter, HTTPException, Depends, Query, Path, Body, status  # fastapi ^0.104.0
from fastapi.responses import JSONResponse
from pydantic import ValidationError  # pydantic ^2.0.0
from opentelemetry import trace  # opentelemetry-api ^1.20.0
from prometheus_client import Counter, Histogram  # prometheus_client ^0.17.0
from typing import List, Dict, Optional
import uuid
import logging
from datetime import datetime
from rate_limit import RateLimiter  # rate-limit ^2.2.1

# Internal imports
from ..models.contact import Contact, ContactSchema
from ..services.contact_manager import ContactManager
from ..config import ServiceConfig

# Initialize router with prefix and tags
router = APIRouter(prefix="/contacts", tags=["contacts"])

# Initialize logging
logger = logging.getLogger(__name__)

# Initialize tracing
tracer = trace.get_tracer(__name__)

# Initialize metrics
metrics = {
    'http_requests': Counter(
        'contact_http_requests_total',
        'Total HTTP requests',
        ['method', 'endpoint', 'status']
    ),
    'request_duration': Histogram(
        'contact_request_duration_seconds',
        'Request duration in seconds',
        ['method', 'endpoint']
    )
}

# Initialize rate limiters
rate_limiters = {
    'create': RateLimiter(max_calls=50, period=60),  # 50 calls per minute
    'bulk': RateLimiter(max_calls=10, period=60),    # 10 calls per minute
    'default': RateLimiter(max_calls=100, period=60)  # 100 calls per minute
}

# Initialize contact manager
contact_manager = ContactManager()

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ContactSchema)
async def create_contact(
    contact_data: ContactSchema = Body(...),
    rate_limiter: RateLimiter = Depends(lambda: rate_limiters['create'])
):
    """
    Create a new contact with validation and rate limiting.
    """
    with tracer.start_as_current_span("create_contact") as span:
        try:
            # Apply rate limiting
            await rate_limiter.acquire()
            
            # Create contact
            contact = await contact_manager.create_contact(contact_data.dict())
            
            # Record metrics
            metrics['http_requests'].labels(
                method='POST',
                endpoint='/contacts',
                status=201
            ).inc()
            
            return contact.to_dict()
            
        except ValidationError as e:
            logger.error(f"Validation error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e)
            )
        except ValueError as e:
            logger.error(f"Value error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            logger.error(f"Error creating contact: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )

@router.get("/{contact_id}", response_model=ContactSchema)
async def get_contact(
    contact_id: uuid.UUID = Path(...),
    rate_limiter: RateLimiter = Depends(lambda: rate_limiters['default'])
):
    """
    Retrieve a contact by ID with caching support.
    """
    with tracer.start_as_current_span("get_contact") as span:
        try:
            # Apply rate limiting
            await rate_limiter.acquire()
            
            # Get contact
            contact = await contact_manager.get_contact(contact_id)
            if not contact:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Contact not found"
                )
            
            # Record metrics
            metrics['http_requests'].labels(
                method='GET',
                endpoint='/contacts/{id}',
                status=200
            ).inc()
            
            return contact.to_dict()
            
        except Exception as e:
            logger.error(f"Error retrieving contact: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )

@router.put("/{contact_id}", response_model=ContactSchema)
async def update_contact(
    contact_id: uuid.UUID = Path(...),
    update_data: ContactSchema = Body(...),
    rate_limiter: RateLimiter = Depends(lambda: rate_limiters['default'])
):
    """
    Update a contact with version control and validation.
    """
    with tracer.start_as_current_span("update_contact") as span:
        try:
            # Apply rate limiting
            await rate_limiter.acquire()
            
            # Update contact
            contact = await contact_manager.update_contact(contact_id, update_data.dict())
            if not contact:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Contact not found"
                )
            
            # Record metrics
            metrics['http_requests'].labels(
                method='PUT',
                endpoint='/contacts/{id}',
                status=200
            ).inc()
            
            return contact.to_dict()
            
        except ValueError as e:
            logger.error(f"Version conflict: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e)
            )
        except Exception as e:
            logger.error(f"Error updating contact: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )

@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: uuid.UUID = Path(...),
    rate_limiter: RateLimiter = Depends(lambda: rate_limiters['default'])
):
    """
    Soft delete a contact.
    """
    with tracer.start_as_current_span("delete_contact") as span:
        try:
            # Apply rate limiting
            await rate_limiter.acquire()
            
            # Delete contact
            success = await contact_manager.delete_contact(contact_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Contact not found"
                )
            
            # Record metrics
            metrics['http_requests'].labels(
                method='DELETE',
                endpoint='/contacts/{id}',
                status=204
            ).inc()
            
            return JSONResponse(status_code=status.HTTP_204_NO_CONTENT)
            
        except Exception as e:
            logger.error(f"Error deleting contact: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )

@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_import_contacts(
    contacts: List[ContactSchema] = Body(...),
    rate_limiter: RateLimiter = Depends(lambda: rate_limiters['bulk'])
):
    """
    Bulk import contacts with validation and rate limiting.
    """
    with tracer.start_as_current_span("bulk_import_contacts") as span:
        try:
            # Apply rate limiting
            await rate_limiter.acquire()
            
            # Import contacts
            results = await contact_manager.bulk_import_contacts(
                [contact.dict() for contact in contacts]
            )
            
            # Record metrics
            metrics['http_requests'].labels(
                method='POST',
                endpoint='/contacts/bulk',
                status=201
            ).inc()
            
            return {
                "success": len(results['success']),
                "failed": len(results['failed']),
                "failed_items": results['failed']
            }
            
        except Exception as e:
            logger.error(f"Error in bulk import: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )

@router.get("/search", response_model=List[ContactSchema])
async def search_contacts(
    query: str = Query(..., min_length=1),
    organization_id: uuid.UUID = Query(...),
    group_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    rate_limiter: RateLimiter = Depends(lambda: rate_limiters['default'])
):
    """
    Search contacts with pagination and filtering.
    """
    with tracer.start_as_current_span("search_contacts") as span:
        try:
            # Apply rate limiting
            await rate_limiter.acquire()
            
            # Search contacts
            contacts = await contact_manager.search_contacts(
                query=query,
                organization_id=organization_id,
                group_id=group_id,
                page=page,
                page_size=page_size
            )
            
            # Record metrics
            metrics['http_requests'].labels(
                method='GET',
                endpoint='/contacts/search',
                status=200
            ).inc()
            
            return [contact.to_dict() for contact in contacts]
            
        except Exception as e:
            logger.error(f"Error searching contacts: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )