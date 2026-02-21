import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import SingleCrawlView from './components/SingleCrawlView';
import LinkCollectorView from './components/LinkCollectorView';
import BatchCrawlView from './components/BatchCrawlView';
import PlaceholderView from './components/PlaceholderView';
import LLMAnalyzerView from './components/LLMAnalyzerView';
import LLMBatchView from './components/LLMBatchView';
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

  return (
    <div className="dashboard-layout">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="dashboard-main-content">
        <div style={{ display: activeView === 'single_crawl' || activeView === 'default' ? 'block' : 'none', height: '100%' }}>
          <SingleCrawlView />
        </div>
        <div style={{ display: activeView === 'link_collector' ? 'block' : 'none', height: '100%' }}>
          <LinkCollectorView onBatchCrawl={handleBatchCrawl} />
        </div>
        <div style={{ display: activeView === 'batch_crawl' ? 'block' : 'none', height: '100%' }}>
          <BatchCrawlView
            initialLinks={batchLinks}
            onClearBatchLinks={() => setBatchLinks([])}
          />
        </div>
        <div style={{ display: activeView === 'llm_analyzer' ? 'block' : 'none', height: '100%' }}>
          <LLMAnalyzerView />
        </div>
        <div style={{ display: activeView === 'llm_batch' ? 'block' : 'none', height: '100%' }}>
          <LLMBatchView />
        </div>
        <div style={{ display: activeView === 'settings' ? 'block' : 'none', height: '100%' }}>
          <PlaceholderView
            title="Settings"
            description="Manage your API keys, crawler configurations, and default LLM preferences."
          />
        </div>
      </main>
    </div>
  );
}

export default App;

