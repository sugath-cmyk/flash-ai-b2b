import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProductChatWidget from '../components/ProductChatWidget';

export default function EnhancedProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'how-to-use' | 'ingredients' | 'benefits'>('overview');
  const [showStickyCart, setShowStickyCart] = useState(false);
  const [showChatWidget, setShowChatWidget] = useState(false);

  const STORE_ID = '7caf971a-d60a-4741-b1e3-1def8e738e45';
  const API_KEY = 'sk_be0c27126807212efa23820f99563ac40b9b9aba2f4f8a02';

  useEffect(() => {
    loadProduct();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [productId]);

  // Close chat with Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showChatWidget) {
        setShowChatWidget(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showChatWidget]);

  const handleScroll = () => {
    setShowStickyCart(window.scrollY > 400);
  };

  const loadProduct = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:3000/api/brand/${STORE_ID}/products`);

      if (response.data.success) {
        const foundProduct = response.data.data.find((p: any) => p.id === productId);

        if (foundProduct) {
          setProduct(foundProduct);
        } else {
          navigate('/store');
        }
      }
    } catch (error) {
      console.error('Failed to load product:', error);
      navigate('/store');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const productImages = [
    `https://ui-avatars.com/api/?name=${encodeURIComponent(product.title)}&size=800&background=10b981&color=fff`,
    `https://ui-avatars.com/api/?name=${encodeURIComponent(product.vendor)}&size=800&background=059669&color=fff`,
    `https://ui-avatars.com/api/?name=Product&size=800&background=047857&color=fff`,
  ];

  const rating = 4.5;
  const reviewCount = 127;
  const inStock = product.inventory > 0;
  const discountPercent = product.compare_at_price
    ? Math.round(((parseFloat(product.compare_at_price) - parseFloat(product.price)) / parseFloat(product.compare_at_price)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/store')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-medium">Back to Store</span>
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">The Body Shop</span>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Add to Cart Bar */}
      {showStickyCart && (
        <div className="fixed top-0 left-0 right-0 bg-white border-b shadow-lg z-50 animate-slide-down">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <img src={productImages[0]} alt={product.title} className="w-12 h-12 rounded-lg object-cover" />
                <div>
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{product.title}</h3>
                  <p className="text-sm text-emerald-600 font-bold">${product.price}</p>
                </div>
              </div>
              <button className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200">
                Add to Bag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <button onClick={() => navigate('/store')} className="hover:text-emerald-600">Home</button>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>{product.product_type || 'Products'}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-900 font-medium line-clamp-1">{product.title}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column - Product Images & Info */}
          <div className="space-y-8">
            {/* Image Gallery */}
            <div>
              {/* Main Image */}
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl overflow-hidden mb-4 aspect-square">
                <img
                  src={productImages[selectedImage]}
                  alt={product.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Thumbnails */}
              <div className="flex space-x-2">
                {productImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === idx
                        ? 'border-emerald-500 ring-2 ring-emerald-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Tabs */}
            <div className="bg-white rounded-2xl border border-gray-200">
              {/* Tab Headers */}
              <div className="border-b border-gray-200">
                <div className="flex overflow-x-auto">
                  {['overview', 'how-to-use', 'ingredients', 'benefits'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                        activeTab === tab
                          ? 'border-emerald-500 text-emerald-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Product Overview</h3>
                    <p className="text-gray-600 leading-relaxed">{product.description}</p>
                    {product.tags && product.tags.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Key Features:</h4>
                        <div className="flex flex-wrap gap-2">
                          {product.tags.map((tag: string, idx: number) => (
                            <span key={idx} className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 text-sm rounded-full">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'how-to-use' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">How to Use</h3>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">1</div>
                        <p className="text-gray-600">Apply a small amount to clean skin.</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">2</div>
                        <p className="text-gray-600">Massage gently in circular motions until absorbed.</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                        <p className="text-gray-600">Use daily for best results. Can be used morning and evening.</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ingredients' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Key Ingredients</h3>
                    <ul className="space-y-2">
                      <li className="flex items-start space-x-2">
                        <span className="text-emerald-600">•</span>
                        <span className="text-gray-600">Natural extracts and botanicals</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-emerald-600">•</span>
                        <span className="text-gray-600">Vitamin-rich formula</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-emerald-600">•</span>
                        <span className="text-gray-600">96% natural origin ingredients</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-emerald-600">•</span>
                        <span className="text-gray-600">Cruelty-free and vegan</span>
                      </li>
                    </ul>
                  </div>
                )}

                {activeTab === 'benefits' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Benefits</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start space-x-3 p-4 bg-emerald-50 rounded-lg">
                        <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <div>
                          <p className="font-semibold text-gray-900">Nourishes Skin</p>
                          <p className="text-sm text-gray-600">Deep hydration for 48 hours</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-4 bg-emerald-50 rounded-lg">
                        <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <div>
                          <p className="font-semibold text-gray-900">Improves Texture</p>
                          <p className="text-sm text-gray-600">Smoother, softer skin</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-4 bg-emerald-50 rounded-lg">
                        <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <div>
                          <p className="font-semibold text-gray-900">Natural Glow</p>
                          <p className="text-sm text-gray-600">Radiant, healthy appearance</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-4 bg-emerald-50 rounded-lg">
                        <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <div>
                          <p className="font-semibold text-gray-900">Gentle Formula</p>
                          <p className="text-sm text-gray-600">Suitable for all skin types</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Purchase & Chat */}
          <div className="space-y-6">
            {/* Product Info Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-24">
              {/* Vendor Badge */}
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-full">
                  {product.vendor}
                </span>
                {inStock && (
                  <span className="inline-flex items-center px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-full">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    In Stock
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-gray-900 mb-3">{product.title}</h1>

              {/* Rating */}
              <div className="flex items-center space-x-2 mb-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm text-gray-600">{rating} ({reviewCount} reviews)</span>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline space-x-3">
                  <span className="text-4xl font-bold text-gray-900">${product.price}</span>
                  {product.compare_at_price && parseFloat(product.compare_at_price) > parseFloat(product.price) && (
                    <>
                      <span className="text-2xl text-gray-400 line-through">${product.compare_at_price}</span>
                      <span className="inline-flex items-center px-2 py-1 bg-red-50 text-red-600 text-sm font-bold rounded">
                        Save {discountPercent}%
                      </span>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">Inclusive of all taxes</p>
              </div>

              {/* Quantity Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="px-6 py-2 font-semibold text-gray-900">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  {product.inventory && (
                    <span className="text-sm text-gray-500">{product.inventory} available</span>
                  )}
                </div>
              </div>


              {/* Subtle Flash AI Widget - Under Quantity */}
              <div
                onClick={() => setShowChatWidget(!showChatWidget)}
                className="mb-4 p-3 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <div>
                      <div className="text-sm font-medium text-gray-700">Ask Anything</div>
                      <div className="text-[9px] text-gray-500">Powered by Flash AI</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add to Cart Button */}
              <button className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 mb-4">
                Add to Bag
              </button>

              {/* Wishlist Button */}
              <button className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:border-emerald-500 hover:text-emerald-600 transition-all duration-200 flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span>Add to Wishlist</span>
              </button>

              {/* Delivery Info */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Free Delivery</p>
                    <p className="text-sm text-gray-600">On orders above $50</p>
                  </div>
                </div>
              </div>

              {/* SKU */}
              {product.sku && (
                <div className="mt-4 text-sm text-gray-500">
                  SKU: {product.sku}
                </div>
              )}
            </div>

        {/* Floating Chat Widget - Right Side Middle */}
        {!showChatWidget && (
          <button
            onClick={() => setShowChatWidget(true)}
            className="fixed right-6 top-1/2 transform -translate-y-1/2 z-50 group"
          >
            <div className="flex items-center space-x-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-3 rounded-full shadow-2xl hover:shadow-emerald-500/50 transition-all duration-300 group-hover:scale-105">
              {/* Pulsing ring */}
              <div className="absolute -inset-1 bg-emerald-400 rounded-full opacity-75 group-hover:opacity-100 animate-ping"></div>

              {/* Icon */}
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>

              {/* Text */}
              <div className="relative text-left">
                <div className="text-sm font-semibold leading-tight">Ask Anything</div>
                <div className="text-[9px] text-white/80 leading-tight">Powered by Flash AI</div>
              </div>
            </div>
          </button>
        )}

        {/* Chat Widget - Bottom Right Corner */}
        {showChatWidget && (
          <div className="fixed bottom-6 right-6 w-96 z-50 animate-slideInRight">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-emerald-200">
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div>
                    <span className="text-white font-semibold text-sm">Flash AI</span>
                    <div className="flex items-center space-x-1">
                      <span className="text-[9px] text-white/70">Powered by</span>
                      <span className="text-[9px] font-semibold text-white">Flash AI</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowChatWidget(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Chat Widget */}
              <ProductChatWidget
                apiKey={API_KEY}
                storeId={STORE_ID}
                product={{
                  id: product.id,
                  title: product.title,
                  description: product.description || '',
                  price: product.price,
                  vendor: product.vendor,
                }}
              />
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
