import React, { useState } from 'react';
import SearchBar from './components/SearchBar';
import ResultViewer from './components/ResultViewer';
import LoadingSpinner from './components/LoadingSpinner';
import './index.css';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async (url) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/v1/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
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
    <div className="app-container">
      <div className="main-content">
        <header className="app-header">
          <h1 className="app-title">
            Veluga Website Crawl Tester
          </h1>
          <p className="app-subtitle">
            Test and verify Veluga scraping capabilities. View LLM-friendly Markdown and raw HTML instantly.
          </p>
        </header>

        <main>
          <SearchBar onAnalyze={handleAnalyze} isLoading={isLoading} />

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {isLoading && <LoadingSpinner />}

          {result && <ResultViewer data={result} />}

          {!isLoading && !result && !error && (
            <div className="empty-state">
              <p>Enter a URL above to start analyzing</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
