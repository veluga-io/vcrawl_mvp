import React, { useState, useRef, useEffect } from 'react';
import '../index.css';

const STATUS_ICON = {
    pending: '⏳',
    crawling: '🔄',
    done: '✅',
    failed: '❌',
};

// ─────────────────────────────────────────────
// CSV parsing (matches LinkTreeView export format)
// Supported formats:
//   List view:    "Category","Link Text","URL","Internal/External"
//   Sitemap view: "Depth","Path","Parent URL","URL","Link Text","Category","Internal/External"
// ─────────────────────────────────────────────
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];

    const header = lines[0].toLowerCase();
    const isSitemap = header.includes('depth') && header.includes('parent url');

    const links = [];
    for (let i = 1; i < lines.length; i++) {
        // Simple CSV split that handles quoted fields
        const cols = lines[i].match(/("(?:[^"]|"")*"|[^,]*)/g) ?? [];
        const clean = cols.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());

        let href = '';
        let text = '';

        if (isSitemap) {
            // "Depth","Path","Parent URL","URL","Link Text","Category","Internal/External"
            href = clean[3] ?? '';
            text = clean[4] ?? '';
        } else {
            // "Category","Link Text","URL","Internal/External"
            href = clean[2] ?? '';
            text = clean[1] ?? '';
        }

        if (href && href.startsWith('http')) {
            links.push({ href, text: text || href });
        }
    }
    return links;
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
const BatchCrawlView = ({ initialLinks = [], onClearBatchLinks }) => {
    const [links, setLinks] = useState(initialLinks);
    const [folderName, setFolderName] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [linkStatus, setLinkStatus] = useState({}); // href → {status, filename, error}
    const [logs, setLogs] = useState([]);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [resultFolder, setResultFolder] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);

    const logEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Sync initialLinks when prop changes
    useEffect(() => {
        if (initialLinks.length > 0) {
            setLinks(initialLinks);
            resetState();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialLinks]);

    // Auto-scroll log panel
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    function resetState() {
        setIsDone(false);
        setLinkStatus({});
        setLogs([]);
        setProgress({ current: 0, total: 0 });
        setResultFolder('');
    }

    // ── CSV handling ──
    function handleCSVFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const parsed = parseCSV(text);
            if (parsed.length === 0) {
                alert('CSV에서 유효한 링크를 찾을 수 없습니다. 형식을 확인해 주세요.');
                return;
            }
            setLinks(parsed);
            resetState();
            if (onClearBatchLinks) onClearBatchLinks();
        };
        reader.readAsText(file, 'utf-8');
    }

    function handleFileInputChange(e) {
        handleCSVFile(e.target.files[0]);
        e.target.value = '';
    }

    function handleDrop(e) {
        e.preventDefault();
        setIsDragOver(false);
        const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith('.csv'));
        if (file) handleCSVFile(file);
    }

    // ── Remove individual link ──
    function removeLink(idx) {
        setLinks(prev => prev.filter((_, i) => i !== idx));
    }

    // ── Start batch crawl ──
    async function handleStart() {
        if (!links.length) return;
        setIsRunning(true);
        setIsDone(false);
        setLogs([]);
        setProgress({ current: 0, total: links.length });
        const initStatus = {};
        links.forEach(l => { initStatus[l.href] = { status: 'pending' }; });
        setLinkStatus(initStatus);

        try {
            const response = await fetch('/api/v1/batch-crawl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    links: links.map(l => ({ href: l.href, text: l.text })),
                    output_folder_name: folderName.trim(),
                }),
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
                const chunks = buffer.split('\n\n');
                buffer = chunks.pop();

                for (const chunk of chunks) {
                    const dataLine = chunk.split('\n').find(l => l.startsWith('data: '));
                    if (!dataLine) continue;
                    try {
                        const event = JSON.parse(dataLine.slice(6));

                        if (event.type === 'log') {
                            setLogs(prev => [...prev, event.message]);
                        } else if (event.type === 'progress') {
                            setProgress({ current: event.current, total: event.total });
                            setLinkStatus(prev => ({
                                ...prev,
                                [event.url]: {
                                    status: event.status,
                                    filename: event.filename,
                                    error: event.error,
                                },
                            }));
                            const statusMsg = event.status === 'done'
                                ? `✅ [${event.current}/${event.total}] ${event.filename}`
                                : event.status === 'crawling'
                                    ? `🔄 [${event.current}/${event.total}] 크롤링 중: ${event.url}`
                                    : `❌ [${event.current}/${event.total}] 실패: ${event.url} — ${event.error || ''}`;
                            setLogs(prev => [...prev, statusMsg]);
                        } else if (event.type === 'complete') {
                            setResultFolder(event.folder_path);
                            setIsDone(true);
                            setIsRunning(false);
                            setLogs(prev => [
                                ...prev,
                                `🏁 완료! ✅ ${event.total_success}개 성공, ❌ ${event.total_failed}개 실패`,
                                `📁 저장 폴더: ${event.folder_path}`,
                            ]);
                        } else if (event.type === 'error') {
                            setLogs(prev => [...prev, `❗ 오류: ${event.message}`]);
                            setIsRunning(false);
                        }
                    } catch {
                        // skip malformed chunks
                    }
                }
            }
        } catch (err) {
            setLogs(prev => [...prev, `❗ 네트워크 오류: ${err.message}`]);
            setIsRunning(false);
        }
    }

    const progressPct = progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;

    return (
        <div className="view-container">
            <header className="view-header">
                <h1 className="view-title">Batch Crawl</h1>
                <p className="view-subtitle">
                    여러 URL을 일괄 크롤링하여 Full Markdown 파일을 다운로드 폴더에 저장합니다.
                </p>
            </header>

            <div className="view-content padding-top-only">

                {/* ── Input Section ── */}
                <section className="batch-section">
                    <div className="batch-section-header">
                        <h2 className="batch-section-title">📥 링크 입력</h2>
                        {links.length > 0 && !isRunning && (
                            <button
                                className="batch-clear-btn"
                                onClick={() => { setLinks([]); resetState(); if (onClearBatchLinks) onClearBatchLinks(); }}
                            >
                                전체 삭제
                            </button>
                        )}
                    </div>

                    {/* CSV Drop Zone */}
                    {!isRunning && (
                        <div
                            className={`batch-dropzone ${isDragOver ? 'drag-over' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                style={{ display: 'none' }}
                                onChange={handleFileInputChange}
                            />
                            <div className="batch-dropzone-icon">📂</div>
                            <div className="batch-dropzone-text">
                                <strong>Link Collector CSV 업로드</strong>
                                <span>여기를 클릭하거나 CSV 파일을 드래그 & 드롭</span>
                            </div>
                        </div>
                    )}

                    {/* Link Preview Table */}
                    {links.length > 0 && (
                        <div className="batch-link-table-wrap">
                            <div className="batch-link-table-header">
                                <span className="batch-link-count">{links.length}개 링크</span>
                            </div>
                            <div className="batch-link-table-scroll">
                                <table className="batch-link-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>상태</th>
                                            <th>링크 텍스트</th>
                                            <th>URL</th>
                                            <th>파일명</th>
                                            {!isRunning && <th></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {links.map((link, idx) => {
                                            const st = linkStatus[link.href];
                                            const status = st?.status ?? 'pending';
                                            const icon = isRunning || isDone ? STATUS_ICON[status] : '–';
                                            return (
                                                <tr key={link.href + idx} className={`batch-row-${status}`}>
                                                    <td className="batch-td-num">{idx + 1}</td>
                                                    <td className="batch-td-icon">{icon}</td>
                                                    <td className="batch-td-text" title={link.text}>{link.text || '–'}</td>
                                                    <td className="batch-td-url">
                                                        <a href={link.href} target="_blank" rel="noopener noreferrer">{link.href}</a>
                                                    </td>
                                                    <td className="batch-td-file">{st?.filename ?? '–'}</td>
                                                    {!isRunning && (
                                                        <td className="batch-td-del">
                                                            <button
                                                                className="batch-row-del-btn"
                                                                onClick={() => removeLink(idx)}
                                                                title="삭제"
                                                            >✕</button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>

                {/* ── Options & Start ── */}
                {links.length > 0 && !isRunning && !isDone && (
                    <section className="batch-section batch-options-row">
                        <label className="batch-folder-label">
                            <span>출력 폴더명 (비워두면 자동 생성)</span>
                            <input
                                className="batch-folder-input"
                                type="text"
                                placeholder="vcrawl_batch_20260221_200000"
                                value={folderName}
                                onChange={e => setFolderName(e.target.value)}
                            />
                        </label>
                        <button className="batch-start-btn" onClick={handleStart}>
                            🚀 Batch Crawl 시작
                        </button>
                    </section>
                )}

                {/* ── Progress Bar ── */}
                {(isRunning || (isDone && progress.total > 0)) && (
                    <section className="batch-section">
                        <div className="batch-progress-header">
                            <span>{isRunning ? '크롤링 진행 중…' : '완료'}</span>
                            <span>{progress.current} / {progress.total} ({progressPct}%)</span>
                        </div>
                        <div className="batch-progress-bar-track">
                            <div
                                className={`batch-progress-bar-fill ${isDone ? 'done' : ''}`}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </section>
                )}

                {/* ── Result Banner ── */}
                {isDone && resultFolder && (
                    <section className="batch-section batch-result-banner">
                        <div className="batch-result-icon">🎉</div>
                        <div className="batch-result-text">
                            <strong>배치 크롤링 완료!</strong>
                            <span>저장 위치: <code>{resultFolder}</code></span>
                        </div>
                    </section>
                )}

                {/* ── Log Panel ── */}
                {logs.length > 0 && (
                    <div className="log-panel">
                        <div className="log-panel-header">
                            <span className="log-panel-title">
                                {isRunning ? <><span className="log-pulse" />Live Progress</> : '✅ Batch Log'}
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

                {/* Empty State */}
                {links.length === 0 && !isRunning && (
                    <div className="empty-state">
                        <p>Link Collector에서 "Batch Crawl Selected" 버튼을 누르거나,<br />위에서 CSV 파일을 업로드하세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BatchCrawlView;
