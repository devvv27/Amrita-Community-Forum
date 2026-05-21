import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Filter, Loader, AlertCircle } from 'lucide-react';
import Card from "../components/Card";
import Button from "../components/Button";
import Badge from "../components/Badge";

export default function AdvancedSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ tasks: [], posts: [], people: [], total: 0 });
  const [facets, setFacets] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState([]);
  const [requestMessage, setRequestMessage] = useState('');
  
  // Filter state
  const [filters, setFilters] = useState({
    types: ['tasks', 'posts', 'people'],
    difficulty: '',
    minBudget: '',
    maxBudget: '',
    skills: [],
    status: '',
  });

  // Fetch suggestions as user types
  useEffect(() => {
    if (query.length > 2) {
      const timer = setTimeout(async () => {
        try {
          const response = await axios.get(`/api/search/suggestions?q=${query}`);
          setSuggestions(response.data.suggestions);
        } catch (err) {
          console.error('Error fetching suggestions:', err);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
    }
  }, [query]);

  // Fetch facets when query changes
  useEffect(() => {
    if (query.length > 2) {
      const timer = setTimeout(async () => {
        try {
          const response = await axios.get(`/api/search/facets?q=${query}`);
          setFacets(response.data);
        } catch (err) {
          console.error('Error fetching facets:', err);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [query]);

  // Load saved searches
  useEffect(() => {
    const loadSavedSearches = async () => {
      try {
        const response = await axios.get('/api/search/saved');
        setSavedSearches(response.data.searches);
      } catch (err) {
        console.error('Error loading saved searches:', err);
      }
    };
    loadSavedSearches();
  }, []);

  const performSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        q: query,
        types: filters.types.join(','),
        ...(filters.difficulty && { difficulty: filters.difficulty }),
        ...(filters.minBudget && { minBudget: filters.minBudget }),
        ...(filters.maxBudget && { maxBudget: filters.maxBudget }),
        ...(filters.skills.length > 0 && { skills: filters.skills.join(',') }),
        ...(filters.status && { status: filters.status }),
      });

      const response = await axios.get(`/api/search?${params}`);
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentSearch = async (name) => {
    try {
      await axios.post('/api/search/saved', {
        name,
        query,
        filters,
      });
      alert('Search saved!');
      // Reload saved searches
      const response = await axios.get('/api/search/saved');
      setSavedSearches(response.data.searches);
    } catch (err) {
      alert('Error saving search: ' + err.response?.data?.message);
    }
  };

  const loadSavedSearch = (search) => {
    setQuery(search.query);
    setFilters(search.filters);
  };

  const toggleFilter = (type) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type]
    }));
  };

  const toggleSkillFilter = (skill) => {
    setFilters(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1a1f3a] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Advanced Search</h1>
          <p className="text-gray-400">Discover tasks, discussions, and people across the platform</p>
        </div>

        {/* Search Bar */}
        <form onSubmit={performSearch} className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, discussions, people, and skills..."
              className="w-full pl-12 pr-4 py-3 bg-[#1a1f3a] text-white placeholder-gray-500 rounded-lg border border-cyan-500/30 focus:border-cyan-500 focus:outline-none transition"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1f3a] border border-cyan-500/30 rounded-lg shadow-lg z-10">
                {suggestions.slice(0, 5).map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(suggestion.suggestion);
                      setSuggestions([]);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 transition"
                  >
                    {suggestion.suggestion}
                    <span className="text-xs text-gray-500 ml-2">({suggestion.type})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <div className="w-80 flex-shrink-0">
            <Button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center gap-2 px-4 py-3 bg-[#1a1f3a] text-cyan-400 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/10 transition mb-4 md:hidden"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>

            <div className={`${showFilters ? 'block' : 'hidden'} md:block space-y-4`}>
              {/* Result Type Filters */}
              <div className="bg-[#1a1f3a] rounded-lg border border-cyan-500/20 p-4">
                <h3 className="text-sm font-semibold text-cyan-400 mb-3">Result Types</h3>
                {['tasks', 'posts', 'people'].map(type => (
                  <label key={type} className="flex items-center gap-2 text-sm text-gray-400 mb-2 cursor-pointer hover:text-gray-300">
                    <input
                      type="checkbox"
                      checked={filters.types.includes(type)}
                      onChange={() => toggleFilter(type)}
                      className="w-4 h-4 rounded"
                    />
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </label>
                ))}
              </div>

              {/* Difficulty Filter */}
              {facets.difficulties && facets.difficulties.length > 0 && (
                <div className="bg-[#1a1f3a] rounded-lg border border-cyan-500/20 p-4">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-3">Difficulty</h3>
                  {facets.difficulties.map(d => (
                    <label key={d.difficulty} className="flex items-center justify-between text-sm text-gray-400 mb-2 cursor-pointer hover:text-gray-300">
                      <span>{d.difficulty}</span>
                      <span className="text-xs text-gray-600">({d.count})</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Budget Range Filter */}
              <div className="bg-[#1a1f3a] rounded-lg border border-cyan-500/20 p-4">
                <h3 className="text-sm font-semibold text-cyan-400 mb-3">Budget Range</h3>
                <input
                  type="number"
                  value={filters.minBudget}
                  onChange={(e) => setFilters({ ...filters, minBudget: e.target.value })}
                  placeholder="Min"
                  className="w-full px-2 py-1 mb-2 bg-[#0f172a] text-white text-sm rounded border border-cyan-500/20 focus:border-cyan-500 outline-none"
                />
                <input
                  type="number"
                  value={filters.maxBudget}
                  onChange={(e) => setFilters({ ...filters, maxBudget: e.target.value })}
                  placeholder="Max"
                  className="w-full px-2 py-1 bg-[#0f172a] text-white text-sm rounded border border-cyan-500/20 focus:border-cyan-500 outline-none"
                />
              </div>

              {/* Skills Filter */}
              {facets.skills && facets.skills.length > 0 && (
                <div className="bg-[#1a1f3a] rounded-lg border border-cyan-500/20 p-4">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-3">Skills</h3>
                  {facets.skills.slice(0, 8).map(s => (
                    <label key={s.skill} className="flex items-center justify-between text-sm text-gray-400 mb-2 cursor-pointer hover:text-gray-300">
                      <span>{s.skill}</span>
                      <span className="text-xs text-gray-600">({s.count})</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Saved Searches */}
              {savedSearches.length > 0 && (
                <div className="bg-[#1a1f3a] rounded-lg border border-cyan-500/20 p-4">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-3">Saved Searches</h3>
                  {savedSearches.map(search => (
                    <Button
                      key={search.id}
                      type="button"
                      onClick={() => loadSavedSearch(search)}
                      className="w-full text-left text-sm text-gray-400 px-2 py-1 rounded hover:bg-cyan-500/10 hover:text-cyan-400 transition mb-1"
                    >
                      {search.name}
                    </Button>
                  ))}
                </div>
              )}

              {/* Save Current Search */}
              {query && (
                <Button
                  type="button"
                  onClick={() => {
                    const name = prompt('Search name:');
                    if (name) saveCurrentSearch(name);
                  }}
                  className="w-full px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition text-sm font-medium"
                >
                  Save Search
                </Button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1">
            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2 text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-6 h-6 text-cyan-400 animate-spin" />
              </div>
            )}

            {!loading && results.total === 0 && query && (
              <div className="text-center py-12 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p>No results found for "{query}"</p>
              </div>
            )}

            {results.tasks.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-cyan-400 mb-4">Tasks ({results.tasks.length})</h2>
                <div className="space-y-3">
                  {results.tasks.map(task => (
                    <Card key={task.id} className="rounded-lg p-4 hover:border-cyan-500/50 transition bg-[#1a1f3a] border-cyan-500/20">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white hover:text-cyan-400 cursor-pointer">{task.title}</h3>
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{task.description}</p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Badge tone="neon" className="text-xs px-2 py-1">{task.difficulty}</Badge>
                            <Badge className="text-xs px-2 py-1">${task.budget.toLocaleString()}</Badge>
                            {task.complexity_score && (
                              <Badge tone="pink" className="text-xs px-2 py-1">Complexity: {task.complexity_score.toFixed(1)}/10</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          {task.views} views
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {results.posts.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-cyan-400 mb-4">Discussions ({results.posts.length})</h2>
                <div className="space-y-3">
                  {results.posts.map(post => (
                    <Card key={post.id} className="rounded-lg p-4 hover:border-cyan-500/50 transition bg-[#1a1f3a] border-cyan-500/20">
                      <h3 className="font-semibold text-white hover:text-cyan-400 cursor-pointer">{post.title}</h3>
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">{post.content}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs text-gray-500">by {post.author_name}</span>
                        <span className="text-xs text-gray-500">Score: {post.score}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {results.people.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-cyan-400 mb-4">People ({results.people.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {results.people.map(person => (
                    <Card key={person.id} className="rounded-lg p-4 hover:border-cyan-500/50 transition bg-[#1a1f3a] border-cyan-500/20">
                      <h3 className="font-semibold text-white hover:text-cyan-400 cursor-pointer">{person.name}</h3>
                      <p className="text-xs text-gray-500">{person.email}</p>
                      <div className="flex gap-2 mt-2 text-xs text-gray-400">
                        <span>⭐ {person.reputation}</span>
                        {person.tasks_completed && <span>✓ {person.tasks_completed} tasks</span>}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {query && results.total === 0 && !loading && (
              <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4">
                <h2 className="text-lg font-semibold text-text">No results found</h2>
                <p className="mt-1 text-sm text-text/60">Try a different keyword or loosen your filters.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
