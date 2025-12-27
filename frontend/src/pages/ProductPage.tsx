import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProductChatWidget from '../components/ProductChatWidget';

export default function ProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);

  const STORE_ID = '7caf971a-d60a-4741-b1e3-1def8e738e45';
  const API_KEY = 'sk_be0c27126807212efa23820f99563ac40b9b9aba2f4f8a02';

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:3000/api/brand/${STORE_ID}/products`);

      if (response.data.success) {
        const foundProduct = response.data.data.find((p: any) => p.id === productId);

        if (foundProduct) {
          setProduct(foundProduct);
        } else {
          console.error('Product not found');
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Product not found</p>
          <button
            onClick={() => navigate('/store')}
            className="mt-4 text-emerald-600 hover:text-emerald-700"
          >
            Back to Store
          </button>
        </div>
      </div>
    );
  }

  // Placeholder images (using gradient backgrounds since we don't have actual images)
  const placeholderImages = [
    `https://ui-avatars.com/api/?name=${encodeURIComponent(product.title)}&size=800&background=10b981&color=fff`,
    `https://ui-avatars.com/api/?name=${encodeURIComponent(product.vendor)}&size=800&background=059669&color=fff`,
    `https://ui-avatars.com/api/?name=Product&size=800&background=047857&color=fff`,
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/store')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span className="font-medium">Back to Store</span>
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">The Body Shop</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Product Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Product Details */}
          <div className="space-y-6">
            {/* Product Images */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="aspect-square bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl mb-4 overflow-hidden">
                <img
                  src={placeholderImages[selectedImage]}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex space-x-2">
                {placeholderImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === idx
                        ? 'border-emerald-500'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              {/* Vendor */}
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                  {product.vendor}
                </span>
                {product.status === 'active' && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    In Stock
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-gray-900 mb-3">{product.title}</h1>

              {/* Product Type */}
              {product.product_type && (
                <p className="text-sm text-gray-500 mb-4">{product.product_type}</p>
              )}

              {/* Price */}
              <div className="flex items-baseline space-x-3 mb-6">
                <span className="text-4xl font-bold text-gray-900">${product.price}</span>
                {product.compare_at_price && parseFloat(product.compare_at_price) > parseFloat(product.price) && (
                  <span className="text-2xl text-gray-400 line-through">
                    ${product.compare_at_price}
                  </span>
                )}
                {product.compare_at_price && parseFloat(product.compare_at_price) > parseFloat(product.price) && (
                  <span className="text-sm font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">
                    Save $
                    {(parseFloat(product.compare_at_price) - parseFloat(product.price)).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
                  <p className="text-gray-600 leading-relaxed">{product.description}</p>
                </div>
              )}

              {/* SKU and Inventory */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {product.sku && (
                  <div>
                    <p className="text-sm text-gray-500">SKU</p>
                    <p className="font-medium text-gray-900">{product.sku}</p>
                  </div>
                )}
                {product.inventory !== null && (
                  <div>
                    <p className="text-sm text-gray-500">Available</p>
                    <p className="font-medium text-gray-900">{product.inventory} units</p>
                  </div>
                )}
              </div>

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {product.tags.map((tag: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Add to Cart Button */}
              <button className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                Add to Cart
              </button>
            </div>
          </div>

          {/* Right Side - Chat Widget */}
          <div className="lg:sticky lg:top-24 lg:self-start">
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
      </div>
    </div>
  );
}
