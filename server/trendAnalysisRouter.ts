/**
 * Trend Analysis Router
 * Phase 4: Multi-inspection trend analysis with corrosion rate acceleration detection
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { inspections, componentCalculations, tmlReadings } from "../drizzle/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { logger } from "./_core/logger";

// Types for trend analysis
interface ThicknessDataPoint {
  inspectionId: string;
  inspectionDate: string;
  thickness: number;
  corrosionRate: number;
  remainingLife: number;
}

interface AccelerationMetrics {
  currentRate: number;
  previousRate: number;
  changePercent: number;
  severity: 'normal' | 'elevated' | 'critical';
  trend: 'stable' | 'accelerating' | 'decelerating';
}

interface TrendPrediction {
  yearsToMinimum: number;
  predictedThicknessIn5Years: number;
  predictedThicknessIn10Years: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export const trendAnalysisRouter = router({
  /**
   * Get all inspections for a vessel chronologically
   */
  getVesselInspectionHistory: protectedProcedure
    .input(z.object({ vesselTagNumber: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const history = await db
        .select({
          id: inspections.id,
          vesselTagNumber: inspections.vesselTagNumber,
          inspectionDate: inspections.inspectionDate,
          status: inspections.status,
        })
        .from(inspections)
        .where(eq(inspections.vesselTagNumber, input.vesselTagNumber))
        .orderBy(asc(inspections.inspectionDate));
      
      logger.info(`[TrendAnalysis] Found ${history.length} inspections for vessel ${input.vesselTagNumber}`);
      
      return history;
    }),

  /**
   * Get thickness trend data for a specific component across inspections
   */
  getComponentThicknessTrend: protectedProcedure
    .input(z.object({
      vesselTagNumber: z.string(),
      componentName: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      // Get all inspections for this vessel
      const vesselInspections = await db
        .select()
        .from(inspections)
        .where(eq(inspections.vesselTagNumber, input.vesselTagNumber))
        .orderBy(asc(inspections.inspectionDate));
      
      const dataPoints: ThicknessDataPoint[] = [];
      
      for (const inspection of vesselInspections) {
        // Get component calculation for this inspection
        const [calc] = await db
          .select()
          .from(componentCalculations)
          .where(and(
            sql`${componentCalculations.reportId} IN (SELECT id FROM professionalReports WHERE inspectionId = ${inspection.id})`,
            eq(componentCalculations.componentName, input.componentName)
          ))
          .limit(1);
        
        if (calc && calc.actualThickness) {
          dataPoints.push({
            inspectionId: inspection.id,
            inspectionDate: inspection.inspectionDate?.toISOString() || '',
            thickness: parseFloat(calc.actualThickness),
            corrosionRate: parseFloat(calc.corrosionRate || '0'),
            remainingLife: parseFloat(calc.remainingLife || '999'),
          });
        }
      }
      
      logger.info(`[TrendAnalysis] Found ${dataPoints.length} data points for ${input.componentName}`);
      
      return dataPoints;
    }),

  /**
   * Calculate corrosion rate acceleration between consecutive inspections
   */
  getCorrosionRateAcceleration: protectedProcedure
    .input(z.object({
      vesselTagNumber: z.string(),
      componentName: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      // Get all inspections for this vessel ordered by date
      const vesselInspections = await db
        .select()
        .from(inspections)
        .where(eq(inspections.vesselTagNumber, input.vesselTagNumber))
        .orderBy(asc(inspections.inspectionDate));
      
      const accelerationData: AccelerationMetrics[] = [];
      let previousRate: number | null = null;
      
      for (const inspection of vesselInspections) {
        const [calc] = await db
          .select()
          .from(componentCalculations)
          .where(and(
            sql`${componentCalculations.reportId} IN (SELECT id FROM professionalReports WHERE inspectionId = ${inspection.id})`,
            eq(componentCalculations.componentName, input.componentName)
          ))
          .limit(1);
        
        if (calc && calc.corrosionRate) {
          const currentRate = parseFloat(calc.corrosionRate);
          
          if (previousRate !== null && previousRate > 0) {
            const changePercent = ((currentRate - previousRate) / previousRate) * 100;
            
            let severity: 'normal' | 'elevated' | 'critical' = 'normal';
            let trend: 'stable' | 'accelerating' | 'decelerating' = 'stable';
            
            if (changePercent > 50) {
              severity = 'critical';
              trend = 'accelerating';
            } else if (changePercent > 20) {
              severity = 'elevated';
              trend = 'accelerating';
            } else if (changePercent < -20) {
              trend = 'decelerating';
            }
            
            accelerationData.push({
              currentRate,
              previousRate,
              changePercent,
              severity,
              trend,
            });
          }
          
          previousRate = currentRate;
        }
      }
      
      return accelerationData;
    }),

  /**
   * Get trend predictions for a component
   */
  getTrendPrediction: protectedProcedure
    .input(z.object({
      vesselTagNumber: z.string(),
      componentName: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      // Get latest inspection
      const [latestInspection] = await db
        .select()
        .from(inspections)
        .where(eq(inspections.vesselTagNumber, input.vesselTagNumber))
        .orderBy(desc(inspections.inspectionDate))
        .limit(1);
      
      if (!latestInspection) {
        return null;
      }
      
      // Get component calculation
      const [calc] = await db
        .select()
        .from(componentCalculations)
        .where(and(
          sql`${componentCalculations.reportId} IN (SELECT id FROM professionalReports WHERE inspectionId = ${latestInspection.id})`,
          eq(componentCalculations.componentName, input.componentName)
        ))
        .limit(1);
      
      if (!calc) {
        return null;
      }
      
      const currentThickness = parseFloat(calc.actualThickness || '0');
      const corrosionRate = parseFloat(calc.corrosionRate || '0');
      const minThickness = parseFloat(calc.minimumThickness || '0');
      
      // Calculate predictions
      const yearsToMinimum = corrosionRate > 0 
        ? (currentThickness - minThickness) / corrosionRate 
        : 999;
      
      const predictedThicknessIn5Years = currentThickness - (corrosionRate * 5);
      const predictedThicknessIn10Years = currentThickness - (corrosionRate * 10);
      
      // Determine confidence level based on data quality
      let confidenceLevel: 'high' | 'medium' | 'low' = 'medium';
      if (calc.dataQualityStatus === 'good' && corrosionRate > 0) {
        confidenceLevel = 'high';
      } else if (calc.dataQualityStatus === 'anomaly' || corrosionRate <= 0) {
        confidenceLevel = 'low';
      }
      
      const prediction: TrendPrediction = {
        yearsToMinimum: Math.max(0, yearsToMinimum),
        predictedThicknessIn5Years: Math.max(0, predictedThicknessIn5Years),
        predictedThicknessIn10Years: Math.max(0, predictedThicknessIn10Years),
        confidenceLevel,
      };
      
      return prediction;
    }),

  /**
   * Get trends for all components of a vessel
   */
  getMultiComponentTrends: protectedProcedure
    .input(z.object({ vesselTagNumber: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      // Get latest inspection
      const [latestInspection] = await db
        .select()
        .from(inspections)
        .where(eq(inspections.vesselTagNumber, input.vesselTagNumber))
        .orderBy(desc(inspections.inspectionDate))
        .limit(1);
      
      if (!latestInspection) {
        return [];
      }
      
      // Get all component calculations for latest inspection
      const calcs = await db
        .select()
        .from(componentCalculations)
        .where(
          sql`${componentCalculations.reportId} IN (SELECT id FROM professionalReports WHERE inspectionId = ${latestInspection.id})`
        );
      
      return calcs.map(calc => ({
        componentName: calc.componentName,
        componentType: calc.componentType,
        actualThickness: parseFloat(calc.actualThickness || '0'),
        minimumThickness: parseFloat(calc.minimumThickness || '0'),
        corrosionRate: parseFloat(calc.corrosionRate || '0'),
        remainingLife: parseFloat(calc.remainingLife || '999'),
        dataQualityStatus: calc.dataQualityStatus,
        governingRateType: calc.governingRateType,
      }));
    }),

  /**
   * Get life-limiting component for a vessel
   */
  getLifeLimitingComponent: protectedProcedure
    .input(z.object({ vesselTagNumber: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      // Get latest inspection
      const [latestInspection] = await db
        .select()
        .from(inspections)
        .where(eq(inspections.vesselTagNumber, input.vesselTagNumber))
        .orderBy(desc(inspections.inspectionDate))
        .limit(1);
      
      if (!latestInspection) {
        return null;
      }
      
      // Get all component calculations and find minimum remaining life
      const calcs = await db
        .select()
        .from(componentCalculations)
        .where(
          sql`${componentCalculations.reportId} IN (SELECT id FROM professionalReports WHERE inspectionId = ${latestInspection.id})`
        );
      
      if (calcs.length === 0) {
        return null;
      }
      
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
        componentName: lifeLimiting.componentName,
        componentType: lifeLimiting.componentType,
        remainingLife: minLife,
        actualThickness: parseFloat(lifeLimiting.actualThickness || '0'),
        minimumThickness: parseFloat(lifeLimiting.minimumThickness || '0'),
        corrosionRate: parseFloat(lifeLimiting.corrosionRate || '0'),
      };
    }),
});
