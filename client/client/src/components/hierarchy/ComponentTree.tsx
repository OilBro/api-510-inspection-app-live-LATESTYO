/**
 * Component Tree Component
 * Phase 5: Collapsible component hierarchy with life-limiting indicators
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Circle, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ComponentNode {
  id: string;
  componentName: string;
  componentType: string;
  parentId: string | null;
  actualThickness: number;
  minimumThickness: number;
  remainingLife: number;
  corrosionRate: number;
  dataQualityStatus: string;
  children: ComponentNode[];
}

interface ComponentTreeProps {
  nodes: ComponentNode[];
  selectedId?: string;
  onSelect?: (node: ComponentNode) => void;
  lifeLimitingId?: string;
  className?: string;
}

export function ComponentTree({
  nodes,
  selectedId,
  onSelect,
  lifeLimitingId,
  className,
}: ComponentTreeProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
          lifeLimitingId={lifeLimitingId}
          level={0}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: ComponentNode;
  selectedId?: string;
  onSelect?: (node: ComponentNode) => void;
  lifeLimitingId?: string;
  level: number;
}

function TreeNode({ node, selectedId, onSelect, lifeLimitingId, level }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;
  const isLifeLimiting = lifeLimitingId === node.id;
  
  // Determine status color based on remaining life
  const getStatusColor = () => {
    if (node.remainingLife < 5) return "text-red-600";
    if (node.remainingLife < 10) return "text-yellow-600";
    return "text-green-600";
  };
  
  // Get status icon
  const StatusIcon = () => {
    if (node.dataQualityStatus === 'below_minimum') {
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    if (node.remainingLife < 5) {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  };
  
  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50",
          isLifeLimiting && "ring-2 ring-red-500 ring-offset-1"
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => onSelect?.(node)}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <Circle className="h-2 w-2 ml-1.5 mr-1.5 text-muted-foreground" />
        )}
        
        {/* Status icon */}
        <StatusIcon />
        
        {/* Component name */}
        <span className={cn("flex-1 text-sm font-medium", isSelected && "text-primary")}>
          {node.componentName}
        </span>
        
        {/* Badges */}
        <div className="flex items-center gap-1">
          {isLifeLimiting && (
            <Badge variant="destructive" className="text-xs">
              Life-Limiting
            </Badge>
          )}
          
          <Badge variant="outline" className={cn("text-xs", getStatusColor())}>
            {node.remainingLife > 50 ? '>50' : node.remainingLife.toFixed(1)} yr
          </Badge>
          
          <Badge variant="secondary" className="text-xs">
            {node.actualThickness.toFixed(3)}"
          </Badge>
        </div>
      </div>
      
      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              lifeLimitingId={lifeLimitingId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ComponentTree;
