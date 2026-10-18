import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  FileText, 
  Plus, 
  Upload, 
  Trash2, 
  Edit3, 
  Eye, 
  Download, 
  X, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle,
  FileDown,
  Clock
} from 'lucide-react';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  category: string;
  authorName: string;
  coverImageUrl?: string;
  readTimeMin: number;
  published: boolean;
  publishedAt?: string;
  tags?: string;
  createdAt?: string;
}

interface Material {
  id: number;
  title: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  category: string;
  downloadCount: number;
  published: boolean;
  createdAt?: string;
}

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<'posts' | 'materials'>('posts');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Post Modal State
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('Therapy & Insights');
  const [postAuthor, setPostAuthor] = useState('Dr. Hana Almaz');
  const [postReadTime, setPostReadTime] = useState(4);
  const [postExcerpt, setPostExcerpt] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postTags, setPostTags] = useState('');
  const [postPublished, setPostPublished] = useState(true);
  const [postCoverUrl, setPostCoverUrl] = useState('');
  const [postSaving, setPostSaving] = useState(false);

  // Material Modal State
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [materialCategory, setMaterialCategory] = useState('Clinical Worksheet');
  const [materialFileUrl, setMaterialFileUrl] = useState('');
  const [materialFileName, setMaterialFileName] = useState('');
  const [materialFileSize, setMaterialFileSize] = useState('');
  const [materialFileType, setMaterialFileType] = useState('pdf');
  const [materialPublished, setMaterialPublished] = useState(true);
  const [materialSaving, setMaterialSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Preview Post Modal State
  const [previewPost, setPreviewPost] = useState<BlogPost | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [resPosts, resMaterials] = await Promise.all([
        fetch('/api/admin/posts').then(r => r.json()),
        fetch('/api/admin/materials').then(r => r.json())
      ]);
      setPosts(Array.isArray(resPosts) ? resPosts : []);
      setMaterials(Array.isArray(resMaterials) ? resMaterials : []);
    } catch {
      showToast('Failed to load content', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle File Upload for Materials or Post Covers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'postCover' | 'material') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetch('/api/admin/upload-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: base64,
            fileName: file.name,
            fileType: file.type,
          }),
        });

        const data = await res.json();
        if (res.ok && data.url) {
          if (target === 'postCover') {
            setPostCoverUrl(data.url);
          } else {
            setMaterialFileUrl(data.url);
            setMaterialFileName(file.name);
            setMaterialFileSize(data.fileSize || `${Math.round(file.size / 1024)} KB`);
            setMaterialFileType(data.fileType || 'pdf');
            if (!materialTitle) {
              const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
              setMaterialTitle(cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1));
            }
          }
          showToast('File uploaded successfully!');
        } else {
          showToast(data.error || 'Upload failed', 'error');
        }
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        setUploadingFile(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Blog Post (Create or Edit)
  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle || !postContent) {
      showToast('Title and content are required.', 'error');
      return;
    }

    setPostSaving(true);
    try {
      const payload = {
        title: postTitle,
        category: postCategory,
        authorName: postAuthor,
        readTimeMin: Number(postReadTime) || 4,
        excerpt: postExcerpt,
        content: postContent,
        tags: postTags,
        published: postPublished,
        coverImageUrl: postCoverUrl || undefined,
      };

      const url = editingPost ? `/api/admin/posts/${editingPost.id}` : '/api/admin/posts';
      const method = editingPost ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(editingPost ? 'Article updated.' : 'Article published!');
        setPostModalOpen(false);
        setEditingPost(null);
        resetPostForm();
        loadData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save article', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setPostSaving(false);
    }
  };

  // Save Material (Create or Edit)
  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialTitle || !materialFileUrl) {
      showToast('Title and file are required.', 'error');
      return;
    }

    setMaterialSaving(true);
    try {
      const payload = {
        title: materialTitle,
        description: materialDescription,
        fileUrl: materialFileUrl,
        fileName: materialFileName || 'document.pdf',
        fileSize: materialFileSize || '1.0 MB',
        fileType: materialFileType || 'pdf',
        category: materialCategory,
        published: materialPublished,
      };

      const url = editingMaterial ? `/api/admin/materials/${editingMaterial.id}` : '/api/admin/materials';
      const method = editingMaterial ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(editingMaterial ? 'Material updated.' : 'Material added!');
        setMaterialModalOpen(false);
        setEditingMaterial(null);
        resetMaterialForm();
        loadData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save material', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setMaterialSaving(false);
    }
  };

  const handleDeletePost = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      const res = await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Article deleted.');
        setPosts(posts.filter(p => p.id !== id));
      } else {
        showToast('Failed to delete article', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteMaterial = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete material "${title}"?`)) return;
    try {
      const res = await fetch(`/api/admin/materials/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Material deleted.');
        setMaterials(materials.filter(m => m.id !== id));
      } else {
        showToast('Failed to delete material', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleTogglePublishPost = async (post: BlogPost) => {
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !post.published }),
      });
      if (res.ok) {
        showToast(`Article ${!post.published ? 'published' : 'moved to drafts'}.`);
        setPosts(posts.map(p => p.id === post.id ? { ...p, published: !post.published } : p));
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleTogglePublishMaterial = async (material: Material) => {
    try {
      const res = await fetch(`/api/admin/materials/${material.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !material.published }),
      });
      if (res.ok) {
        showToast(`Material ${!material.published ? 'published' : 'hidden'}.`);
        setMaterials(materials.map(m => m.id === material.id ? { ...m, published: !material.published } : m));
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const resetPostForm = () => {
    setPostTitle('');
    setPostCategory('Therapy & Insights');
    setPostAuthor('Dr. Hana Almaz');
    setPostReadTime(4);
    setPostExcerpt('');
    setPostContent('');
    setPostTags('');
    setPostPublished(true);
    setPostCoverUrl('');
  };

  const resetMaterialForm = () => {
    setMaterialTitle('');
    setMaterialDescription('');
    setMaterialCategory('Clinical Worksheet');
    setMaterialFileUrl('');
    setMaterialFileName('');
    setMaterialFileSize('');
    setMaterialFileType('pdf');
    setMaterialPublished(true);
  };

  const openEditPost = (post: BlogPost) => {
    setEditingPost(post);
    setPostTitle(post.title);
    setPostCategory(post.category);
    setPostAuthor(post.authorName);
    setPostReadTime(post.readTimeMin);
    setPostExcerpt(post.excerpt || '');
    setPostContent(post.content);
    setPostTags(post.tags || '');
    setPostPublished(post.published);
    setPostCoverUrl(post.coverImageUrl || '');
    setPostModalOpen(true);
  };

  const openEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setMaterialTitle(material.title);
    setMaterialDescription(material.description || '');
    setMaterialCategory(material.category);
    setMaterialFileUrl(material.fileUrl);
    setMaterialFileName(material.fileName);
    setMaterialFileSize(material.fileSize);
    setMaterialFileType(material.fileType);
    setMaterialPublished(material.published);
    setMaterialModalOpen(true);
  };

  const filteredPosts = posts.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || 
      (p.excerpt && p.excerpt.toLowerCase().includes(search.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase()) || 
      (m.description && m.description.toLowerCase().includes(search.toLowerCase())) ||
      m.category.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'all' || m.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const postCategories = Array.from(new Set(posts.map(p => p.category))).filter(Boolean);
  const materialCategories = Array.from(new Set(materials.map(m => m.category))).filter(Boolean);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1050px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toastMessage.type === 'success' ? '#165b38' : '#9b1c1c',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: 600,
        }}>
          {toastMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', margin: '0 0 4px', color: 'var(--ink)' }}>Psychoeducation & Resources CMS</h1>
          <p style={{ margin: 0, color: 'var(--mut)', fontSize: '14px' }}>
            Publish therapeutic blog articles, upload patient worksheets, guides, and downloadable resources.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'posts' ? (
            <button
              onClick={() => {
                setEditingPost(null);
                resetPostForm();
                setPostModalOpen(true);
              }}
              style={{
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                padding: '9px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus className="w-4 h-4" /> Write New Article
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingMaterial(null);
                resetMaterialForm();
                setMaterialModalOpen(true);
              }}
              style={{
                background: 'var(--acc)',
                color: '#fff',
                border: 'none',
                padding: '9px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Upload className="w-4 h-4" /> Upload New Material
            </button>
          )}
        </div>
      </header>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <button
          onClick={() => {
            setActiveTab('posts');
            setCategoryFilter('all');
          }}
          style={{
            background: activeTab === 'posts' ? 'var(--acc)' : 'var(--card)',
            color: activeTab === 'posts' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '8px 18px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <BookOpen className="w-4 h-4" />
          <span>Blog Articles & Insights ({posts.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('materials');
            setCategoryFilter('all');
          }}
          style={{
            background: activeTab === 'materials' ? 'var(--acc)' : 'var(--card)',
            color: activeTab === 'materials' ? '#fff' : 'var(--ink)',
            border: '1px solid var(--line)',
            padding: '8px 18px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileDown className="w-4 h-4" />
          <span>Patient Materials & Worksheets ({materials.length})</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '1.25rem' }}>
        <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
          <Search className="w-4 h-4" style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--mut)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder={activeTab === 'posts' ? "Search articles by title or keyword..." : "Search materials by title or purpose..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="admin-input"
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter className="w-4 h-4 text-mut" />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="admin-select"
            style={{ minWidth: '180px' }}
          >
            <option value="all">All Categories</option>
            {activeTab === 'posts' 
              ? postCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
              : materialCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
            }
          </select>
        </div>
      </div>

      {/* ================= TAB 1: BLOG ARTICLES ================= */}
      {activeTab === 'posts' && (
        <section>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--mut)' }}>Loading articles...</p>
          ) : filteredPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <BookOpen className="w-10 h-10 text-mut" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 6px', color: 'var(--ink)' }}>No blog articles found</h3>
              <p style={{ color: 'var(--mut)', fontSize: '13px', margin: '0 0 1rem' }}>Write reflective, psychoeducational essays for public visitors.</p>
              <button
                onClick={() => {
                  setEditingPost(null);
                  resetPostForm();
                  setPostModalOpen(true);
                }}
                style={{ background: 'var(--acc)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                Write First Article
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {filteredPosts.map(p => (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: 'var(--off)', color: 'var(--acc)' }}>
                        {p.category}
                      </span>
                      <button
                        onClick={() => handleTogglePublishPost(p)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: p.published ? '#166534' : '#92400e',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.published ? '#22c55e' : '#f59e0b' }} />
                        {p.published ? 'Published' : 'Draft'}
                      </button>
                    </div>

                    <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: 'var(--ink)', lineHeight: 1.4 }}>
                      {p.title}
                    </h3>

                    {p.excerpt && (
                      <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--mut)', lineHeight: 1.5 }}>
                        {p.excerpt.length > 130 ? p.excerpt.slice(0, 130) + '...' : p.excerpt}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--mut)', marginBottom: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock className="w-3.5 h-3.5" /> {p.readTimeMin} min read
                      </span>
                      <span>By {p.authorName}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                    <button
                      onClick={() => setPreviewPost(p)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--acc)', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => openEditPost(p)}
                        style={{ background: 'var(--off)', border: '1px solid var(--line)', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', color: 'var(--ink)' }}
                        title="Edit Article"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePost(p.id, p.title)}
                        style={{ background: 'var(--off)', border: '1px solid #fecaca', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', color: '#dc2626' }}
                        title="Delete Article"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================= TAB 2: PATIENT MATERIALS & DOCUMENTS ================= */}
      {activeTab === 'materials' && (
        <section>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--mut)' }}>Loading materials...</p>
          ) : filteredMaterials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <FileDown className="w-10 h-10 text-mut" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 6px', color: 'var(--ink)' }}>No patient documents or materials uploaded</h3>
              <p style={{ color: 'var(--mut)', fontSize: '13px', margin: '0 0 1rem' }}>Upload clinical guides, reflection worksheets, and PDF materials for clients to download.</p>
              <button
                onClick={() => {
                  setEditingMaterial(null);
                  resetMaterialForm();
                  setMaterialModalOpen(true);
                }}
                style={{ background: 'var(--acc)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                Upload First Material
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredMaterials.map(m => (
                <div
                  key={m.id}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      background: 'var(--off)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--acc)',
                      border: '1px solid var(--line)',
                      flexShrink: 0
                    }}>
                      <FileText className="w-5 h-5" />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: 'var(--off)', color: 'var(--acc)' }}>
                          {m.category}
                        </span>
                        <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{m.title}</strong>
                      </div>
                      {m.description && (
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'var(--mut)', lineHeight: 1.4 }}>
                          {m.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--mut)' }}>
                        <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{m.fileType}</span>
                        <span>·</span>
                        <span>{m.fileSize}</span>
                        <span>·</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Download className="w-3 h-3" /> {m.downloadCount} downloads
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleTogglePublishMaterial(m)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: m.published ? '#166534' : '#92400e',
                        padding: '4px 8px'
                      }}
                    >
                      {m.published ? 'Live' : 'Hidden'}
                    </button>

                    <a
                      href={m.fileUrl}
                      download={m.fileName}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: 'var(--off)',
                        border: '1px solid var(--line)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        color: 'var(--ink)',
                        fontSize: '12px',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>

                    <button
                      onClick={() => openEditMaterial(m)}
                      style={{ background: 'var(--off)', border: '1px solid var(--line)', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', color: 'var(--ink)' }}
                      title="Edit Material"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteMaterial(m.id, m.title)}
                      style={{ background: 'var(--off)', border: '1px solid #fecaca', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', color: '#dc2626' }}
                      title="Delete Material"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================= MODAL: WRITE/EDIT ARTICLE ================= */}
      {postModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setPostModalOpen(false)}>
          <div
            className="admin-modal-card"
            onClick={e => e.stopPropagation()}
            style={{ padding: '1.75rem', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>
                {editingPost ? 'Edit Blog Article' : 'Compose Psychoeducation Article'}
              </h3>
              <button onClick={() => setPostModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePost}>
              <div className="admin-form-group">
                <label className="admin-label">Article Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Navigating Chronic Worry with Somatic Grounding"
                  value={postTitle}
                  onChange={e => setPostTitle(e.target.value)}
                  className="admin-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="admin-form-group">
                  <label className="admin-label">Category</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Therapy & Insights"
                    value={postCategory}
                    onChange={e => setPostCategory(e.target.value)}
                    className="admin-input"
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Estimated Read Time (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={postReadTime}
                    onChange={e => setPostReadTime(Number(e.target.value))}
                    className="admin-input"
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Short Summary / Excerpt</label>
                <textarea
                  rows={2}
                  placeholder="A 1-2 sentence teaser shown on the public landing page card..."
                  value={postExcerpt}
                  onChange={e => setPostExcerpt(e.target.value)}
                  className="admin-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Full Article Content (Markdown / Text) *</label>
                <textarea
                  rows={8}
                  required
                  placeholder="Write clinical reflections, paragraphs, and guidance here..."
                  value={postContent}
                  onChange={e => setPostContent(e.target.value)}
                  className="admin-input"
                  style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="admin-form-group">
                  <label className="admin-label">Author Name</label>
                  <input
                    type="text"
                    value={postAuthor}
                    onChange={e => setPostAuthor(e.target.value)}
                    className="admin-input"
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="anxiety, somatic, resilience"
                    value={postTags}
                    onChange={e => setPostTags(e.target.value)}
                    className="admin-input"
                  />
                </div>
              </div>

              {/* Cover Image Upload */}
              <div className="admin-form-group">
                <label className="admin-label">Cover Image (Optional)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleFileUpload(e, 'postCover')}
                    style={{ fontSize: '12px' }}
                  />
                  {uploadingFile && <span style={{ fontSize: '11px', color: 'var(--mut)' }}>Uploading...</span>}
                </div>
                {postCoverUrl && (
                  <div style={{ marginTop: '8px' }}>
                    <img src={postCoverUrl} alt="Cover Preview" style={{ maxHeight: '80px', borderRadius: '6px', objectFit: 'cover' }} />
                  </div>
                )}
              </div>

              {/* Publish Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '1rem 0' }}>
                <input
                  type="checkbox"
                  id="postPublished"
                  checked={postPublished}
                  onChange={e => setPostPublished(e.target.checked)}
                />
                <label htmlFor="postPublished" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>
                  Publish immediately (Visible to public visitors)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '1rem', borderTop: '1px solid var(--line)' }}>
                <button
                  type="button"
                  onClick={() => setPostModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postSaving}
                  style={{
                    background: 'var(--acc)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {postSaving ? 'Saving...' : editingPost ? 'Update Article' : 'Publish Article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: UPLOAD/EDIT MATERIAL ================= */}
      {materialModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setMaterialModalOpen(false)}>
          <div
            className="admin-modal-card"
            onClick={e => e.stopPropagation()}
            style={{ padding: '1.75rem', maxWidth: '520px', width: '100%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>
                {editingMaterial ? 'Edit Patient Material' : 'Upload Patient Document / Material'}
              </h3>
              <button onClick={() => setMaterialModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial}>
              {/* File Attachment Upload */}
              <div style={{
                border: '2px dashed var(--line)',
                borderRadius: '8px',
                padding: '1.25rem',
                textAlign: 'center',
                marginBottom: '1rem',
                background: 'var(--off)'
              }}>
                <Upload className="w-8 h-8 text-mut" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                  {materialFileName ? materialFileName : 'Select PDF or Document to Upload'}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--mut)', marginBottom: '10px' }}>
                  Supported formats: PDF, DOCX, Worksheets, Images (Up to 10 MB)
                </span>
                <input
                  type="file"
                  id="materialFilePicker"
                  onChange={e => handleFileUpload(e, 'material')}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('materialFilePicker')?.click()}
                  disabled={uploadingFile}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {uploadingFile ? 'Uploading...' : materialFileUrl ? 'Replace File' : 'Browse Files'}
                </button>
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Material Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily Compassionate Thought-Record Worksheet"
                  value={materialTitle}
                  onChange={e => setMaterialTitle(e.target.value)}
                  className="admin-input"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Category</label>
                <select
                  value={materialCategory}
                  onChange={e => setMaterialCategory(e.target.value)}
                  className="admin-select"
                >
                  <option value="Clinical Worksheet">Clinical Worksheet</option>
                  <option value="Patient Guide">Patient Guide</option>
                  <option value="Self-Reflection">Self-Reflection</option>
                  <option value="Psychoeducation">Psychoeducation</option>
                  <option value="Clinical Intake & Forms">Clinical Intake & Forms</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Clinical Description / Instructions</label>
                <textarea
                  rows={3}
                  placeholder="Explain how the patient or visitor should utilize this material..."
                  value={materialDescription}
                  onChange={e => setMaterialDescription(e.target.value)}
                  className="admin-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Publish Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '1rem 0' }}>
                <input
                  type="checkbox"
                  id="materialPublished"
                  checked={materialPublished}
                  onChange={e => setMaterialPublished(e.target.checked)}
                />
                <label htmlFor="materialPublished" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>
                  Make available for public download immediately
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '1rem', borderTop: '1px solid var(--line)' }}>
                <button
                  type="button"
                  onClick={() => setMaterialModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--card)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={materialSaving || !materialFileUrl}
                  style={{
                    background: 'var(--acc)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {materialSaving ? 'Saving...' : editingMaterial ? 'Update Material' : 'Save & Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ARTICLE PREVIEW ================= */}
      {previewPost && (
        <div className="admin-modal-backdrop" onClick={() => setPreviewPost(null)}>
          <div
            className="admin-modal-card"
            onClick={e => e.stopPropagation()}
            style={{ padding: '2rem', maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: 'var(--off)', color: 'var(--acc)', marginBottom: '6px', display: 'inline-block' }}>
                  {previewPost.category}
                </span>
                <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--ink)', lineHeight: 1.3 }}>
                  {previewPost.title}
                </h2>
                <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--mut)', display: 'flex', gap: '12px' }}>
                  <span>By {previewPost.authorName}</span>
                  <span>·</span>
                  <span>{previewPost.readTimeMin} min read</span>
                </div>
              </div>
              <button onClick={() => setPreviewPost(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {previewPost.coverImageUrl && (
              <div style={{ marginBottom: '1.25rem', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={previewPost.coverImageUrl} alt={previewPost.title} style={{ width: '100%', maxHeight: '240px', objectFit: 'cover' }} />
              </div>
            )}

            <div style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--ink)', whiteSpace: 'pre-wrap', borderTop: '1px solid var(--line)', paddingTop: '1.25rem' }}>
              {previewPost.content}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--line)' }}>
              <button
                type="button"
                onClick={() => setPreviewPost(null)}
                style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--acc)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
