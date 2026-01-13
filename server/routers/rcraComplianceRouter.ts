import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";

// Standard RCRA checklist items per 40 CFR Part 265 Subpart J
const RCRA_CHECKLIST_ITEMS: Record<string, Array<{ code: string; description: string; reference: string }>> = {
  integrity_assessment: [
    { code: "IA-001", description: "Tank system designed and constructed to contain hazardous waste", reference: "40 CFR 265.191(a)" },
    { code: "IA-002", description: "Tank foundation provides adequate structural support", reference: "40 CFR 265.191(a)" },
    { code: "IA-003", description: "Tank compatible with waste to be stored/treated", reference: "40 CFR 265.191(b)" },
    { code: "IA-004", description: "Corrosion protection adequate for metal components", reference: "40 CFR 265.191(b)(3)" },
    { code: "IA-005", description: "PE-certified assessment current and on file", reference: "40 CFR 265.191(a)" },
    { code: "IA-006", description: "Leak test results documented (if required)", reference: "40 CFR 265.191(a)" },
  ],
  daily_visual: [
    { code: "DV-001", description: "Aboveground tank shell inspected for corrosion, erosion, or releases", reference: "40 CFR 265.195(a)" },
    { code: "DV-002", description: "Tank connections and seams inspected for leaks", reference: "40 CFR 265.195(a)" },
    { code: "DV-003", description: "Secondary containment inspected for accumulated liquids", reference: "40 CFR 265.195(a)" },
    { code: "DV-004", description: "Surrounding area inspected for signs of releases", reference: "40 CFR 265.195(a)" },
    { code: "DV-005", description: "Overfill/spill prevention equipment operational", reference: "40 CFR 265.195(a)" },
    { code: "DV-006", description: "Level indicators and gauges functioning properly", reference: "40 CFR 265.195(a)" },
  ],
  corrosion_protection: [
    { code: "CP-001", description: "Cathodic protection system operational (if installed)", reference: "40 CFR 265.191(b)(3)" },
    { code: "CP-002", description: "Sacrificial anodes in acceptable condition", reference: "40 CFR 265.191(b)(3)" },
    { code: "CP-003", description: "Impressed current rectifier operating within parameters", reference: "40 CFR 265.191(b)(3)" },
    { code: "CP-004", description: "Pipe-to-soil potential meets -0.85V minimum", reference: "NACE SP0169" },
    { code: "CP-005", description: "Protective coatings intact and undamaged", reference: "40 CFR 265.191(b)(3)" },
    { code: "CP-006", description: "Annual cathodic protection survey completed", reference: "40 CFR 265.195(b)" },
  ],
  secondary_containment: [
    { code: "SC-001", description: "Secondary containment capacity >= 100% of largest tank + precipitation", reference: "40 CFR 265.193(a)" },
    { code: "SC-002", description: "Containment base free of cracks and deterioration", reference: "40 CFR 265.193(b)" },
    { code: "SC-003", description: "Liner/coating intact and compatible with waste", reference: "40 CFR 265.193(b)" },
    { code: "SC-004", description: "Containment slopes toward leak detection point (min 2%)", reference: "40 CFR 265.193(c)" },
    { code: "SC-005", description: "Leak detection system operational (24-hour capability)", reference: "40 CFR 265.193(c)" },
    { code: "SC-006", description: "Accumulated liquids removed within 24 hours", reference: "40 CFR 265.193(c)(4)" },
    { code: "SC-007", description: "Penetrations through containment properly sealed", reference: "40 CFR 265.193(b)" },
  ],
  ancillary_equipment: [
    { code: "AE-001", description: "Aboveground piping inspected daily for leaks", reference: "40 CFR 265.193(f)(1)" },
    { code: "AE-002", description: "Welded pipe connections verified (if claiming exemption)", reference: "40 CFR 265.193(f)(2)" },
    { code: "AE-003", description: "Sealless pumps/valves verified (if claiming exemption)", reference: "40 CFR 265.193(f)(3)" },
    { code: "AE-004", description: "Automatic shutoff devices tested and operational", reference: "40 CFR 265.193(f)(4)" },
    { code: "AE-005", description: "Underground piping has secondary containment or monitoring", reference: "40 CFR 265.193(g)" },
    { code: "AE-006", description: "Flanged connections inspected for leaks", reference: "40 CFR 265.195(a)" },
  ],
  air_emission_controls: [
    { code: "AC-001", description: "Tank meets Level 1 or Level 2 control requirements", reference: "40 CFR 265.1085" },
    { code: "AC-002", description: "Fixed roof in good condition (no visible gaps/holes)", reference: "40 CFR 265.1085(c)" },
    { code: "AC-003", description: "Pressure relief devices operating properly", reference: "40 CFR 265.1085(c)(4)" },
    { code: "AC-004", description: "Internal floating roof in contact with liquid surface", reference: "40 CFR 265.1085(d)" },
    { code: "AC-005", description: "Vapor recovery/control system operational (if required)", reference: "40 CFR 265.1085(e)" },
    { code: "AC-006", description: "VOC monitoring records current", reference: "40 CFR 265.1090" },
  ],
  leak_detection: [
    { code: "LD-001", description: "Leak detection system capable of detecting release within 24 hours", reference: "40 CFR 265.193(c)(1)" },
    { code: "LD-002", description: "Visual inspection of sump/collection point performed", reference: "40 CFR 265.193(c)(2)" },
    { code: "LD-003", description: "Electronic leak detection sensors tested (if installed)", reference: "40 CFR 265.193(c)" },
    { code: "LD-004", description: "Interstitial monitoring for double-walled tanks operational", reference: "40 CFR 265.193(c)(3)" },
    { code: "LD-005", description: "Leak detection records maintained", reference: "40 CFR 265.196" },
  ],
  spill_overfill_prevention: [
    { code: "SP-001", description: "High level alarms tested and operational", reference: "40 CFR 265.194(a)" },
    { code: "SP-002", description: "Automatic feed cutoff devices functional", reference: "40 CFR 265.194(a)" },
    { code: "SP-003", description: "Bypass/overflow piping directs to containment", reference: "40 CFR 265.194(a)" },
    { code: "SP-004", description: "Transfer procedures documented and followed", reference: "40 CFR 265.194(b)" },
    { code: "SP-005", description: "Spill response equipment available and accessible", reference: "40 CFR 265.194" },
    { code: "SP-006", description: "Personnel trained on spill prevention procedures", reference: "40 CFR 265.16" },
  ],
};

