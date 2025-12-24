import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from '../lib/axios';

interface Product {
  id: string;
  external_id: string;
  title: string;
  description: string;
  short_description: string;
  price: number;
  compare_at_price: number | null;
  currency: string;
  sku: string;
  product_type: string;
  vendor: string;
  handle: string;
  status: string;
  images: any[];
  variants: any[];
  tags: string[];
  created_at: string;
}

interface Collection {
  id: string;
  external_id: string;
  title: string;
  description: string;
  handle: string;
  image_url: string;
  product_count: number;
  created_at: string;
}

interface Page {
  id: string;
  page_type: string;
  title: string;
  content: string;
  url: string;
  handle: string;
  created_at: string;
}

interface Store {
  id: string;
  platform: string;
  store_url: string;
  store_name: string;
  domain: string;
  sync_status: string;
  last_sync: string | null;
  productCount: number;
  collectionCount: number;
  pageCount: number;
  created_at: string;
}

export default function StoreDetails() {
  const { storeId } = useParams<{ storeId: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'collections' | 'pages'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadStore();
  }, [storeId]);

  useEffect(() => {
    loadTabData();
  }, [activeTab, currentPage]);

  const loadStore = async () => {
    try {
      const response = await axios.get(`/stores/${storeId}`);
      setStore(response.data.data);
    } catch (error: any) {
      console.error('Failed to load store:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    if (!storeId) return;

    setDataLoading(true);
    try {
      if (activeTab === 'products') {
        const response = await axios.get(`/stores/${storeId}/products`, {
          params: { page: currentPage, limit: 20 }
        });
        setProducts(response.data.data.products);
        setTotalPages(response.data.data.pagination.totalPages);
      } else if (activeTab === 'collections') {
        const response = await axios.get(`/stores/${storeId}/collections`);
        setCollections(response.data.data);
      } else if (activeTab === 'pages') {
        const response = await axios.get(`/stores/${storeId}/pages`);
        setPages(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Store not found</h2>
          <Link to="/stores" className="text-primary-600 hover:text-primary-700">
            ← Back to stores
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/stores" className="text-sm text-gray-600 hover:text-gray-900 mb-2 block">
            ← Back to Stores
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{store.store_name || store.domain}</h1>
              <a
                href={store.store_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-primary-600"
              >
                {store.store_url} ↗
              </a>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">
                {store.platform}
              </span>
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                {store.sync_status}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Products</div>
            <div className="text-3xl font-bold text-gray-900">{store.productCount}</div>
            <div className="text-xs text-gray-500 mt-1">Extracted products</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Collections</div>
            <div className="text-3xl font-bold text-gray-900">{store.collectionCount}</div>
            <div className="text-xs text-gray-500 mt-1">Product categories</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Pages</div>
            <div className="text-3xl font-bold text-gray-900">{store.pageCount}</div>
            <div className="text-xs text-gray-500 mt-1">Store pages extracted</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => { setActiveTab('products'); setCurrentPage(1); }}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'products'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Products ({store.productCount})
              </button>
              <button
                onClick={() => { setActiveTab('collections'); setCurrentPage(1); }}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'collections'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Collections ({store.collectionCount})
              </button>
              <button
                onClick={() => { setActiveTab('pages'); setCurrentPage(1); }}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'pages'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Pages ({store.pageCount})
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {dataLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading...</p>
              </div>
            ) : (
              <>
                {/* Products Tab */}
                {activeTab === 'products' && (
                  <div className="space-y-4">
                    {products.length === 0 ? (
                      <p className="text-center text-gray-600 py-8">No products found</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {products.map((product) => (
                            <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              {product.images[0] && (
                                <img
                                  src={product.images[0].src}
                                  alt={product.title}
                                  className="w-full h-48 object-cover rounded-lg mb-3"
                                />
                              )}
                              <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                                {product.title}
                              </h3>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg font-bold text-gray-900">
                                  ${product.price.toFixed(2)}
                                </span>
                                {product.compare_at_price && (
                                  <span className="text-sm text-gray-500 line-through">
                                    ${product.compare_at_price.toFixed(2)}
                                  </span>
                                )}
                              </div>
                              {product.vendor && (
                                <p className="text-xs text-gray-600 mb-2">{product.vendor}</p>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {product.tags.slice(0, 3).map((tag, idx) => (
                                  <span key={idx} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                          <div className="flex justify-center items-center gap-2 mt-6">
                            <button
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              className="btn btn-secondary disabled:opacity-50"
                            >
                              Previous
                            </button>
                            <span className="text-sm text-gray-600">
                              Page {currentPage} of {totalPages}
                            </span>
                            <button
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                              className="btn btn-secondary disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Collections Tab */}
                {activeTab === 'collections' && (
                  <div className="space-y-4">
                    {collections.length === 0 ? (
                      <p className="text-center text-gray-600 py-8">No collections found</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {collections.map((collection) => (
                          <div key={collection.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            {collection.image_url && (
                              <img
                                src={collection.image_url}
                                alt={collection.title}
                                className="w-full h-32 object-cover rounded-lg mb-3"
                              />
                            )}
                            <h3 className="font-semibold text-gray-900 mb-2">{collection.title}</h3>
                            {collection.description && (
                              <p className="text-sm text-gray-600 mb-3 line-clamp-3" dangerouslySetInnerHTML={{ __html: collection.description }}></p>
                            )}
                            <p className="text-xs text-gray-500">{collection.product_count} products</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Pages Tab */}
                {activeTab === 'pages' && (
                  <div className="space-y-4">
                    {pages.length === 0 ? (
                      <p className="text-center text-gray-600 py-8">No pages found</p>
                    ) : (
                      <div className="space-y-3">
                        {pages.map((page) => (
                          <div key={page.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-gray-900">{page.title}</h3>
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                                {page.page_type}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mb-3 line-clamp-3" dangerouslySetInnerHTML={{ __html: page.content }}></div>
                            <a
                              href={page.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary-600 hover:text-primary-700"
                            >
                              View original page ↗
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
