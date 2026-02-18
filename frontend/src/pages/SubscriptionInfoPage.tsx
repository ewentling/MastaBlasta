import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Crown, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

const SubscriptionInfoPage: React.FC = () => {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const tiers = [
    {
      name: 'STARTER',
      price: 29,
      icon: Zap,
      color: 'blue',
      description: 'Perfect for individuals and small teams',
      features: [
        '100 posts per month',
        '3 accounts per platform',
        'AI-powered content suggestions',
        'Basic analytics',
        'Email support',
        'Schedule posts',
        'Content calendar',
      ],
    },
    {
      name: 'PRO',
      price: 99,
      icon: Crown,
      color: 'purple',
      badge: 'Most Popular',
      description: 'Best for growing businesses',
      features: [
        '1,000 posts per month',
        '10 accounts per platform',
        'Advanced AI features',
        'Advanced analytics & reports',
        'Social listening',
        'Priority email support',
        'Custom scheduling',
        'Team collaboration',
        'API access',
      ],
    },
    {
      name: 'ENTERPRISE',
      price: 299,
      icon: TrendingUp,
      color: 'yellow',
      badge: 'Best Value',
      description: 'For large teams and agencies',
      features: [
        'Unlimited posts',
        'Unlimited accounts',
        'All PRO features',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee',
        'Phone support',
        'White-label options',
        'Custom AI training',
        'Advanced security',
      ],
    },
  ];

  const comparisonFeatures = [
    { name: 'Posts per month', starter: '100', pro: '1,000', enterprise: 'Unlimited' },
    { name: 'Accounts per platform', starter: '3', pro: '10', enterprise: 'Unlimited' },
    { name: 'AI Content Suggestions', starter: true, pro: true, enterprise: true },
    { name: 'Basic Analytics', starter: true, pro: true, enterprise: true },
    { name: 'Advanced Analytics', starter: false, pro: true, enterprise: true },
    { name: 'Social Listening', starter: false, pro: true, enterprise: true },
    { name: 'Team Collaboration', starter: false, pro: true, enterprise: true },
    { name: 'API Access', starter: false, pro: true, enterprise: true },
    { name: 'Priority Support', starter: false, pro: true, enterprise: true },
    { name: 'Custom Integrations', starter: false, pro: false, enterprise: true },
    { name: 'Dedicated Manager', starter: false, pro: false, enterprise: true },
    { name: 'SLA Guarantee', starter: false, pro: false, enterprise: true },
  ];

  const faqs = [
    {
      question: 'How does billing work?',
      answer: 'All plans are billed monthly. You can upgrade, downgrade, or cancel anytime.',
    },
    {
      question: 'Can I change my plan later?',
      answer: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards through Square, our secure payment processor.',
    },
    {
      question: 'Is there a free trial?',
      answer: 'We no longer offer a free tier, but you can cancel within the first month for a full refund if not satisfied.',
    },
    {
      question: 'What happens if I exceed my limits?',
      answer: 'You\'ll receive notifications when approaching your limits. You can upgrade anytime to increase limits.',
    },
    {
      question: 'Can I cancel anytime?',
      answer: 'Yes, you can cancel your subscription at any time. No long-term contracts required.',
    },
  ];

  const handleSubscribe = async (tierName: string) => {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      // Not logged in - prompt to login/register
      navigate('/login', { state: { from: '/subscription-info', tier: tierName } });
      return;
    }

    try {
      // Create Square checkout session
      const response = await fetch('/api/square/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ tier: tierName.toLowerCase() }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      
      // Redirect to Square checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Failed to start subscription process. Please try again.');
    }
  };

  const getColorClasses = (color: string) => {
    const colors = {
      blue: {
        bg: 'bg-blue-600',
        hover: 'hover:bg-blue-700',
        text: 'text-blue-600',
        border: 'border-blue-200',
        badge: 'bg-blue-100 text-blue-800',
      },
      purple: {
        bg: 'bg-purple-600',
        hover: 'hover:bg-purple-700',
        text: 'text-purple-600',
        border: 'border-purple-200',
        badge: 'bg-purple-100 text-purple-800',
      },
      yellow: {
        bg: 'bg-yellow-500',
        hover: 'hover:bg-yellow-600',
        text: 'text-yellow-600',
        border: 'border-yellow-200',
        badge: 'bg-yellow-100 text-yellow-800',
      },
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4">
            Choose Your Perfect Plan
          </h1>
          <p className="text-xl text-blue-100 mb-8">
            Start managing social media like a pro. No free tier - all plans include premium features.
          </p>
          <div className="inline-flex items-center bg-white bg-opacity-20 rounded-lg px-6 py-3 text-sm">
            <Check className="w-5 h-5 mr-2" />
            30-day money-back guarantee
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 mb-16">
        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const colors = getColorClasses(tier.color);
            
            return (
              <div
                key={tier.name}
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden transform transition-all hover:scale-105 ${
                  tier.badge ? 'ring-4 ring-purple-500 ring-opacity-50' : ''
                }`}
              >
                {/* Badge */}
                {tier.badge && (
                  <div className={`${colors.badge} text-center py-2 px-4 text-sm font-semibold`}>
                    {tier.badge}
                  </div>
                )}

                <div className="p-8">
                  {/* Icon */}
                  <div className={`inline-flex p-3 rounded-xl ${colors.bg} bg-opacity-10 mb-4`}>
                    <Icon className={`w-8 h-8 ${colors.text}`} />
                  </div>

                  {/* Title & Price */}
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {tier.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4 min-h-[48px]">
                    {tier.description}
                  </p>
                  <div className="mb-6">
                    <span className="text-5xl font-bold text-gray-900 dark:text-white">
                      ${tier.price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">/month</span>
                  </div>

                  {/* Subscribe Button */}
                  <button
                    onClick={() => handleSubscribe(tier.name)}
                    className={`w-full ${colors.bg} ${colors.hover} text-white py-3 px-6 rounded-lg font-semibold transition-colors mb-6`}
                  >
                    Get Started
                  </button>

                  {/* Features */}
                  <ul className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 dark:text-gray-300 text-sm">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-6xl mx-auto px-4 mb-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
          Feature Comparison
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Feature
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                    Starter
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                    Pro
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {comparisonFeatures.map((feature, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                      {feature.name}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {typeof feature.starter === 'boolean' ? (
                        feature.starter ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )
                      ) : (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {feature.starter}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {typeof feature.pro === 'boolean' ? (
                        feature.pro ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )
                      ) : (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {feature.pro}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {typeof feature.enterprise === 'boolean' ? (
                        feature.enterprise ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )
                      ) : (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {feature.enterprise}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 mb-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="font-semibold text-gray-900 dark:text-white">
                  {faq.question}
                </span>
                {expandedFaq === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              {expandedFaq === index && (
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-gray-700 dark:text-gray-300">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Transform Your Social Media Strategy?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of businesses already using MastaBlasta
          </p>
          <button
            onClick={() => navigate('/login')}
            className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
          >
            Get Started Today
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionInfoPage;
