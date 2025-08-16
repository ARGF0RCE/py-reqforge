import { useState, useMemo } from 'react';
import {
  DependencyResolution,
  DependencyTree as APITreeType,
} from '../../api/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitBranch,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';

interface Package {
  name: string;
  version: string;
  isDependency: boolean;
}

interface DependencyNode {
  name: string;
  version: string;
  dependencies: DependencyNode[];
  level: number;
}

interface DependencyTreeProps {
  packages: Package[];
  dependencyResolution: DependencyResolution | null;
}

export default function DependencyTree({
  packages,
  dependencyResolution,
}: DependencyTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const dependencyTree = useMemo(() => {
    if (!dependencyResolution) return [];

    const convertAPITreeToNodes = (
      apiTree: APITreeType[],
      level = 0
    ): DependencyNode[] => {
      return apiTree.map(tree => ({
        name: tree.name,
        version: tree.version,
        dependencies: convertAPITreeToNodes(tree.dependencies, level + 1),
        level,
      }));
    };

    return convertAPITreeToNodes(dependencyResolution.tree);
  }, [dependencyResolution]);

  const isLoading = false;

  const toggleNode = (nodeName: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeName)) {
      newExpanded.delete(nodeName);
    } else {
      newExpanded.add(nodeName);
    }
    setExpandedNodes(newExpanded);
  };

  const getIndentStyle = (level: number) => ({
    marginLeft: `${level * 20}px`,
  });

  const flattenTree = (
    nodes: DependencyNode[],
    parentExpanded = true
  ): DependencyNode[] => {
    const result: DependencyNode[] = [];

    for (const node of nodes) {
      if (parentExpanded) {
        result.push(node);

        if (expandedNodes.has(node.name)) {
          result.push(...flattenTree(node.dependencies, true));
        }
      }
    }

    return result;
  };

  const visibleNodes = flattenTree(dependencyTree);

  return (
    <div className="container">
      <Card className="w-full bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100 text-xl font-bold">
            <GitBranch className="h-6 w-6" />
            Dependency Tree
            {isLoading && (
              <Badge variant="secondary" className="bg-zinc-700 text-gray-300">
                Loading...
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-gray-400 text-base">
            Visualize package dependencies and their relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <div className="text-center py-8">
              <GitBranch className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No dependencies to visualize
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Add packages to see their dependency relationships
              </p>
            </div>
          ) : !dependencyResolution ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                No dependency resolution available
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[500px] w-full rounded-md border border-zinc-700 p-3">
              <div className="space-y-1">
                {visibleNodes.map((node, index) => (
                  <div
                    key={`${node.name}-${index}`}
                    style={getIndentStyle(node.level)}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                      selectedNode === node.name
                        ? 'bg-zinc-800 border border-zinc-600'
                        : 'hover:bg-zinc-800/50 border border-transparent'
                    }`}
                    onClick={() => {
                      setSelectedNode(
                        selectedNode === node.name ? null : node.name
                      );
                      if (node.dependencies.length > 0) {
                        toggleNode(node.name);
                      }
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-semibold text-gray-200 mono text-sm break-all"
                          title={node.name}
                        >
                          {node.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="border-zinc-600 text-zinc-300 font-mono text-xs shrink-0"
                        >
                          v{node.version}
                        </Badge>
                        {node.level === 0 && (
                          <Badge
                            variant="default"
                            className="bg-blue-600 text-white font-medium text-xs shrink-0"
                          >
                            main
                          </Badge>
                        )}
                      </div>
                      {node.dependencies.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {node.dependencies.length} dependencies
                        </div>
                      )}
                    </div>

                    {node.dependencies.length > 0 && (
                      <div className="text-gray-400">
                        {expandedNodes.has(node.name) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {selectedNode && (
            <>
              <Separator className="my-4" />
              <Card className="bg-zinc-800 border-zinc-700">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-gray-100 mono">
                    {selectedNode}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const findNodeInTree = (
                      nodes: DependencyNode[],
                      name: string
                    ): DependencyNode | null => {
                      for (const node of nodes) {
                        if (node.name === name) return node;
                        const found = findNodeInTree(node.dependencies, name);
                        if (found) return found;
                      }
                      return null;
                    };

                    const node = findNodeInTree(dependencyTree, selectedNode);
                    const pkg = packages.find(p => p.name === selectedNode);
                    return (
                      <div className="text-sm space-y-3 text-gray-300">
                        <div>
                          <span className="font-semibold text-gray-200">
                            Version:
                          </span>{' '}
                          <span className="mono text-blue-400">
                            {node?.version}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-200">
                            Type:
                          </span>{' '}
                          <span className="text-gray-300">
                            {pkg?.isDependency ? 'Dependency' : 'Main package'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-200">
                            Level:
                          </span>{' '}
                          <span className="text-gray-300">{node?.level}</span>
                        </div>
                        {node?.dependencies && node.dependencies.length > 0 && (
                          <div>
                            <span className="font-semibold text-gray-200">
                              Dependencies:
                            </span>
                            <div className="ml-4 mt-2 space-y-1">
                              {node.dependencies.map(dep => (
                                <div
                                  key={dep.name}
                                  className="mr-2 mb-1 bg-zinc-700 text-zinc-300 mono text-xs p-2 rounded border border-zinc-600 break-all"
                                  title={`${dep.name} v${dep.version}`}
                                >
                                  {dep.name} v{dep.version}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </>
          )}

          {packages.length > 0 && dependencyResolution && (
            <>
              <Separator className="my-4" />
              <div className="flex justify-between text-sm text-gray-500 font-mono">
                <span>
                  Total nodes:{' '}
                  <span className="text-blue-400">{visibleNodes.length}</span>
                </span>
                <span>
                  Expanded:{' '}
                  <span className="text-green-400">{expandedNodes.size}</span> |
                  Selected:{' '}
                  <span className="text-yellow-400">
                    {selectedNode ? '1' : '0'}
                  </span>
                </span>
              </div>
              {dependencyResolution?.warnings &&
                dependencyResolution.warnings.length > 0 && (
                  <Alert className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold mb-1 text-yellow-300">
                        Warnings:
                      </div>
                      {dependencyResolution.warnings.map((warning, index) => (
                        <div key={index} className="text-xs text-yellow-200">
                          • {warning}
                        </div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}
              {dependencyResolution?.resolution_time && (
                <div className="mt-2 text-xs text-gray-500 mono">
                  Resolution time:{' '}
                  <span className="text-blue-400">
                    {dependencyResolution.resolution_time.toFixed(2)}s
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
