import { getDb } from '../server/db';
import * as schema from '../drizzle/schema';
import { tmlReadings, nozzleEvaluations, inspections } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';

async function update2025Data() {
  console.log('Starting 2025 UT data update for 54-11-001...');
  
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }
  
  // Find the inspection by vessel tag
  // Use the specific inspection ID we created
  const inspectionId = 'AeT7KIXu7Nx1pOv7TwpTj';
  const [inspection] = await db.select().from(inspections).where(eq(inspections.id, inspectionId)).limit(1);
  
   if (!inspection) {
    console.error('Inspection 54-11-001 not found!');
    process.exit(1);
  }
  
  console.log(`Found inspection: ${inspection.id}`);
  
  // 2025 UT Data - Shell readings (CML 8-24)
  const shellReadings2025 = [
    { cml: '8', location: '2" from SH Shell', readings: [0.801, 0.801, 0.802, 0.859, 0.801, 0.801, 0.803, 0.801] },
    { cml: '9', location: "2'", readings: [0.801, 0.8, 0.802, 0.861, 0.801, 0.801, 0.802, 0.801] },
    { cml: '10', location: "4'", readings: [0.801, 0.801, 0.802, 0.863, 0.801, 0.801, 0.802, 0.8] },
    { cml: '11', location: "6'", readings: [0.801, 0.801, 0.803, 0.857, 0.801, 0.8, 0.808, 0.801] },
    { cml: '12', location: "8'", readings: [0.802, 0.8, 0.802, 0.865, 0.801, 0.8, 0.802, 0.801] },
    { cml: '13', location: "10'", readings: [0.802, 0.8, 0.802, 0.872, 0.801, 0.801, 0.802, 0.801] },
    { cml: '14', location: "12'", readings: [0.801, 0.801, 0.802, 0.87, 0.801, 0.801, 0.802, 0.801] },
    { cml: '15', location: "14'", readings: [0.801, 0.8, 0.839, 0.864, 0.801, 0.8, 0.802, 0.801] },
    { cml: '16', location: "16'", readings: [0.801, 0.802, 0.802, 0.802, 0.801, 0.801, 0.807, 0.801] },
    { cml: '17', location: "18'", readings: [0.803, 0.801, 0.802, 0.802, 0.801, 0.801, 0.861, 0.801] },
    { cml: '18', location: "20'", readings: [0.801, 0.805, 0.802, 0.802, 0.8, 0.801, 0.864, 0.801] },
    { cml: '19', location: "22'", readings: [0.802, 0.801, 0.802, 0.801, 0.801, 0.801, 0.838, 0.803] },
    { cml: '20', location: "24'", readings: [0.801, 0.801, 0.802, 0.801, 0.801, 0.8, 0.801, 0.802] },
    { cml: '21', location: "26'", readings: [0.801, 0.804, 0.802, 0.802, 0.801, 0.801, 0.802, 0.801] },
    { cml: '22', location: "28'", readings: [0.801, 0.806, 0.808, 0.802, 0.801, 0.801, 0.802, 0.801] },
    { cml: '23', location: "30'", readings: [0.804, 0.801, 0.802, 0.802, 0.801, 0.802, 0.805, 0.801] },
    { cml: '24', location: '2" from NH Shell', readings: [null, 0.81, 0.804, 0.802, 0.802, 0.802, 0.802, 0.801] },
  ];
  
  // South Head readings (CML 1-5, 7)
  const southHeadReadings2025 = [
    { cml: '1', location: '12 O\'Clock', thickness: 0.488 },
    { cml: '2', location: '3 O\'Clock', thickness: 0.493 },
    { cml: '3', location: '6 O\'clock', thickness: 0.495 },
    { cml: '4', location: '9 O\'Clock', thickness: 0.501 },
    { cml: '5', location: 'South Head Center', thickness: 0.501 },
    { cml: '7', location: '2" from SH Head', thickness: 0.502 }, // Min of all readings: 0.502
  ];
  
  // North Head readings (CML 25-30)
  const northHeadReadings2025 = [
    { cml: '25', location: '2" from NH Head', thickness: 0.502 }, // Min of readings
    { cml: '26', location: '12 O\'Clock', thickness: 0.508 },
    { cml: '27', location: '3 O\'Clock', thickness: 0.506 },
    { cml: '28', location: '6 O\'clock', thickness: 0.517 },
    { cml: '29', location: '9 O\'Clock', thickness: 0.513 },
    { cml: '30', location: 'North Head Center', thickness: 0.502 },
  ];
  
  // Nozzle readings 2025
  const nozzleReadings2025 = [
    { nozzle: 'N1', description: 'Manway', size: '16', thickness: null, notes: 'No neck on Manway' },
    { nozzle: 'N2', description: 'Vapor Out', size: '2', thickness: 0.206 }, // Min of readings
    { nozzle: 'N3', description: 'Thermowall', size: '0.75', thickness: 0.801, notes: 'Blank Flange' },
    { nozzle: 'N4', description: 'Sight Gauge', size: '2.25', thickness: 0.13 }, // Min of readings
    { nozzle: 'N5', description: 'Liquid In', size: '3', thickness: 0.312, notes: 'Threaded Pipe' },
    { nozzle: 'N6', description: 'Liquid Out', size: '3', thickness: 0.188 },
    { nozzle: 'N7', description: 'Gauge', size: '1', thickness: 0.104 },
  ];
  
  const inspectionDate2025 = new Date('2025-11-04');
  
  // Get all existing TML readings for this inspection
  const existingTmls = await db.select().from(tmlReadings).where(eq(tmlReadings.inspectionId, inspection.id));
  
  console.log(`Found ${existingTmls.length} existing TML readings`);
  
  // Update shell readings - find by CML number pattern and update currentThickness
  let updatedCount = 0;
  
  // Update South Head readings
  for (const reading of southHeadReadings2025) {
    const existingTml = existingTmls.find(t => 
      t.cmlNumber?.includes(reading.cml) && 
      (t.component?.toLowerCase().includes('south') || t.componentType === 'head')
    );
    
    if (existingTml) {
      await db.update(tmlReadings)
        .set({ 
          currentThickness: reading.thickness,
          readingDate: inspectionDate2025
        })
        .where(eq(tmlReadings.id, existingTml.id));
      updatedCount++;
      console.log(`Updated South Head CML ${reading.cml}: ${reading.thickness}`);
    }
  }
  
  // Update North Head readings
  for (const reading of northHeadReadings2025) {
    const existingTml = existingTmls.find(t => 
      t.cmlNumber?.includes(reading.cml) && 
      (t.component?.toLowerCase().includes('north') || t.componentType === 'head')
    );
    
    if (existingTml) {
      await db.update(tmlReadings)
        .set({ 
          currentThickness: reading.thickness,
          readingDate: inspectionDate2025
        })
        .where(eq(tmlReadings.id, existingTml.id));
      updatedCount++;
      console.log(`Updated North Head CML ${reading.cml}: ${reading.thickness}`);
    }
  }
  
  // Update Shell readings - use minimum thickness from all angles
  for (const reading of shellReadings2025) {
    const validReadings = reading.readings.filter(r => r !== null) as number[];
    const minThickness = Math.min(...validReadings);
    
    // Find matching TML by CML number
    const existingTml = existingTmls.find(t => 
      t.cmlNumber?.includes(reading.cml) && 
      (t.component?.toLowerCase().includes('shell') || t.componentType === 'shell')
    );
    
    if (existingTml) {
      await db.update(tmlReadings)
        .set({ 
          currentThickness: minThickness,
          readingDate: inspectionDate2025
        })
        .where(eq(tmlReadings.id, existingTml.id));
      updatedCount++;
      console.log(`Updated Shell CML ${reading.cml}: ${minThickness}`);
    }
  }
  
  console.log(`Updated ${updatedCount} TML readings`);
  
  // Update nozzle evaluations
  const existingNozzles = await db.select().from(nozzleEvaluations).where(eq(nozzleEvaluations.inspectionId, inspection.id));
  
  console.log(`Found ${existingNozzles.length} existing nozzle evaluations`);
  
  let nozzleUpdatedCount = 0;
  for (const nozzle of nozzleReadings2025) {
    if (nozzle.thickness === null) continue;
    
    const existingNozzle = existingNozzles.find(n => 
      n.nozzleNumber === nozzle.nozzle || 
      n.description?.toLowerCase().includes(nozzle.description.toLowerCase())
    );
    
    if (existingNozzle) {
      await db.update(nozzleEvaluations)
        .set({ 
          actualThickness: nozzle.thickness,
          notes: nozzle.notes || existingNozzle.notes
        })
        .where(eq(nozzleEvaluations.id, existingNozzle.id));
      nozzleUpdatedCount++;
      console.log(`Updated Nozzle ${nozzle.nozzle} (${nozzle.description}): ${nozzle.thickness}`);
    }
  }
  
  console.log(`Updated ${nozzleUpdatedCount} nozzle evaluations`);
  
  // Update inspection date to 2025
  await db.update(inspections)
    .set({ 
      inspectionDate: inspectionDate2025,
      updatedAt: new Date()
    })
    .where(eq(inspections.id, inspection.id));
  
  console.log('Updated inspection date to 11/4/2025');
  console.log('2025 UT data update complete!');
  
  process.exit(0);
}

update2025Data().catch(console.error);
