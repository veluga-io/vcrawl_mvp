import React, { useState } from 'react';
import SitemapTreeView from './SitemapTreeView';
import '../index.css';

const LinkNodeRow = ({ link, isSelected, onToggleSelect }) => {
    // Generate badge class based on category
    const getBadgeClass = (category) => {
        if (category === 'File Download') return 'badge-file';
        if (category === 'Board/Forum') return 'badge-board';
        return 'badge-standard';
    };

    return (
        <tr className="link-grid-row">
            <td className="col-checkbox">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(link.href)}
                    className="link-checkbox"
                />
            </td>
            <td className="col-text" title={link.text || link.href}>
                <div className="text-truncate">{link.text || link.href}</div>
            </td>
            <td className="col-url" title={link.href}>
                <a href={link.href} target="_blank" rel="noopener noreferrer" className="url-truncate">
                    {link.href}
                </a>
            </td>
            <td className="col-badge">
                {link.category !== 'Standard' && (
                    <span className={`link-badge ${getBadgeClass(link.category)}`}>
                        {link.category === 'File Download' ? '⬇️ File' : '💬 Board'}
                    </span>
                )}
            </td>
        </tr>
    );
};

const LinkFolder = ({ title, links, selectedUrls, onToggleSelect, onSelectGroup }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const allGroupUrls = links.map(l => l.href);
    const selectedInGroup = allGroupUrls.filter(url => selectedUrls.has(url));

    // Determine checkbox state
    const isAllSelected = selectedInGroup.length === allGroupUrls.length && allGroupUrls.length > 0;
    const isIndeterminate = selectedInGroup.length > 0 && selectedInGroup.length < allGroupUrls.length;

    const handleToggleFolder = () => {
        setIsExpanded(!isExpanded);
    };

    const handleSelectAll = (e) => {
        e.stopPropagation();
        onSelectGroup(allGroupUrls, !isAllSelected);
    };

    if (links.length === 0) return null;

    return (
        <div className="link-folder">
            <div className="link-folder-header" onClick={handleToggleFolder}>
                <span className="folder-toggle-icon">{isExpanded ? '▼' : '▶'}</span>
                <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={input => {
                        if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={handleSelectAll}
                    onClick={(e) => e.stopPropagation()}
                    className="link-checkbox"
                />
                <span className="folder-title">📁 {title}</span>
                <span className="folder-count">({selectedInGroup.length} / {links.length})</span>
            </div>

            {isExpanded && (
                <div className="link-folder-contents">
                    <table className="link-grid-table">
                        <thead>
                            <tr>
                                <th className="col-checkbox"></th>
                                <th className="col-text">Link Text</th>
                                <th className="col-url">URL Address</th>
                                <th className="col-badge">Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {links.map((link, idx) => (
                                <LinkNodeRow
                                    key={`${link.href}-${idx}`}
                                    link={link}
                                    isSelected={selectedUrls.has(link.href)}
                                    onToggleSelect={onToggleSelect}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const LinkTreeView = ({ data, setData, selectedUrls, setSelectedUrls, seedUrl, onBatchCrawl }) => {
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'sitemap'

    const toggleSelect = (url) => {
        const newSelected = new Set(selectedUrls);
        if (newSelected.has(url)) {
            newSelected.delete(url);
        } else {
            newSelected.add(url);
        }
        setSelectedUrls(newSelected);
    };

    const selectGroup = (urls, shouldSelect) => {
        const newSelected = new Set(selectedUrls);
        urls.forEach(url => {
            if (shouldSelect) newSelected.add(url);
            else newSelected.delete(url);
        });
        setSelectedUrls(newSelected);
    };

    // Delete Selection: remove checked URLs from the result data
    const handleDeleteSelection = () => {
        if (selectedUrls.size === 0) return;
        setData(prev => ({
            ...prev,
            internal_links: (prev.internal_links || []).filter(l => !selectedUrls.has(l.href)),
            external_links: (prev.external_links || []).filter(l => !selectedUrls.has(l.href)),
        }));
        setSelectedUrls(new Set());
    };

    // Send selected links to Batch Crawl
    const handleBatchCrawl = () => {
        if (!onBatchCrawl || selectedUrls.size === 0) return;
        const allLinks = [...(data.internal_links || []), ...(data.external_links || [])];
        const selected = allLinks
            .filter(l => selectedUrls.has(l.href))
            .map(l => ({ href: l.href, text: l.text || '' }));
        onBatchCrawl(selected);
    };

    // Check if any links have parent_url data (depth > 0 crawl)
    const hasHierarchyData = [...(data.internal_links || []), ...(data.external_links || [])]
        .some(l => l.parent_url && l.parent_url !== '');

    const totalLinks = (data.internal_links || []).length + (data.external_links || []).length;

    // Prepare CSV data — format depends on current view mode
    const handleExportCSV = () => {
        const isSitemapMode = viewMode === 'sitemap';

        const header = isSitemapMode
            ? ["Depth", "Path", "Parent URL", "URL", "Link Text", "Category", "Internal/External"]
            : ["Category", "Link Text", "URL", "Internal/External"];

        // Helper: build indented path display (e.g. "· · /about/team")
        const buildPathDisplay = (href, depth) => {
            const indent = '· '.repeat(depth);
            try {
                const u = new URL(href);
                return indent + u.pathname + u.search;
            } catch {
                return indent + href;
            }
        };

        const rows = [];

        // Export ALL links (selection not required)
        const processLinks = (linkList, typeStr) => {
            linkList.forEach(link => {
                const d = link.depth ?? 0;
                if (isSitemapMode) {
                    rows.push({
                        depth: d, cols: [
                            `"${d}"`,
                            `"${buildPathDisplay(link.href, d).replace(/"/g, '""')}"`,
                            `"${(link.parent_url || '').replace(/"/g, '""')}"`,
                            `"${link.href}"`,
                            `"${(link.text || '').replace(/"/g, '""')}"`,
                            `"${link.category}"`,
                            `"${typeStr}"`
                        ].join(',')
                    });
                } else {
                    rows.push({
                        depth: 0, cols: [
                            `"${link.category}"`,
                            `"${(link.text || '').replace(/"/g, '""')}"`,
                            `"${link.href}"`,
                            `"${typeStr}"`
                        ].join(',')
                    });
                }
            });
        };

        if (data.internal_links) processLinks(data.internal_links, "Internal");
        if (data.external_links) processLinks(data.external_links, "External");

        // In sitemap mode, sort by depth to preserve hierarchy order
        const dataRows = isSitemapMode
            ? rows.slice().sort((a, b) => a.depth - b.depth).map(r => r.cols)
            : rows.map(r => r.cols);

        const csvContent = [header.join(','), ...dataRows].join('\n');

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = isSitemapMode
            ? `vcrawl_sitemap_export_${Date.now()}.csv`
            : `vcrawl_links_export_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="link-tree-wrapper">
            <div className="link-tree-controls">
                <span>Selected: <strong>{selectedUrls.size}</strong> / <strong>{totalLinks}</strong> links</span>
                <div className="link-tree-actions">
                    {/* View Mode Toggle */}
                    {hasHierarchyData && (
                        <div className="view-mode-toggle">
                            <button
                                className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                            >
                                📋 List
                            </button>
                            <button
                                className={`view-mode-btn ${viewMode === 'sitemap' ? 'active' : ''}`}
                                onClick={() => setViewMode('sitemap')}
                            >
                                🗺️ Sitemap
                            </button>
                        </div>
                    )}

                    <button
                        className="btn-secondary"
                        onClick={handleDeleteSelection}
                        disabled={selectedUrls.size === 0}
                    >
                        Delete Selection
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={handleExportCSV}
                        disabled={totalLinks === 0}
                    >
                        Export CSV
                    </button>
                    <button
                        className="btn-primary"
                        disabled={selectedUrls.size === 0 || !onBatchCrawl}
                        onClick={handleBatchCrawl}
                        title={selectedUrls.size === 0 ? '링크를 먼저 선택하세요' : `${selectedUrls.size}개 링크를 Batch Crawl로 전송`}
                    >
                        📦 Batch Crawl ({selectedUrls.size})
                    </button>
                </div>
            </div>

            <div className="link-tree-container">
                {viewMode === 'list' ? (
                    <>
                        <LinkFolder
                            title="Internal Links"
                            links={data.internal_links || []}
                            selectedUrls={selectedUrls}
                            onToggleSelect={toggleSelect}
                            onSelectGroup={selectGroup}
                        />
                        <LinkFolder
                            title="External Links"
                            links={data.external_links || []}
                            selectedUrls={selectedUrls}
                            onToggleSelect={toggleSelect}
                            onSelectGroup={selectGroup}
                        />
                    </>
                ) : (
                    <>
                        <div className="sitemap-section-header">🔗 Internal Links — Sitemap View</div>
                        <SitemapTreeView
                            links={data.internal_links || []}
                            seedUrl={seedUrl || ''}
                            selectedUrls={selectedUrls}
                            onToggleSelect={toggleSelect}
                            onSelectSubtree={selectGroup}
                        />
                        {(data.external_links || []).length > 0 && (
                            <>
                                <div className="sitemap-section-header">🌐 External Links</div>
                                <LinkFolder
                                    title="External Links"
                                    links={data.external_links || []}
                                    selectedUrls={selectedUrls}
                                    onToggleSelect={toggleSelect}
                                    onSelectGroup={selectGroup}
                                />
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default LinkTreeView;
