import React from 'react';
import LLMAnalyzer from './LLMAnalyzer';

const LLMAnalyzerView = () => {
    return (
        <div className="view-container">
            <header className="view-header">
                <h1 className="view-title">Standalone LLM Analyzer</h1>
                <p className="view-subtitle">
                    Directly select an LLM model, paste your text or Markdown, and run custom RAG or extraction instructions.
                </p>
            </header>
            <div className="view-content padding-top-only">
                {/* We pass a forced open state or modify LLMAnalyzer to be open by default */}
                {/* For now, we just mount it. The user can toggle it or we can modify the component later */}
                <LLMAnalyzer crawlResult={null} />
            </div>
        </div>
    );
};

export default LLMAnalyzerView;
