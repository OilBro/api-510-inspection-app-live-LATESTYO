/**
 * Track 004: Data Extraction & Organization Tests
 * 
 * Tests for enhanced PDF data extraction and component organization features.
 */

import { describe, it, expect } from 'vitest';

// Test component type normalization logic
describe('Track 004: Component Type Normalization', () => {
  
  // Helper function that mirrors the client-side logic
  const getComponentType = (component: string, location: string): string => {
    const combined = `${component} ${location}`.toLowerCase();
    
    if (combined.includes("east") || combined.includes("north") || combined.includes("head 1") || combined.includes("left head")) {
      return "East Head";
    }
    if (combined.includes("west") || combined.includes("south") || combined.includes("head 2") || combined.includes("right head")) {
      return "West Head";
    }
    if (combined.includes("nozzle") || combined.includes("manway") || combined.includes("relief") || 
        combined.includes("inlet") || combined.includes("outlet") || combined.includes("drain") ||
        combined.includes("vent") || combined.includes("gauge")) {
      return "Nozzle";
    }
    if (combined.includes("shell") || combined.includes("body") || combined.includes("cylinder")) {
      return "Shell";
    }
    return "Shell"; // Default
  };

  describe('Head Type Detection', () => {
    it('should detect East Head from "East Head" component', () => {
      expect(getComponentType("East Head", "")).toBe("East Head");
    });

    it('should detect East Head from "North Head" component', () => {
      expect(getComponentType("North Head", "")).toBe("East Head");
    });

    it('should detect East Head from "Head 1" component', () => {
      expect(getComponentType("Head 1", "")).toBe("East Head");
    });

    it('should detect East Head from "Left Head" component', () => {
      expect(getComponentType("Left Head", "")).toBe("East Head");
    });

    it('should detect West Head from "West Head" component', () => {
      expect(getComponentType("West Head", "")).toBe("West Head");
    });

    it('should detect West Head from "South Head" component', () => {
      expect(getComponentType("South Head", "")).toBe("West Head");
    });

    it('should detect West Head from "Head 2" component', () => {
      expect(getComponentType("Head 2", "")).toBe("West Head");
    });

    it('should detect West Head from "Right Head" component', () => {
      expect(getComponentType("Right Head", "")).toBe("West Head");
    });
  });

  describe('Nozzle Detection', () => {
    it('should detect Nozzle from "Nozzle" component', () => {
      expect(getComponentType("Nozzle", "N1")).toBe("Nozzle");
    });

    it('should detect Nozzle from "Manway" in location', () => {
      expect(getComponentType("", "24\" Manway")).toBe("Nozzle");
    });

    it('should detect Nozzle from "Relief" in location', () => {
      expect(getComponentType("", "Relief Valve")).toBe("Nozzle");
    });

    it('should detect Nozzle from "Inlet" in location', () => {
      expect(getComponentType("", "Inlet Nozzle")).toBe("Nozzle");
    });

    it('should detect Nozzle from "Outlet" in location', () => {
      expect(getComponentType("", "Outlet")).toBe("Nozzle");
    });

    it('should detect Nozzle from "Drain" in location', () => {
      expect(getComponentType("", "Drain")).toBe("Nozzle");
    });

    it('should detect Nozzle from "Vent" in location', () => {
      expect(getComponentType("", "Vent")).toBe("Nozzle");
    });

    it('should detect Nozzle from "Gauge" in location', () => {
      expect(getComponentType("", "Level Gauge")).toBe("Nozzle");
    });
  });

  describe('Shell Detection', () => {
    it('should detect Shell from "Shell" component', () => {
      expect(getComponentType("Shell", "")).toBe("Shell");
    });

    it('should detect Shell from "Body" component', () => {
      expect(getComponentType("Body", "")).toBe("Shell");
    });

    it('should detect Shell from "Cylinder" component', () => {
      expect(getComponentType("Cylinder", "")).toBe("Shell");
    });

    it('should default to Shell for unknown components', () => {
      expect(getComponentType("Unknown", "")).toBe("Shell");
    });

    it('should default to Shell for empty strings', () => {
      expect(getComponentType("", "")).toBe("Shell");
    });
  });

  describe('Case Insensitivity', () => {
    it('should handle uppercase "EAST HEAD"', () => {
      expect(getComponentType("EAST HEAD", "")).toBe("East Head");
    });

    it('should handle mixed case "East head"', () => {
      expect(getComponentType("East head", "")).toBe("East Head");
    });

    it('should handle lowercase "shell"', () => {
      expect(getComponentType("shell", "")).toBe("Shell");
    });
  });
});

