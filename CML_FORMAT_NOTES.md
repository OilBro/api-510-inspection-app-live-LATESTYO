# CML/TML Format Analysis from 54-11-067UTINFO2016.pdf

## Document Structure

### Page 1: Shell Layout (CML Layout Shell)
- Triangles numbered 6-17 represent CML locations along the shell
- Table shows readings at 8 angular positions: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
- Description column uses distance markers: "2' from East Head Seam - Head side", "2'", "4'", "6'", etc.
- Each row has 8 thickness readings for the circumferential positions

### Page 2: Head Layout (CML Layout East \ West Head)
- CML numbers 1-5 for East Head, 18-22 for West Head
- Simple single readings (no angular positions for heads)
- Descriptions use clock positions: "12 O'Clock", "3 O'Clock", "6 O'Clock", "9 O'Clock", "Center"

### Page 3: Nozzle Readings
- Nozzles N1-N12 with descriptions (Manway, Relief, Vapor Out, etc.)
- 4 angular positions: 0°, 90°, 180°, 270°
- Includes tmin* (minimum thickness) column

## CML Naming Convention Patterns

### Pattern 1: Simple CML Numbers
- Shell: 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17
- East Head: 1, 2, 3, 4, 5
- West Head: 18, 19, 20, 21, 22
- Nozzles: N1, N2, N3, etc.

### Pattern 2: CML with Angular Position (Slice-Angle Format)
For shell readings, each CML can have multiple readings at different angles:
- CML-0 (or CML-0°) = Top of vessel (0°)
- CML-45 = 45° clockwise from top
- CML-90 = Right side (90°)
- CML-135 = 135° clockwise
- CML-180 = Bottom (180°)
- CML-225 = 225° clockwise
- CML-270 = Left side (270°)
- CML-315 = 315° clockwise

Example: CML 10 with all positions would be:
- 10-0, 10-45, 10-90, 10-135, 10-180, 10-225, 10-270, 10-315

### Pattern 3: Nozzle Angular Positions
For nozzles, 4 positions are used:
- N1-0 (or N1-0°) = Top/North
- N1-90 = Right/East
- N1-180 = Bottom/South
- N1-270 = Left/West

## Data Structure Requirements

1. **TML/CML ID**: Can be simple number (1, 2, 3) or with angle suffix (1-0, 1-45, etc.)
2. **Component Type**: Shell, Head, Nozzle
3. **Location Description**: Distance from seam, clock position, or nozzle description
4. **Angular Position**: 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315° for shell; 0°, 90°, 180°, 270° for nozzles
5. **Thickness Reading**: Decimal value in inches

## Import Parsing Rules

1. When importing shell data with multiple columns (0°, 45°, 90°, etc.):
   - Create separate TML records for each angular position
   - Format as: {CML}-{angle} (e.g., "10-45", "10-90")

2. When importing head data:
   - Use simple CML number
   - Store clock position in description

3. When importing nozzle data:
   - Prefix with "N" (e.g., N1, N2)
   - Create separate records for each angular position
