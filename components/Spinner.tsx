import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center p-8 min-h-[300px]">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
    </div>
  );
};

export default Spinner;
