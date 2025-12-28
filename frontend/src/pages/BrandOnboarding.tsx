import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function BrandOnboarding() {
  const [formData, setFormData] = useState({
    brandName: '',
    contactName: '',
    email: '',
    phone: '',
    storeUrl: '',
    storePlatform: 'Shopify',
    businessAddress: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'India',
    gstNumber: '',
    monthlyTraffic: '',
    currentSupport: '',
    hearAboutUs: '',
    additionalInfo: '',
    adminUsername: '',
    adminPassword: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [responseData, setResponseData] = useState<any>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await axios.post(`${API_URL}/onboarding/submit`, formData);
      setResponseData(response.data.data);
      setSuccess(true);
      setShowForm(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        @font-face {
          font-family: 'Cal Sans';
          src: url('https://cdn.jsdelivr.net/gh/calcom/font@main/CalSans-SemiBold.woff2') format('woff2');
        }

        * { font-family: 'Inter', sans-serif; }
        .font-display { font-family: 'Cal Sans', 'Inter', sans-serif; }

        .hover-lift {
          transition: all 0.3s ease;
        }

        .hover-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <span className="font-display text-2xl font-bold text-black">AskFlash.ai</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#problem" className="text-gray-600 hover:text-black transition font-medium">Why Now</a>
              <a href="#solution" className="text-gray-600 hover:text-black transition font-medium">Solution</a>
              <a href="#pricing" className="text-gray-600 hover:text-black transition font-medium">Pricing</a>
              <button
                onClick={() => setShowForm(true)}
                className="bg-black text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-800 transition"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Success Modal */}
      {success && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h3>
            <p className="text-gray-600 mb-6">
              Thank you for your interest in AskFlash.ai. Our team will review your application and get back to you within 24 hours.
            </p>
            <button
              onClick={() => {
                setSuccess(false);
                setFormData({
                  brandName: '',
                  contactName: '',
                  email: '',
                  phone: '',
                  storeUrl: '',
                  storePlatform: 'Shopify',
                  businessAddress: '',
                  city: '',
                  state: '',
                  zipCode: '',
                  country: 'India',
                  gstNumber: '',
                  monthlyTraffic: '',
                  currentSupport: '',
                  hearAboutUs: '',
                  additionalInfo: '',
                  adminUsername: '',
                  adminPassword: '',
                });
              }}
              className="bg-black text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Onboarding Form Modal */}
      {showForm && !success && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">Join AskFlash.ai</h2>
                  <p className="text-gray-600 mt-1">Start your 14-day free trial</p>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[calc(100vh-200px)] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              {/* Brand Information */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Brand Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Brand Name *
                    </label>
                    <input
                      type="text"
                      name="brandName"
                      value={formData.brandName}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="Your Brand Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Person *
                    </label>
                    <input
                      type="text"
                      name="contactName"
                      value={formData.contactName}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="Full Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="you@brand.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="+91-XXXXXXXXXX"
                    />
                  </div>
                </div>
              </div>

              {/* Store Information */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Store Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Store URL *
                    </label>
                    <input
                      type="url"
                      name="storeUrl"
                      value={formData.storeUrl}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="https://yourbrand.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Store Platform *
                    </label>
                    <select
                      name="storePlatform"
                      value={formData.storePlatform}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    >
                      <option value="Shopify">Shopify</option>
                      <option value="WooCommerce">WooCommerce</option>
                      <option value="Magento">Magento</option>
                      <option value="BigCommerce">BigCommerce</option>
                      <option value="Custom">Custom</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Traffic
                    </label>
                    <select
                      name="monthlyTraffic"
                      value={formData.monthlyTraffic}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    >
                      <option value="">Select range</option>
                      <option value="<5000">&lt; 5,000</option>
                      <option value="5000-10000">5,000 - 10,000</option>
                      <option value="10000-50000">10,000 - 50,000</option>
                      <option value="50000-100000">50,000 - 100,000</option>
                      <option value="100000+">100,000+</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Support Solution
                    </label>
                    <input
                      type="text"
                      name="currentSupport"
                      value={formData.currentSupport}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="e.g., Email, Phone, Live Chat"
                    />
                  </div>
                </div>
              </div>

              {/* Business Details */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Business Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Address
                    </label>
                    <input
                      type="text"
                      name="businessAddress"
                      value={formData.businessAddress}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="Street Address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="State"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="PIN Code"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GST Number
                    </label>
                    <input
                      type="text"
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="GST Number"
                    />
                  </div>
                </div>
              </div>

              {/* Admin Credentials */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Admin Credentials</h3>
                <p className="text-sm text-gray-600 mb-4">Set up your login credentials for accessing the brand dashboard</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Username *
                    </label>
                    <input
                      type="text"
                      name="adminUsername"
                      value={formData.adminUsername}
                      onChange={handleChange}
                      required
                      minLength={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="Your preferred username (min 3 characters)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Password *
                    </label>
                    <input
                      type="password"
                      name="adminPassword"
                      value={formData.adminPassword}
                      onChange={handleChange}
                      required
                      minLength={8}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="Strong password (min 8 characters)"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Additional Information</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      How did you hear about us?
                    </label>
                    <select
                      name="hearAboutUs"
                      value={formData.hearAboutUs}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    >
                      <option value="">Select an option</option>
                      <option value="Google Search">Google Search</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Twitter">Twitter</option>
                      <option value="Referral">Referral</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tell us about your needs (Optional)
                    </label>
                    <textarea
                      name="additionalInfo"
                      value={formData.additionalInfo}
                      onChange={handleChange}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="What are you hoping to achieve with AskFlash.ai?"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end space-x-4 pt-6 border-t sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-black text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Start Free Trial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center space-x-2 bg-gray-100 text-gray-900 px-4 py-2 rounded-full text-sm font-semibold mb-8 border border-gray-200">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-black opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
              </span>
              <span>The future of conversational shopping is here</span>
            </div>

            <h1 className="font-display text-6xl md:text-8xl font-bold text-black mb-8 leading-tight tracking-tight">
              Turn <span className="text-black underline decoration-4 underline-offset-8">60% of Traffic</span><br/>Into Revenue
            </h1>

            <p className="text-2xl md:text-3xl text-gray-600 mb-6 leading-relaxed font-light">
              The first AI that actually <span className="font-semibold text-black">understands ingredients, builds trust, and converts</span>—without sounding like a bot.
            </p>

            <p className="text-xl text-gray-500 mb-12 font-light">
              While your competitors lose 60% of visitors, your AI agent turns browsers into buyers.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button
                onClick={() => setShowForm(true)}
                className="bg-black text-white px-10 py-5 rounded-xl font-bold text-xl hover:bg-gray-800 transition group"
              >
                See It In Action
                <span className="inline-block ml-2 group-hover:translate-x-1 transition">→</span>
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="bg-white text-black px-10 py-5 rounded-xl font-bold text-xl border-2 border-black hover:bg-black hover:text-white transition"
              >
                5-Minute Setup • No Credit Card
              </button>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-gray-600 font-medium">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                </svg>
                <span>SOC 2 Certified</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                </svg>
                <span>GDPR Compliant</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                </svg>
                <span>99.9% Uptime SLA</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-16 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="p-8 text-center">
              <div className="text-5xl md:text-6xl font-bold mb-3 text-white">20%</div>
              <div className="text-gray-400 font-medium">Conversion Uplift</div>
            </div>
            <div className="p-8 text-center">
              <div className="text-5xl md:text-6xl font-bold mb-3 text-white">33%</div>
              <div className="text-gray-400 font-medium">Higher AOV</div>
            </div>
            <div className="p-8 text-center">
              <div className="text-5xl md:text-6xl font-bold mb-3 text-white">91%</div>
              <div className="text-gray-400 font-medium">Queries Resolved</div>
            </div>
            <div className="p-8 text-center">
              <div className="text-5xl md:text-6xl font-bold mb-3 text-white">175X</div>
              <div className="text-gray-400 font-medium">ROI</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section id="problem" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="font-display text-5xl md:text-6xl font-bold text-black mb-6 tracking-tight">
              The Silent <span className="underline decoration-4 underline-offset-8">Revenue Killer</span>
            </h2>
            <p className="text-2xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
              Every day, 60% of your traffic leaves without buying. Not because your products are wrong—but because they're confused, uncertain, or can't find what they need.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover-lift">
              <div className="text-5xl mb-4">😕</div>
              <h3 className="text-2xl font-bold text-black mb-4">Analysis Paralysis</h3>
              <p className="text-gray-600 mb-6 text-lg leading-relaxed">"Is this safe for my skin type? Can I use this during pregnancy? Will this work with my retinol?"</p>
              <div className="bg-gray-100 rounded-lg p-4 text-sm font-semibold text-black border border-gray-200">
                → 40% abandon due to uncertainty
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover-lift">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold text-black mb-4">Information Overload</h3>
              <p className="text-gray-600 mb-6 text-lg leading-relaxed">156 products, 50+ ingredients, 10 routines. Your customer is drowning in choice.</p>
              <div className="bg-gray-100 rounded-lg p-4 text-sm font-semibold text-black border border-gray-200">
                → 35% leave to "research more"
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover-lift">
              <div className="text-5xl mb-4">⏰</div>
              <h3 className="text-2xl font-bold text-black mb-4">Zero Guidance</h3>
              <p className="text-gray-600 mb-6 text-lg leading-relaxed">No one to ask "how do I use this?" or "what should I buy with this?" at 11 PM.</p>
              <div className="bg-gray-100 rounded-lg p-4 text-sm font-semibold text-black border border-gray-200">
                → 60% of traffic converts at 0%
              </div>
            </div>
          </div>

          <div className="bg-black rounded-3xl p-12 text-white text-center">
            <h3 className="text-4xl font-bold mb-6">The Math is Brutal</h3>
            <div className="max-w-3xl mx-auto">
              <p className="text-2xl mb-6 text-gray-300 leading-relaxed">
                10,000 monthly visitors × 60% lost × ₹1,500 AOV × 3% conversion = <span className="font-bold text-3xl text-white">₹2,70,000 left on the table</span>
              </p>
              <p className="text-xl text-gray-400 leading-relaxed">
                Every single month. That's ₹32 lakhs annually walking away because they couldn't get answers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="solution" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="font-display text-5xl md:text-6xl font-bold text-black mb-6 tracking-tight">
              Meet Your AI Sales Expert
            </h2>
            <p className="text-2xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
              Not a chatbot. A conversational shopping experience that turns every visitor into a guided, confident buyer.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-10 hover-lift">
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center mr-4">
                  <span className="text-3xl">🧬</span>
                </div>
                <h3 className="text-2xl font-bold text-black">Ingredient Intelligence</h3>
              </div>
              <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                50,000+ ingredient database. Instantly answers "Is this safe for pregnancy?" or "Can I use this with retinol?"
              </p>
              <div className="bg-white rounded-xl p-5 border-l-4 border-black">
                <p className="text-sm text-gray-700 leading-relaxed">
                  "I'm pregnant. Is this safe?" → AI scans ingredients in 2 seconds → Flags retinol → Suggests 3 pregnancy-safe alternatives
                </p>
              </div>
            </div>

            <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-10 hover-lift">
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center mr-4">
                  <span className="text-3xl">🔬</span>
                </div>
                <h3 className="text-2xl font-bold text-black">Trust Builder</h3>
              </div>
              <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                Synthesizes clinical studies + 1000s of reviews to answer "Will this actually work for my acne scars?"
              </p>
              <div className="bg-white rounded-xl p-5 border-l-4 border-black">
                <p className="text-sm text-gray-700 leading-relaxed">
                  "84% of customers saw improvement in 5-6 weeks. Clinical study shows 40% reduction in hyperpigmentation." [Shows relevant 5★ review]
                </p>
              </div>
            </div>

            <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-10 hover-lift">
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center mr-4">
                  <span className="text-3xl">📚</span>
                </div>
                <h3 className="text-2xl font-bold text-black">Usage Educator</h3>
              </div>
              <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                Builds complete AM/PM routines. Shows layering order, wait times, and what to expect week-by-week.
              </p>
              <div className="bg-white rounded-xl p-5 border-l-4 border-black">
                <p className="text-sm text-gray-700 leading-relaxed">
                  "Apply after cleansing, wait 30 sec, then moisturizer, then SPF 50+ (mandatory!). Results visible in 4-6 weeks with daily use."
                </p>
              </div>
            </div>

            <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-10 hover-lift">
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center mr-4">
                  <span className="text-3xl">🎯</span>
                </div>
                <h3 className="text-2xl font-bold text-black">Smart Upselling</h3>
              </div>
              <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                "Adding retinol? You'll also need SPF 50+ and a moisturizer." Bundles products that actually work together.
              </p>
              <div className="bg-white rounded-xl p-5 border-l-4 border-black">
                <p className="text-sm text-gray-700 leading-relaxed">
                  "Get all 3 for ₹2,499 (Save ₹498). Complete routine for best results!" → 33% higher AOV
                </p>
              </div>
            </div>
          </div>

          <div className="bg-black rounded-3xl p-12 text-white border-2 border-gray-800">
            <h3 className="font-display text-4xl font-bold mb-10 text-center">Why This Isn't Just Another Chatbot</h3>
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h4 className="text-2xl font-bold mb-6 text-gray-400">❌ Generic Chatbots</h4>
                <ul className="space-y-4 text-lg">
                  <li className="flex items-start">
                    <span className="mr-3 text-gray-400 font-bold">×</span>
                    <span className="text-gray-400">"Let me connect you with support"</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-3 text-gray-400 font-bold">×</span>
                    <span className="text-gray-400">Can't read ingredient lists</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-3 text-gray-400 font-bold">×</span>
                    <span className="text-gray-400">No clinical knowledge</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-3 text-gray-400 font-bold">×</span>
                    <span className="text-gray-400">Generic product suggestions</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-2xl font-bold mb-6 text-white">✓ AskFlash AI</h4>
                <ul className="space-y-4 text-lg">
                  <li className="flex items-start">
                    <span className="mr-3 text-white font-bold">✓</span>
                    <span className="text-white">Answers 91% of queries instantly</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-3 text-white font-bold">✓</span>
                    <span className="text-white">50K+ ingredient safety database</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-3 text-white font-bold">✓</span>
                    <span className="text-white">Cites clinical studies & reviews</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-3 text-white font-bold">✓</span>
                    <span className="text-white">Personalized by skin type & concerns</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-5xl md:text-6xl font-bold text-white mb-8 tracking-tight">
            Ready to Turn Traffic Into Revenue?
          </h2>
          <p className="text-2xl text-gray-400 mb-12 font-light leading-relaxed">
            Join hundreds of beauty & wellness brands using AI to convert 60% more visitors.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-white text-black px-12 py-6 rounded-xl font-bold text-xl hover:bg-gray-100 transition"
          >
            Start Your Free Trial Today
          </button>
          <p className="text-gray-500 mt-6 text-lg font-medium">14-day free trial • No credit card required • 5-minute setup</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t-2 border-gray-200 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <span className="font-display text-2xl font-bold text-black">AskFlash.ai</span>
          </div>
          <p className="text-base text-gray-600 mb-6 font-medium">Conversational Shopping AI for Beauty & Wellness Brands</p>
          <div className="flex justify-center space-x-8 text-sm font-medium">
            <Link to="/login" className="text-gray-600 hover:text-black transition">Admin Login</Link>
            <a href="#" className="text-gray-600 hover:text-black transition">Privacy Policy</a>
            <a href="#" className="text-gray-600 hover:text-black transition">Terms of Service</a>
          </div>
          <p className="text-sm text-gray-500 mt-8">© 2024 AskFlash.ai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
