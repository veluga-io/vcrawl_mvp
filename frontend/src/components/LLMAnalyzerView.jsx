import React, { useState, useEffect } from 'react';
import SearchBar from './SearchBar';
import LoadingSpinner from './LoadingSpinner';
import LLMAnalyzer from './LLMAnalyzer';

const LLMAnalyzerView = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleAnalyze = async (url) => {
        setIsLoading(true);
        setError(null);
        setResult(null);

        let urlToCrawl = url.trim();
        if (!/^https?:\/\//i.test(urlToCrawl)) {
            urlToCrawl = 'https://' + urlToCrawl;
        }

        try {
            const response = await fetch('/api/v1/crawl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: urlToCrawl
                }),
            });

            const data = await response.json();

            if (data.success) {
                setResult(data);
            } else {
                setError(data.error_message || 'Failed to crawl the website');
            }
        } catch (err) {
            setError('Network error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="view-container">
            <header className="view-header">
                <h1 className="view-title">Standalone LLM Analyzer</h1>
                <p className="view-subtitle">
                    Enter a URL to inject its content into the context, or directly select an LLM model, paste your text, and run custom RAG instructions.
                </p>
            </header>
            <div className="view-content padding-top-only">

                <SearchBar onAnalyze={handleAnalyze} isLoading={isLoading} />

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {isLoading && <LoadingSpinner />}

                {/* The LLMAnalyzer will receive the result and auto-populate itself */}
                <LLMAnalyzer crawlResult={result} initiallyOpen={true} />
            </div>
        </div>
    );
};

export default LLMAnalyzerView;
