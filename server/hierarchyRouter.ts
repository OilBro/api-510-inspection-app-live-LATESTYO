/**
 * Component Hierarchy Router
 * Phase 5: Component hierarchy with parent-child relationships and life-limiting analysis
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { componentCalculations, inspections, professionalReports } from "../drizzle/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { logger } from "./_core/logger";

// Types for hierarchy
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

interface HierarchyStats {
  totalComponents: number;
  shellCount: number;
  headCount: number;
  nozzleCount: number;
  lifeLimitingComponent: string;
  minRemainingLife: number;
}

export const hierarchyRouter = router({
  /**
   * Get component tree structure for an inspection
   */
  getComponentTree: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const calcs = await db
        .select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, input.reportId));
      
      // Build tree structure
      const nodeMap = new Map<string, ComponentNode>();
      const rootNodes: ComponentNode[] = [];
      
      // First pass: create all nodes
      for (const calc of calcs) {
        const node: ComponentNode = {
          id: calc.id,
          componentName: calc.componentName || 'Unknown',
          componentType: calc.componentType || 'shell',
          parentId: calc.parentComponentId || null,
          actualThickness: parseFloat(calc.actualThickness || '0'),
          minimumThickness: parseFloat(calc.minimumThickness || '0'),
          remainingLife: parseFloat(calc.remainingLife || '999'),
          corrosionRate: parseFloat(calc.corrosionRate || '0'),
          dataQualityStatus: calc.dataQualityStatus || 'good',
          children: [],
        };
        nodeMap.set(calc.id, node);
      }
      
      // Second pass: build tree
      Array.from(nodeMap.values()).forEach(node => {
        if (node.parentId && nodeMap.has(node.parentId)) {
          nodeMap.get(node.parentId)!.children.push(node);
        } else {
          rootNodes.push(node);
        }
      });
      
      // Sort children by name
      const sortChildren = (nodes: ComponentNode[]) => {
        nodes.sort((a, b) => a.componentName.localeCompare(b.componentName));
        nodes.forEach(n => sortChildren(n.children));
      };
      sortChildren(rootNodes);
      
      return rootNodes;
    }),

  /**
   * Get life-limiting component for a report
   */
  getLifeLimitingComponent: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const calcs = await db
        .select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, input.reportId));
      
      if (calcs.length === 0) return null;
      
      // Find component with minimum remaining life
      let lifeLimiting = calcs[0];
      let minLife = parseFloat(calcs[0].remainingLife || '999');
      
      for (const calc of calcs) {
        const rl = parseFloat(calc.remainingLife || '999');
        if (rl < minLife) {
          minLife = rl;
          lifeLimiting = calc;
        }
      }
      
      return {
        id: lifeLimiting.id,
        componentName: lifeLimiting.componentName,
        componentType: lifeLimiting.componentType,
        remainingLife: minLife,
        actualThickness: parseFloat(lifeLimiting.actualThickness || '0'),
        minimumThickness: parseFloat(lifeLimiting.minimumThickness || '0'),
        corrosionRate: parseFloat(lifeLimiting.corrosionRate || '0'),
        dataQualityStatus: lifeLimiting.dataQualityStatus,
      };
    }),

  /**
   * Update component parent relationship
   */
  updateComponentParent: protectedProcedure
    .input(z.object({
      componentId: z.string(),
      parentId: z.string().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      await db
        .update(componentCalculations)
        .set({ parentComponentId: input.parentId })
        .where(eq(componentCalculations.id, input.componentId));
      
      logger.info(`[Hierarchy] Updated parent of ${input.componentId} to ${input.parentId}`);
      
      return { success: true };
    }),

  /**
   * Get hierarchy statistics for a report
   */
  getHierarchyStats: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const calcs = await db
        .select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, input.reportId));
      
      let shellCount = 0;
      let headCount = 0;
      let nozzleCount = 0;
      let minLife = 999;
      let lifeLimitingName = '';
      
      for (const calc of calcs) {
        const type = calc.componentType?.toLowerCase() || '';
        if (type.includes('shell')) shellCount++;
        else if (type.includes('head')) headCount++;
        else if (type.includes('nozzle')) nozzleCount++;
        
        const rl = parseFloat(calc.remainingLife || '999');
        if (rl < minLife) {
          minLife = rl;
          lifeLimitingName = calc.componentName || 'Unknown';
        }
      }
      
      const stats: HierarchyStats = {
        totalComponents: calcs.length,
        shellCount,
        headCount,
        nozzleCount,
        lifeLimitingComponent: lifeLimitingName,
        minRemainingLife: minLife,
      };
      
      return stats;
    }),

  /**
   * Get all children of a component recursively
   */
  getComponentChildren: protectedProcedure
    .input(z.object({ componentId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const getAllChildren = async (parentId: string): Promise<any[]> => {
        const children = await db
          .select()
          .from(componentCalculations)
          .where(eq(componentCalculations.parentComponentId, parentId));
        
        const result = [];
        for (const child of children) {
          const grandchildren = await getAllChildren(child.id);
          result.push({
            ...child,
            children: grandchildren,
          });
        }
        return result;
      };
      
      return getAllChildren(input.componentId);
    }),

  /**
   * Auto-assign hierarchy based on component names
   */
  autoAssignHierarchy: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const calcs = await db
        .select()
        .from(componentCalculations)
        .where(eq(componentCalculations.reportId, input.reportId));
      
      // Find main components (shell, heads)
      const shell = calcs.find(c => 
        c.componentType === 'shell' || 
        c.componentName?.toLowerCase().includes('shell')
      );
      
      const eastHead = calcs.find(c => 
        c.componentName?.toLowerCase().includes('east') ||
        c.componentName?.toLowerCase().includes('head 1')
      );
      
      const westHead = calcs.find(c => 
        c.componentName?.toLowerCase().includes('west') ||
        c.componentName?.toLowerCase().includes('head 2')
      );
      
      let assignedCount = 0;
      
      // Assign nozzles and CMLs to appropriate parents
      for (const calc of calcs) {
        if (calc.id === shell?.id || calc.id === eastHead?.id || calc.id === westHead?.id) {
          continue; // Skip main components
        }
        
        const name = calc.componentName?.toLowerCase() || '';
        let parentId: string | null = null;
        
        // Assign based on name patterns
        if (name.includes('nozzle') || name.includes('manway')) {
          parentId = shell?.id || null;
        } else if (name.includes('east') || name.includes('head 1')) {
          parentId = eastHead?.id || null;
        } else if (name.includes('west') || name.includes('head 2')) {
          parentId = westHead?.id || null;
        } else if (name.includes('cml') || name.includes('shell')) {
          parentId = shell?.id || null;
        }
        
        if (parentId && parentId !== calc.parentComponentId) {
          await db
            .update(componentCalculations)
            .set({ parentComponentId: parentId })
            .where(eq(componentCalculations.id, calc.id));
          assignedCount++;
        }
      }
      
      logger.info(`[Hierarchy] Auto-assigned ${assignedCount} components`);
      
      return { success: true, assignedCount };
    }),
});
