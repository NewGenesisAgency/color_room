using System;
using System.Threading.Tasks;
using Konicaminolta;
using Newtonsoft.Json;

namespace ColorRoom.CS150Bridge
{
    /// <summary>
    /// Bridge between Node.js and Konica Minolta CS150 SDK
    /// This class is exposed to Node.js via Edge.js or similar interop
    /// </summary>
    public class CS150Bridge
    {
        private static LightColorMISDK _sdk;
        private static bool _isConnected = false;
        private static int _currentCalibCh = 0;

        public static async Task<object> Connect(dynamic input)
        {
            try
            {
                _sdk = LightColorMISDK.GetInstance();
                var ret = _sdk.Connect();
                
                if (ret.errorCode != ErrorDefine.KmSuccess)
                {
                    return new { success = false, error = $"Connect failed: {ret.errorCode}" };
                }

                _isConnected = true;
                return new { success = true, data = new { deviceInfo = "CS150-001" } };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.Message };
            }
        }

        public static async Task<object> Disconnect(dynamic input)
        {
            try
            {
                if (!_isConnected) return new { success = true };
                
                var ret = _sdk.DisConnect(0);
                _isConnected = false;
                _currentCalibCh = 0;
                
                return new { success = ret.errorCode == ErrorDefine.KmSuccess };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.Message };
            }
        }

        public static async Task<object> Measure(dynamic input)
        {
            try
            {
                if (!_isConnected) return new { success = false, error = "Not connected" };
                
                var ret = _sdk.Measure();
                return new { success = ret.errorCode == ErrorDefine.KmSuccess };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.Message };
            }
        }

        public static async Task<object> PollingMeasurement(dynamic input)
        {
            try
            {
                if (!_isConnected) return new { success = false, error = "Not connected" };
                
                MeasStatus state;
                ReturnMessage ret;
                
                do
                {
                    ret = _sdk.PollingMeasurement(out state);
                    if (ret.errorCode != ErrorDefine.KmSuccess)
                    {
                        return new { success = false, error = $"Polling failed: {ret.errorCode}" };
                    }
                    await Task.Delay(50); // Small delay between polls
                } while (state == MeasStatus.Measuring);

                return new { success = true, data = new { status = state.ToString().ToLower() } };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.Message };
            }
        }

        public static async Task<object> ReadXYZ(dynamic input)
        {
            try
            {
                if (!_isConnected) return new { success = false, error = "Not connected" };
                
                XYZ xyz = new XYZ();
                var ret = _sdk.ReadLatestData(xyz);
                
                if (ret.errorCode != ErrorDefine.KmSuccess)
                {
                    return new { success = false, error = $"Read failed: {ret.errorCode}" };
                }

                return new { 
                    success = true, 
                    data = new { X = xyz.X, Y = xyz.Y, Z = xyz.Z } 
                };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.Message };
            }
        }

        public static async Task<object> ReadLvxy(dynamic input)
        {
            try
            {
                if (!_isConnected) return new { success = false, error = "Not connected" };
                
                Lvxy lvxy = new Lvxy(LuminanceUnit.cdm2);
                var ret = _sdk.ReadLatestData(lvxy);
                
                if (ret.errorCode != ErrorDefine.KmSuccess)
                {
                    return new { success = false, error = $"Read failed: {ret.errorCode}" };
                }

                return new { 
                    success = true, 
                    data = new { Lv = lvxy.Lv, x = lvxy.x, y = lvxy.y } 
                };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.Message };
            }
        }

        public static async Task<object> SetBacklight(dynamic input)
        {
            try
            {
                if (!_isConnected) return new { success = false, error = "Not connected" };
                
                string mode = input.mode;
                BackLightMode backLightMode = mode == "on" ? BackLightMode.On : BackLightMode.Off;
                
                var ret = _sdk.SetBackLightOnOff(backLightMode);
                return new { success = ret.errorCode == ErrorDefine.KmSuccess };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.Message };
            }
        }

        public static async Task<object> SetCalibrationCh(dynamic input)
        {
            try
            {
                if (!_isConnected) return new { success = false, error = "Not connected" };
                
                int channel = input.channel;
                var ret = _sdk.SetCalibrationCh(channel);
                
                if (ret.errorCode == ErrorDefine.KmSuccess)
                {
                    _currentCalibCh = channel;
                }
                
                return new { success = ret.errorCode == ErrorDefine.KmSuccess };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.Message };
            }
        }

        public static async Task<object> SetMatrixCalib(dynamic input)
        {
            try
            {
                if (!_isConnected) return new { success = false, error = "Not connected" };
                
                int channel = input.channel;
                string type = input.type;
                string id = input.id;
                
                // Parse measurement values from JSON
                var measValues = JsonConvert.DeserializeObject<System.Collections.Generic.List<XYZ>>(
                    input.measValues.ToString());
                var trueValues = JsonConvert.DeserializeObject<System.Collections.Generic.List<XYZ>>(
                    input.trueValues.ToString());

                CalibType calibType = type == "RGB" ? CalibType.RGB : CalibType.OnePoint;
                
                var ret = _sdk.SetMatrixCalib(channel, measValues, trueValues, calibType, id);
                return new { success = ret.errorCode == ErrorDefine.KmSuccess };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.Message };
            }
        }

        public static async Task<object> GetCalibData(dynamic input)
        {
            try
            {
                if (!_isConnected) return new { success = false, error = "Not connected" };
                
                int channel = input.channel;
                
                System.Collections.Generic.List<MeasurementData> outputMeasValues;
                System.Collections.Generic.List<MeasurementData> outputTrueValues;
                UserCalibData calibCoefs;
                
                var ret = _sdk.GetCalibData(channel, out outputMeasValues, out outputTrueValues, out calibCoefs);
                
                if (ret.errorCode != ErrorDefine.KmSuccess)
                {
                    return new { success = false, error = $"GetCalibData failed: {ret.errorCode}" };
                }

                return new { 
                    success = true, 
                    data = new { 
                        measValues = outputMeasValues, 
                        trueValues = outputTrueValues,
                        calibCoefs = calibCoefs
                    } 
                };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.Message };
            }
        }

        public static async Task<object> SetMeasurementTime(dynamic input)
        {
            try
            {
                if (!_isConnected) return new { success = false, error = "Not connected" };
                
                // Note: The actual SDK might have a different method for this
                // This is a placeholder implementation
                return new { success = true };
            }
            catch (Exception ex)
            {
                return new { success = false, error = ex.Message };
            }
        }

        public static async Task<object> GetStatus(dynamic input)
        {
            return new { 
                success = true, 
                data = new { 
                    connected = _isConnected, 
                    calibChannel = _currentCalibCh,
                    deviceInfo = _isConnected ? "CS150-001" : null
                } 
            };
        }
    }
}
