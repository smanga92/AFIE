/**
 * AFIE Intelligence Platform — Application Shell
 *
 * Responsibilities of this file:
 *   1. Routing state — which section, story, and asset are active
 *   2. Composition — assembling navigation and views
 *   3. Placeholder screens for Tier 2 / Tier 3 blueprint sections
 *
 * This file does not contain component definitions, styling, tokens,
 * mock data, or utilities. Those live in their own modules.
 *
 * Blueprint reference: AFIE UX Architecture Blueprint v1.0 (LOCKED)
 * Screen inventory:    §3 — Screen Inventory (Tier 1 implemented, Tier 2+ placeholders)
 */

import { useState, useCallback } from 'react';

import { MOCK_STORIES, MOCK_PIPELINE_STATUS, MOCK_WATCHLIST } from './data/mockData.js';
import { timeAgo } from './utils.js';
import { Sidebar, MobileTabBar } from './components/Navigation.jsx';
import { StoryDetail }           from './components/StoryDetail.jsx';
import { IntelligenceFeed }      from './views/IntelligenceFeed.jsx';
import { AssetOverview, AssetDetail } from './views/AssetViews.jsx';

// ─── PLACEHOLDER SCREEN ───────────────────────────────────────────────────────
// Used for all Tier 2 and Tier 3 blueprint sections.
// Receives a section identity and communicates its future purpose clearly.

function PlaceholderScreen({ icon, title, description }) {
  return (
    <div className="placeholder-screen">
      <div className="placeholder-icon">{icon}</div>
      <div className="placeholder-title">{title}</div>
      <div className="placeholder-sub">{description}</div>
      <div style={{ marginTop: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
        Blueprint Tier 2 — Implementation Pending
      </div>
    </div>
  );
}

// ─── ROOT APPLICATION ─────────────────────────────────────────────────────────

export default function App() {
  const [activeSection, setActiveSection] = useState('feed');
  const [selectedStory, setSelectedStory] = useState(null);
  const [selectedAsset, setSelectedAsset]  = useState(null);

  const stories  = MOCK_STORIES;
  const pipeline = MOCK_PIPELINE_STATUS;
  const watchlist = MOCK_WATCHLIST;

  const breakingCount = stories.filter(s =>
    ['breaking', 'developing'].includes(s.status)
  ).length;

  const handleNav = useCallback((section) => {
    setActiveSection(section);
    setSelectedStory(null);
    setSelectedAsset(null);
  }, []);

  const handleStoryClick = useCallback((story) => {
    setSelectedStory(story);
    setSelectedAsset(null);
  }, []);

  const handleAssetClick = useCallback((symbol) => {
    setSelectedAsset(symbol);
    setSelectedStory(null);
    setActiveSection('assets');
  }, []);

  const handleBack = useCallback(() => {
    setSelectedStory(null);
    setSelectedAsset(null);
  }, []);

  // ── CONTENT ROUTER ──────────────────────────────────────────────────────────
  // Story detail and asset detail take precedence over the active section.

  function renderContent() {
    if (selectedStory) {
      return (
        <StoryDetail
          story={selectedStory}
          onBack={handleBack}
          onAssetClick={handleAssetClick}
        />
      );
    }

    if (selectedAsset && activeSection === 'assets') {
      return (
        <AssetDetail
          symbol={selectedAsset}
          stories={stories}
          onBack={handleBack}
          onStoryClick={handleStoryClick}
        />
      );
    }

    switch (activeSection) {
      case 'feed':
        return (
          <IntelligenceFeed
            stories={stories}
            watchlist={watchlist}
            pipeline={pipeline}
            onStoryClick={handleStoryClick}
            onAssetClick={handleAssetClick}
          />
        );

      case 'assets':
        return (
          <AssetOverview
            stories={stories}
            watchlist={watchlist}
            onAssetClick={handleAssetClick}
          />
        );

      // ── TIER 2 PLACEHOLDERS ────────────────────────────────────────────────
      case 'brief':
        return (
          <PlaceholderScreen
            icon="☀"
            title="Morning Intelligence Brief"
            description="Structured pre-session briefing covering overnight developments, updated stories, and today's watch points. Space reserved for future Current Market Expectations module."
          />
        );

      case 'explore':
        return (
          <PlaceholderScreen
            icon="⊕"
            title="Story Explorer"
            description="Browse all stories by category, asset, status, or time period. Full-text search across stories, facts, sources, and assets."
          />
        );

      case 'archive':
        return (
          <PlaceholderScreen
            icon="◷"
            title="Intelligence Archive"
            description="Complete history of all resolved and completed intelligence stories. Browse by date, asset, or story status at close."
          />
        );

      case 'watch':
        return (
          <PlaceholderScreen
            icon="★"
            title="Watchlist"
            description="Add, remove, and organise your watched assets. Watchlist assets determine which stories AFIE surfaces in your feed."
          />
        );

      case 'sources':
        return (
          <PlaceholderScreen
            icon="⊞"
            title="News Sources"
            description="Manage the news sources AFIE monitors. Enable or disable sources, view reliability tiers, and review article counts."
          />
        );

      case 'ai':
        return (
          <PlaceholderScreen
            icon="◈"
            title="AI Providers"
            description="View and configure the AI model AFIE uses for market reasoning. Switch models or compare outputs from different providers."
          />
        );

      case 'notif':
        return (
          <PlaceholderScreen
            icon="◉"
            title="Alerts"
            description="Configure alerts for story status changes and new stories affecting your watchlist assets."
          />
        );

      case 'settings':
        return (
          <PlaceholderScreen
            icon="◎"
            title="Settings"
            description="Display preferences, timezone, default feed filters, and application configuration."
          />
        );

      default:
        return null;
    }
  }

  return (
    <div className="afie-app">
      <Sidebar
        active={selectedStory ? 'feed' : activeSection}
        onNav={handleNav}
        breakingCount={breakingCount}
        pipeline={pipeline}
      />

      <div className="afie-main">
        {renderContent()}
      </div>

      <MobileTabBar
        active={activeSection}
        onNav={handleNav}
        breakingCount={breakingCount}
      />
    </div>
  );
}
