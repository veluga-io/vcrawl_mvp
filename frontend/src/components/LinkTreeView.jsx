import React, { useState } from 'react';
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

const LinkTreeView = ({ data, selectedUrls, setSelectedUrls }) => {

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

    // Prepare CSV data
    const handleExportCSV = () => {
        const header = ["Category", "Link Text", "URL", "Internal/External"];
        const rows = [];

        const processLinks = (linkList, typeStr) => {
            linkList.forEach(link => {
                if (selectedUrls.has(link.href)) {
                    rows.push([
                        `"${link.category}"`,
                        `"${(link.text || '').replace(/"/g, '""')}"`,
                        `"${link.href}"`,
                        `"${typeStr}"`
                    ].join(','));
                }
            });
        };

        if (data.internal_links) processLinks(data.internal_links, "Internal");
        if (data.external_links) processLinks(data.external_links, "External");

        const csvContent = [header.join(','), ...rows].join('\n');

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vcrawl_links_export_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="link-tree-wrapper">
            <div className="link-tree-controls">
                <span>Selected: <strong>{selectedUrls.size}</strong> links</span>
                <div className="link-tree-actions">
                    <button
                        className="btn-secondary"
                        onClick={() => setSelectedUrls(new Set())}
                        disabled={selectedUrls.size === 0}
                    >
                        Clear Selection
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={handleExportCSV}
                        disabled={selectedUrls.size === 0}
                    >
                        Export CSV
                    </button>
                    {/* Placeholder for future features */}
                    <button className="btn-primary" disabled={selectedUrls.size === 0}>
                        Send to Batch Crawl
                    </button>
                </div>
            </div>

            <div className="link-tree-container">
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
            </div>
        </div>
    );
};

export default LinkTreeView;
