// Utility functions for brand management and theming

export interface BrandingConfig {
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  primaryColor: "224 71% 60%", // Blue
  secondaryColor: "220 14% 96%", // Light gray
  accentColor: "142 76% 36%", // Green
};

/**
 * Converts hex color to HSL format
 */
export function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Converts HSL format to hex
 */
export function hslToHex(hsl: string): string {
  const [h, s, l] = hsl.split(' ').map((v, i) => 
    i === 0 ? parseInt(v) : parseInt(v.replace('%', ''))
  );
  
  const sNorm = s / 100;
  const lNorm = l / 100;
  
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Apply branding configuration to CSS variables
 */
export function applyBranding(branding: BrandingConfig): void {
  const root = document.documentElement;
  
  // Apply color variables
  root.style.setProperty('--primary', branding.primaryColor);
  root.style.setProperty('--secondary', branding.secondaryColor);
  root.style.setProperty('--accent', branding.accentColor);
  
  // Generate gradient from primary color
  const [h, s, l] = branding.primaryColor.split(' ').map((v, i) => 
    i === 0 ? parseInt(v) : parseInt(v.replace('%', ''))
  );
  const lighterL = Math.min(l + 10, 90);
  const gradientSecond = `${h} ${s}% ${lighterL}%`;
  
  root.style.setProperty('--gradient-primary', 
    `linear-gradient(135deg, hsl(${branding.primaryColor}), hsl(${gradientSecond}))`
  );
  
  // Update shadow colors to match primary
  root.style.setProperty('--shadow-primary', 
    `0 10px 30px -10px hsl(${branding.primaryColor} / 0.3)`
  );
}

/**
 * Generate and update favicon based on logo or organization initials
 */
export function updateFavicon(logoUrl?: string, orgName?: string): void {
  const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
  
  if (logoUrl) {
    // Use logo as favicon
    if (favicon) {
      favicon.href = logoUrl;
    } else {
      const newFavicon = document.createElement('link');
      newFavicon.rel = 'icon';
      newFavicon.href = logoUrl;
      newFavicon.type = 'image/png';
      document.head.appendChild(newFavicon);
    }
  } else if (orgName) {
    // Generate favicon from organization initials
    const initials = orgName
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Background
      ctx.fillStyle = `hsl(${document.documentElement.style.getPropertyValue('--primary') || '224 71% 60%'})`;
      ctx.fillRect(0, 0, 32, 32);
      
      // Text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, 16, 16);
      
      const dataUrl = canvas.toDataURL('image/png');
      
      if (favicon) {
        favicon.href = dataUrl;
      } else {
        const newFavicon = document.createElement('link');
        newFavicon.rel = 'icon';
        newFavicon.href = dataUrl;
        newFavicon.type = 'image/png';
        document.head.appendChild(newFavicon);
      }
    }
  }
}

/**
 * Load branding from localStorage
 */
export function loadBrandingFromStorage(): BrandingConfig | null {
  try {
    const stored = localStorage.getItem('organization-branding');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Save branding to localStorage
 */
export function saveBrandingToStorage(branding: BrandingConfig): void {
  localStorage.setItem('organization-branding', JSON.stringify(branding));
}

/**
 * Reset branding to default values
 */
export function resetBranding(): void {
  localStorage.removeItem('organization-branding');
  applyBranding(DEFAULT_BRANDING);
  updateFavicon(undefined, 'AI Portal');
}