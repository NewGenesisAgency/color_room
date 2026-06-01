/**
 * CS160 Colorimeter Service
 * 
 * This service provides a TypeScript interface to the Konica Minolta CS160
 * via the .NET SDK bridge or direct API calls.
 */

export interface XYZ {
  X: number;
  Y: number;
  Z: number;
}

export interface Lvxy {
  Lv: number;  // Luminance in cd/m²
  x: number;   // CIE x chromaticity
  y: number;   // CIE y chromaticity
}

export interface MeasurementData {
  colorSpace: string;
  values: Record<string, number>;
}

export interface CalibData {
  id: string;
  type: 'RGB' | 'OnePoint' | 'MultiPoint';
  channel: number;
  measValues: MeasurementData[];
  trueValues: MeasurementData[];
}

export interface CS160Status {
  connected: boolean;
  deviceInfo?: string;
  calibChannel: number;
  measurementTime?: number;
  backlightOn?: boolean;
}

export type MeasStatus = 'idle' | 'measuring' | 'completed' | 'error';
export type BackLightMode = 'on' | 'off';
export type CalibType = 'RGB' | 'OnePoint' | 'MultiPoint';

class CS160Service {
  private baseUrl = '/api/cs160';
  private _status: CS160Status = { connected: false, calibChannel: 0 };

  get status(): CS160Status {
    return { ...this._status };
  }

