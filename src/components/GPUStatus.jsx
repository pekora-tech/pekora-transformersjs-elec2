import { useEffect, useState } from 'react';

const GPUStatus = () => {
  const [gpuInfo, setGpuInfo] = useState({
    webGPUSupported: false,
    adapterInfo: null,
    error: null
  });

  useEffect(() => {
    checkWebGPUSupport();
  }, []);

  const checkWebGPUSupport = async () => {
    try {
      if (!navigator.gpu) {
        setGpuInfo({
          webGPUSupported: false,
          error: 'WebGPU is not supported in this browser'
        });
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: 'high-performance'
        });
        
        if (!adapter) {
          setGpuInfo({
            webGPUSupported: false,
            error: 'No WebGPU adapter found'
          });
          return;
        }

        const info = await adapter.requestAdapterInfo();
        setGpuInfo({
          webGPUSupported: true,
          adapterInfo: {
            vendor: info.vendor,
            architecture: info.architecture,
            description: info.description
          },
          error: null
        });
      } catch (err) {
        setGpuInfo({
          webGPUSupported: false,
          error: `WebGPU adapter error: ${err.message}`
        });
      }
    } catch (err) {
      setGpuInfo({
        webGPUSupported: false,
        error: `WebGPU check error: ${err.message}`
      });
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">WebGPU Status</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">WebGPU Support</h2>
          <p className={`text-lg ${gpuInfo.webGPUSupported ? 'text-green-600' : 'text-red-600'}`}>
            {gpuInfo.webGPUSupported ? '✓ Supported' : '✗ Not Supported'}
          </p>
        </div>

        {gpuInfo.error && (
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p className="text-red-600">{gpuInfo.error}</p>
          </div>
        )}

        {gpuInfo.adapterInfo && (
          <div>
            <h2 className="text-xl font-semibold mb-2">GPU Information</h2>
            <div className="space-y-2">
              <p><strong>Vendor:</strong> {gpuInfo.adapterInfo.vendor}</p>
              <p><strong>Architecture:</strong> {gpuInfo.adapterInfo.architecture}</p>
              <p><strong>Description:</strong> {gpuInfo.adapterInfo.description}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GPUStatus;
