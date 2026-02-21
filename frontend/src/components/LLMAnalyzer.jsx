import React, { useState, useEffect } from 'react';
import '../index.css';

const SOURCE_OPTIONS = [
    { value: 'llm_extraction', label: 'LLM Extraction' },
    { value: 'content_markdown', label: 'Content (MD)' },
    { value: 'content_html', label: 'Content (HTML)' },
    { value: 'markdown', label: 'Full Markdown' },
    { value: 'html', label: 'Full HTML' },
];

const getDataBySource = (data, source) => {
    if (!data) return '';
    switch (source) {
        case 'llm_extraction': return data.llm_extraction || '';
        case 'content_markdown': return data.content_only_markdown || '';
        case 'content_html': return data.content_only_html || '';
        case 'markdown': return data.markdown || '';
        case 'html': return data.html || '';
        default: return '';
    }
};

const LLMAnalyzer = ({ crawlResult, selectedModel }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [source, setSource] = useState('content_markdown');
    const [content, setContent] = useState('');
    const [instruction, setInstruction] = useState('이 내용을 분석하여 핵심 내용, 주요 키워드, 요약을 마크다운 형식으로 작성해 주세요.');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');

    // Auto-fill content when crawl result or source changes
    useEffect(() => {
        if (crawlResult) {
            const filled = getDataBySource(crawlResult, source);
            setContent(filled);
        }
    }, [crawlResult, source]);

    const handleAnalyze = async () => {
        setIsLoading(true);
        setResult('');
        setError('');
        try {
            const response = await fetch('/api/v1/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                    llm_model: selectedModel,
                    instruction,
                }),
            });
            const data = await response.json();
            if (data.success) {
                setResult(data.result);
            } else {
                setError(data.error_message || 'Analysis failed.');
            }
        } catch (e) {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const modelLabel = selectedModel && selectedModel !== 'none' ? selectedModel : null;

    return (
        <div className="llm-analyzer-wrapper">
            {/* Toggle header */}
            <button
                className={`llm-analyzer-toggle ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(v => !v)}
            >
                <span className="llm-analyzer-toggle-icon">{isOpen ? '▲' : '▼'}</span>
                <span>LLM Analyzer</span>
                {modelLabel && (
                    <span className="llm-analyzer-model-badge">{modelLabel.split('/').pop()}</span>
                )}
            </button>

            {isOpen && (
                <div className="llm-analyzer-panel">
                    {/* Source selector */}
                    <div className="llm-analyzer-row">
                        <label className="llm-analyzer-label">Content Source</label>
                        <div className="llm-analyzer-source-bar">
                            {SOURCE_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    className={`llm-source-btn ${source === opt.value ? 'active' : ''}`}
                                    onClick={() => setSource(opt.value)}
                                    disabled={isLoading}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content textarea */}
                    <div className="llm-analyzer-row">
                        <label className="llm-analyzer-label">
                            Content&nbsp;
                            <span className="llm-analyzer-hint">(auto-filled from crawl result · paste anything here)</span>
                        </label>
                        <textarea
                            className="llm-analyzer-textarea"
                            rows={6}
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="크롤링 결과가 자동으로 채워집니다. 직접 텍스트를 붙여넣기 해도 됩니다."
                            disabled={isLoading}
                        />
                    </div>

                    {/* Instruction textarea */}
                    <div className="llm-analyzer-row">
                        <label className="llm-analyzer-label">System Instruction</label>
                        <textarea
                            className="llm-analyzer-textarea"
                            rows={3}
                            value={instruction}
                            onChange={e => setInstruction(e.target.value)}
                            placeholder="LLM에게 내릴 명령을 입력하세요."
                            disabled={isLoading}
                        />
                    </div>

                    {/* Run button */}
                    <button
                        className={`llm-analyzer-run-btn ${isLoading ? 'loading' : ''}`}
                        onClick={handleAnalyze}
                        disabled={isLoading || !content.trim()}
                    >
                        {isLoading ? 'Analyzing…' : '✦ Run LLM Analysis'}
                    </button>

                    {/* Error */}
                    {error && (
                        <div className="llm-analyzer-error">{error}</div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className="llm-analyzer-result">
                            <div className="llm-analyzer-result-header">
                                <span>Result</span>
                                <button
                                    className="copy-button"
                                    onClick={() => navigator.clipboard.writeText(result)}
                                >
                                    Copy
                                </button>
                            </div>
                            <pre className="llm-analyzer-result-body">{result}</pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LLMAnalyzer;
