# Enterprise User Authorization Control (EUAC) - Frontend

A comprehensive frontend application for enterprise user authorization and access control management, built with React, Ant Design, and UmiJS.

## Features

### 🔐 Authentication & Authorization
- User login/logout functionality
- Password reset capabilities
- **Single Sign-On (SSO)** integration with IAM system
- Role-based access control (RBAC)
- Session management

### 👥 Member & Organization Management
- **Member Management**: User account administration and profile management
- **Organization Management**: Hierarchical organizational structure management
- **Role Management**: Role definition, assignment, and permission configuration

### 🛡️ Permission Management
- **Menu Permissions**: Navigation and menu access control
- **Button Permissions**: UI element-level access control
- **API Permissions**: Backend API endpoint access management

### 🔧 Service Provider Management
- Application registration and management
- Service provider configuration
- **SSO Configuration Management**: Configure SSO settings for service providers
- Integration management

### 👤 User Center
- Personal profile management
- Account settings
- Password management

## Project Structure

```
src/
├── pages/
│   ├── Auth/                 # Authentication pages
│   ├── MemberOrg/           # Member & Organization management
│   │   ├── Member/          # Member management
│   │   ├── Organization/    # Organization structure
│   │   └── Role/           # Role management
│   ├── Permissions/         # Permission management
│   │   ├── Menu/           # Menu permissions
│   │   ├── Button/         # Button permissions
│   │   └── API/            # API permissions
│   ├── ServiceProvider/    # Service provider management
│   └── account/            # User center
├── components/              # Reusable UI components
├── services/               # API service layer
├── layouts/                # Layout components
└── utils/                  # Utility functions
```

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm, yarn, or pnpm
- Git

### Quick Start

1. **Install dependencies**
```bash
npm install
# or
yarn install
# or
pnpm install
```

2. **Start development server**
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

### Directory Permissions

```bash
# Ensure current user has directory access permissions
# (Note: adjust the path to your actual installation directory)
sudo chown -R $USER ~/MOM/UAC-Admin
```

## Offline Installation

### External Network Setup
```bash
# Create and populate offline package directory
mkdir offline-packages
cd offline-packages

# Download all dependencies listed in package.json
npm pack $(cat ../package.json | jq -r '.dependencies | keys[]')

# Copy the following files to portable storage:
# - Project source code (including package.json and package-lock.json/yarn.lock)
# - Generated offline package files (.tgz or .tar.gz)
# - Offline dependency package directory (if manually downloaded)
```

### Internal Network Installation
```bash
# Option 1: Using npm offline packages
npm install --offline --production --no-audit

# Option 2: Using yarn offline cache
yarn install --production --offline
```

## Development

### API Generation

The project uses OpenAPI3 specification to generate API methods. Due to installation issues with Umi's built-in OpenAPI plugin, a custom solution is implemented.

- **Configuration file**: `./openapi2ts.config.ts`
- **Generation command**: `npm run openapi2ts`

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Generate API types from OpenAPI spec
npm run openapi2ts

# Run linting
npm run lint

# Run tests
npm run test

# Skip validation when committing to GitHub (if needed)
git commit --no-verify -m "routine update"
```

## Technology Stack

- **Framework**: UmiJS 4.x
- **UI Library**: Ant Design 5.x
- **Language**: TypeScript
- **State Management**: Built-in UmiJS state management
- **HTTP Client**: Axios
- **Build Tool**: Webpack (via UmiJS)
- **Package Manager**: npm/yarn/pnpm

## Routing Structure

The application uses a hierarchical routing structure:

- `/auth` - Authentication pages (login, password reset)
- `/member_org` - Member and organization management
- `/permissions` - Permission management system
- `/service_provider` - Service provider management
- `/account` - User center and profile management

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## SSO Integration

### Overview
The application supports Single Sign-On (SSO) integration with IAM systems. Users can authenticate through the centralized IAM system and access the application seamlessly.

### SSO Features
- **IAM Integration**: Seamless integration with enterprise IAM systems
- **Token Management**: Automatic handling of access tokens and refresh tokens
- **User Synchronization**: Real-time user information synchronization
- **Security**: Secure token transmission and validation
- **Callback Handling**: Robust SSO callback processing

### SSO Configuration
SSO can be configured through the application settings. The system supports:
- Custom redirect URIs
- Client ID and secret management
- Token validation and refresh
- User information mapping

### SSO Documentation
For detailed SSO implementation and callback interface documentation, see:
- [SSO Callback Interface Documentation](./SSO_CALLBACK.md)

## Support

For support and questions, please contact the development team or create an issue in the repository.
