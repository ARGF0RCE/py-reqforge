# py-reqforge

A powerful, intelligent web application for managing Python project dependencies with advanced features like dependency resolution, hash management, and project templates.

![React](https://img.shields.io/badge/React-19+-61DAFB.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)
![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)

## 🚀 Overview

py-reqforge is a comprehensive tool designed to streamline Python dependency management. It goes beyond simple text editing by providing intelligent dependency resolution, hash management, project templates, and visual dependency tracking through a modern React frontend with a FastAPI backend.

## ✨ Key Features

### 📁 **File Management**

- **Upload existing requirements.txt** - Support for files with or without hashes, environment markers, and package extras
- **Smart parsing** - Handles various requirement formats, version specifiers, and platform-specific dependencies
- **Export functionality** - Generate properly formatted requirements.txt files with SHA256 hashes
- **Hash management** - Fetches and caches SHA256 hashes from PyPI for secure package verification

### 🔍 **Intelligent Package Management**

- **Package search** - Real-time search through PyPI packages with 3-second debouncing
- **Version selection** - Choose specific versions with dropdown menus
- **Dependency resolution** - Automatically resolves and categorizes main packages vs dependencies
- **Conflict detection** - Warns about version conflicts and breaking changes
- **Orphan cleanup** - Intelligent removal of unused dependencies when packages are removed
- **Extras support** - Handles packages with square bracket extras like `torch[gpu]`

### 🏗️ **Project Templates**

- **8+ Pre-built templates** for common project types:
  - **Web Development**: Django, Flask, FastAPI
  - **Data Science**: Pandas, NumPy, Jupyter, Scikit-learn
  - **Machine Learning**: TensorFlow, PyTorch
  - **Testing**: Pytest, Black, Flake8, Pre-commit
  - **Minimal**: Basic Python project setup
- **Template customization** - Modify templates before applying
- **One-click application** - Instantly apply complete project setups

### 🔐 **Advanced Security & Configuration**

- **Hash management** - SHA256 hash generation and validation from PyPI
- **Custom package indexes** - Support for private PyPI servers
- **Dependency tracking** - Visual indicators for main packages vs dependencies
- **Impact analysis** - Preview what breaks when removing packages
- **Cache management** - Force refresh cache button with rate limiting

### 📊 **Visual Interface**

- **Three-panel layout** - Optimized workflow design
- **Dependency tree visualization** - Understand package relationships
- **Real-time package information** - Detailed package metadata display
- **Warning system** - Clear alerts for potential issues
- **Progress indicators** - Loading states and operation feedback

## 🛠️ Technologies Used

### **Frontend Framework**

- **React 19+** - Modern React with Hooks for state management
- **TypeScript** - Type-safe development with modern TypeScript features
- **Vite.js** - Fast and lightweight build tool for React applications
- **Tailwind CSS v4** - Utility-first CSS framework for responsive design
- **Radix UI** - Accessible, unstyled UI components
- **Lucide React** - Beautiful, customizable SVG icons

### **Backend Framework**

- **FastAPI** - Modern, fast web framework for building APIs
- **Python 3.9+** - Asynchronous Python backend
- **Prisma ORM** - Type-safe database access and migrations
- **SQLite** - Lightweight database for caching PyPI data
- **Uvicorn** - Lightning-fast ASGI server

### **Package Management APIs**

- **PyPI JSON API** - Real-time package information retrieval
- **PyPI Simple API** - Package index browsing with PEP 691 JSON support
- **SHA256 Hash Retrieval** - Secure package verification
- **Custom Index Support** - Private package repository integration

### **File Processing**

- **FileReader API** - Client-side file upload and parsing
- **Blob API** - File generation and download functionality
- **Requirements.txt Parsing** - Intelligent parsing with environment markers and extras

### **State Management**

- **React Hooks** - useState, useEffect, useCallback for state management
- **Local State** - No external state management library required
- **Real-time Updates** - Immediate UI feedback for all operations

## 📦 Installation & Setup

### **Prerequisites**

- **Node.js 18+** and npm/yarn
- **Python 3.9+** with pip
- **Modern web browser** with ES2020+ support

### **Frontend Setup**

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### **Backend Setup**

```bash
# Navigate to API directory
cd api

# Create virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Generate Prisma client
prisma generate --schema=schema.prisma

# Setup database
prisma db push --schema=schema.prisma

# Start API server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### **Full Development Setup**

1. **Start the backend** (port 8000)
2. **Start the frontend** (port 5173)
3. **Access the application** at `http://localhost:5173`
4. **API documentation** available at `http://localhost:8000/docs`

## 🎯 Usage Guide

### **1. Upload Existing Requirements**

- Click the upload area or drag & drop your `requirements.txt` file
- The app automatically parses packages, versions, and hashes
- Existing hashes are preserved and displayed

### **2. Use Project Templates**

- Click "Browse Templates" to see available project setups
- Preview template contents before applying
- Templates include all necessary dependencies automatically

### **3. Add New Packages**

- Search for packages using the search bar
- Select package from search results to view detailed information
- Choose specific version from dropdown menu
- Click "Add Package" to include with dependencies

### **4. Manage Dependencies**

- View main packages vs. dependencies (marked in blue)
- Remove packages with automatic orphan cleanup
- Receive warnings about dependency conflicts
- Visual dependency overview panel

### **5. Configure Settings**

- Toggle hash inclusion for enhanced security
- Set custom package indexes for private repositories
- Export final requirements.txt with proper formatting

## 🔌 API Integration

### **PyPI Integration**

The app integrates with PyPI's JSON API for real-time package data:

```typescript
// Package search
GET /api/packages/search?q=numpy

// Package details with versions
GET /api/packages/numpy

// Dependency resolution
POST /api/packages/resolve-dependencies
{
  "packages": ["numpy==1.24.0", "pandas==2.0.0"],
  "index_url": "https://pypi.org/simple/",
  "python_version": "3.9"
}
```

### **Custom Index Support**

Configure custom package indexes for private repositories:

```
https://your-private-pypi.com/simple/
https://artifactory.company.com/pypi/
https://pypi.org/simple/
```

## 🏗️ Architecture

### **Component Structure**

```
frontend/
├── components/
│   ├── FileUpload/         # Requirements.txt upload handling
│   ├── ProjectTemplates/   # Pre-built project configurations
│   ├── PackageSearch/      # PyPI package search interface
│   ├── PackageManager/     # Add/remove package functionality
│   ├── DependencyTree/     # Visual dependency relationships
│   ├── SettingsPanel/      # Configuration options
│   ├── ExportManager/      # Requirements.txt generation
│   └── ui/                 # Radix UI components
└── api/
    ├── services/
    │   ├── package_service.py  # Core package operations
    │   ├── cache_service.py    # Prisma database caching
    │   └── pypi_client.py     # PyPI API integration
    ├── schema.prisma           # Database schema
    └── main.py                 # FastAPI application
```

### **State Management**

**Frontend State (React)**:

- **packages[]** - Current project packages with dependency flags
- **dependencyTree{}** - Package relationship mapping
- **packageInfo{}** - Selected package metadata
- **warnings[]** - Conflict and breaking change alerts
- **settings{}** - User preferences and configuration

**Backend State (FastAPI + Prisma)**:

- **Package cache** - PyPI package metadata with TTL
- **Version cache** - Package versions with SHA256 hashes
- **Dependency cache** - Resolved dependency trees
- **Search cache** - PyPI search results optimization

## 🎨 UI/UX Features

### **Responsive Design**

- Mobile-friendly three-panel layout
- Collapsible sections for smaller screens
- Touch-friendly controls and interactions

### **Accessibility**

- Semantic HTML structure
- Keyboard navigation support
- Screen reader compatible
- High contrast color scheme

### **User Experience**

- One-click operations for common tasks
- Real-time feedback and loading states
- Clear visual hierarchy and information grouping
- Contextual help and package information

## 🔒 Security Features

### **Hash Verification**

- SHA256 hash generation for package integrity
- Hash validation against PyPI checksums
- Support for custom hash algorithms

### **Safe Dependency Resolution**

- Conflict detection before package installation
- Breaking change warnings
- Rollback capabilities for operations

## 🚀 Future Enhancements

### **Planned Features**

- **PEP 508 Support** - Full dependency specification compliance with extras validation
- **Virtual environment integration** - Direct pip install capabilities
- **Git integration** - Commit changes to version control
- **Package vulnerability scanning** - Security audit integration
- **Batch operations** - Bulk package management
- **Export formats** - Support for Poetry, Pipenv, conda formats
- **Team collaboration** - Shared project configurations
- **History tracking** - Undo/redo operations
- **Package comparison** - Diff view for requirement changes

### **API Enhancements**

- **Enhanced caching strategies** - Smarter cache invalidation and refresh
- **Offline mode** - Local package database for offline usage
- **Custom metadata** - Add project-specific package annotations
- **Webhook support** - Real-time PyPI update notifications

## 📋 Requirements

### **Browser Compatibility**

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### **System Requirements**

- 2GB RAM minimum
- Modern multi-core processor
- Stable internet connection for package data

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Development Setup**

```bash
# Clone the repository
git clone https://github.com/ARGF0RCE/py-reqforge.git
cd py-reqforge

# Setup frontend
npm install
npm run dev  # Runs on port 5173

# Setup backend (in another terminal)
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
prisma generate --schema=schema.prisma
prisma db push --schema=schema.prisma
uvicorn main:app --reload --port 8000

# Run linting and type checking
npm run lint
npm run type-check
npm run format
```

## 📄 License

This project is licensed under the Apache 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **PyPI** - Python Package Index for package data
- **React Team** - For the amazing React framework
- **Tailwind CSS** - For the utility-first CSS framework
- **Lucide** - For the beautiful icon set
- **Python Community** - For inspiration and feedback

## 📞 Support

- **Documentation**: [Wiki](https://github.com/ARGF0RCE/py-reqforge/wiki)
- **Issues**: [GitHub Issues](https://github.com/ARGF0RCE/py-reqforge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ARGF0RCE/py-reqforge/discussions)
- **Repository**: [GitHub](https://github.com/ARGF0RCE/py-reqforge)

---

**Made with ❤️ for the Python community**
