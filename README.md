# Python Requirements Manager

A powerful, intelligent web application for managing Python project dependencies with advanced features like dependency resolution, hash management, and project templates.

![React](https://img.shields.io/badge/React-19+-61DAFB.svg)
![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)

## 🚀 Overview

Python Requirements Manager is a comprehensive tool designed to streamline Python dependency management. It goes beyond simple text editing by providing intelligent dependency resolution, hash management, project templates, and visual dependency tracking.

## ✨ Key Features

### 📁 **File Management**

- **Upload existing requirements.txt** - Support for files with or without hashes
- **Smart parsing** - Handles various requirement formats and version specifiers
- **Export functionality** - Generate properly formatted requirements.txt files
- **Hash preservation** - Maintains existing hashes and generates new ones when needed

### 🔍 **Intelligent Package Management**

- **Package search** - Real-time search through PyPI packages
- **Version selection** - Choose specific versions with dropdown menus
- **Dependency resolution** - Automatically resolves and adds required dependencies
- **Conflict detection** - Warns about version conflicts and breaking changes
- **Orphan cleanup** - Removes unused dependencies automatically

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

- **Hash management** - SHA256 hash generation and validation
- **Custom package indexes** - Support for private PyPI servers
- **Dependency tracking** - Visual indicators for main packages vs dependencies
- **Impact analysis** - Preview what breaks when removing packages

### 📊 **Visual Interface**

- **Three-panel layout** - Optimized workflow design
- **Dependency tree visualization** - Understand package relationships
- **Real-time package information** - Detailed package metadata display
- **Warning system** - Clear alerts for potential issues
- **Progress indicators** - Loading states and operation feedback

## 🛠️ Technologies Used

### **Frontend Framework**

- **React 19+** - Modern React with Hooks for state management
- **Lucide React** - Beautiful, customizable SVG icons
- **Vite.js** - Fast and lightweight build tool for React applications
- **Tailwind CSS** - Utility-first CSS framework for responsive design

### **Core Technologies**

- **TypeScript** - Modern TypeScript features
- **HTML5** - Semantic markup and file handling APIs
- **CSS3** - Advanced styling with Flexbox and Grid

### **Package Management APIs**

- **PyPI JSON API** - Real-time package information retrieval
- **Custom Index Support** - Private package repository integration
- **Hash Generation** - SHA256 cryptographic hash creation

### **File Processing**

- **FileReader API** - Client-side file upload and parsing
- **Blob API** - File generation and download functionality
- **Text Processing** - Requirements.txt parsing and generation

### **State Management**

- **React Hooks** - useState, useEffect, useCallback for state management
- **Local State** - No external state management library required
- **Real-time Updates** - Immediate UI feedback for all operations

## 📦 Installation & Setup

### **Prerequisites**

- Node.js 16+ and npm/yarn
- Modern web browser with ES2020+ support

### **Quick Start**

> **To be filled**

### **Build for Production**

> **To be filled**

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

> **To be filled with example API calls**

### **Custom Index Support**

Configure custom package indexes for private repositories:

```
https://your-private-pypi.com/simple/
https://artifactory.company.com/pypi/
```

## 🏗️ Architecture

### **Component Structure**

```
RequirementsManager/
├── FileUpload          # Requirements.txt upload handling
├── ProjectTemplates    # Pre-built project configurations
├── PackageSearch       # PyPI package search interface
├── PackageManager      # Add/remove package functionality
├── DependencyTree      # Visual dependency relationships
├── SettingsPanel       # Configuration options
└── ExportManager       # Requirements.txt generation
```

### **State Management**

- **packages[]** - Current project packages
- **dependencyTree{}** - Package relationship mapping
- **packageInfo{}** - Selected package metadata
- **warnings[]** - Conflict and breaking change alerts
- **settings{}** - User preferences and configuration

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

- **Virtual environment integration** - Direct pip install capabilities
- **Git integration** - Commit changes to version control
- **Package vulnerability scanning** - Security audit integration
- **Batch operations** - Bulk package management
- **Export formats** - Support for Poetry, Pipenv, conda formats
- **Team collaboration** - Shared project configurations
- **History tracking** - Undo/redo operations
- **Package comparison** - Diff view for requirement changes

### **API Enhancements**

- **Real PyPI API integration** - Replace mock data with live API calls
- **Caching layer** - Improve performance with intelligent caching
- **Offline mode** - Local package database for offline usage
- **Custom metadata** - Add project-specific package annotations

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

> **To be filled with setup instructions**

## 📄 License

This project is licensed under the Apache 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **PyPI** - Python Package Index for package data
- **React Team** - For the amazing React framework
- **Tailwind CSS** - For the utility-first CSS framework
- **Lucide** - For the beautiful icon set
- **Python Community** - For inspiration and feedback

## 📞 Support

- **Documentation**: [Wiki](https://github.com/your-username/python-requirements-manager/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-username/python-requirements-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/python-requirements-manager/discussions)
- **Email**: support@requirements-manager.com

---

**Made with ❤️ for the Python community**
