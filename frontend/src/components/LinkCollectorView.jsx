import React, { useState } from 'react';
import SearchBar from './SearchBar';
import LoadingSpinner from './LoadingSpinner';
import LinkTreeView from './LinkTreeView';

const LinkCollectorView = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [selectedUrls, setSelectedUrls] = useState(new Set());

    const handleCollect = async (url) => {
        setIsLoading(true);
        setError(null);
        setResult(null);
        setSelectedUrls(new Set()); // Reset selections on new crawl

        let urlToCrawl = url.trim();
        if (!/^https?:\/\//i.test(urlToCrawl)) {
            urlToCrawl = 'https://' + urlToCrawl;
        }

        try {
            const response = await fetch('/api/v1/collect-links', {
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
                setError(data.error_message || 'Failed to collect links');
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
                <h1 className="view-title">Link Collector</h1>
                <p className="view-subtitle">
                    Extract all internal and external links from a target page. Filter, select, and prepare URLs for Batch Crawling.
                </p>
            </header>

            <div className="view-content padding-top-only">
                <SearchBar onAnalyze={handleCollect} isLoading={isLoading} />

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {isLoading && <LoadingSpinner />}

                {result && (
                    <LinkTreeView
                        data={result}
                        selectedUrls={selectedUrls}
                        setSelectedUrls={setSelectedUrls}
                    />
                )}

                {!isLoading && !result && !error && (
                    <div className="empty-state">
                        <p>Enter a URL above to start collecting links</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LinkCollectorView;
