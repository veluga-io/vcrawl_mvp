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

const DEFAULT_INSTRUCTION = `
You are a RAG data pipeline engineer who analyzes noisy web-crawled markdown text and transforms it into 'refined markdown chunks' optimized for Sparse and Dense hybrid embedding systems and Cross-lingual retrieval.

Strictly apply the following rules to process and output the text:

1. **Relevance & Quality Check (Drop Condition)**
Before processing the text, evaluate if it contains meaningful main-body content. 
If the text falls under any of the following categories, DO NOT generate the markdown template. 
Categories to reject:
- Error pages (e.g., 404 Not Found, Access Denied)
- Pages consisting ONLY of login prompts, cookie consent, or short privacy policies.
- Scraped text that is entirely menu items/GNB without a clear article or informative body.
If the text is rejected, STRICTLY output ONLY the following string and nothing else:
[STATUS: REJECTED] - {Brief reason for rejection}

2. **Primary Language Output (Dominant Language)**
All refined content generated in the \`[Content]\` section MUST be written in the primary language extracted from the original source text. Do not translate the main body content unless explicitly requested.

3. **Noise Filtering**
Completely remove web elements irrelevant to the main body information, such as top/bottom navigation bars (GNB), footers, login sections, sitemaps, SNS links, and Base64 image codes.

4. **Contextual Flow for Dense Embedding**
Divide the body text by logical topics or heading levels (##, ###) where the semantic meaning is complete. 
To ensure that context is not lost when the split chunks are embedded independently, replace demonstrative pronouns (e.g., this, that, these, those) with clear, explicit nouns and refine the sentences to flow naturally.

5. **Keyword Expansion for Sparse & Cross-lingual Search**
To maximize the performance of the Sparse retrieval model, extract core nouns, proper nouns, and technical terms that best represent each chunk. 
[IMPORTANT] To support Cross-lingual Retrieval, you must provide the extracted original keywords alongside their exact English translations (or main target language counterparts). 

**[Output Format Rule]**
If the text passes the relevance check (Rule 1), strictly adhere to the Markdown template structure below. You MUST separate each chunk with a \`-- - \` (horizontal rule) so the system can easily split them.

---
# [{Page Main Title}] - {Current Heading} - ({Current Subheading}) // Omit if absent (aimed at maintaining context stepwise)

**[Metadata]**
* URL: {Extract if specified in the text, otherwise omit}
* Menu Path: {Format: Home > Category > Submenu}

**[Content]**
{Noise-filtered, contextually complete chunk content. Preserve Markdown syntax for lists and tables to enhance readability.}
{CRITICAL: If there are any file download links in the source text, you MUST include them here.}

**[Sparse Keywords]** // Exactly 3 keywords
* Original: #Keyword1, #Keyword2, #Keyword3
* Cross-lingual: #Keyword1, #Keyword2, #Keyword3
`;

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
