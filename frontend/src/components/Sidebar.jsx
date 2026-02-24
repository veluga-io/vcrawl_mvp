import React, { useState } from 'react';
import '../index.css';

const Sidebar = ({ activeView, setActiveView }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const navItems = [
        { id: 'single_crawl', label: 'Single Crawl', icon: '🔍' },
        { id: 'link_collector', label: 'Link Collector', icon: '🔗' },
        { id: 'batch_crawl', label: 'Batch Crawl', icon: '📦' },
        { id: 'llm_analyzer', label: 'LLM Analyzer', icon: '🧠' },
        { id: 'llm_batch', label: 'LLM Batch', icon: '⚡' },
    ];

    const bottomItems = [
        { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    return (
        <aside className={`app-sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
            <div className="sidebar-header">
                {isExpanded && <img src="/veluga_logo.png" alt="Veluga Logo" className="sidebar-logo" />}
                <button
                    className="sidebar-toggle-btn"
                    onClick={() => setIsExpanded(!isExpanded)}
                    title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
                >
                    {isExpanded ? '◀' : '▶'}
                </button>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-group">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                            onClick={() => setActiveView(item.id)}
                            title={!isExpanded ? item.label : ''}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {isExpanded && <span className="nav-label">{item.label}</span>}
                        </button>
                    ))}
                </div>

                <div className="nav-group bottom-group">
                    {bottomItems.map((item) => (
                        <button
                            key={item.id}
                            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                            onClick={() => setActiveView(item.id)}
                            title={!isExpanded ? item.label : ''}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {isExpanded && <span className="nav-label">{item.label}</span>}
                        </button>
                    ))}
                </div>
            </nav>
        </aside>
    );
};

export default Sidebar;
