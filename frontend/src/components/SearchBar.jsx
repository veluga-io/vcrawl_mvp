import React, { useState } from 'react';
import '../index.css';

const MODELS = [
    { value: 'none', label: 'No LLM', group: null },
    { value: 'gemini/gemini-3-pro-preview', label: 'Gemini 3 Pro Preview', group: 'Gemini' },
    { value: 'gemini/gemini-3-flash-preview', label: 'Gemini 3 Flash Preview', group: 'Gemini' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini', group: 'OpenAI' },
    { value: 'openai/gpt-5-nano', label: 'GPT-5 Nano', group: 'OpenAI' },
    { value: 'openai/gpt-4o', label: 'GPT-4o', group: 'OpenAI' },
];

const SearchBar = ({ onAnalyze, isLoading }) => {
    const [url, setUrl] = useState('');
    const [llmModel, setLlmModel] = useState('none');
    const [instruction, setInstruction] = useState('Extract the main content, key points, and purpose of this page. Structure the output clearly in markdown.');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (url.trim()) {
            onAnalyze(url, llmModel, instruction);
        }
    };

    return (
        <div className="search-container">
            <form onSubmit={handleSubmit} className="search-form">
                <select
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    disabled={isLoading}
                    className="model-select"
                >
                    <option value="none">No LLM</option>
                    <optgroup label="──── Gemini ────">
                        <option value="gemini/gemini-3-pro-preview">Gemini 3 Pro Preview</option>
                        <option value="gemini/gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                    </optgroup>
                    <optgroup label="──── OpenAI ────">
                        <option value="openai/gpt-5-mini">GPT-5 Mini</option>
                        <option value="openai/gpt-5-nano">GPT-5 Nano</option>
                        <option value="openai/gpt-4o">GPT-4o</option>
                    </optgroup>
                </select>
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
            </form>
            {llmModel !== 'none' && (
                <div className="instruction-container">
                    <label htmlFor="instruction">LLM Extraction Instruction</label>
                    <textarea
                        id="instruction"
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="Enter custom instructions for LLM extraction..."
                        disabled={isLoading}
                        rows={3}
                        className="instruction-textarea"
                    />
                </div>
            )}
        </div>
    );
};

export default SearchBar;
