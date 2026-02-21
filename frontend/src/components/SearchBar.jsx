import React, { useState } from 'react';
import '../index.css';

const SearchBar = ({ onAnalyze, isLoading, extraControls }) => {
    const [url, setUrl] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (url.trim()) {
            onAnalyze(url);
        }
    };

    return (
        <div className="search-container">
            <form onSubmit={handleSubmit} className="search-form">
                <div className="search-input-wrapper">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com"
                        required
                        disabled={isLoading}
                        className="search-input"
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`search-button ${isLoading ? 'loading' : ''}`}
                    >
                        {isLoading ? 'Analyzing...' : 'Analyze'}
                    </button>
                </div>
                {extraControls && (
                    <div className="search-extra-controls">
                        {extraControls}
                    </div>
                )}
            </form>
        </div>
    );
};

export default SearchBar;
