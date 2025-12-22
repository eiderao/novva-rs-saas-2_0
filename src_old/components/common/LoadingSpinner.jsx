import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = () => {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
    );
};

export default LoadingSpinner;