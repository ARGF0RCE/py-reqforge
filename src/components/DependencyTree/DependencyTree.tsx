import { useState, useMemo } from 'react';

interface Package {
  name: string;
  version: string;
  isDependency: boolean;
}

interface DependencyNode {
  name: string;
  version: string;
  dependencies: string[];
  level: number;
}

interface DependencyTreeProps {
  packages: Package[];
}

export default function DependencyTree({ packages }: DependencyTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const dependencyMap = useMemo(() => {
    const mockDependencies: Record<string, string[]> = {
      django: ['sqlparse', 'asgiref', 'pytz'],
      flask: ['werkzeug', 'jinja2', 'click', 'itsdangerous'],
      requests: ['urllib3', 'certifi', 'charset-normalizer', 'idna'],
      fastapi: ['pydantic', 'starlette', 'typing-extensions'],
      pandas: ['numpy', 'python-dateutil', 'pytz'],
      tensorflow: ['numpy', 'six', 'protobuf', 'h5py'],
      pytest: ['iniconfig', 'packaging', 'pluggy'],
      'scikit-learn': ['numpy', 'scipy', 'joblib', 'threadpoolctl'],
    };

    return mockDependencies;
  }, []);

  const dependencyTree = useMemo(() => {
    const mainPackages = packages.filter(pkg => !pkg.isDependency);
    const tree: DependencyNode[] = [];

    const buildTree = (
      packageName: string,
      level = 0,
      visited = new Set<string>()
    ): DependencyNode[] => {
      if (visited.has(packageName)) return [];
      visited.add(packageName);

      const pkg = packages.find(p => p.name === packageName);
      if (!pkg) return [];

      const dependencies = dependencyMap[packageName] || [];
      const node: DependencyNode = {
        name: packageName,
        version: pkg.version,
        dependencies,
        level,
      };

      const result = [node];

      dependencies.forEach(depName => {
        const depNodes = buildTree(depName, level + 1, new Set(visited));
        result.push(...depNodes);
      });

      return result;
    };

    mainPackages.forEach(pkg => {
      const nodes = buildTree(pkg.name);
      tree.push(...nodes);
    });

    return tree;
  }, [packages, dependencyMap]);

  const toggleNode = (nodeName: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeName)) {
      newExpanded.delete(nodeName);
    } else {
      newExpanded.add(nodeName);
    }
    setExpandedNodes(newExpanded);
  };

  const getNodeIcon = (node: DependencyNode) => {
    if (node.dependencies.length === 0) return '📄';
    return expandedNodes.has(node.name) ? '📂' : '📁';
  };

  const getIndentStyle = (level: number) => ({
    marginLeft: `${level * 20}px`,
  });

  const isNodeVisible = (node: DependencyNode) => {
    if (node.level === 0) return true;

    const parentNodes = dependencyTree.filter(
      n => n.level < node.level && n.dependencies.includes(node.name)
    );

    return parentNodes.some(parent => expandedNodes.has(parent.name));
  };

  const visibleNodes = dependencyTree.filter(isNodeVisible);

  return (
    <div className="bg-gradient-tree p-6 rounded-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Dependency Tree</h2>

      {packages.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🌳</div>
          <p className="text-blue-200">No dependencies to visualize</p>
          <p className="text-sm text-blue-300 mt-2">
            Add packages to see their dependency relationships
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {visibleNodes.map((node, index) => (
            <div
              key={`${node.name}-${index}`}
              style={getIndentStyle(node.level)}
              className={`flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer ${
                selectedNode === node.name
                  ? 'bg-blue-500/30'
                  : 'hover:bg-white/10'
              }`}
              onClick={() => {
                setSelectedNode(selectedNode === node.name ? null : node.name);
                if (node.dependencies.length > 0) {
                  toggleNode(node.name);
                }
              }}
            >
              <span className="text-lg">{getNodeIcon(node)}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{node.name}</span>
                  <span className="text-xs text-blue-300">v{node.version}</span>
                  {node.level === 0 && (
                    <span className="text-xs bg-green-500/30 text-green-200 px-2 py-1 rounded">
                      main
                    </span>
                  )}
                </div>
                {node.dependencies.length > 0 && (
                  <div className="text-xs text-blue-400">
                    {node.dependencies.length} dependencies
                  </div>
                )}
              </div>

              {node.dependencies.length > 0 && (
                <span className="text-blue-400 text-sm">
                  {expandedNodes.has(node.name) ? '▼' : '▶'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedNode && (
        <div className="mt-4 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
          <h3 className="text-lg font-medium text-white mb-2">
            {selectedNode}
          </h3>
          {(() => {
            const node = dependencyTree.find(n => n.name === selectedNode);
            const pkg = packages.find(p => p.name === selectedNode);
            return (
              <div className="text-sm text-blue-200">
                <p>
                  <strong>Version:</strong> {node?.version}
                </p>
                <p>
                  <strong>Type:</strong>{' '}
                  {pkg?.isDependency ? 'Dependency' : 'Main package'}
                </p>
                <p>
                  <strong>Level:</strong> {node?.level}
                </p>
                {node?.dependencies && node.dependencies.length > 0 && (
                  <div className="mt-2">
                    <strong>Dependencies:</strong>
                    <div className="ml-4 mt-1">
                      {node.dependencies.map(dep => (
                        <div key={dep} className="text-blue-300">
                          • {dep}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {packages.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="flex justify-between text-sm text-blue-300">
            <span>Total nodes: {dependencyTree.length}</span>
            <span>
              Expanded: {expandedNodes.size} | Selected:{' '}
              {selectedNode ? '1' : '0'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
