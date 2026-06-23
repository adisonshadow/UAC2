## EUAC Backend (v 1.0)

### About EUAC (Enterprise User Authorization Control)

EUAC consists of (IAM + EMM + SSO) components:

**IAM System** - Identity and Access Management system is a technical framework for managing digital identities and controlling user access to resources. Its core objective is to ensure that the right users access the right resources with appropriate permissions at the right time, while maintaining system and data security.

**EMM System** - Enterprise Media Management system is designed to manage enterprise digital assets including images, documents, videos, and other digital production materials.

**SSO Service** - Single Sign-On service allows users to access multiple related but independent systems using a single account and password. Once a user logs into one application, they can access all applications that trust this identity authentication without repeated logins. This simplifies identity management and enhances security. The EUAC system provides a complete SSO solution, supporting multiple SSO protocols (such as SAML, OAuth 2.0, etc.) and offering unified user authentication, authorization, and session management.

---

### Reference Links
This project references the following [links](./Documents/引用链接.md)

## Installation

1. **Configure the application**
   Modify the configuration file `./config.json`
   Configuration includes: database settings, API configuration, file upload settings, and logging configuration.
   For detailed configuration instructions, please refer to [Configuration File Documentation](./Documents/config.json.md)

2. **Install and setup database**
   This project uses PostgreSQL for development. Other databases have not been tested yet.

```bash
npm run init-db
# After installation, a super administrator 'admin' will be initialized
# Please delete the super administrator after initialization

# Development testing: Initialize database structure and mock data
# Note: This will clear existing data
npm run init-db-with-mock
```

### Post-Startup Debugging

```bash
# Check API service health status
curl -s http://localhost:3000/api/v1/health
```

### API Documentation
- **Web API Documentation**  
  http://localhost:3000/swagger

- **OpenAPI Specification**  
  http://localhost:3000/swagger.json | [swagger.json source](./swagger.json)

### Logging System Documentation
This project is configured with a comprehensive logging system. [Detailed documentation](./Documents/日志使用说明.md)

### Database Table Maintenance Operations
Database table maintenance operations include VACUUM, ANALYZE, and REINDEX operations. These are used to clean up dead tuples, update statistics, and rebuild indexes to ensure optimal database performance.

Execute maintenance operations using the following commands:

```bash
# Execute all maintenance operations (VACUUM, ANALYZE, REINDEX)
yarn db:maintenance:all

# Execute VACUUM operation only
yarn db:vacuum

# Execute ANALYZE operation only
yarn db:analyze

# Execute REINDEX operation only
yarn db:reindex
```

