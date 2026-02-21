import React, { useState, useEffect } from 'react';
import '../index.css';
import LoadingSpinner from './LoadingSpinner';

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
Completely remove web elements irrelevant to the main body information, such as top/bottom navigation bars (GNB), footers, login sections, sitemaps, SNS links, list of menus, and Base64 image codes.

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
`.trim();

const LLMBatchView = () => {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Step 1: Convert
    const [mdFolderPath, setMdFolderPath] = useState('');
    const [instruction, setInstruction] = useState(DEFAULT_INSTRUCTION);
    const [llmModel, setLlmModel] = useState('gpt-5-mini');
    const [convertedJsonlPath, setConvertedJsonlPath] = useState('');

    // Step 2: Submit
    const [jsonlFolderPath, setJsonlFolderPath] = useState('');

    // Step 3: Status
    const [activeBatches, setActiveBatches] = useState([]); // Array of { batch_id, status, ... }

    // Step 4: Results
    const [resultsFolderPath, setResultsFolderPath] = useState('');

    // Step 5: Recover Past Batches
    const [recoveryBatches, setRecoveryBatches] = useState([]);
    const [selectedRecoveryBatches, setSelectedRecoveryBatches] = useState(new Set());
    const [recoveryFolderPath, setRecoveryFolderPath] = useState('');
    const [recoveryLimit, setRecoveryLimit] = useState(30);

    // Auto-fill JSONL path when conversion succeeds
    useEffect(() => {
        if (convertedJsonlPath) {
            setJsonlFolderPath(convertedJsonlPath);
        }
    }, [convertedJsonlPath]);

    // Polling interval for status
    useEffect(() => {
        let interval;
        if (activeBatches.length > 0) {
            const hasPending = activeBatches.some(b => !['completed', 'failed', 'cancelled', 'expired'].includes(b.status));
            if (hasPending) {
                interval = setInterval(fetchBatchStatus, 5000);
            }
        }
        return () => clearInterval(interval);
    }, [activeBatches]);

    const handleConvert = async () => {
        if (!mdFolderPath.trim()) {
            setError('Please enter the path to the folder containing .md files.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const res = await fetch('/api/v1/llm-batch/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folder_path: mdFolderPath,
                    instruction,
                    model: llmModel
                })
            });
            const data = await res.json();
            if (data.success) {
                setConvertedJsonlPath(data.output_folder);
                setSuccessMessage(`Successfully converted ${data.file_count} files to JSONL.\nSaved to: ${data.output_folder}`);
                setStep(2);
            } else {
                setError(data.error_message || 'Conversion failed.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!jsonlFolderPath.trim()) {
            setError('Please enter the path to the JSONL folder.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const res = await fetch('/api/v1/llm-batch/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonl_folder_path: jsonlFolderPath
                })
            });
            const data = await res.json();
            if (data.success) {
                setActiveBatches(data.batches);
                setSuccessMessage(`Successfully created ${data.batches.length} batch job(s).`);
                setStep(3);
            } else {
                setError(data.error_message || 'Submit failed.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchBatchStatus = async () => {
        if (activeBatches.length === 0) return;

        try {
            const batch_ids = activeBatches.map(b => b.batch_id);
            const res = await fetch('/api/v1/llm-batch/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch_ids })
            });
            const data = await res.json();
            if (data.success) {
                setActiveBatches(data.batches);
            }
        } catch (err) {
            console.error("Failed to fetch status", err);
        }
    };

    const handleDownloadResults = async () => {
        const completedBatchIds = activeBatches.filter(b => b.status === 'completed').map(b => b.batch_id);
        if (completedBatchIds.length === 0) {
            setError("No completed batches to download.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        // Derive results folder path from the jsonl folder path
        let outPath = '';
        if (jsonlFolderPath) {
            outPath = jsonlFolderPath.replace(/_jsonl[\\\/]?$/, '') + '_results';
        }

        try {
            const res = await fetch('/api/v1/llm-batch/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batch_ids: completedBatchIds,
                    output_folder_path: outPath
                })
            });
            const data = await res.json();
            if (data.success) {
                setResultsFolderPath(data.output_folder);
                setSuccessMessage(`Results downloaded! Total files: ${data.total_files}. Rejected files: ${data.rejected_count}.\nSaved to: ${data.output_folder}`);
                setStep(4);
            } else {
                setError(data.error_message || 'Failed to download results.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Step 5 functions
    const fetchRecoveryBatches = async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const res = await fetch('/api/v1/llm-batch/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: recoveryLimit })
            });
            const data = await res.json();
            if (data.success) {
                setRecoveryBatches(data.batches);
                setSuccessMessage(`Fetched ${data.batches.length} past batches.`);
            } else {
                setError(data.error_message || 'Failed to fetch batches.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleRecoveryBatch = (batchId) => {
        setSelectedRecoveryBatches(prev => {
            const next = new Set(prev);
            if (next.has(batchId)) {
                next.delete(batchId);
            } else {
                next.add(batchId);
            }
            return next;
        });
    };

    const handleToggleAllRecoveryBatches = () => {
        const completedBatches = recoveryBatches.filter(b => b.status === 'completed').map(b => b.batch_id);
        const allSelected = completedBatches.length > 0 && completedBatches.every(id => selectedRecoveryBatches.has(id));

        if (allSelected) {
            // Deselect all completed
            setSelectedRecoveryBatches(prev => {
                const next = new Set(prev);
                completedBatches.forEach(id => next.delete(id));
                return next;
            });
        } else {
            // Select all completed
            setSelectedRecoveryBatches(prev => {
                const next = new Set(prev);
                completedBatches.forEach(id => next.add(id));
                return next;
            });
        }
    };

    const handleDownloadRecoveryResults = async () => {
        if (selectedRecoveryBatches.size === 0) {
            setError("No batches selected.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const res = await fetch('/api/v1/llm-batch/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batch_ids: Array.from(selectedRecoveryBatches),
                    output_folder_path: recoveryFolderPath
                })
            });
            const data = await res.json();
            if (data.success) {
                setResultsFolderPath(data.output_folder);
                setSuccessMessage(`Recovery Download Successful! Total files: ${data.total_files}. Rejected files: ${data.rejected_count}.\nSaved to: ${data.output_folder}`);
            } else {
                setError(data.error_message || 'Failed to download recovered results.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="view-container llm-batch-view">
            <header className="view-header">
                <h1 className="view-title">LLM Batch Processor</h1>
                <p className="view-subtitle">
                    Process multiple local .md files using OpenAI's Batch API for cost-effective bulk analysis.
                </p>
            </header>

            <div className="llm-batch-steps">
                {[1, 2, 3, 4, 5].map(s => (
                    <button
                        key={s}
                        className={`step-btn ${step === s ? 'active' : ''} ${step > s ? 'completed' : ''}`}
                        onClick={() => setStep(s)}
                    >
                        Step {s}
                    </button>
                ))}
            </div>

            <div className="view-content">
                {error && <div className="error-message">{error}</div>}
                {successMessage && <div className="success-message" style={{ whiteSpace: 'pre-wrap' }}>{successMessage}</div>}

                {/* STEP 1: CONVERT */}
                {step === 1 && (
                    <div className="batch-card fade-in">
                        <h2>Step 1: Convert to JSONL</h2>
                        <div className="form-group row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div className="form-group flex-1" style={{ marginBottom: 0, minWidth: 0 }}>
                                <label>Folder Path (.md files)</label>
                                <input
                                    className="search-input"
                                    type="text"
                                    value={mdFolderPath}
                                    onChange={e => setMdFolderPath(e.target.value)}
                                    placeholder="e.g. D:\data\markdown_files"
                                    disabled={isLoading}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>LLM Model</label>
                                <select
                                    className="model-select"
                                    value={llmModel}
                                    onChange={e => setLlmModel(e.target.value)}
                                    disabled={isLoading}
                                >
                                    <option value="gpt-5-mini">GPT-5 Mini (low)</option>
                                    <option value="gpt-5-nano">GPT-5 Nano (low)</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>System Instruction</label>
                            <textarea
                                className="instruction-textarea code-font"
                                rows={10}
                                value={instruction}
                                onChange={e => setInstruction(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>

                        <div className="action-row">
                            <button className="primary-btn" onClick={handleConvert} disabled={isLoading}>
                                {isLoading ? <LoadingSpinner small /> : 'Convert to JSONL'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: SUBMIT */}
                {step === 2 && (
                    <div className="batch-card fade-in">
                        <h2>Step 2: Submit to OpenAI Batch API</h2>
                        <div className="form-group">
                            <label>JSONL Folder Path</label>
                            <input
                                className="search-input"
                                type="text"
                                value={jsonlFolderPath}
                                onChange={e => setJsonlFolderPath(e.target.value)}
                                placeholder="Path to JSONL directory"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="action-row">
                            <button className="primary-btn" onClick={handleSubmit} disabled={isLoading}>
                                {isLoading ? <LoadingSpinner small /> : 'Submit Batch'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: STATUS */}
                {step === 3 && (
                    <div className="batch-card fade-in">
                        <h2>Step 3: Monitor Batch Status</h2>
                        <div className="action-row" style={{ justifyContent: 'flex-start', marginBottom: '1rem' }}>
                            <button className="secondary-btn" onClick={fetchBatchStatus} disabled={isLoading}>
                                🔄 Refresh Status
                            </button>
                        </div>

                        {activeBatches.length === 0 ? (
                            <p className="text-secondary">No active batches. Submit a batch in Step 2.</p>
                        ) : (
                            <div className="batch-table-container">
                                <table className="batch-link-table">
                                    <thead>
                                        <tr>
                                            <th>Batch ID</th>
                                            <th>Status</th>
                                            <th>Completed</th>
                                            <th>Failed</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeBatches.map(b => (
                                            <tr key={b.batch_id}>
                                                <td className="code-font">{b.batch_id}</td>
                                                <td><span className={`status-badge ${b.status}`}>{b.status}</span></td>
                                                <td>{b.completed}</td>
                                                <td>{b.failed}</td>
                                                <td>{b.total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeBatches.some(b => b.status === 'completed') && (
                            <div className="action-row" style={{ marginTop: '2rem' }}>
                                <button className="primary-btn" onClick={handleDownloadResults} disabled={isLoading}>
                                    {isLoading ? <LoadingSpinner small /> : 'Download Results'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 4: RESULTS */}
                {step === 4 && (
                    <div className="batch-card fade-in">
                        <h2>Step 4: View Results</h2>
                        {resultsFolderPath ? (
                            <div className="success-banner">
                                <h3>🎉 Results successfully saved!</h3>
                                <p>Location: <code>{resultsFolderPath}</code></p>
                                <p className="text-secondary mt-2">
                                    Files containing [STATUS: REJECTED] have been renamed automatically.
                                </p>
                            </div>
                        ) : (
                            <p className="text-secondary">Results have not been downloaded yet.</p>
                        )}
                    </div>
                )}

                {/* STEP 5: RECOVER PAST BATCHES */}
                {step === 5 && (
                    <div className="batch-card fade-in">
                        <h2>Step 5: Recover Past Batches</h2>
                        <p className="text-secondary">
                            Fetch and download results from previously submitted batch jobs, even if you closed the browser.
                        </p>

                        <div className="form-group row" style={{ alignItems: 'flex-end', marginTop: '1rem' }}>
                            <div className="form-group flex-1" style={{ marginBottom: 0 }}>
                                <label>Fetch Limit</label>
                                <input
                                    type="number"
                                    className="search-input"
                                    value={recoveryLimit}
                                    onChange={e => setRecoveryLimit(Number(e.target.value))}
                                    min={1}
                                    max={100}
                                />
                            </div>
                            <button className="secondary-btn" onClick={fetchRecoveryBatches} disabled={isLoading} style={{ marginLeft: '1rem' }}>
                                Fetch Recent Batches
                            </button>
                        </div>

                        <div className="form-group mt-4">
                            <label>Output Folder Path (Optional)</label>
                            <input
                                className="search-input"
                                type="text"
                                value={recoveryFolderPath}
                                onChange={e => setRecoveryFolderPath(e.target.value)}
                                placeholder="Leave empty for default directory"
                            />
                        </div>

                        {recoveryBatches.length > 0 && (
                            <div className="batch-table-container mt-4">
                                <table className="batch-link-table">
                                    <thead>
                                        <tr>
                                            <th>
                                                <input
                                                    type="checkbox"
                                                    onChange={handleToggleAllRecoveryBatches}
                                                    checked={
                                                        recoveryBatches.filter(b => b.status === 'completed').length > 0 &&
                                                        recoveryBatches.filter(b => b.status === 'completed').every(b => selectedRecoveryBatches.has(b.batch_id))
                                                    }
                                                    title="Select All Completed"
                                                />
                                            </th>
                                            <th>Batch ID</th>
                                            <th>Status</th>
                                            <th>Created (UTC)</th>
                                            <th>Completed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recoveryBatches.map(b => (
                                            <tr key={b.batch_id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        disabled={b.status !== 'completed'}
                                                        checked={selectedRecoveryBatches.has(b.batch_id)}
                                                        onChange={() => handleToggleRecoveryBatch(b.batch_id)}
                                                    />
                                                </td>
                                                <td className="code-font">{b.batch_id}</td>
                                                <td><span className={`status-badge ${b.status}`}>{b.status}</span></td>
                                                <td>{new Date(b.created_at * 1000).toLocaleString()}</td>
                                                <td>{b.completed}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="action-row mt-4">
                                    <button
                                        className="primary-btn"
                                        onClick={handleDownloadRecoveryResults}
                                        disabled={isLoading || selectedRecoveryBatches.size === 0}
                                    >
                                        {isLoading ? <LoadingSpinner small /> : 'Download Selected Results'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LLMBatchView;
