import React from 'react';
import '../index.css';

const LoadingSpinner = () => {
    return (
        <div className="spinner-container">
            <div className="spinner"></div>
            <p className="spinner-text">Visiting website and analyzing content...</p>
        </div>
    );
};

export default LoadingSpinner;
