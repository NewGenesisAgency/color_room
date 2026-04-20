/**
 * CS160 .NET Bridge for Node.js
 * 
 * This module provides a Node.js interface to the Konica Minolta CS-160 SDK
 * via HTTP REST API.
 * 
 * API Documentation:
 * - POST /api/connect - Connect the colorimeter
 * - POST /api/disconnect - Disconnect the colorimeter
 * - POST /api/measure - Launch measurement (returns XYZ and Lv/x/y)
 * - GET /api/samples - Get stored sample data
 * - GET /api/health - Health check
 */

interface BridgeResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface MeasureResult {
  timestamp: string;
  xyz: {
    X: number;
    Y: number;
    Z: number;
  };
  lvxy: {
    Lv: number;
    x: number;
    y: number;
  };
}

class CS160Bridge {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.CS160_API_URL || 'http://localhost:3000';
  }

  /**
   * Connect the CS-160 colorimeter
   */
  async connect(): Promise<BridgeResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[CS160] Connected successfully:', data);
        return { success: true, data };
      } else {
        const error = await response.text();
        console.warn('[CS160] Connect failed:', error);
        return { success: false, error };
      }
    } catch (error: any) {
      console.warn('[CS160] Connect error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect the CS-160 colorimeter
   */
  async disconnect(): Promise<BridgeResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[CS160] Disconnected successfully:', data);
        return { success: true, data };
      } else {
        const error = await response.text();
        console.warn('[CS160] Disconnect failed:', error);
        return { success: false, error };
      }
    } catch (error: any) {
      console.warn('[CS160] Disconnect error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Launch a measurement and return XYZ and Lv/x/y values
   */
  async measure(): Promise<BridgeResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/measure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: MeasureResult = await response.json();
        console.log('[CS160] Measurement successful:', data);
        return { success: true, data };
      } else {
        const error = await response.text();
        console.warn('[CS160] Measure failed:', error);
        return { success: false, error };
      }
    } catch (error: any) {
      console.warn('[CS160] Measure error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get stored sample data
   */
  async getSamples(): Promise<BridgeResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/samples`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[CS160] Samples retrieved:', data);
        return { success: true, data };
      } else {
        const error = await response.text();
        console.warn('[CS160] Get samples failed:', error);
        return { success: false, error };
      }
    } catch (error: any) {
      console.warn('[CS160] Get samples error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Health check
   */
  async health(): Promise<BridgeResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[CS160] Health check:', data);
        return { success: true, data };
      } else {
        const error = await response.text();
        console.warn('[CS160] Health check failed:', error);
        return { success: false, error };
      }
    } catch (error: any) {
      console.warn('[CS160] Health check error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton
export const cs160Bridge = new CS160Bridge();
export default cs160Bridge;
