"""
Contact Service Models Package
----------------------------
Entry point for the contact service models package that exposes Contact and Group models
along with their schemas for contact management functionality.

Version: 1.0.0
Author: WhatsApp Web Enhancement Team

This package provides core data models for:
- Contact management (import/export)
- Group management
- Contact segmentation
- Activity history tracking

Models exposed:
- Contact: Core contact data model with comprehensive contact information
- ContactSchema: Pydantic schema for contact validation
- Group: Group management model for contact organization
- GroupSchema: Pydantic schema for group validation
"""

# Import models and schemas from their respective modules
from .contact import Contact, ContactSchema
from .group import Group, GroupSchema

# Define explicitly exported names for clean imports
__all__ = [
    'Contact',
    'ContactSchema',
    'Group',
    'GroupSchema'
]

# Version information
__version__ = '1.0.0'

# Package metadata
__package_name__ = 'contact-service-models'
__author__ = 'WhatsApp Web Enhancement Team'
__description__ = 'Core data models for WhatsApp Web Enhancement contact management'

# Verify required dependencies are properly imported
if not all(model for model in [Contact, ContactSchema, Group, GroupSchema]):
    raise ImportError("Failed to import required models or schemas")