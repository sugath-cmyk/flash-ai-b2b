import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ChatWidget from '../components/ChatWidget';

export default function Storefront() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // The Body Shop store ID and API key
  const STORE_ID = '7caf971a-d60a-4741-b1e3-1def8e738e45';
  const API_KEY = 'sk_be0c27126807212efa23820f99563ac40b9b9aba2f4f8a02';

  useEffect(() => {
    loadProducts();
    loadChatWidget();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/brand/${STORE_ID}/products`);
      if (response.data.success) {
        setProducts(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChatWidget = () => {
    // Widget configuration would be loaded here
    // For now, we'll simulate the widget
    console.log('Chat widget loaded for store:', STORE_ID);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">The Body Shop</h1>
                <p className="text-sm text-gray-500">Natural Beauty & Wellness</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </button>
              <button className="text-gray-600 hover:text-gray-900 relative">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">0</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Natural Beauty, Ethically Sourced</h2>
          <p className="text-xl mb-8 text-green-50">Discover our collection of vegan, cruelty-free products</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
              </svg>
              <span>100% Vegan</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
              </svg>
              <span>Cruelty-Free</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
              </svg>
              <span>Ethically Sourced</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-white border-b sticky top-[72px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            <button className="py-4 px-2 border-b-2 border-green-600 text-green-600 font-medium whitespace-nowrap">
              All Products
            </button>
            <button className="py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap">
              Face Care
            </button>
            <button className="py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap">
              Hair Care
            </button>
            <button className="py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap">
              Serums
            </button>
            <button className="py-4 px-2 border-b-2 border-transparent text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap">
              Bestsellers
            </button>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Loading products...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                All Products <span className="text-gray-500 font-normal text-lg">({products.length})</span>
              </h2>
              <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                <option>Sort by: Featured</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Newest First</option>
                <option>Best Selling</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <svg className="w-20 h-20 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-medium text-green-600 mb-1">{product.vendor}</p>
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-green-600 transition">
                      {product.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xl font-bold text-gray-900">${product.price}</span>
                        {product.compare_at_price && (
                          <span className="text-sm text-gray-500 line-through ml-2">${product.compare_at_price}</span>
                        )}
                      </div>
                      <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition">
                        Add
                      </button>
                    </div>
                    {product.tags && product.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {product.tags.slice(0, 3).map((tag: string, idx: number) => (
                          <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Product Quick View Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedProduct(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="grid md:grid-cols-2 gap-8 p-8">
              <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                <svg className="w-32 h-32 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-green-600 mb-2">{selectedProduct.vendor}</p>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">{selectedProduct.title}</h2>
                <div className="flex items-center mb-6">
                  <span className="text-3xl font-bold text-gray-900">${selectedProduct.price}</span>
                  {selectedProduct.compare_at_price && (
                    <span className="text-xl text-gray-500 line-through ml-3">${selectedProduct.compare_at_price}</span>
                  )}
                </div>
                <p className="text-gray-600 mb-6">{selectedProduct.description}</p>
                {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Tags:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.tags.map((tag: string, idx: number) => (
                        <span key={idx} className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  <button className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-green-700 transition">
                    Add to Cart
                  </button>
                  <button className="w-full bg-gray-100 text-gray-900 py-4 rounded-xl font-semibold text-lg hover:bg-gray-200 transition">
                    Buy Now
                  </button>
                </div>
                <div className="mt-6 text-sm text-gray-600">
                  <p>✓ Free shipping on orders over $50</p>
                  <p>✓ 30-day returns</p>
                  <p>✓ Secure checkout</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Widget Button (Placeholder) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button className="bg-green-600 text-white p-4 rounded-full shadow-2xl hover:bg-green-700 transition hover:scale-110 transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
        </button>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4">Shop</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">Face Care</a></li>
                <li><a href="#" className="hover:text-white">Hair Care</a></li>
                <li><a href="#" className="hover:text-white">Body Care</a></li>
                <li><a href="#" className="hover:text-white">Bestsellers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Help</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">Shipping</a></li>
                <li><a href="#" className="hover:text-white">Returns</a></li>
                <li><a href="#" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">About</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">Our Story</a></li>
                <li><a href="#" className="hover:text-white">Sustainability</a></li>
                <li><a href="#" className="hover:text-white">Fair Trade</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Connect</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">Instagram</a></li>
                <li><a href="#" className="hover:text-white">Facebook</a></li>
                <li><a href="#" className="hover:text-white">Twitter</a></li>
                <li><a href="#" className="hover:text-white">YouTube</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
            <p>© 2024 The Body Shop. All rights reserved. | Privacy Policy | Terms of Service</p>
          </div>
        </div>
      </footer>

      {/* Chat Widget */}
      <ChatWidget apiKey={API_KEY} storeId={STORE_ID} />
    </div>
  );
}
