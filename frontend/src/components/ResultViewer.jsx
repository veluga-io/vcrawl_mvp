import React, { useState } from 'react';
import '../index.css';

const ResultViewer = ({ data }) => {
    const [activeTab, setActiveTab] = useState('markdown');

    const handleCopy = () => {
        const content = activeTab === 'markdown' ? data.markdown : data.html;
        navigator.clipboard.writeText(content);
    };

    return (
        <div className="result-viewer">
            <div className="result-header">
                <div className="tabs">
                    <button
                        onClick={() => setActiveTab('markdown')}
                        className={`tab-button ${activeTab === 'markdown' ? 'active' : ''}`}
                    >
                        Markdown (LLM)
                    </button>
                    <button
                        onClick={() => setActiveTab('html')}
                        className={`tab-button ${activeTab === 'html' ? 'active' : ''}`}
                    >
                        Raw HTML
                    </button>
                    <button
                        onClick={() => setActiveTab('structure')}
                        className={`tab-button ${activeTab === 'structure' ? 'active' : ''}`}
                    >
                        Structure
                    </button>
                </div>
                <div className="actions">
                    {data.metadata && (
                        <span className="metadata-url">
                            {data.metadata.url}
                        </span>
                    )}
                    <button
                        onClick={handleCopy}
                        className="copy-button"
                    >
                        Copy Content
                    </button>
                </div>
            </div>

            <div className="result-content">
                {activeTab === 'structure' ? (
                    <div className="structure-view">
                        {data.structure && Object.entries(data.structure).map(([key, value]) => (
                            <div key={key} className="structure-item">
                                <h3 className="structure-title">{key.replace('_', ' ').toUpperCase()}</h3>
                                <pre className="structure-code">
                                    {Array.isArray(value)
                                        ? (value.length > 0 ? value.join('\n\n') : 'No ads found')
                                        : value}
                                </pre>
                            </div>
                        ))}
                    </div>
                ) : (
                    <pre className="code-block">
                        <code>
                            {activeTab === 'markdown' ? data.markdown : data.html}
                        </code>
                    </pre>
                )}
            </div>
        </div>
    );
};

export default ResultViewer;
