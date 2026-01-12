# Product Guidelines: API 510 Pressure Vessel Inspection Application

## Design Principles

### 1. Safety and Accuracy Above All

This is a safety-critical application used by professional inspectors to assess pressure vessel integrity. Every calculation, every data point, and every recommendation must be accurate and compliant with industry standards. When in doubt, prioritize accuracy over convenience, and compliance over features.

### 2. Professional and Trustworthy

The application must inspire confidence in professional inspectors and engineering firms. The interface should be clean, organized, and professional. Data should be presented clearly with appropriate precision. Reports must meet or exceed industry standards for format and content.

### 3. Minimize Manual Data Entry

Inspectors work in challenging field conditions. The application should minimize the need for manual typing through intelligent PDF import, field mapping, and data reuse. Every piece of information that can be automatically extracted, calculated, or inferred should be.

### 4. Validate Everything

Never trust user input or imported data without validation. Provide clear feedback when data is invalid, missing, or suspicious. Use data quality indicators to flag anomalies. Make it easy for users to review and correct issues.

### 5. Transparent Calculations

All calculations should be transparent and auditable. Show the formulas used, the input values, and the intermediate steps. Allow users to compare calculated values against original PDF data. Provide clear explanations for any discrepancies.

### 6. Progressive Disclosure

Present information in layers. Show the most important data first, with details available on demand. Use collapsible sections, tabs, and modals to organize complex information without overwhelming the user.

### 7. Responsive and Fast

The application should feel fast and responsive, even with large datasets. Use optimistic updates, caching, and background processing to maintain a smooth user experience. Provide loading indicators for operations that take time.

### 8. Mobile-Friendly

While the primary use case is desktop, inspectors may need to reference data on tablets in the field. The interface should be responsive and usable on smaller screens, with touch-friendly controls and appropriate font sizes.

## Brand Voice and Tone

### Professional but Approachable

The application serves professional inspectors and engineers, so the tone should be professional and technically accurate. However, it should also be approachable and helpful, not intimidating or overly formal.

**Good**: "The calculated minimum thickness is below the measured value, indicating adequate remaining life."

**Bad**: "Thickness OK."

**Bad**: "The aforementioned computational analysis of the vessel's structural integrity parameters indicates that the measured thickness value exceeds the minimum required thickness threshold as stipulated by the applicable regulatory framework."

### Clear and Concise

Use plain language whenever possible. Avoid jargon unless it's standard industry terminology. Be concise but not cryptic.

**Good**: "Upload an existing inspection report PDF to automatically extract vessel data and measurements."

**Bad**: "Import PDF."

**Bad**: "Utilize the document ingestion functionality to facilitate the automated extraction and population of vessel-related metadata and measurement data from pre-existing inspection documentation in Portable Document Format."

### Helpful and Supportive

When users encounter errors or issues, provide helpful guidance on how to resolve them. Don't just say what's wrong—explain how to fix it.

**Good**: "The design pressure must be greater than zero. Please enter a valid pressure value in PSI."

**Bad**: "Invalid input."

**Good**: "This PDF could not be parsed automatically. You can manually enter the vessel data or try uploading a different version of the report."

**Bad**: "Parsing failed."

### Confident but Humble

Express confidence in the application's capabilities while acknowledging limitations. When calculations or parsing results are uncertain, communicate that clearly.

**Good**: "The calculated corrosion rate is based on two inspection intervals. Additional data points will improve accuracy."

**Bad**: "Corrosion rate: 0.025 in/yr" (without context)

**Good**: "Some fields could not be automatically extracted from the PDF. Please review the unmatched data and manually assign fields as needed."

