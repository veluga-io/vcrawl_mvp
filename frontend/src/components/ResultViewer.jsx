import React, { useState } from 'react';
import '../index.css';

const ResultViewer = ({ data }) => {
    const [activeTab, setActiveTab] = useState('content_markdown');

    const getContentForCopy = () => {
        switch (activeTab) {
            case 'markdown':
                return data.markdown;
            case 'html':
                return data.html;
            case 'content_markdown':
                return data.content_only_markdown;
            case 'content_html':
                return data.content_only_html;
            case 'llm_extraction':
                return data.llm_extraction;
            default:
                return '';
        }
    };

    const handleCopy = () => {
        const content = getContentForCopy();
        navigator.clipboard.writeText(content);
    };

    return (
        <div className="result-viewer">
            <div className="result-header">
                <div className="tabs">
                    {data.llm_extraction && (
                        <button
                            onClick={() => setActiveTab('llm_extraction')}
                            className={`tab-button ${activeTab === 'llm_extraction' ? 'active' : ''}`}
                        >
                            LLM Extraction
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('content_markdown')}
                        className={`tab-button ${activeTab === 'content_markdown' ? 'active' : ''}`}
                    >
                        Content (MD)
                    </button>
                    <button
                        onClick={() => setActiveTab('content_html')}
                        className={`tab-button ${activeTab === 'content_html' ? 'active' : ''}`}
                    >
                        Content (HTML)
                    </button>
                    <button
                        onClick={() => setActiveTab('markdown')}
                        className={`tab-button ${activeTab === 'markdown' ? 'active' : ''}`}
                    >
                        Full Markdown
                    </button>
                    <button
                        onClick={() => setActiveTab('html')}
                        className={`tab-button ${activeTab === 'html' ? 'active' : ''}`}
                    >
                        Full HTML
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
                            {activeTab === 'markdown' && data.markdown}
                            {activeTab === 'html' && data.html}
                            {activeTab === 'content_markdown' && data.content_only_markdown}
                            {activeTab === 'content_html' && data.content_only_html}
                            {activeTab === 'llm_extraction' && data.llm_extraction}
                        </code>
                    </pre>
                )}
            </div>
        </div>
    );
};

export default ResultViewer;
