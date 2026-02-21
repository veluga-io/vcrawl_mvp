import React, { useState, useRef, useEffect } from 'react';
import SearchBar from './SearchBar';
import LoadingSpinner from './LoadingSpinner';
import LinkTreeView from './LinkTreeView';

const LinkCollectorView = ({ onBatchCrawl }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [selectedUrls, setSelectedUrls] = useState(new Set());
    const [depth, setDepth] = useState(0);
    const [logs, setLogs] = useState([]);
    const [crawledUrl, setCrawledUrl] = useState('');

    const logEndRef = useRef(null);

    // Auto-scroll log panel to bottom when new logs arrive
    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const handleCollect = async (url) => {
        setIsLoading(true);
        setError(null);
        setResult(null);
        setSelectedUrls(new Set());
        setLogs([]);

        let urlToCrawl = url.trim();
        if (!/^https?:\/\//i.test(urlToCrawl)) {
            urlToCrawl = 'https://' + urlToCrawl;
        }
        setCrawledUrl(urlToCrawl);

        try {
            const response = await fetch('/api/v1/collect-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlToCrawl, depth, max_urls: 1400 }),
            });

            if (!response.ok || !response.body) {
                throw new Error(`Server error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop(); // keep incomplete last chunk

                for (const chunk of lines) {
                    const dataLine = chunk.split('\n').find(l => l.startsWith('data: '));
                    if (!dataLine) continue;
                    try {
                        const event = JSON.parse(dataLine.slice(6));
                        if (event.type === 'log') {
                            setLogs(prev => [...prev, event.message]);
                        } else if (event.type === 'done') {
                            setResult({
                                success: true,
                                internal_links: event.internal_links,
                                external_links: event.external_links,
                            });
                            setIsLoading(false);
                        } else if (event.type === 'error') {
                            setError(event.message);
                            setIsLoading(false);
                        }
                    } catch {
                        // skip malformed chunks
                    }
                }
            }
        } catch (err) {
            setError(err.message || 'Network error occurred. Please try again.');
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
                <SearchBar
                    onAnalyze={handleCollect}
                    isLoading={isLoading}
                    extraControls={
                        <div className="depth-control">
                            <label className="depth-label" htmlFor="depth-select">
                                Crawl Depth:
                            </label>
                            <select
                                id="depth-select"
                                value={depth}
                                onChange={(e) => setDepth(Number(e.target.value))}
                                disabled={isLoading}
                                className="depth-select"
                            >
                                <option value={0}>0 (Current Page Only)</option>
                                <option value={1}>1 (Internal Links)</option>
                                <option value={2}>2 (Deeper Subpages)</option>
                                <option value={3}>3 (Max Depth)</option>
                            </select>
                            <span className="depth-hint">Higher depth takes significantly longer. Restricted to same domain.</span>
                        </div>
                    }
                />

                {error && (
                    <div className="error-message">{error}</div>
                )}

                {/* Live log panel — visible while loading OR after completion if logs exist */}
                {logs.length > 0 && (
                    <div className="log-panel">
                        <div className="log-panel-header">
                            <span className="log-panel-title">
                                {isLoading ? (
                                    <><span className="log-pulse" />Live Progress</>
                                ) : '✅ Crawl Log'}
                            </span>
                            <span className="log-panel-count">{logs.length} events</span>
                        </div>
                        <div className="log-panel-body">
                            {logs.map((line, i) => (
                                <div key={i} className="log-line">{line}</div>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    </div>
                )}

                {isLoading && logs.length === 0 && <LoadingSpinner />}

                {result && (
                    <LinkTreeView
                        data={result}
                        setData={setResult}
                        selectedUrls={selectedUrls}
                        setSelectedUrls={setSelectedUrls}
                        seedUrl={crawledUrl}
                        onBatchCrawl={onBatchCrawl}
                    />
                )}

                {!isLoading && !result && !error && logs.length === 0 && (
                    <div className="empty-state">
                        <p>Enter a URL above to start collecting links</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LinkCollectorView;
