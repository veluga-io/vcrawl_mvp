import React, { useState, useMemo } from 'react';
import '../index.css';

const LinkNode = ({ link, isSelected, onToggleSelect }) => {
    // Generate badge class based on category
    const getBadgeClass = (category) => {
        if (category === 'File Download') return 'badge-file';
        if (category === 'Board/Forum') return 'badge-board';
        return 'badge-standard';
    };

    return (
        <div className="link-node">
            <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(link.href)}
                className="link-checkbox"
            />
            <div className="link-details">
                <a href={link.href} target="_blank" rel="noopener noreferrer" className="link-text" title={link.href}>
                    {link.text || link.href}
                </a>
                <span className="link-url-hint">{link.href}</span>
            </div>
            {link.category !== 'Standard' && (
                <span className={`link-badge ${getBadgeClass(link.category)}`}>
                    {link.category === 'File Download' ? '⬇️ File' : '💬 Board'}
                </span>
            )}
        </div>
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
                    {links.map((link, idx) => (
                        <LinkNode
                            key={`${link.href}-${idx}`}
                            link={link}
                            isSelected={selectedUrls.has(link.href)}
                            onToggleSelect={onToggleSelect}
                        />
                    ))}
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
