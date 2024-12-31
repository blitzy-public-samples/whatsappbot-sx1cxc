# External imports with version specifications
from sqlalchemy.orm import Session  # sqlalchemy ^2.0.0
from sqlalchemy.exc import IntegrityError, SQLAlchemyError  # sqlalchemy ^2.0.0
from pydantic import ValidationError  # pydantic ^2.0.0
from typing import List, Dict, Optional, Tuple
from redis import Redis  # redis ^4.0.0
import logging
import uuid
import json
from datetime import datetime, timedelta

# Internal imports
from ..models.group import Group, GroupSchema
from ..models.contact import Contact
from ..config import DatabaseConfig

class GroupManager:
    """
    Comprehensive service for managing WhatsApp contact groups with support for 
    multi-tenancy, caching, and bulk operations.
    """

    def __init__(self, db_session: Session, cache_client: Redis, config: Dict):
        """Initialize group manager with database session, cache connection, and configuration."""
        self._db_session = db_session
        self._cache = cache_client
        self._logger = logging.getLogger(__name__)
        self._batch_size = config.get('batch_size', 100)
        self._cache_ttl = config.get('cache_ttl', 1800)  # 30 minutes default
        
        # Validate connections
        self._validate_connections()

    def _validate_connections(self) -> None:
        """Validate database and cache connections."""
        try:
            # Test database connection
            self._db_session.execute("SELECT 1")
            
            # Test cache connection
            self._cache.ping()
        except Exception as e:
            self._logger.error(f"Connection validation failed: {str(e)}")
            raise RuntimeError("Failed to establish required connections")

    def _get_cache_key(self, group_id: uuid.UUID) -> str:
        """Generate cache key for group data."""
        return f"group:{str(group_id)}"

    def _cache_group(self, group: Group) -> None:
        """Cache group data with TTL."""
        try:
            cache_key = self._get_cache_key(group.id)
            group_data = group.to_dict()
            self._cache.setex(
                cache_key,
                self._cache_ttl,
                json.dumps(group_data)
            )
        except Exception as e:
            self._logger.warning(f"Failed to cache group {group.id}: {str(e)}")

    def _get_cached_group(self, group_id: uuid.UUID) -> Optional[Dict]:
        """Retrieve group data from cache."""
        try:
            cache_key = self._get_cache_key(group_id)
            cached_data = self._cache.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            self._logger.warning(f"Cache retrieval failed for group {group_id}: {str(e)}")
        return None

    def create_group(self, name: str, description: str, metadata: Dict, 
                    organization_id: uuid.UUID, created_by: uuid.UUID) -> Group:
        """
        Create a new contact group with validation and caching.
        
        Args:
            name: Group name
            description: Group description
            metadata: Additional group metadata
            organization_id: Organization ID for multi-tenancy
            created_by: User ID creating the group
        
        Returns:
            Newly created group instance
        
        Raises:
            ValueError: If validation fails
            RuntimeError: If database operation fails
        """
        try:
            # Validate group data
            GroupSchema.validate_name(name)
            
            # Check for duplicate names in organization
            existing = self._db_session.query(Group).filter(
                Group.name == name,
                Group.organization_id == organization_id,
                Group.is_deleted == False
            ).first()
            
            if existing:
                raise ValueError(f"Group name '{name}' already exists in organization")
            
            # Create new group
            new_group = Group(
                name=name,
                description=description,
                metadata=metadata,
                organization_id=organization_id,
                created_by=created_by
            )
            
            # Save to database
            self._db_session.add(new_group)
            self._db_session.commit()
            
            # Cache the new group
            self._cache_group(new_group)
            
            self._logger.info(f"Created new group: {new_group.id}")
            return new_group
            
        except ValidationError as e:
            self._logger.error(f"Validation error creating group: {str(e)}")
            raise ValueError(str(e))
        except IntegrityError as e:
            self._db_session.rollback()
            self._logger.error(f"Database integrity error: {str(e)}")
            raise RuntimeError("Failed to create group due to database constraint")
        except Exception as e:
            self._db_session.rollback()
            self._logger.error(f"Unexpected error creating group: {str(e)}")
            raise

    def update_group(self, group_id: uuid.UUID, update_data: Dict, 
                    organization_id: uuid.UUID) -> bool:
        """
        Update group information with validation and cache refresh.
        
        Args:
            group_id: ID of group to update
            update_data: Dictionary of fields to update
            organization_id: Organization ID for access validation
        
        Returns:
            Boolean indicating success
        
        Raises:
            ValueError: If validation fails or group not found
            RuntimeError: If database operation fails
        """
        try:
            # Get group with organization validation
            group = self._db_session.query(Group).filter(
                Group.id == group_id,
                Group.organization_id == organization_id,
                Group.is_deleted == False
            ).first()
            
            if not group:
                raise ValueError("Group not found or access denied")
            
            # Validate update data
            if 'name' in update_data:
                GroupSchema.validate_name(update_data['name'])
                
                # Check name uniqueness
                existing = self._db_session.query(Group).filter(
                    Group.name == update_data['name'],
                    Group.organization_id == organization_id,
                    Group.id != group_id,
                    Group.is_deleted == False
                ).first()
                
                if existing:
                    raise ValueError(f"Group name '{update_data['name']}' already exists")
            
            # Update fields
            for field, value in update_data.items():
                if hasattr(group, field):
                    setattr(group, field, value)
            
            group.version += 1
            group.updated_at = datetime.utcnow()
            
            # Commit changes
            self._db_session.commit()
            
            # Update cache
            self._cache_group(group)
            
            self._logger.info(f"Updated group: {group_id}")
            return True
            
        except ValidationError as e:
            self._logger.error(f"Validation error updating group: {str(e)}")
            raise ValueError(str(e))
        except SQLAlchemyError as e:
            self._db_session.rollback()
            self._logger.error(f"Database error updating group: {str(e)}")
            raise RuntimeError("Failed to update group")
        except Exception as e:
            self._db_session.rollback()
            self._logger.error(f"Unexpected error updating group: {str(e)}")
            raise

    def bulk_add_contacts(self, group_id: uuid.UUID, contact_ids: List[uuid.UUID],
                         organization_id: uuid.UUID) -> Dict:
        """
        Add multiple contacts to a group with batch processing.
        
        Args:
            group_id: Target group ID
            contact_ids: List of contact IDs to add
            organization_id: Organization ID for access validation
        
        Returns:
            Dict with success and failure counts
        
        Raises:
            ValueError: If validation fails
            RuntimeError: If database operation fails
        """
        results = {
            'total': len(contact_ids),
            'successful': 0,
            'failed': 0,
            'errors': []
        }
        
        try:
            # Validate group access
            group = self._db_session.query(Group).filter(
                Group.id == group_id,
                Group.organization_id == organization_id,
                Group.is_deleted == False
            ).first()
            
            if not group:
                raise ValueError("Group not found or access denied")
            
            # Process contacts in batches
            for i in range(0, len(contact_ids), self._batch_size):
                batch = contact_ids[i:i + self._batch_size]
                
                # Get contacts for batch
                contacts = self._db_session.query(Contact).filter(
                    Contact.id.in_(batch),
                    Contact.organization_id == organization_id,
                    Contact.is_deleted == False
                ).all()
                
                # Track failed IDs
                found_ids = {str(c.id) for c in contacts}
                failed_ids = set(map(str, batch)) - found_ids
                
                # Add contacts to group
                for contact in contacts:
                    try:
                        if contact not in group.members:
                            group.members.append(contact)
                            results['successful'] += 1
                    except Exception as e:
                        results['failed'] += 1
                        results['errors'].append(f"Failed to add contact {contact.id}: {str(e)}")
                
                # Record failures for not found contacts
                for failed_id in failed_ids:
                    results['failed'] += 1
                    results['errors'].append(f"Contact not found: {failed_id}")
                
                # Update group metadata
                group.member_count = len(group.members)
                group.version += 1
                group.updated_at = datetime.utcnow()
                
                # Commit batch
                self._db_session.commit()
            
            # Update cache
            self._cache_group(group)
            
            self._logger.info(f"Bulk added contacts to group {group_id}: {results}")
            return results
            
        except SQLAlchemyError as e:
            self._db_session.rollback()
            self._logger.error(f"Database error in bulk add: {str(e)}")
            raise RuntimeError("Failed to complete bulk add operation")
        except Exception as e:
            self._db_session.rollback()
            self._logger.error(f"Unexpected error in bulk add: {str(e)}")
            raise