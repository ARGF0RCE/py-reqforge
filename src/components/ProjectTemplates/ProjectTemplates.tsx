import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Folder, Code, Eye, CheckCircle2 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  packages: string[];
  category: string;
}

interface ProjectTemplatesProps {
  onTemplateSelect: (packages: string[]) => void | Promise<void>;
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
  const [isApplying, setIsApplying] = useState<string | null>(null);

  const categories = [
    'All',
    ...Array.from(new Set(templates.map(t => t.category))),
  ];

  const filteredTemplates =
    selectedCategory === 'All'
      ? templates
      : templates.filter(t => t.category === selectedCategory);

  const handleTemplateApply = async (template: Template) => {
    if (isApplying === template.id) return; // Prevent duplicate calls

    setIsApplying(template.id);
    try {
      await onTemplateSelect(template.packages);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Failed to apply template:', error);
    } finally {
      setIsApplying(null);
    }
  };

  return (
    <Card className="w-full bg-zinc-900 border-zinc-800 h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-gray-100 text-lg font-bold">
          <Folder className="h-5 w-5" />
          Templates
        </CardTitle>
        <CardDescription className="text-gray-400 text-sm">
          Quick start with pre-configured packages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {categories.map(category => (
            <Button
              key={category}
              onClick={() => setSelectedCategory(category)}
              variant={selectedCategory === category ? 'default' : 'ghost'}
              size="sm"
              className={`w-full justify-start text-sm ${
                selectedCategory === category
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'text-gray-300 hover:bg-zinc-700 hover:text-gray-100'
              }`}
            >
              {category}
            </Button>
          ))}
        </div>

        <ScrollArea className="h-[600px] w-full rounded-md border border-zinc-700 p-2">
          <div className="space-y-3">
            {filteredTemplates.map(template => (
              <Card
                key={template.id}
                className="bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-700/50 transition-all duration-200"
              >
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div>
                      <h3 className="font-semibold text-gray-100 text-sm leading-tight">
                        {template.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className="border-zinc-600 text-zinc-400 text-xs mt-1"
                      >
                        {template.category}
                      </Badge>
                    </div>

                    <p className="text-gray-400 text-xs leading-relaxed">
                      {template.description}
                    </p>

                    <div className="flex justify-between items-center pt-1">
                      <div className="flex items-center gap-1">
                        <Code className="h-3 w-3 text-gray-500" />
                        <span className="text-xs text-gray-500 mono">
                          {template.packages.length} pkgs
                        </span>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          onClick={() => setSelectedTemplate(template)}
                          size="sm"
                          variant="outline"
                          className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white text-xs px-2 h-6"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={() => handleTemplateApply(template)}
                          size="sm"
                          disabled={isApplying === template.id}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 h-6 disabled:opacity-50"
                        >
                          {isApplying === template.id ? (
                            <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {selectedTemplate && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <Card className="bg-zinc-900 border-zinc-700 max-w-2xl w-full max-h-[90vh] overflow-hidden">
              <CardHeader>
                <CardTitle className="text-gray-100 text-lg font-bold mono">
                  {selectedTemplate.name}
                </CardTitle>
                <CardDescription className="text-gray-400 italic">
                  {selectedTemplate.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Packages ({selectedTemplate.packages.length}):
                  </h4>
                  <ScrollArea className="h-40 w-full rounded-md border border-zinc-700 p-3">
                    <div className="space-y-2">
                      {selectedTemplate.packages.map((pkg, index) => (
                        <div
                          key={index}
                          className="text-sm text-gray-300 bg-zinc-800 px-3 py-2 rounded mono border border-zinc-700"
                        >
                          {pkg}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex gap-3 justify-end">
                  <Button
                    onClick={() => setSelectedTemplate(null)}
                    variant="outline"
                    className="border-zinc-600 text-gray-300 hover:bg-zinc-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleTemplateApply(selectedTemplate)}
                    disabled={isApplying === selectedTemplate?.id}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
                  >
                    {isApplying === selectedTemplate?.id ? (
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border border-white border-t-transparent" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    {isApplying === selectedTemplate?.id
                      ? 'Applying...'
                      : 'Apply Template'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