**Bad**: "PDF parsing complete." (when it's only partial)

## Visual Identity

### Color Palette

**Primary Colors**:
- **Blue (#3B82F6)**: Primary actions, links, and highlights
- **Dark Blue (#1E40AF)**: Headers and emphasis
- **Light Blue (#DBEAFE)**: Backgrounds and subtle highlights

**Secondary Colors**:
- **Gray (#6B7280)**: Body text and secondary information
- **Light Gray (#F3F4F6)**: Backgrounds and borders
- **Dark Gray (#1F2937)**: Headings and important text

**Status Colors**:
- **Green (#10B981)**: Success, passing tests, adequate thickness
- **Yellow (#F59E0B)**: Warnings, attention needed, approaching limits
- **Red (#EF4444)**: Errors, failures, below minimum thickness
- **Orange (#F97316)**: Anomalies, data quality issues

**Data Visualization**:
- Use consistent colors for corrosion rate trends (blue for long-term, orange for short-term)
- Use red for values below minimum, yellow for values approaching minimum, green for adequate
- Maintain sufficient contrast for accessibility

### Typography

**Primary Font**: Inter (system font stack)
- Clean, modern, and highly readable
- Excellent for UI elements and body text
- Good number rendering for technical data

**Monospace Font**: JetBrains Mono
- Use for code, formulas, and technical identifiers
- Clearly distinguishes technical content from prose

**Font Sizes**:
- **Headings**: 24px (h1), 20px (h2), 18px (h3)
- **Body Text**: 16px (default), 14px (secondary)
- **Small Text**: 12px (captions, footnotes)
- **Data Tables**: 14px (readable but compact)

**Font Weights**:
- **Regular (400)**: Body text
- **Medium (500)**: Emphasis, labels
- **Semibold (600)**: Headings, important data
- **Bold (700)**: Strong emphasis (use sparingly)

### Spacing and Layout

**Consistent Spacing**:
- Use Tailwind's spacing scale (4px increments)
- Standard padding: 16px (p-4) for cards and sections
- Standard margin: 16px (mb-4) between sections
- Larger spacing: 24px (p-6) for major sections

**Grid and Alignment**:
- Use CSS Grid for complex layouts
- Align related elements vertically and horizontally
- Maintain consistent margins and padding
- Use whitespace to separate distinct sections

**Responsive Breakpoints**:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Icons and Graphics

**Icon Library**: Lucide React
- Consistent style and weight
- Comprehensive coverage of needed icons
- Excellent accessibility

**Icon Usage**:
- Use icons to reinforce meaning, not replace text
- Maintain consistent size (16px or 20px typically)
- Provide alt text or aria-labels for accessibility
- Use color to indicate status (green checkmark, red X)

### UI Components

**Buttons**:
- **Primary**: Blue background, white text (main actions)
- **Secondary**: Gray background, dark text (secondary actions)
- **Destructive**: Red background, white text (delete, cancel)
- **Ghost**: Transparent background, blue text (tertiary actions)

**Forms**:
- Clear labels above or beside inputs
- Validation messages below inputs
- Required fields marked with asterisk (*)
- Disabled state clearly indicated

**Tables**:
- Alternating row colors for readability
- Sortable columns with clear indicators
- Sticky headers for long tables
- Responsive design (horizontal scroll or stacked on mobile)

**Cards**:
- Subtle shadow for depth
- Consistent padding (16px)
- Clear headers and sections
- Hover state for interactive cards

**Modals and Dialogs**:
- Semi-transparent backdrop
- Centered on screen
- Clear close button
- Keyboard accessible (ESC to close)

## Content Guidelines

### Terminology

Use consistent terminology throughout the application:

**Preferred Terms**:
- **Inspection** (not "report" or "assessment" when referring to the overall record)
- **Component** (not "part" or "element" for vessel sections)
- **TML** or **Thickness Measurement Location** (not "reading point" or "measurement point")
- **Corrosion Rate** (not "metal loss rate" or "thinning rate")
- **Remaining Life** (not "service life" or "useful life")
- **MAWP** (not "max pressure" or "working pressure")
- **Design Pressure** (not "rated pressure" or "operating pressure")

**Abbreviations**:
- Spell out on first use, then use abbreviation
- Example: "Maximum Allowable Working Pressure (MAWP)"
- Common abbreviations: API, ASME, TML, CML, MAWP, FFS

### Data Presentation

**Numbers and Units**:
- Always include units (PSI, inches, years, etc.)
- Use consistent precision (typically 3 decimal places for thickness, 2 for pressure)
- Format large numbers with commas (1,000 not 1000)
- Use scientific notation for very large or small numbers

**Dates and Times**:
- Use consistent format: MM/DD/YYYY or ISO 8601 (YYYY-MM-DD)
- Include time only when necessary
- Use relative dates when helpful ("2 days ago")

**Formulas**:
- Use standard mathematical notation
- Include variable definitions
- Reference ASME section numbers
- Example: `t_min = PR / (SE - 0.6P)` (ASME VIII-1, UG-27)

### Error Messages

**Structure**:
1. **What happened**: Clear description of the error
2. **Why it happened**: Brief explanation (if helpful)
3. **What to do**: Actionable steps to resolve

**Examples**:

**Good**: "The design pressure must be greater than zero. Please enter a valid pressure value in PSI."

**Bad**: "Invalid pressure."

**Good**: "This PDF could not be parsed because it appears to be a scanned image without text. Try uploading a text-based PDF or use manual data entry."

**Bad**: "PDF error."

### Success Messages

Keep success messages brief and positive:

**Good**: "Inspection created successfully."

**Good**: "PDF imported and 47 thickness readings extracted."

**Good**: "Report generated and ready for download."

## Accessibility

### WCAG 2.1 Level AA Compliance

The application should meet WCAG 2.1 Level AA standards:

**Color Contrast**:
- Text contrast ratio: at least 4.5:1 for normal text, 3:1 for large text
- Interactive elements: clear focus indicators
- Don't rely on color alone to convey information

**Keyboard Navigation**:
- All interactive elements accessible via keyboard
- Logical tab order
- Skip links for main content
- Keyboard shortcuts documented

**Screen Reader Support**:
- Semantic HTML elements
- ARIA labels for custom components
- Alt text for images
- Clear form labels

**Responsive Text**:
- Text can be resized up to 200% without loss of functionality
- No horizontal scrolling at standard zoom levels
- Readable font sizes (minimum 14px for body text)

## Performance Standards

### Loading Times
- Initial page load: < 3 seconds
- API response time: < 500ms for typical queries
- PDF generation: < 30 seconds for typical inspection
- PDF import: < 60 seconds for typical report

### Responsiveness
- UI interactions: < 100ms response time
- Optimistic updates for user actions
- Loading indicators for operations > 500ms
- Background processing for long operations

### Data Handling
- Support inspections with 1000+ TML readings
- Efficient pagination for large datasets
- Lazy loading for images and charts
- Caching for frequently accessed data

## Quality Assurance

### Testing Requirements
- Unit test coverage: >80% for calculation engines
- Integration tests for critical workflows
- Manual testing on Chrome, Firefox, Safari
- Mobile testing on iOS and Android tablets

### Code Quality
- TypeScript strict mode enabled
- ESLint and Prettier for code style
- No console errors or warnings in production
- Comprehensive error handling

### Data Quality
- Validation on all user inputs
- Anomaly detection for imported data
- Cross-validation of calculations
- Audit trail for all changes

## Compliance and Standards

### Industry Standards
- **API 510**: Pressure Vessel Inspection Code
- **ASME Section VIII Division 1**: Pressure Vessel Design and Construction
- **ASME B31.3**: Process Piping

### Regulatory Compliance
- Data privacy and protection
- Secure storage of inspection records
- Audit trail for compliance verification
- Export capabilities for regulatory reporting

### Professional Standards
- Reports suitable for Professional Engineer review and stamping
- Calculations traceable and auditable
- Documentation of assumptions and limitations
- Clear indication of uncertainty or missing data
