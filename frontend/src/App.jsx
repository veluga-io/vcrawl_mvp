import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import SingleCrawlView from './components/SingleCrawlView';
import LinkCollectorView from './components/LinkCollectorView';
import BatchCrawlView from './components/BatchCrawlView';
import PlaceholderView from './components/PlaceholderView';
import LLMAnalyzerView from './components/LLMAnalyzerView';
import './index.css';

function App() {
  const [activeView, setActiveView] = useState('single_crawl');
  // Links transferred from Link Collector → Batch Crawl
  const [batchLinks, setBatchLinks] = useState([]);

  const handleBatchCrawl = (selectedLinks) => {
    // Convert Set of hrefs + link objects to {href, text}[]
    setBatchLinks(selectedLinks);
    setActiveView('batch_crawl');
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'single_crawl':
        return <SingleCrawlView />;
      case 'link_collector':
        return <LinkCollectorView onBatchCrawl={handleBatchCrawl} />;
      case 'batch_crawl':
        return (
          <BatchCrawlView
            initialLinks={batchLinks}
            onClearBatchLinks={() => setBatchLinks([])}
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