  /**
   * Connect to CS160 device
   */
  async connect(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' })
      });
      const data = await res.json();
      
      if (data.success) {
        this._status.connected = true;
        this._status.deviceInfo = data.data?.deviceInfo;
      }
      return data.success;
    } catch (error) {
      console.error('CS160 connect error:', error);
      return false;
    }
  }

  /**
   * Disconnect from CS160 device
   */
  async disconnect(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' })
      });
      const data = await res.json();
      
      if (data.success) {
        this._status = { connected: false, calibChannel: 0 };
      }
      return data.success;
    } catch (error) {
      console.error('CS160 disconnect error:', error);
      return false;
    }
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<CS160Status> {
    try {
      const res = await fetch(`${this.baseUrl}?action=status`);
      const data = await res.json();
      
      if (data.success) {
        this._status = { ...this._status, ...data.data };
      }
      return this._status;
    } catch (error) {
      console.error('CS160 status error:', error);
      return this._status;
    }
  }

  /**
   * Start a measurement
   */
  async measure(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'measure' })
      });
      const data = await res.json();
      return data.success;
    } catch (error) {
      console.error('CS160 measure error:', error);
      return false;
    }
  }

  /**
   * Poll measurement status until complete
   */
  async pollMeasurement(timeoutMs: number = 30000): Promise<MeasStatus> {
    const start = Date.now();
    
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(`${this.baseUrl}?action=polling`);
        const data = await res.json();
        
        if (!data.success) return 'error';
        
        const status = data.data?.status;
        if (status === 'completed') return 'completed';
        if (status === 'error') return 'error';
        
        // Wait 100ms before next poll
        await new Promise(r => setTimeout(r, 100));
      } catch (error) {
        return 'error';
      }
    }
    
    return 'error';
  }

  /**
   * Read measurement as XYZ values
   */
  async readXYZ(): Promise<XYZ | null> {
    try {
      const res = await fetch(`${this.baseUrl}?action=readXYZ`);
      const data = await res.json();
      
      if (data.success) {
        return {
          X: data.data.X,
          Y: data.data.Y,
          Z: data.data.Z
        };
      }
      return null;
    } catch (error) {
      console.error('CS160 readXYZ error:', error);
      return null;
    }
  }

  /**
   * Read measurement as Lv, x, y values
   */
  async readLvxy(): Promise<Lvxy | null> {
    try {
      const res = await fetch(`${this.baseUrl}?action=readLvxy`);
      const data = await res.json();
      
      if (data.success) {
        return {
          Lv: data.data.Lv,
          x: data.data.x,
          y: data.data.y
        };
      }
      return null;
    } catch (error) {
      console.error('CS160 readLvxy error:', error);
      return null;
    }
  }

  /**
   * One-shot measurement: measure + poll + read
   */
  async oneShotMeasurement(): Promise<{ xyz: XYZ | null; lvxy: Lvxy | null }> {
    if (!await this.measure()) {
      return { xyz: null, lvxy: null };
    }

    const status = await this.pollMeasurement();
    if (status !== 'completed') {
      return { xyz: null, lvxy: null };
    }

    const [xyz, lvxy] = await Promise.all([
      this.readXYZ(),
      this.readLvxy()
    ]);

    return { xyz, lvxy };
  }

  /**
   * Set backlight on/off
   */
  async setBacklight(mode: BackLightMode): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setBacklight', params: { mode } })
      });
      const data = await res.json();
      
      if (data.success) {
        this._status.backlightOn = mode === 'on';
      }
      return data.success;
    } catch (error) {
      console.error('CS160 setBacklight error:', error);
      return false;
    }
  }

  /**
   * Set calibration channel
   */
  async setCalibrationCh(channel: number): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setCalibCh', params: { channel } })
      });
      const data = await res.json();
      
      if (data.success) {
        this._status.calibChannel = channel;
      }
      return data.success;
    } catch (error) {
      console.error('CS160 setCalibrationCh error:', error);
      return false;
    }
  }

  /**
   * Set matrix calibration (RGB or Single Point)
   */
  async setMatrixCalib(
    channel: number,
    measValues: XYZ[] | Lvxy[],
    trueValues: XYZ[] | Lvxy[],
    type: CalibType,
    id: string
  ): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setMatrixCalib',
          params: { channel, measValues, trueValues, type, id }
        })
      });
      const data = await res.json();
      return data.success;
    } catch (error) {
      console.error('CS160 setMatrixCalib error:', error);
      return false;
    }
  }

  /**
   * Get calibration data
   */
  async getCalibData(channel: number): Promise<CalibData | null> {
    try {
      const res = await fetch(`${this.baseUrl}?action=getCalibData&channel=${channel}`);
      const data = await res.json();
      
      if (data.success) {
        return {
          id: '',
          type: 'RGB',
          channel,
          measValues: data.data.measValues || [],
          trueValues: data.data.trueValues || []
        };
      }
      return null;
    } catch (error) {
      console.error('CS160 getCalibData error:', error);
      return null;
    }
  }

  /**
   * RGB Calibration workflow: measures R, G, B + sets calibration
   */
  async performRGBCalibration(
    trueRed: XYZ,
    trueGreen: XYZ,
    trueBlue: XYZ,
    calibrationId: string = 'rgb_calib',
    targetChannel: number = 1
  ): Promise<boolean> {
    // Step 1: Set channel 0 for raw measurements
    if (!await this.setCalibrationCh(0)) return false;

    // Step 2: Measure Red
    let result = await this.oneShotMeasurement();
    if (!result.xyz) return false;
    const measRed = result.xyz;
    console.log('Measured Red:', measRed);

    // Step 3: Measure Green
    result = await this.oneShotMeasurement();
    if (!result.xyz) return false;
    const measGreen = result.xyz;
    console.log('Measured Green:', measGreen);

    // Step 4: Measure Blue
    result = await this.oneShotMeasurement();
    if (!result.xyz) return false;
    const measBlue = result.xyz;
    console.log('Measured Blue:', measBlue);

    // Step 5: Set matrix calibration
    const measValues = [measRed, measGreen, measBlue];
    const trueValues = [trueRed, trueGreen, trueBlue];
    
    if (!await this.setMatrixCalib(targetChannel, measValues, trueValues, 'RGB', calibrationId)) {
      return false;
    }

    // Step 6: Activate the new calibration channel
    return await this.setCalibrationCh(targetChannel);
  }

  /**
   * Single Point Calibration workflow
   */
  async performSinglePointCalibration(
    trueValue: Lvxy,
    calibrationId: string = 'single_point_calib',
    targetChannel: number = 1
  ): Promise<boolean> {
    // Step 1: Set channel 0 for raw measurement
    if (!await this.setCalibrationCh(0)) return false;

    // Step 2: Measure
    const result = await this.oneShotMeasurement();
    if (!result.lvxy) return false;
    const measValue = result.lvxy;
    console.log('Measured before calibration:', measValue);

    // Step 3: Set single point calibration
    if (!await this.setMatrixCalib(targetChannel, [measValue], [trueValue], 'OnePoint', calibrationId)) {
      return false;
    }

    // Step 4: Activate the new calibration channel
    if (!await this.setCalibrationCh(targetChannel)) return false;

    // Step 5: Verify with a new measurement
    const verifyResult = await this.oneShotMeasurement();
    console.log('Measured after calibration:', verifyResult.lvxy);
    
    return true;
  }
}

// Export singleton instance
export const cs160Service = new CS160Service();
export default cs160Service;
