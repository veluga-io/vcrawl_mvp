import React, { useState } from 'react';
import '../index.css';

const SearchBar = ({ onAnalyze, isLoading }) => {
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
            </form>
        </div>
    );
};

export default SearchBar;
