import React, { useState, useMemo } from 'react';

/**
 * Build a tree structure from flat link arrays.
 * Each node: { link, children: [] }
 * Groups by parent_url; root nodes have parent_url === "" or parent_url === seedUrl.
 */
function buildTree(links, seedUrl) {
    // Map: parent_url -> children links
    const childrenMap = new Map();
    const allHrefs = new Set(links.map(l => l.href));

    for (const link of links) {
        const parent = link.parent_url || '';
        if (!childrenMap.has(parent)) childrenMap.set(parent, []);
        childrenMap.get(parent).push(link);
    }

    // Recursive builder
    function buildNode(link) {
        const children = (childrenMap.get(link.href) || []).map(buildNode);
        return { link, children };
    }

    // Roots = links whose parent_url is "" or whose parent_url is the seed URL
    // but the seed URL itself is NOT in the links list
    const roots = [];
    for (const link of links) {
        const parent = link.parent_url || '';
        // It's a root if parent is empty, or parent is seed but seed is not in links,
        // or parent is not in our href set at all
        if (parent === '' || parent === seedUrl || !allHrefs.has(parent)) {
            roots.push(buildNode(link));
        }
    }

    // Remove roots that are already children of other roots (dedup)
    const rootHrefs = new Set(roots.map(r => r.link.href));
    // Any link that appears as a child in childrenMap of another link in allHrefs
    // should not also be a root — but keep it simple: just return roots.
    return roots;
}

const SitemapNode = ({ node, depth, selectedUrls, onToggleSelect, onSelectSubtree }) => {
    const [isExpanded, setIsExpanded] = useState(depth < 2); // auto-expand first 2 levels
    const hasChildren = node.children.length > 0;
    const link = node.link;
    const isSelected = selectedUrls.has(link.href);

    // Count selected in this subtree
    const countSubtree = (n) => {
        let count = selectedUrls.has(n.link.href) ? 1 : 0;
        for (const c of n.children) count += countSubtree(c);
        return count;
    };

    const collectAllHrefs = (n) => {
        const hrefs = [n.link.href];
        for (const c of n.children) hrefs.push(...collectAllHrefs(c));
        return hrefs;
    };

    const subtreeCount = hasChildren ? countSubtree(node) : 0;
    const totalSubtree = hasChildren ? collectAllHrefs(node).length : 1;

    const getBadgeClass = (category) => {
        if (category === 'File Download') return 'badge-file';
        if (category === 'Board/Forum') return 'badge-board';
        return '';
    };

    // Extract path segment for display
    const getPathSegment = (href) => {
        try {
            const url = new URL(href);
            return url.pathname + url.search;
        } catch {
            return href;
        }
    };

    return (
        <div className="sitemap-node">
            <div className="sitemap-node-row" style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}>
                {hasChildren ? (
                    <button
                        className="sitemap-toggle-btn"
                        onClick={() => setIsExpanded(!isExpanded)}
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                        {isExpanded ? '▼' : '▶'}
                    </button>
                ) : (
                    <span className="sitemap-leaf-icon">─</span>
                )}

                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(link.href)}
                    className="link-checkbox"
                />

                {hasChildren ? (
                    <span className="sitemap-folder-icon">📂</span>
                ) : (
                    <span className="sitemap-page-icon">📄</span>
                )}

                <a
                    className="sitemap-url"
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.href}
                >
                    {depth === 0 ? link.href : getPathSegment(link.href)}
                </a>

                {link.text && link.text !== link.href && (
                    <span className="sitemap-text" title={link.text}>{link.text}</span>
                )}

                {link.category !== 'Standard' && (
                    <span className={`link-badge ${getBadgeClass(link.category)}`}>
                        {link.category === 'File Download' ? '⬇️ File' : '💬 Board'}
                    </span>
                )}

                {hasChildren && (
                    <span className="sitemap-child-count">
                        ({subtreeCount}/{totalSubtree})
                    </span>
                )}
            </div>

            {isExpanded && hasChildren && (
                <div className="sitemap-children">
                    {node.children.map((child, i) => (
                        <SitemapNode
                            key={child.link.href + '-' + i}
                            node={child}
                            depth={depth + 1}
                            selectedUrls={selectedUrls}
                            onToggleSelect={onToggleSelect}
                            onSelectSubtree={onSelectSubtree}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const SitemapTreeView = ({ links, seedUrl, selectedUrls, onToggleSelect, onSelectSubtree }) => {
    const tree = useMemo(() => buildTree(links, seedUrl), [links, seedUrl]);

    if (tree.length === 0) {
        return (
            <div className="sitemap-empty">
                <p>No hierarchical data available. Try a crawl with Depth ≥ 1.</p>
            </div>
        );
    }

    return (
        <div className="sitemap-tree">
            {tree.map((node, i) => (
                <SitemapNode
                    key={node.link.href + '-' + i}
                    node={node}
                    depth={0}
                    selectedUrls={selectedUrls}
                    onToggleSelect={onToggleSelect}
                    onSelectSubtree={onSelectSubtree}
                />
            ))}
        </div>
    );
};

export default SitemapTreeView;
