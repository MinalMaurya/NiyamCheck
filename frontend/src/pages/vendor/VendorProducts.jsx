import React, { useEffect, useState } from 'react';
import {
  Package,
  Search,
  Filter,
  PlusCircle,
  ShieldCheck,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  AlertCircle,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { listProducts, deleteProduct } from '../../api/products';
import { getVendorContext } from '../../context/vendorContext';
import { StatusBadge } from '../../components/StatusBadge';
import { AddProductModal, PRODUCT_CATEGORIES } from './AddProductModal';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All Statuses' },
  { id: 'NOT_CHECKED', label: 'Not Checked' },
  { id: 'CHECKED', label: 'Compliant / Checked' },
  { id: 'ISSUES_FOUND', label: 'Issues Found' },
  { id: 'NEEDS_REVIEW', label: 'Needs Review' },
];

export function VendorProducts({ onNavigate, onSelectProduct, onStartCheckForProduct }) {
  const vendor = getVendorContext();

  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProducts({
        vendorId: vendor.vendor_id,
        category: categoryFilter !== 'ALL' ? categoryFilter : null,
        status: statusFilter !== 'ALL' ? statusFilter : null,
        search: searchTerm || null,
      });
      setProducts(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [categoryFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleDelete = async (productId, productName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove "${productName}" from your product catalog?`)) {
      return;
    }
    try {
      await deleteProduct(productId);
      setProducts((prev) => prev.filter((p) => p.product_id !== productId));
    } catch (err) {
      alert(`Failed to delete product: ${err.message}`);
    }
  };

  const handleEdit = (prod, e) => {
    e.stopPropagation();
    setEditingProduct(prod);
    setIsAddModalOpen(true);
  };

  const handleOpenDetails = (productId) => {
    if (onSelectProduct) onSelectProduct(productId);
    onNavigate('vendor_product_details');
  };

  const handleStartCheck = (prod, e) => {
    e.stopPropagation();
    if (onStartCheckForProduct) onStartCheckForProduct(prod);
    onNavigate('vendor_check');
  };

  return (
    <div className="vendor-products-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendor Product Catalog</h1>
          <p className="page-description">
            Manage your registered commodities, track their Legal Metrology compliance statuses, and initiate packaging audits.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchProducts}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingProduct(null);
              setIsAddModalOpen(true);
            }}
          >
            <PlusCircle size={15} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--status-fail-bg)',
            border: '1px solid var(--status-fail-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-fail-text)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Product Name, Brand, SKU, or Code..."
              style={{
                width: '100%',
                padding: '0.55rem 0.85rem 0.55rem 2.2rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '0.55rem 0.85rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="ALL">All Categories</option>
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.55rem 0.85rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            <button type="submit" className="btn btn-secondary btn-sm">
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Products Grid / Table */}
      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spinning" style={{ margin: '0 auto 0.75rem' }} />
          <div>Loading catalog products...</div>
        </div>
      ) : products.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <Package size={42} style={{ margin: '0 auto 1rem', opacity: 0.35 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            No Products Found
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto 1.25rem' }}>
            {searchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'No products match your search or filter criteria. Try resetting filters.'
              : 'Your vendor product catalog is currently empty. Add your first product to start compliance checks.'}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingProduct(null);
              setIsAddModalOpen(true);
            }}
          >
            <PlusCircle size={16} />
            <span>Add First Product</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {products.map((product) => (
            <div
              key={product.product_id}
              className="card card-action"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '1.25rem',
              }}
              onClick={() => handleOpenDetails(product.product_id)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.65rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: 'var(--primary-600)',
                      backgroundColor: 'var(--primary-50)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--primary-100)',
                    }}
                  >
                    {product.category}
                  </span>
                  <StatusBadge status={product.status} size="sm" />
                </div>

                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.25rem',
                    lineHeight: 1.3,
                  }}
                >
                  {product.product_name}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Brand: <strong style={{ color: 'var(--text-secondary)' }}>{product.brand_name}</strong> &bull; Code: {product.product_code}
                </div>

                {product.description && (
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      marginBottom: '1rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {product.description}
                  </p>
                )}
              </div>

              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-subtle)',
                    marginBottom: '0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Checks: {(product.inspection_ids || []).length}</span>
                  <span>
                    Updated: {new Date(product.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title="Edit Product"
                      onClick={(e) => handleEdit(product, e)}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-danger"
                      title="Delete Product"
                      onClick={(e) => handleDelete(product.product_id, product.product_name, e)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetails(product.product_id);
                      }}
                    >
                      <Eye size={13} />
                      <span>Details</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={(e) => handleStartCheck(product, e)}
                    >
                      <ShieldCheck size={13} />
                      <span>Check</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddProductModal
        isOpen={isAddModalOpen}
        initialProduct={editingProduct}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={() => {
          fetchProducts();
        }}
      />
    </div>
  );
}
