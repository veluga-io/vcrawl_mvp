import React from 'react';

const PlaceholderView = ({ title, description }) => {
    return (
        <div className="view-container">
            <header className="view-header">
                <h1 className="view-title">{title}</h1>
                <p className="view-subtitle">{description}</p>
            </header>
            <div className="view-content placeholder-content">
                <div className="empty-state">
                    <div className="construction-icon">🚧</div>
                    <h2>Under Construction</h2>
                    <p>This feature is coming soon.</p>
                </div>
            </div>
        </div>
    );
};

export default PlaceholderView;