export const rcraComplianceRouter = router({
  getFacilityStatus: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ input }) => {
      const result = await (await getDb())!.execute(
        sql`SELECT * FROM rcraFacilityStatus WHERE inspectionId = ${input.inspectionId} LIMIT 1`
      );
      return (result as any)[0]?.[0] || null;
    }),

  upsertFacilityStatus: protectedProcedure
    .input(z.object({
      inspectionId: z.string(),
      epaId: z.string().optional(),
      facilityName: z.string().optional(),
      interimStatus: z.enum(["active", "transitioning", "permitted", "closed"]).optional(),
      tankSystemType: z.enum(["existing", "new"]).optional(),
      tankMaterial: z.enum(["metal", "polyethylene", "fiberglass", "concrete", "other"]).optional(),
      tankCapacityGallons: z.number().optional(),
      wasteTypes: z.string().optional(),
      peCertificationDate: z.string().optional(),
      peCertificationExpiry: z.string().optional(),
      peEngineerName: z.string().optional(),
      peEngineerLicense: z.string().optional(),
      secondaryContainmentStatus: z.enum(["compliant", "exempt_daily_inspection", "upgrade_required", "non_compliant"]).optional(),
      airEmissionControlLevel: z.enum(["level_1", "level_2", "exempt"]).optional(),
      closureStatus: z.enum(["operational", "closure_planned", "clean_closure", "landfill_closure"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const existing = await (await getDb())!.execute(
        sql`SELECT id FROM rcraFacilityStatus WHERE inspectionId = ${input.inspectionId} LIMIT 1`
      );
      
      if ((existing as any)[0]?.length > 0) {
        await (await getDb())!.execute(sql`
          UPDATE rcraFacilityStatus SET
            epaId = ${input.epaId || null},
            facilityName = ${input.facilityName || null},
            interimStatus = ${input.interimStatus || "active"},
            tankSystemType = ${input.tankSystemType || "existing"},
            tankMaterial = ${input.tankMaterial || "metal"},
            tankCapacityGallons = ${input.tankCapacityGallons || null},
            wasteTypes = ${input.wasteTypes || null},
            secondaryContainmentStatus = ${input.secondaryContainmentStatus || "compliant"},
            airEmissionControlLevel = ${input.airEmissionControlLevel || "level_1"},
            closureStatus = ${input.closureStatus || "operational"},
            notes = ${input.notes || null}
          WHERE inspectionId = ${input.inspectionId}
        `);
        return { success: true, action: "updated" };
      } else {
        const id = nanoid();
        await (await getDb())!.execute(sql`
          INSERT INTO rcraFacilityStatus (id, inspectionId, epaId, facilityName, interimStatus, tankSystemType, tankMaterial, tankCapacityGallons, wasteTypes, secondaryContainmentStatus, airEmissionControlLevel, closureStatus, notes)
          VALUES (${id}, ${input.inspectionId}, ${input.epaId || null}, ${input.facilityName || null}, ${input.interimStatus || "active"}, ${input.tankSystemType || "existing"}, ${input.tankMaterial || "metal"}, ${input.tankCapacityGallons || null}, ${input.wasteTypes || null}, ${input.secondaryContainmentStatus || "compliant"}, ${input.airEmissionControlLevel || "level_1"}, ${input.closureStatus || "operational"}, ${input.notes || null})
        `);
        return { success: true, action: "created", id };
      }
    }),

  getChecklistItems: protectedProcedure
    .input(z.object({
      inspectionId: z.string(),
      category: z.enum(["integrity_assessment", "daily_visual", "corrosion_protection", "secondary_containment", "ancillary_equipment", "air_emission_controls", "leak_detection", "spill_overfill_prevention"]),
    }))
    .query(async ({ input }) => {
      const existing = await (await getDb())!.execute(
        sql`SELECT * FROM rcraChecklistItems WHERE inspectionId = ${input.inspectionId} AND category = ${input.category} ORDER BY itemCode`
      );
      
      if ((existing as any)[0]?.length > 0) {
        return (existing as any)[0];
      }
      
      const defaultItems = RCRA_CHECKLIST_ITEMS[input.category] || [];
      for (const item of defaultItems) {
        const id = nanoid();
        await (await getDb())!.execute(sql`
          INSERT INTO rcraChecklistItems (id, inspectionId, category, itemCode, itemDescription, regulatoryReference, status)
          VALUES (${id}, ${input.inspectionId}, ${input.category}, ${item.code}, ${item.description}, ${item.reference}, 'not_inspected')
        `);
      }
      
      const newItems = await (await getDb())!.execute(
        sql`SELECT * FROM rcraChecklistItems WHERE inspectionId = ${input.inspectionId} AND category = ${input.category} ORDER BY itemCode`
      );
      return (newItems as any)[0];
    }),

  updateChecklistItem: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(["satisfactory", "unsatisfactory", "na", "not_inspected"]).optional(),
      findings: z.string().optional(),
      correctiveActionRequired: z.boolean().optional(),
      correctiveActionDescription: z.string().optional(),
      correctiveActionDueDate: z.string().optional(),
      inspectorName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await (await getDb())!.execute(sql`
        UPDATE rcraChecklistItems SET
          status = COALESCE(${input.status}, status),
          findings = COALESCE(${input.findings}, findings),
          correctiveActionRequired = COALESCE(${input.correctiveActionRequired}, correctiveActionRequired),
          correctiveActionDescription = COALESCE(${input.correctiveActionDescription}, correctiveActionDescription),
          correctiveActionDueDate = ${input.correctiveActionDueDate ? new Date(input.correctiveActionDueDate) : null},
          inspectorName = COALESCE(${input.inspectorName}, inspectorName),
          inspectionDate = CURRENT_TIMESTAMP
        WHERE id = ${input.id}
      `);
      return { success: true };
    }),

  getComplianceSummary: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ input }) => {
      const categories = Object.keys(RCRA_CHECKLIST_ITEMS);
      const summary: Record<string, { total: number; satisfactory: number; unsatisfactory: number; na: number; notInspected: number }> = {};
      
      for (const category of categories) {
        const result = await (await getDb())!.execute(sql`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'satisfactory' THEN 1 ELSE 0 END) as satisfactory,
            SUM(CASE WHEN status = 'unsatisfactory' THEN 1 ELSE 0 END) as unsatisfactory,
            SUM(CASE WHEN status = 'na' THEN 1 ELSE 0 END) as na,
            SUM(CASE WHEN status = 'not_inspected' THEN 1 ELSE 0 END) as notInspected
          FROM rcraChecklistItems 
          WHERE inspectionId = ${input.inspectionId} AND category = ${category}
        `);
        
        const row = (result as any)[0]?.[0];
        summary[category] = {
          total: Number(row?.total || 0),
          satisfactory: Number(row?.satisfactory || 0),
          unsatisfactory: Number(row?.unsatisfactory || 0),
          na: Number(row?.na || 0),
          notInspected: Number(row?.notInspected || 0),
        };
      }
      
      return summary;
    }),

  getChecklistCategories: protectedProcedure
    .query(() => {
      return Object.entries(RCRA_CHECKLIST_ITEMS).map(([key, items]) => ({
        key,
        title: key.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        itemCount: items.length,
      }));
    }),

  calculateContainmentCompliance: protectedProcedure
    .input(z.object({
      capacityGallons: z.number(),
      largestTankGallons: z.number(),
      stormWaterCapacityGallons: z.number(),
    }))
    .query(({ input }) => {
      const requiredCapacity = input.largestTankGallons + input.stormWaterCapacityGallons;
      const isCompliant = input.capacityGallons >= requiredCapacity;
      return {
        requiredCapacity,
        actualCapacity: input.capacityGallons,
        isCompliant,
        deficit: isCompliant ? 0 : requiredCapacity - input.capacityGallons,
        surplus: isCompliant ? input.capacityGallons - requiredCapacity : 0,
        compliancePercent: (input.capacityGallons / requiredCapacity) * 100,
      };
    }),
});
