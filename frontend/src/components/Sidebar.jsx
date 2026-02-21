import React from 'react';
import '../index.css';

const Sidebar = ({ activeView, setActiveView }) => {
    const navItems = [
        { id: 'single_crawl', label: 'Single Crawl', icon: '🔍' },
        { id: 'link_collector', label: 'Link Collector', icon: '🔗' },
        { id: 'batch_crawl', label: 'Batch Crawl', icon: '📦' },
        { id: 'llm_analyzer', label: 'LLM Analyzer', icon: '🧠' },
    ];

    const bottomItems = [
        { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    return (
        <aside className="app-sidebar">
            <div className="sidebar-header">
                <h2>Vcrawl MVP</h2>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-group">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                            onClick={() => setActiveView(item.id)}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="nav-group bottom-group">
                    {bottomItems.map((item) => (
                        <button
                            key={item.id}
                            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                            onClick={() => setActiveView(item.id)}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </button>
                    ))}
                </div>
            </nav>
        </aside>
    );
};

export default Sidebar;
