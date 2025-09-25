# Database Schema Documentation

This directory contains the SQL migration files for the enhanced media tracking platform database schema.

## Overview

The database schema is designed to support a comprehensive media tracking platform with social features. It includes tables for user management, media tracking, reviews, and social interactions.

## Schema Structure

### Core Tables

1. **user_profiles** - Extended user profile information
2. **user_preferences** - User settings and preferences
3. **media_items** - Unified media items (movies, TV shows, books, anime)
4. **user_media** - User's media lists and tracking status
5. **reviews** - User reviews and ratings
6. **review_likes** - Like system for reviews
7. **user_follows** - User following relationships
8. **user_activities** - Activity feed for social features

### Legacy Tables (Preserved)

- **Anime** - Original anime data
- **Books** - Original book data
- **Movies** - Original movie data

## Migration Files

### 001_create_user_profiles.sql

- Creates user_profiles and user_preferences tables
- Sets up Row Level Security (RLS) policies
- Creates triggers for automatic profile creation
- Implements updated_at timestamp management

### 002_create_media_tables.sql

- Creates media_items and user_media tables
- Sets up indexes for performance optimization
- Implements RLS policies for data privacy
- Creates triggers for rating calculations

### 003_create_social_features.sql

- Creates reviews, review_likes, user_follows, and user_activities tables
- Sets up social interaction triggers
- Implements activity feed generation
- Creates comprehensive RLS policies

## Applying Migrations

To apply these migrations to your Supabase database:

1. **Via Supabase Dashboard:**

   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor
   - Copy and paste each migration file in order (001, 002, 003)
   - Execute each migration

2. **Via Supabase CLI:**

   ```bash
   # If you have Supabase CLI installed
   supabase db reset
   # Or apply individual migrations
   supabase db push
   ```

3. **Manual Application:**
   - Connect to your PostgreSQL database
   - Execute each SQL file in order

## Row Level Security (RLS)

All tables have RLS enabled with the following principles:

- **Public Data**: Media items are publicly readable
- **User Data**: Users can only access their own data by default
- **Privacy Controls**: Users can control visibility of their lists and reviews
- **Social Features**: Public profiles and reviews are visible to all users
- **Following System**: Users can see activities of users they follow

## Key Features

### Automatic Profile Creation

When a user signs up via Supabase Auth, a trigger automatically creates:

- A user profile with username and display name
- Default user preferences

### Rating System

- Automatic calculation of average ratings for media items
- Real-time updates when users add/update/remove ratings
- Separate detailed reviews with like functionality

### Activity Feed

- Automatic activity tracking for user actions
- Privacy-aware activity visibility
- Support for various activity types (ratings, reviews, follows, etc.)

### Performance Optimizations

- Comprehensive indexing strategy
- Full-text search capabilities for media titles
- Optimized queries for common operations

## Data Types

The `database.types.ts` file contains TypeScript definitions for all tables, generated from the Supabase schema. Additional application-specific types are defined in `src/types/database.ts`.

## Security Considerations

- All sensitive operations require authentication
- RLS policies prevent unauthorized data access
- User data is automatically cleaned up on account deletion
- Privacy settings are enforced at the database level

## Maintenance

### Regular Tasks

- Monitor query performance and adjust indexes as needed
- Review RLS policies for security
- Clean up old activity records periodically
- Update external API metadata as needed

### Backup Strategy

- Regular database backups via Supabase
- Export user data functionality for GDPR compliance
- Point-in-time recovery capabilities
