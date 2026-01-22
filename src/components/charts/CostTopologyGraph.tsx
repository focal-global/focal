'use client';

import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { formatCurrency } from '@/lib/currency';

// ============================================================================
// Types
// ============================================================================

export interface CostNode {
  id: string;
  name: string;
  type: 'provider' | 'service' | 'category' | 'resource' | 'tag';
  cost: number;
  children?: string[]; // IDs of child nodes
  metadata?: Record<string, unknown>;
}

export interface CostTopologyProps {
  nodes: CostNode[];
  currency?: string;
  height?: number;
  onNodeClick?: (node: CostNode) => void;
  colorScheme?: 'blue' | 'green' | 'purple';
}

// ============================================================================
// Custom Nodes
// ============================================================================

interface CustomNodeData {
  label: string;
  cost: number;
  currency: string;
  nodeType: CostNode['type'];
  percentage?: number;
  [key: string]: unknown; // Index signature for compatibility
}

// Type guard for node data
function isCustomNodeData(data: Record<string, unknown>): data is CustomNodeData {
  return (
    typeof data.label === 'string' &&
    typeof data.cost === 'number' &&
    typeof data.currency === 'string' &&
    typeof data.nodeType === 'string'
  );
}

const nodeTypeColors = {
  provider: {
    bg: 'bg-blue-900/50',
    border: 'border-blue-500',
    text: 'text-blue-200',
  },
  service: {
    bg: 'bg-purple-900/50',
    border: 'border-purple-500',
    text: 'text-purple-200',
  },
  category: {
    bg: 'bg-green-900/50',
    border: 'border-green-500',
    text: 'text-green-200',
  },
  resource: {
    bg: 'bg-orange-900/50',
    border: 'border-orange-500',
    text: 'text-orange-200',
  },
  tag: {
    bg: 'bg-pink-900/50',
    border: 'border-pink-500',
    text: 'text-pink-200',
  },
};

