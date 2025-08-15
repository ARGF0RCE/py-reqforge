import { useState } from 'react';

interface Template {
  id: string;
  name: string;
  description: string;
  packages: string[];
  category: string;
}

interface ProjectTemplatesProps {
  onTemplateSelect: (packages: string[]) => void;
}

const templates: Template[] = [
  {
    id: 'web-django',
    name: 'Django Web App',
    description: 'Full-stack web application with Django framework',
    packages: [
      'Django>=4.2.0',
      'djangorestframework>=3.14.0',
      'django-cors-headers>=4.0.0',
    ],
    category: 'Web Development',
  },
  {
    id: 'web-flask',
    name: 'Flask API',
    description: 'Lightweight web API with Flask',
    packages: ['Flask>=2.3.0', 'Flask-RESTful>=0.3.10', 'Flask-CORS>=4.0.0'],
    category: 'Web Development',
  },
  {
    id: 'web-fastapi',
    name: 'FastAPI',
    description: 'Modern, fast web API framework',
    packages: ['fastapi>=0.100.0', 'uvicorn>=0.22.0', 'pydantic>=2.0.0'],
    category: 'Web Development',
  },
  {
    id: 'data-science',
    name: 'Data Science',
    description: 'Essential data science and analysis tools',
    packages: [
      'pandas>=2.0.0',
      'numpy>=1.24.0',
      'matplotlib>=3.7.0',
      'seaborn>=0.12.0',
    ],
    category: 'Data Science',
  },
  {
    id: 'ml-tensorflow',
    name: 'TensorFlow ML',
    description: 'Machine learning with TensorFlow',
    packages: [
      'tensorflow>=2.13.0',
      'scikit-learn>=1.3.0',
      'pandas>=2.0.0',
      'numpy>=1.24.0',
    ],
    category: 'Machine Learning',
  },
  {
    id: 'ml-pytorch',
    name: 'PyTorch ML',
    description: 'Machine learning with PyTorch',
    packages: [
      'torch>=2.0.0',
      'torchvision>=0.15.0',
      'scikit-learn>=1.3.0',
      'numpy>=1.24.0',
    ],
    category: 'Machine Learning',
  },
  {
    id: 'testing',
    name: 'Testing Suite',
    description: 'Comprehensive testing and code quality tools',
    packages: [
      'pytest>=7.4.0',
      'black>=23.0.0',
      'flake8>=6.0.0',
      'pre-commit>=3.3.0',
    ],
    category: 'Testing',
  },
  {
    id: 'minimal',
    name: 'Minimal Setup',
    description: 'Basic Python project with essential tools',
    packages: ['requests>=2.31.0', 'python-dotenv>=1.0.0'],
    category: 'Basic',
  },
];

export default function ProjectTemplates({
  onTemplateSelect,
}: ProjectTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );

  const categories = [
    'All',
    ...Array.from(new Set(templates.map(t => t.category))),
  ];

  const filteredTemplates =
    selectedCategory === 'All'
      ? templates
      : templates.filter(t => t.category === selectedCategory);

  const handleTemplateApply = (template: Template) => {
    onTemplateSelect(template.packages);
    setSelectedTemplate(null);
  };

  return (
    <div className="bg-gradient-templates p-6 rounded-lg">
      <h2 className="text-xl font-semibold text-white mb-4">
        Project Templates
      </h2>

      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 max-h-96 overflow-y-auto">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-white">{template.name}</h3>
              <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-1 rounded">
                {template.category}
              </span>
            </div>

            <p className="text-blue-200 text-sm mb-3">{template.description}</p>

            <div className="flex justify-between items-center">
              <span className="text-xs text-blue-300">
                {template.packages.length} packages
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTemplate(template)}
                  className="text-xs bg-blue-500/20 text-blue-200 px-3 py-1 rounded hover:bg-blue-500/30 transition-colors"
                >
                  Preview
                </button>
                <button
                  onClick={() => handleTemplateApply(template)}
                  className="text-xs bg-green-500/20 text-green-200 px-3 py-1 rounded hover:bg-green-500/30 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-primary p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">
              {selectedTemplate.name}
            </h3>
            <p className="text-blue-200 mb-4">{selectedTemplate.description}</p>

            <div className="mb-4">
              <h4 className="text-sm font-medium text-white mb-2">Packages:</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {selectedTemplate.packages.map((pkg, index) => (
                  <div
                    key={index}
                    className="text-sm text-blue-200 bg-white/10 px-2 py-1 rounded"
                  >
                    {pkg}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="px-4 py-2 bg-gray-500/20 text-gray-200 rounded hover:bg-gray-500/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleTemplateApply(selectedTemplate)}
                className="px-4 py-2 bg-green-500/20 text-green-200 rounded hover:bg-green-500/30 transition-colors"
              >
                Apply Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
