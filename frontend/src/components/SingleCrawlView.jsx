import React, { useState } from 'react';
import SearchBar from './SearchBar';
import ResultViewer from './ResultViewer';
import LoadingSpinner from './LoadingSpinner';
import LLMAnalyzer from './LLMAnalyzer';

const SingleCrawlView = () => {
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
                setError(data.error_message || 'Failed to analyze the website');
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
                <h1 className="view-title">Single Target Crawl</h1>
                <p className="view-subtitle">
                    Test and verify Veluga scraping capabilities. View LLM-friendly Markdown and raw HTML instantly.
                </p>
            </header>

            <div className="view-content">
                <SearchBar onAnalyze={handleAnalyze} isLoading={isLoading} />

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {isLoading && <LoadingSpinner />}

                {result && <ResultViewer data={result} />}

                {result && (
                    <LLMAnalyzer crawlResult={result} />
                )}

                {!isLoading && !result && !error && (
                    <div className="empty-state">
                        <p>Enter a URL above to start analyzing</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SingleCrawlView;
