import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import SingleCrawlView from './components/SingleCrawlView';
import PlaceholderView from './components/PlaceholderView';
import LLMAnalyzerView from './components/LLMAnalyzerView';
import './index.css';

function App() {
  const [activeView, setActiveView] = useState('single_crawl');

  const renderActiveView = () => {
    switch (activeView) {
      case 'single_crawl':
        return <SingleCrawlView />;
      case 'link_collector':
        return (
          <PlaceholderView
            title="Link Collector"
            description="Collect all internal and external links from a target site and map out its structure."
          />
        );
      case 'batch_crawl':
        return (
          <PlaceholderView
            title="Batch Crawl"
            description="Run high-volume parallel scraping operations across multiple URLs or domains."
          />
        );
      case 'llm_analyzer':
        return <LLMAnalyzerView />;
      case 'settings':
        return (
          <PlaceholderView
            title="Settings"
            description="Manage your API keys, crawler configurations, and default LLM preferences."
          />
        );
      default:
        return <SingleCrawlView />;
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="dashboard-main-content">
        {renderActiveView()}
      </main>
    </div>
  );
}

export default App;
