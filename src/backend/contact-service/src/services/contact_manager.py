# External imports with version specifications
from sqlalchemy import create_engine, exc  # sqlalchemy ^2.0.0
from sqlalchemy.orm import sessionmaker, scoped_session  # sqlalchemy ^2.0.0
from redis import Redis, ConnectionPool  # redis ^4.5.0
from pydantic import ValidationError  # pydantic ^2.0.0
from tenacity import retry, stop_after_attempt, wait_exponential  # tenacity ^8.0.0
from prometheus_client import Counter, Histogram  # prometheus_client ^0.17.0
import logging
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import uuid

# Internal imports
from ..models.contact import Contact, ContactSchema
from ..models.group import Group
from ..config import DatabaseConfig, RedisConfig

# Constants
CACHE_TTL = 900  # 15 minutes
BATCH_SIZE = 100
MAX_RETRIES = 3
POOL_SIZE = 10
MAX_OVERFLOW = 20
CIRCUIT_BREAKER_THRESHOLD = 5

class ContactManager:
    """
    Enhanced service class for managing WhatsApp contacts with optimized caching 
    and connection pooling.
    """

    def __init__(self, db_config: DatabaseConfig, redis_config: RedisConfig):
        """Initialize contact manager with enhanced database and cache connections."""
        # Initialize database connection with pooling
        engine = create_engine(
            db_config.get_connection_url(),
            pool_size=POOL_SIZE,
            max_overflow=MAX_OVERFLOW,
            pool_timeout=30,
            pool_pre_ping=True
        )
        session_factory = sessionmaker(bind=engine)
        self.Session = scoped_session(session_factory)

        # Initialize Redis connection with pooling
        redis_pool = ConnectionPool(**redis_config.get_connection_params())
        self.redis_client = Redis(connection_pool=redis_pool)

        # Set up logging
        self.logger = logging.getLogger(__name__)

        # Initialize metrics
        self.metrics = {
            'contact_operations': Counter(
                'contact_operations_total',
                'Total contact operations',
                ['operation', 'status']
            ),
            'operation_duration': Histogram(
                'contact_operation_duration_seconds',
                'Duration of contact operations',
                ['operation']
            ),
            'cache_hits': Counter(
                'contact_cache_hits_total',
                'Total cache hits'
            ),
            'cache_misses': Counter(
                'contact_cache_misses_total',
                'Total cache misses'
            )
        }

    def _get_cache_key(self, key_type: str, identifier: str) -> str:
        """Generate standardized cache keys."""
        return f"contact_service:{key_type}:{identifier}"

    def _cache_contact(self, contact: Contact) -> None:
        """Cache contact data with TTL."""
        cache_key = self._get_cache_key('contact', str(contact.id))
        self.redis_client.setex(
            cache_key,
            CACHE_TTL,
            json.dumps(contact.to_dict())
        )

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def create_contact(self, contact_data: Dict) -> Contact:
        """
        Create a new contact with enhanced validation and caching.
        
        Args:
            contact_data (Dict): Contact information including required fields
            
        Returns:
            Contact: Created contact instance
            
        Raises:
            ValidationError: If contact data is invalid
            ValueError: If contact already exists
        """
        session = self.Session()
        try:
            # Validate contact data
            contact_schema = ContactSchema(**contact_data)
            
            # Check for existing contact
            existing_contact = session.query(Contact).filter(
                Contact.phone_number == contact_schema.phone_number,
                Contact.organization_id == contact_schema.organization_id,
                Contact.is_deleted == False
            ).first()
            
            if existing_contact:
                raise ValueError("Contact with this phone number already exists")

            # Create new contact
            new_contact = Contact.from_dict(contact_data)
            session.add(new_contact)
            
            # Handle group assignments if provided
            if contact_data.get('group_ids'):
                groups = session.query(Group).filter(
                    Group.id.in_(contact_data['group_ids']),
                    Group.organization_id == contact_schema.organization_id,
                    Group.is_deleted == False
                ).all()
                new_contact.groups.extend(groups)

            session.commit()
            
            # Cache the new contact
            self._cache_contact(new_contact)
            
            # Record metrics
            self.metrics['contact_operations'].labels(
                operation='create',
                status='success'
            ).inc()
            
            return new_contact

        except ValidationError as e:
            self.logger.error(f"Validation error creating contact: {str(e)}")
            self.metrics['contact_operations'].labels(
                operation='create',
                status='validation_error'
            ).inc()
            raise

        except Exception as e:
            self.logger.error(f"Error creating contact: {str(e)}")
            session.rollback()
            self.metrics['contact_operations'].labels(
                operation='create',
                status='error'
            ).inc()
            raise

        finally:
            session.close()

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def get_contact(self, contact_id: uuid.UUID) -> Optional[Contact]:
        """
        Retrieve contact with caching support.
        
        Args:
            contact_id (uuid.UUID): ID of the contact to retrieve
            
        Returns:
            Optional[Contact]: Contact instance if found, None otherwise
        """
        # Check cache first
        cache_key = self._get_cache_key('contact', str(contact_id))
        cached_data = self.redis_client.get(cache_key)

        if cached_data:
            self.metrics['cache_hits'].inc()
            return Contact.from_dict(json.loads(cached_data))

        self.metrics['cache_misses'].inc()
        
        # Query database if not in cache
        session = self.Session()
        try:
            contact = session.query(Contact).filter(
                Contact.id == contact_id,
                Contact.is_deleted == False
            ).first()

            if contact:
                self._cache_contact(contact)
                
            self.metrics['contact_operations'].labels(
                operation='get',
                status='success'
            ).inc()
            
            return contact

        except Exception as e:
            self.logger.error(f"Error retrieving contact: {str(e)}")
            self.metrics['contact_operations'].labels(
                operation='get',
                status='error'
            ).inc()
            raise

        finally:
            session.close()

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def update_contact(self, contact_id: uuid.UUID, update_data: Dict) -> Optional[Contact]:
        """
        Update contact with optimistic locking and cache invalidation.
        
        Args:
            contact_id (uuid.UUID): ID of the contact to update
            update_data (Dict): Updated contact information
            
        Returns:
            Optional[Contact]: Updated contact instance
            
        Raises:
            ValueError: If version conflict occurs
        """
        session = self.Session()
        try:
            contact = session.query(Contact).filter(
                Contact.id == contact_id,
                Contact.is_deleted == False
            ).with_for_update().first()

            if not contact:
                return None

            # Validate version for optimistic locking
            if update_data.get('version') != contact.version:
                raise ValueError("Version conflict detected")

            # Update contact
            contact.update(update_data)
            session.commit()

            # Invalidate cache
            cache_key = self._get_cache_key('contact', str(contact_id))
            self.redis_client.delete(cache_key)

            # Cache updated contact
            self._cache_contact(contact)

            self.metrics['contact_operations'].labels(
                operation='update',
                status='success'
            ).inc()

            return contact

        except Exception as e:
            self.logger.error(f"Error updating contact: {str(e)}")
            session.rollback()
            self.metrics['contact_operations'].labels(
                operation='update',
                status='error'
            ).inc()
            raise

        finally:
            session.close()