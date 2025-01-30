import { useEffect } from 'react';
import GPUStatus from './components/GPUStatus';
import './index.css';

function GPUCheck() {
  useEffect(() => {
    document.title = 'WebGPU Status Check';
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <GPUStatus />
    </div>
  );
}

export default GPUCheck;
