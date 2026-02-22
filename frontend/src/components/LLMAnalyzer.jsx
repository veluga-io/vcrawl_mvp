import React, { useState, useEffect } from 'react';
import '../index.css';

const SOURCE_OPTIONS = [
    { value: 'content_markdown', label: 'Content (MD)' },
    { value: 'content_html', label: 'Content (HTML)' },
    { value: 'markdown', label: 'Full Markdown' },
    { value: 'html', label: 'Full HTML' },
];

const getDataBySource = (data, source) => {
    if (!data) return '';
    switch (source) {
        case 'content_markdown': return data.content_only_markdown || '';
        case 'content_html': return data.content_only_html || '';
        case 'markdown': return data.markdown || '';
        case 'html': return data.html || '';
        default: return '';
    }
};

const DEFAULT_INSTRUCTION = `You are a RAG data pipeline engineer who analyzes noisy web-crawled markdown text and transforms it into 'refined markdown chunks' optimized for Sparse and Dense hybrid embedding systems and Cross-lingual retrieval.

Strictly apply the following rules to process and output the text:

1. **Relevance & Quality Check (Drop Condition)**
Evaluate if the text contains meaningful main-body content. DO NOT generate chunks for:
- Error pages (e.g., 404 Not Found, Access Denied)
- Pages consisting ONLY of login prompts, cookie consent, or short privacy policies.
- Scraped text that is entirely menu items/GNB without a clear article or informative body.
If rejected, STRICTLY output ONLY this string: \`[STATUS: REJECTED] - {Brief reason}\`

2. **Primary Language Output (Dominant Language)**
All refined content in the \`[Content]\` section MUST be written in the primary language of the original source text. Do not translate the main body content.

3. **Noise Filtering**
Completely remove web elements irrelevant to the main body (e.g., GNB, footers, login sections, sitemaps, SNS links, menu lists, Base64 image codes).

4. **Contextual Flow & Chunking for Dense Embedding**
- Divide the body text by logical topics or heading levels (##, ###). 
- **Chunk Size:** Aim for a balanced chunk size (e.g., roughly 300-500 words per chunk). If a section is too long, split it logically; if too short, merge it with a related adjacent section.
- **Coreference Resolution:** Replace demonstrative pronouns (this, that, these) with explicit nouns to maintain context. **[ANTI-HALLUCINATION WARNING]** Only perform this replacement if the referenced noun is 100% clear from the surrounding text. Do not invent context.

5. **Keyword Expansion for Sparse & Cross-lingual Search**
Extract core nouns, proper nouns, and technical terms.
- Extract **3 to 5 keywords** per chunk depending on its information density.
- Provide the extracted original keywords alongside their exact English translations (or main target language counterparts) to support Cross-lingual Retrieval.

6. **Strict Markdown Formatting & Syntax**
- **URLs and Links:** Must use standard Markdown: \`[Link Text](URL)\`. Never output raw URLs.
- **Tables:** Must use strict Markdown table syntax (accurate columns, \`|\` alignment, header separator \`|---|---|\`).

**[Output Format Rule]**
If the text passes the relevance check, output the chunks using the EXACT XML and Markdown structure below. Wrap each chunk in <chunk>...</chunk> tags to ensure safe programmatic parsing in data pipelines.

<chunk>
# [{Page Main Title}] - {Current Heading} - ({Current Subheading}) // Omit if absent

**[Metadata]**
* URL: {Extract if specified, format as \`[Link Text](URL)\`, otherwise output \`N/A\`}
* Menu Path: {Format: Home > Category > Submenu, otherwise output \`N/A\`}

**[Content]**
{Noise-filtered, contextually complete chunk content. Preserve Markdown lists and tables (Rule 6).}
{CRITICAL: Include any file download links found in this section's source as \`[File Name](URL)\`.}

**[Sparse Keywords]** // 3 to 5 keywords
* Original: #Keyword1, #Keyword2, ...
* Cross-lingual: #Keyword1, #Keyword2, ...
</chunk>`;

const LLMAnalyzer = ({ crawlResult, initiallyOpen = false }) => {
    const [isOpen, setIsOpen] = useState(initiallyOpen);
    const [llmModel, setLlmModel] = useState('openai/gpt-4o');
    const [source, setSource] = useState('content_markdown');
    const [content, setContent] = useState('');
    const [instruction, setInstruction] = useState(DEFAULT_INSTRUCTION);
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
                    llm_model: llmModel,
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

    const modelLabel = llmModel && llmModel !== 'none' ? llmModel : null;

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
                    {/* Model selector */}
                    <div className="llm-analyzer-row">
                        <label className="llm-analyzer-label">LLM Model</label>
                        <select
                            value={llmModel}
                            onChange={(e) => setLlmModel(e.target.value)}
                            disabled={isLoading}
                            className="model-select"
                            style={{ padding: '0.4rem', borderRadius: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #444' }}
                        >
                            <option value="none" disabled>Select Model</option>
                            <optgroup label="──── Gemini ────">
                                <option value="gemini/gemini-3-pro-preview">Gemini 3 Pro Preview</option>
                                <option value="gemini/gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                            </optgroup>
                            <optgroup label="──── OpenAI ────">
                                <option value="openai/gpt-5-mini">GPT-5 Mini - low</option>
                                <option value="openai/gpt-5-nano">GPT-5 Nano - low</option>
                                <option value="openai/gpt-4o">GPT-4o</option>
                            </optgroup>
                        </select>
                    </div>

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
                            className="llm-analyzer-textarea code-font"
                            rows={15}
                            value={instruction}
                            onChange={e => setInstruction(e.target.value)}
                            placeholder="LLM에게 내릴 명령을 입력하세요."
                            disabled={isLoading}
                            style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
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