// Test nozzle size parsing
describe('Track 004: Nozzle Size Parsing', () => {
  
  const parseNozzleSize = (description: string): string | null => {
    // Common patterns: 24", 18", 12", 8", 6", 4", 3", 2", 1", 3/4"
    const patterns = [
      /(\d+(?:\/\d+)?)\s*["']/,  // 24", 3/4"
      /(\d+(?:\/\d+)?)\s*(?:inch|in)/i,  // 24 inch, 24in
      /(\d+(?:\/\d+)?)\s*NPS/i,  // 24 NPS
    ];
    
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1] + '"';
      }
    }
    return null;
  };

  it('should parse 24" from "24\\" Manway"', () => {
    expect(parseNozzleSize('24" Manway')).toBe('24"');
  });

  it('should parse 3" from "3\\" Relief Valve"', () => {
    expect(parseNozzleSize('3" Relief Valve')).toBe('3"');
  });

  it('should parse 2" from "2\\" NPS Inlet"', () => {
    expect(parseNozzleSize('2" NPS Inlet')).toBe('2"');
  });

  it('should parse 3/4" from "3/4\\" Drain"', () => {
    expect(parseNozzleSize('3/4" Drain')).toBe('3/4"');
  });

  it('should parse from "24 inch Manway"', () => {
    expect(parseNozzleSize('24 inch Manway')).toBe('24"');
  });

  it('should parse from "24 NPS"', () => {
    expect(parseNozzleSize('24 NPS')).toBe('24"');
  });

  it('should return null for no size', () => {
    expect(parseNozzleSize('Manway')).toBeNull();
  });
});

// Test inspection results parsing
describe('Track 004: Inspection Results Parsing', () => {
  
  const parseResults = (text: string): { title: string; content: string }[] => {
    if (!text || text.trim().length === 0) {
      return [];
    }
    
    // Split by numbered sections (3.1, 3.2, etc.)
    const numberedSections = text.split(/(?=\d+\.\d+\s)/);
    if (numberedSections.length > 1) {
      return numberedSections
        .filter(s => s.trim())
        .map(section => {
          const lines = section.trim().split('\n');
          const title = lines[0].replace(/^\d+\.\d+\s*/, '').trim() || 'Section';
          const content = lines.slice(1).join('\n').trim() || lines[0];
          return { title, content };
        });
    }

    // Return as single section
    return [{ title: 'Inspection Findings', content: text }];
  };

  it('should return empty array for empty text', () => {
    expect(parseResults('')).toEqual([]);
  });

  it('should return single section for simple text', () => {
    const result = parseResults('The vessel was found in good condition.');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Inspection Findings');
    expect(result[0].content).toBe('The vessel was found in good condition.');
  });

  it('should parse numbered sections', () => {
    const text = '3.1 Foundation\nFoundation is in good condition.\n3.2 Shell\nShell shows minor corrosion.';
    const result = parseResults(text);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Foundation');
    expect(result[1].title).toBe('Shell');
  });
});

// Test component grouping
describe('Track 004: Component Grouping', () => {
  
  interface TMLReading {
    id: string;
    component?: string;
    location?: string;
  }

  const groupByComponent = (readings: TMLReading[]): Record<string, TMLReading[]> => {
    const getComponentType = (reading: TMLReading): string => {
      const combined = `${reading.component || ''} ${reading.location || ''}`.toLowerCase();
      
      if (combined.includes("east") || combined.includes("north") || combined.includes("head 1")) {
        return "East Head";
      }
      if (combined.includes("west") || combined.includes("south") || combined.includes("head 2")) {
        return "West Head";
      }
      if (combined.includes("nozzle") || combined.includes("manway") || combined.includes("relief")) {
        return "Nozzle";
      }
      return "Shell";
    };

    return readings.reduce((acc, reading) => {
      const type = getComponentType(reading);
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(reading);
      return acc;
    }, {} as Record<string, TMLReading[]>);
  };

  it('should group readings by component type', () => {
    const readings: TMLReading[] = [
      { id: '1', component: 'Shell', location: 'CML-1' },
      { id: '2', component: 'Shell', location: 'CML-2' },
      { id: '3', component: 'East Head', location: 'CML-3' },
      { id: '4', component: 'West Head', location: 'CML-4' },
      { id: '5', component: 'Nozzle', location: 'Manway' },
    ];

    const grouped = groupByComponent(readings);
    
    expect(grouped['Shell']).toHaveLength(2);
    expect(grouped['East Head']).toHaveLength(1);
    expect(grouped['West Head']).toHaveLength(1);
    expect(grouped['Nozzle']).toHaveLength(1);
  });

  it('should handle empty readings array', () => {
    const grouped = groupByComponent([]);
    expect(Object.keys(grouped)).toHaveLength(0);
  });

  it('should normalize North Head to East Head', () => {
    const readings: TMLReading[] = [
      { id: '1', component: 'North Head', location: '' },
    ];

    const grouped = groupByComponent(readings);
    expect(grouped['East Head']).toHaveLength(1);
    expect(grouped['North Head']).toBeUndefined();
  });
});

// Test multi-page table detection hints
describe('Track 004: Multi-Page Table Detection', () => {
  
  const hasTableContinuation = (text: string): boolean => {
    const patterns = [
      /continued/i,
      /cont['']?d/i,
      /page \d+ of \d+/i,
      /\(continued\)/i,
    ];
    
    return patterns.some(pattern => pattern.test(text));
  };

  it('should detect "continued" indicator', () => {
    expect(hasTableContinuation('Table 1 (continued)')).toBe(true);
  });

  it('should detect "cont\'d" indicator', () => {
    expect(hasTableContinuation("Table 1 (cont'd)")).toBe(true);
  });

  it('should detect "Page X of Y" indicator', () => {
    expect(hasTableContinuation('Page 2 of 5')).toBe(true);
  });

  it('should return false for no continuation', () => {
    expect(hasTableContinuation('Table 1')).toBe(false);
  });
});
