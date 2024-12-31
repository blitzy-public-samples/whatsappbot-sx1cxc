# External imports with version specifications
from sqlalchemy import Column, String, Boolean, DateTime, JSON, ForeignKey, Integer, Table, Text
from sqlalchemy.orm import relationship, declarative_base  # sqlalchemy ^2.0.0
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from pydantic import BaseModel, validator  # pydantic ^2.0.0
from datetime import datetime
from typing import List, Dict, Optional
import uuid
import phonenumbers  # phonenumbers ^8.13.0
import re
from dataclasses import dataclass

# Internal imports
from ..config import DatabaseConfig

# Initialize SQLAlchemy base
Base = declarative_base()

# Global constants for validation
PHONE_REGEX = r'^\+[1-9]\d{1,14}$'
EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

# Association table for contact-group many-to-many relationship
contact_group_association = Table(
    'contact_group_association',
    Base.metadata,
    Column('contact_id', UUID(as_uuid=True), ForeignKey('contacts.id')),
    Column('group_id', UUID(as_uuid=True), ForeignKey('groups.id')),
    Column('created_at', DateTime, default=datetime.utcnow),
)

@dataclass
class Contact(Base):
    """
    Enhanced SQLAlchemy model representing a WhatsApp contact with comprehensive information
    and optimized indexing for high-performance querying.
    """
    __tablename__ = 'contacts'
    
    # Primary indexing and identification
    __table_args__ = (
        {'schema': 'contact_service'},
        Index('idx_phone_number', 'phone_number'),
        Index('idx_org_last_contact', 'organization_id', 'last_contacted_at'),
        Index('idx_tags', 'tags', postgresql_using='gin'),
        Index('idx_metadata', 'metadata', postgresql_using='gin'),
    )

    # Core fields
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone_number = Column(String(20), nullable=False, unique=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    email = Column(String(255), nullable=True)
    
    # Extended information
    metadata = Column(JSON, nullable=True, default={})
    tags = Column(ARRAY(String), nullable=True, default=[])
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Tracking fields
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_contacted_at = Column(DateTime, nullable=True)
    
    # Relationships and foreign keys
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    groups = relationship('Group', secondary=contact_group_association, back_populates='contacts')
    
    # Version control and soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    version = Column(Integer, nullable=False, default=1)

    def __init__(self, phone_number: str, first_name: str, last_name: str, email: str,
                 metadata: Dict, tags: List[str], organization_id: uuid.UUID):
        """
        Initialize a new Contact instance with enhanced validation.
        """
        # Validate phone number format
        try:
            parsed_number = phonenumbers.parse(phone_number)
            if not phonenumbers.is_valid_number(parsed_number):
                raise ValueError("Invalid phone number format")
            self.phone_number = phonenumbers.format_number(parsed_number, 
                                                         phonenumbers.PhoneNumberFormat.E164)
        except phonenumbers.NumberParseException:
            raise ValueError("Invalid phone number format")

        # Validate email format if provided
        if email and not re.match(EMAIL_REGEX, email):
            raise ValueError("Invalid email format")

        # Set core fields
        self.id = uuid.uuid4()
        self.first_name = first_name
        self.last_name = last_name
        self.email = email
        self.metadata = metadata or {}
        self.tags = tags or []
        self.organization_id = organization_id
        
        # Initialize tracking fields
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.version = 1
        self.is_deleted = False

    def to_dict(self) -> Dict:
        """
        Convert contact instance to dictionary with enhanced metadata.
        """
        return {
            'id': str(self.id),
            'phone_number': self.phone_number,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'email': self.email,
            'metadata': self.metadata,
            'tags': self.tags,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'last_contacted_at': self.last_contacted_at.isoformat() if self.last_contacted_at else None,
            'organization_id': str(self.organization_id),
            'group_ids': [str(group.id) for group in self.groups],
            'is_deleted': self.is_deleted,
            'version': self.version
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'Contact':
        """
        Create contact instance from dictionary with validation.
        """
        required_fields = ['phone_number', 'first_name', 'last_name', 'organization_id']
        if not all(field in data for field in required_fields):
            raise ValueError("Missing required fields")

        return cls(
            phone_number=data['phone_number'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=data.get('email'),
            metadata=data.get('metadata', {}),
            tags=data.get('tags', []),
            organization_id=uuid.UUID(data['organization_id'])
        )

    def update(self, update_data: Dict) -> bool:
        """
        Update contact with new data and version control.
        """
        if 'version' in update_data and update_data['version'] != self.version:
            raise ValueError("Version conflict detected")

        updatable_fields = {
            'first_name', 'last_name', 'email', 'metadata', 
            'tags', 'is_active', 'last_contacted_at'
        }

        for field, value in update_data.items():
            if field in updatable_fields:
                setattr(self, field, value)

        self.version += 1
        self.updated_at = datetime.utcnow()
        return True

class ContactSchema(BaseModel):
    """
    Enhanced Pydantic schema for contact data validation with custom validators.
    """
    id: Optional[uuid.UUID]
    phone_number: str
    first_name: str
    last_name: str
    email: Optional[str]
    metadata: Dict = {}
    tags: List[str] = []
    is_active: bool = True
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    last_contacted_at: Optional[datetime]
    organization_id: uuid.UUID
    group_ids: List[uuid.UUID] = []
    is_deleted: bool = False
    version: int = 1

    @validator('phone_number')
    def validate_phone_number(cls, v):
        """
        Enhanced WhatsApp phone number validation.
        """
        try:
            parsed_number = phonenumbers.parse(v)
            if not phonenumbers.is_valid_number(parsed_number):
                raise ValueError("Invalid phone number")
            return phonenumbers.format_number(parsed_number, phonenumbers.PhoneNumberFormat.E164)
        except phonenumbers.NumberParseException:
            raise ValueError("Invalid phone number format")

    @validator('email')
    def validate_email(cls, v):
        """
        Validate email format if provided.
        """
        if v and not re.match(EMAIL_REGEX, v):
            raise ValueError("Invalid email format")
        return v

    class Config:
        orm_mode = True
        arbitrary_types_allowed = True