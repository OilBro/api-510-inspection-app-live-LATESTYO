import { calculateTRequiredShell } from '../server/lockedCalculationEngine';

async function testEngine() {
    const input = {
        insideDiameter: 95,
        designPressure: 150,
        designTemperature: 500,
        materialSpec: "SA-36",
        allowableStress: 20900,
        jointEfficiency: 0.85,
        nominalThickness: 0.5,
        currentThickness: 0.475,
        corrosionAllowance: 0.125,
        headType: '2:1 Ellipsoidal' as const,
        yearBuilt: undefined, // It was null in the DB
        currentYear: 2026,
        vesselOrientation: 'horizontal' as const,
    };

    try {
        const result = calculateTRequiredShell(input);
        console.log("Success:", JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error("Calculation crashed:", error.message);
    }
}

testEngine();
