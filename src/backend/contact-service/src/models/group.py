# External imports with version specifications
from sqlalchemy import Column, String, Boolean, DateTime, JSON, ForeignKey, Integer, Table  # sqlalchemy ^2.0.0
from sqlalchemy.orm import relationship, declarative_base  # sqlalchemy ^2.0.0
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import event  # sqlalchemy ^2.0.0
from pydantic import BaseModel  # pydantic ^2.0.0
from datetime import datetime
from typing import List, Dict, Optional
import uuid
from dataclasses import dataclass

# Internal imports
from ..config import DatabaseConfig
from .contact import Contact

# Initialize SQLAlchemy base
Base = declarative_base()

# Association table for group-member relationship with enhanced tracking
group_member_table = Table(
    'group_members',
    Base.metadata,
    Column('group_id', UUID(as_uuid=True), ForeignKey('groups.id')),
    Column('contact_id', UUID(as_uuid=True), ForeignKey('contacts.id')),
    Column('added_at', DateTime, default=datetime.utcnow),
    Column('added_by', UUID(as_uuid=True), nullable=False),
    Column('is_active', Boolean, default=True),
)

@dataclass
class Group(Base):
    """
    Enhanced SQLAlchemy model for WhatsApp contact groups with comprehensive version control
    and member tracking capabilities.
    """
    __tablename__ = 'groups'
    
    # Optimized indexing configuration
    __table_args__ = (
        {'schema': 'contact_service'},
        Index('idx_org_name', 'organization_id', 'name'),
        Index('idx_metadata', 'metadata', postgresql_using='gin'),
        Index('idx_created_at', 'created_at'),
    )

    # Core fields
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    metadata = Column(JSON, nullable=True, default={})
    is_active = Column(Boolean, default=True, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    
    # Version control
    version = Column(Integer, nullable=False, default=1)
    
    # Tracking fields
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    last_modified_by = Column(UUID(as_uuid=True), nullable=False)
    
    # Relationships
    members = relationship('Contact', secondary=group_member_table, backref='groups')
    member_count = Column(Integer, default=0, nullable=False)

    def __init__(self, name: str, description: str, metadata: Dict, 
                 organization_id: uuid.UUID, created_by: uuid.UUID):
        """
        Initialize a new Group instance with versioning support.
        """
        self.id = uuid.uuid4()
        self.name = name
        self.description = description
        self.metadata = metadata or {}
        self.organization_id = organization_id
        self.last_modified_by = created_by
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.version = 1
        self.is_active = True
        self.is_deleted = False
        self.member_count = 0
        self.members = []

    def to_dict(self) -> Dict:
        """
        Convert group instance to dictionary with version info and tracking data.
        """
        return {
            'id': str(self.id),
            'name': self.name,
            'description': self.description,
            'metadata': self.metadata,
            'is_active': self.is_active,
            'is_deleted': self.is_deleted,
            'version': self.version,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'organization_id': str(self.organization_id),
            'last_modified_by': str(self.last_modified_by),
            'member_ids': [str(member.id) for member in self.members],
            'member_count': self.member_count
        }

    def add_member(self, contact: Contact, modified_by: uuid.UUID) -> bool:
        """
        Add a contact to group with version control and validation.
        """
        # Validate member limit (example: 256 members per group)
        if self.member_count >= 256:
            raise ValueError("Group member limit exceeded")

        # Check if contact is already a member
        if contact in self.members:
            return False

        # Update version and tracking info
        self.version += 1
        self.last_modified_by = modified_by
        self.updated_at = datetime.utcnow()

        # Add member and update count
        self.members.append(contact)
        self.member_count = len(self.members)
        
        return True

    def soft_delete(self, deleted_by: uuid.UUID) -> bool:
        """
        Mark group as deleted while maintaining data integrity.
        """
        self.is_deleted = True
        self.is_active = False
        self.version += 1
        self.last_modified_by = deleted_by
        self.updated_at = datetime.utcnow()
        return True

# Event listener for member count validation
@event.listens_for(Group.members, 'append')
def validate_member_count(target, value, initiator):
    """Validate member count constraints when adding members."""
    if target.member_count >= 256:
        raise ValueError("Group member limit exceeded")

class GroupSchema(BaseModel):
    """
    Enhanced Pydantic schema for group validation with version control support.
    """
    id: Optional[uuid.UUID]
    name: str
    description: Optional[str]
    metadata: Dict = {}
    is_active: bool = True
    is_deleted: bool = False
    version: int = 1
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    organization_id: uuid.UUID
    last_modified_by: uuid.UUID
    member_ids: List[uuid.UUID] = []
    member_count: int = 0

    @validator('version')
    def validate_version(cls, v: int) -> bool:
        """
        Validate version for optimistic locking.
        """
        if v < 1:
            raise ValueError("Version must be positive")
        return v

    class Config:
        orm_mode = True
        arbitrary_types_allowed = True