function CostNodeComponent({ data }: NodeProps) {
  if (!isCustomNodeData(data)) {
    return null;
  }
  
  const { label, cost, currency, nodeType, percentage } = data;
  const colors = nodeTypeColors[nodeType] || nodeTypeColors.resource;

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 ${colors.bg} ${colors.border} min-w-[160px] shadow-lg`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      
      <div className="space-y-1">
        <div className={`text-sm font-medium ${colors.text} truncate max-w-[200px]`} title={label}>
          {label}
        </div>
        <div className="text-white font-bold">
          {formatCurrency(cost, currency)}
        </div>
        {percentage !== undefined && (
          <div className="text-xs text-slate-400">
            {percentage.toFixed(1)}% of total
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
    </div>
  );
}

const nodeTypes = {
  costNode: CostNodeComponent,
};

// ============================================================================
// Layout Utilities
// ============================================================================

interface LayoutNode {
  id: string;
  type: CostNode['type'];
  depth: number;
  index: number;
  siblings: number;
}

/**
 * Build a hierarchical layout that properly positions children under their parents.
 * Uses a tree-based layout algorithm:
 * 1. Find root nodes (providers or nodes without parents)
 * 2. Recursively position children centered under each parent
 * 3. Sort by cost at each level for visual clarity
 */
function buildHierarchyLayout(
  nodes: CostNode[],
  currency: string,
  totalCost: number
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];
  
  if (nodes.length === 0) return { flowNodes, flowEdges };
  
  // Build lookup maps
  const nodeMap = new Map<string, CostNode>();
  const childToParent = new Map<string, string>();
  
  nodes.forEach(node => {
    nodeMap.set(node.id, node);
    node.children?.forEach(childId => {
      childToParent.set(childId, node.id);
    });
  });
  
  // Find root nodes (nodes without parents)
  const rootNodes = nodes.filter(n => !childToParent.has(n.id));
  
  // Sort roots by cost (highest first)
  rootNodes.sort((a, b) => b.cost - a.cost);
  
  // Layout configuration
  const nodeWidth = 180;
  const nodeHeight = 70;
  const horizontalGap = 40;
  const verticalGap = 100;
  
  // Track positions at each depth level
  const depthWidths: number[] = [];
  
  /**
   * Calculate the width needed for a subtree
   */
  function calculateSubtreeWidth(nodeId: string): number {
    const node = nodeMap.get(nodeId);
    if (!node) return nodeWidth;
    
    const children = node.children || [];
    if (children.length === 0) return nodeWidth;
    
    // Filter to only children that exist in our node set
    const validChildren = children.filter(id => nodeMap.has(id));
    if (validChildren.length === 0) return nodeWidth;
    
    // Sort children by cost
    validChildren.sort((a, b) => {
      const nodeA = nodeMap.get(a);
      const nodeB = nodeMap.get(b);
      return (nodeB?.cost || 0) - (nodeA?.cost || 0);
    });
    
    // Sum widths of all children plus gaps
    const childrenWidth = validChildren.reduce((sum, childId) => {
      return sum + calculateSubtreeWidth(childId);
    }, 0) + (validChildren.length - 1) * horizontalGap;
    
    return Math.max(nodeWidth, childrenWidth);
  }
  
  /**
   * Position a node and its children recursively
   */
  function positionNode(
    nodeId: string,
    depth: number,
    centerX: number
  ): void {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    
    const y = depth * (nodeHeight + verticalGap);
    
    // Add this node
    flowNodes.push({
      id: node.id,
      type: 'costNode',
      position: { x: centerX - nodeWidth / 2, y },
      data: {
        label: node.name,
        cost: node.cost,
        currency,
        nodeType: node.type,
        percentage: totalCost > 0 ? (node.cost / totalCost) * 100 : 0,
      },
    });
    
    // Get valid children and sort by cost
    const children = (node.children || []).filter(id => nodeMap.has(id));
    children.sort((a, b) => {
      const nodeA = nodeMap.get(a);
      const nodeB = nodeMap.get(b);
      return (nodeB?.cost || 0) - (nodeA?.cost || 0);
    });
    
    if (children.length === 0) return;
    
    // Calculate total width needed for children
    const childWidths = children.map(id => calculateSubtreeWidth(id));
    const totalChildWidth = childWidths.reduce((sum, w) => sum + w, 0) + 
                           (children.length - 1) * horizontalGap;
    
    // Position children centered under this node
    let currentX = centerX - totalChildWidth / 2;
    
    children.forEach((childId, index) => {
      const childWidth = childWidths[index];
      const childCenterX = currentX + childWidth / 2;
      
      // Add edge from parent to child
      flowEdges.push({
        id: `${node.id}-${childId}`,
        source: node.id,
        target: childId,
        animated: depth === 0,
        style: { 
          stroke: depth === 0 ? '#3b82f6' : '#475569', 
          strokeWidth: Math.max(1, 2 - depth * 0.5) 
        },
      });
      
      // Recursively position child
      positionNode(childId, depth + 1, childCenterX);
      
      currentX += childWidth + horizontalGap;
    });
  }
  
  // Calculate total width for all root nodes
  const rootWidths = rootNodes.map(n => calculateSubtreeWidth(n.id));
  const totalWidth = rootWidths.reduce((sum, w) => sum + w, 0) + 
                    (rootNodes.length - 1) * horizontalGap * 2;
  
  // Position all root nodes
  let currentX = -totalWidth / 2;
  rootNodes.forEach((node, index) => {
    const width = rootWidths[index];
    const centerX = currentX + width / 2;
    positionNode(node.id, 0, centerX);
    currentX += width + horizontalGap * 2;
  });
  
  return { flowNodes, flowEdges };
}

// ============================================================================
// Main Component
// ============================================================================

export function CostTopologyGraph({
  nodes: costNodes,
  currency,
  height = 500,
  onNodeClick,
}: CostTopologyProps) {
  // Currency should be passed from parent - no default to avoid hardcoding USD
  const displayCurrency = currency || 'USD';
  
  const totalCost = useMemo(
    () => costNodes.filter(n => n.type === 'provider').reduce((sum, n) => sum + n.cost, 0) ||
          costNodes.reduce((sum, n) => sum + n.cost, 0),
    [costNodes]
  );
  
  const { flowNodes, flowEdges } = useMemo(
    () => buildHierarchyLayout(costNodes, displayCurrency, totalCost),
    [costNodes, displayCurrency, totalCost]
  );
  
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);
  
  // CRITICAL: Update nodes and edges when the computed layout changes
  // useNodesState/useEdgesState don't automatically track changes to initial values
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);
  
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const costNode = costNodes.find(n => n.id === node.id);
      if (costNode && onNodeClick) {
        onNodeClick(costNode);
      }
    },
    [costNodes, onNodeClick]
  );

  if (costNodes.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-slate-900/50 rounded-lg border border-slate-800"
        style={{ height }}
      >
        <p className="text-slate-400">No topology data available</p>
      </div>
    );
  }

  return (
    <div style={{ height }} className="rounded-lg overflow-hidden border border-slate-800">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="bg-slate-950"
      >
        <Controls className="!bg-slate-800 !border-slate-700 [&_button]:!bg-slate-700 [&_button]:!border-slate-600 [&_button:hover]:!bg-slate-600" />
        <MiniMap 
          className="!bg-slate-800 !border-slate-700"
          nodeColor={() => '#64748b'}
          maskColor="rgba(0, 0, 0, 0.5)"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
      </ReactFlow>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Transform FOCUS query results into topology nodes
 */
export function transformToTopologyNodes(
  serviceData: Array<{ ServiceName: string; ServiceCategory?: string; BilledCost: number }>,
  providerName: string = 'Cloud'
): CostNode[] {
  const nodes: CostNode[] = [];
  
  // Group by category
  const categoryMap = new Map<string, { services: string[]; cost: number }>();
  
  serviceData.forEach(row => {
    const category = row.ServiceCategory || 'Other';
    const existing = categoryMap.get(category) || { services: [], cost: 0 };
    const serviceId = `service_${row.ServiceName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    existing.services.push(serviceId);
    existing.cost += row.BilledCost;
    categoryMap.set(category, existing);
  });
  
  // Create category nodes
  const categoryIds: string[] = [];
  categoryMap.forEach((data, categoryName) => {
    const categoryId = `category_${categoryName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    categoryIds.push(categoryId);
    nodes.push({
      id: categoryId,
      name: categoryName,
      type: 'category',
      cost: data.cost,
      children: data.services,
    });
  });
  
  // Create service nodes
  serviceData.forEach(row => {
    const serviceId = `service_${row.ServiceName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    nodes.push({
      id: serviceId,
      name: row.ServiceName,
      type: 'service',
      cost: row.BilledCost,
    });
  });
  
  // Create provider node
  const totalCost = serviceData.reduce((sum, row) => sum + row.BilledCost, 0);
  nodes.push({
    id: 'provider_cloud',
    name: providerName,
    type: 'provider',
    cost: totalCost,
    children: categoryIds,
  });
  
  return nodes;
}
