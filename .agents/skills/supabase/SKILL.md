---
name: supabase
description: Supabase Database, Authentication, Storage, Edge Functions, and SQL Migrations best practices for Kotha Jagir Solution.
---

# Supabase Integration Skill

This skill provides comprehensive instructions and best practices for integrating and working with Supabase services (PostgreSQL, Auth, Storage, Database Client, and Migrations) in this project.

## Supabase Project Details
- **Project URL / Host**: `db.uphafrhzvovxsoonowve.supabase.co`
- **Database Connection String**: `postgresql://postgres:[PASSWORD]@db.uphafrhzvovxsoonowve.supabase.co:5432/postgres` (Pooler: port 6543, Direct: port 5432)

## Key Guidelines

### 1. Database & Migrations
- Use standard SQL DDL scripts to define schemas.
- Ensure all foreign keys, indexes, and primary keys (UUID) are explicitly set.
- Disable direct client deletion on permanent audit tables (e.g., `applications`).

### 2. Private Storage & Signed URLs
- Public files (e.g., listing images, videos) are stored in public storage buckets.
- Private files (e.g., citizenship front & back cards) MUST be stored in private storage buckets with strict access policies.
- Generate short-lived signed URLs (e.g., 5-minute expiry) for administrative access only.

### 3. Authentication & Security
- Admin access uses scoped JWTs.
- Member login uses application-scoped credentials (`email` + `password_hash`).
- Revoking login access sets `password_hash = NULL` while retaining application records.
