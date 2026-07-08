import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageShell } from '../components/layout/page-shell';

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
}

const helpArticles: HelpArticle[] = [
  { id: '1', title: 'Getting Started', description: 'Learn the basics of JengaBooks accounting platform', icon: '🚀', category: 'Basics' },
  { id: '2', title: 'Chart of Accounts', description: 'How to set up and manage your chart of accounts', icon: '📋', category: 'Accounting' },
  { id: '3', title: 'Recording Transactions', description: 'How to record income and expense entries', icon: '📒', category: 'Accounting' },
  { id: '4', title: 'M-Pesa Import', description: 'Import and categorize M-Pesa business transactions', icon: '📱', category: 'Integrations' },
  { id: '5', title: 'eTIMS Compliance', description: 'Submit invoices to KRA eTIMS system', icon: '🧾', category: 'Compliance' },
  { id: '6', title: 'Team Management', description: 'Invite team members and manage permissions', icon: '👥', category: 'Administration' },
  { id: '7', title: 'Reports & Analytics', description: 'Generate profit & loss, balance sheet and more', icon: '📊', category: 'Reports' },
  { id: '8', title: 'Keyboard Shortcuts', description: 'Time-saving shortcuts for power users', icon: '⌨️', category: 'Tips' },
  { id: '9', title: 'Gamification & XP', description: 'How XP rewards and levels work', icon: '🏆', category: 'Features' },
  { id: '10', title: 'Data Export', description: 'Export your accounting data to CSV or PDF', icon: '💾', category: 'Administration' },
];

export function Help() {
  const [search, setSearch] = React.useState('');

  const filtered = search
    ? helpArticles.filter((a) =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.description.toLowerCase().includes(search.toLowerCase())
      )
    : helpArticles;

  const categories = [...new Set(filtered.map((a) => a.category))];

  return (
    <PageShell
      title="Help & Support"
      subtitle="Guides and documentation for JengaBooks"
    >

      {/* Search */}
      <Card>
        <CardContent>
          <input
            type="text"
            placeholder="Search help articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="touch-target h-12 w-full rounded-lg border border-kenya-green-200 bg-white px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark focus:outline-none focus:ring-2 focus:ring-kenya-green-500"
          />
        </CardContent>
      </Card>

      {/* Articles by Category */}
      {categories.map((category) => (
        <div key={category}>
          <h2 className="text-lg font-semibold text-kenya-green-900 dark:text-kenya-green-50 mb-3">{category}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered
              .filter((a) => a.category === category)
              .map((article) => (
                <button
                  key={article.id}
                  className="touch-target flex items-start gap-4 rounded-xl border border-kenya-green-100 p-4 text-left hover:border-kenya-green-300 hover:bg-kenya-green-50/50 dark:border-kenya-green-800 dark:hover:bg-kenya-green-900/20 transition-all"
                >
                  <span className="text-2xl mt-1">{article.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">{article.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{article.description}</p>
                  </div>
                  <span className="text-kenya-green-500 mt-1">→</span>
                </button>
              ))}
          </div>
        </div>
      ))}

      {/* Contact Support */}
      <Card>
        <CardHeader>
          <CardTitle>Need More Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Can't find what you're looking for? Contact our support team for assistance.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" size="lg">Email Support</Button>
            <Button variant="ghost" size="lg">Documentation</Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
